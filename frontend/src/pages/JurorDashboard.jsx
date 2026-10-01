import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { sampleDisputes, sampleReputation } from "../lib/sampleData.js";
import { useWallet } from "../hooks/useWallet.jsx";
import { useContracts } from "../hooks/useContracts.js";
import { VOTE_LABEL } from "../lib/config.js";

export default function JurorDashboard() {
  const { address, connect } = useWallet();
  const { configured, barazaRegistry, disputeEscrow, reputationSBT } = useContracts();

  const [pending, setPending] = useState([]);
  const [past, setPast] = useState([]);
  const [stats, setStats] = useState(sampleReputation);
  const [loading, setLoading] = useState(false);

  // useEffect(() => {
  //   if (!configured || !address || !barazaRegistry || !disputeEscrow) {
  //     // Demo mode or no wallet connected yet — show the original sample view.
  //     setPending(sampleDisputes.filter((d) => d.status === "Voting"));
  //     setPast(sampleDisputes.filter((d) => d.status === "Resolved"));
  //     setStats(sampleReputation);
  //     return;
  //   }

  useEffect(() => {
    if (!configured) {
      // True demo mode — no contracts deployed yet, so sample data (and its
      // sample links) can't collide with anything real.
      setPending(sampleDisputes.filter((d) => d.status === "Voting"));
      setPast(sampleDisputes.filter((d) => d.status === "Resolved"));
      setStats(sampleReputation);
      return;
    }
    if (!address || !barazaRegistry || !disputeEscrow || !reputationSBT) {
      // Contracts ARE live, but no wallet connected yet. Must NOT fall back
      // to sample data here — a sample "Vote now" link would point at a
      // real dispute URL with unrelated real content, which is exactly the
      // mismatch that was confusing. Show nothing until a real wallet
      // connects, so every link on this page is either real or absent.
      setPending([]);
      setPast([]);
      setStats({ score: 500, timesJuror: 0, juryAccuracy: 0 });
      return;
    }

    setLoading(true);
    (async () => {
      try {
        const circleIds = await barazaRegistry.circlesOf(address);
        const circleNameCache = new Map();

        // Gather every dispute filed in any circle this wallet belongs to.
        const disputeIdsByCircle = await Promise.all(
          circleIds.map(async (circleId) => {
            const filter = disputeEscrow.filters.DisputeFiled(null, circleId);
            const events = await disputeEscrow.queryFilter(filter, 0, "latest");
            return events.map((ev) => ev.args.disputeId);
          })
        );
        const allDisputeIds = disputeIdsByCircle.flat();

        const pendingList = [];
        const pastList = [];

        await Promise.all(
          allDisputeIds.map(async (disputeId) => {
            const jury = await disputeEscrow.getJury(disputeId);
            const isJuror = jury.some((j) => j.toLowerCase() === address.toLowerCase());
            if (!isJuror) return;

            const d = await disputeEscrow.getDispute(disputeId);
            const circleIdStr = d.circleId.toString();
            if (!circleNameCache.has(circleIdStr)) {
              try {
                const c = await barazaRegistry.circles(d.circleId);
                circleNameCache.set(circleIdStr, c.name || `Circle #${circleIdStr}`);
              } catch {
                circleNameCache.set(circleIdStr, `Circle #${circleIdStr}`);
              }
            }
            const circleName = circleNameCache.get(circleIdStr);

            if (Number(d.status) === 2) {
              // Voting
              const voted = await disputeEscrow.hasVoted(disputeId, address).catch(() => false);
              if (!voted) {
                pendingList.push({ id: disputeId.toString(), summary: d.summary, circle: circleName });
              }
            } else if (Number(d.status) === 3) {
              // Resolved
              pastList.push({
                id: disputeId.toString(),
                summary: d.summary,
                circle: circleName,
                outcome: VOTE_LABEL[Number(d.outcome)],
              });
            }
          })
        );

        setPending(pendingList);
        setPast(pastList);

        // Real reputation stats, same source as the Reputation page.
        const tokenId = await reputationSBT.tokenIdOf(address);
        if (tokenId !== 0n) {
          const p = await reputationSBT.profiles(tokenId);
          setStats({
            score: Number(p.score),
            timesJuror: Number(p.timesJuror),
            juryAccuracy: Number(p.juryAccuracy),
          });
        } else {
          setStats({ score: 500, timesJuror: 0, juryAccuracy: 0 });
        }
      } catch (e) {
        console.error("Failed to load juror dashboard from chain:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [configured, address, barazaRegistry, disputeEscrow, reputationSBT]);

  return (
    <div className="mx-auto max-w-4xl px-5 sm:px-8 py-12">
      <p className="label-caps text-marigold-400 mb-2">Community service</p>
      <h1 className="font-display text-3xl text-bone-100 mb-2">Juror dashboard</h1>
      <p className="text-bone-300 mb-8 max-w-xl">
        You're drawn into a jury pool automatically based on your reputation and circle
        membership — there's nothing to opt into beyond joining a circle.
      </p>

      {!address && (
        <div className="panel p-6 mb-8 flex items-center justify-between gap-4">
          <p className="text-sm text-bone-300">Connect your wallet to see disputes you've been drawn for.</p>
          <button onClick={connect} className="btn-primary shrink-0">
            Connect wallet
          </button>
        </div>
      )}

      <div className="grid sm:grid-cols-3 gap-4 mb-10">
        <MiniStat label="Times drawn as juror" value={stats.timesJuror} />
        <MiniStat label="Voted with majority" value={`${stats.juryAccuracy}/${stats.timesJuror}`} />
        <MiniStat label="Reputation score" value={stats.score} accent />
      </div>

      {loading && <p className="text-sm text-bone-500 mb-6">Loading your jury assignments from chain…</p>}

      <section className="mb-10">
        <p className="label-caps mb-3">Awaiting your vote</p>
        {pending.length === 0 ? (
          <p className="text-sm text-bone-500">No disputes currently need your vote.</p>
        ) : (
          <div className="space-y-3">
            {pending.map((d) => (
              <Link
                key={d.id}
                to={`/disputes/${d.id}`}
                className="panel panel-accent border-l-marigold-500 p-4 flex items-center justify-between hover:border-l-marigold-400 transition-colors"
              >
                <div>
                  <p className="text-bone-100 text-sm">{d.summary}</p>
                  <p className="text-xs text-bone-500 mt-1">{d.circle}</p>
                </div>
                <span className="text-xs text-marigold-400 shrink-0 ml-4">Vote now →</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <p className="label-caps mb-3">Past service</p>
        {past.length === 0 ? (
          <p className="text-sm text-bone-500">No resolved disputes you served on yet.</p>
        ) : (
          <div className="space-y-3">
            {past.map((d) => (
              <Link
                key={d.id}
                to={`/disputes/${d.id}`}
                className="panel p-4 flex items-center justify-between opacity-80 hover:opacity-100 transition-opacity"
              >
                <div>
                  <p className="text-bone-100 text-sm">{d.summary}</p>
                  <p className="text-xs text-bone-500 mt-1">{d.circle}</p>
                </div>
                <span className="text-xs text-sage-500 shrink-0 ml-4">Resolved · {d.outcome}</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function MiniStat({ label, value, accent }) {
  return (
    <div className="panel p-4 text-center">
      <p className={`font-display text-2xl ${accent ? "text-marigold-400" : "text-bone-100"}`}>{value}</p>
      <p className="text-xs text-bone-500 mt-1">{label}</p>
    </div>
  );
}


// import React from "react";
// import { Link } from "react-router-dom";
// import { sampleDisputes, sampleReputation } from "../lib/sampleData.js";
// import { useWallet } from "../hooks/useWallet.jsx";

// export default function JurorDashboard() {
//   const { address, connect } = useWallet();
//   const pending = sampleDisputes.filter((d) => d.status === "Voting");
//   const past = sampleDisputes.filter((d) => d.status === "Resolved");

//   return (
//     <div className="mx-auto max-w-4xl px-5 sm:px-8 py-12">
//       <p className="label-caps text-marigold-400 mb-2">Community service</p>
//       <h1 className="font-display text-3xl text-bone-100 mb-2">Juror dashboard</h1>
//       <p className="text-bone-300 mb-8 max-w-xl">
//         You're drawn into a jury pool automatically based on your reputation and circle
//         membership — there's nothing to opt into beyond joining a circle.
//       </p>

//       {!address && (
//         <div className="panel p-6 mb-8 flex items-center justify-between gap-4">
//           <p className="text-sm text-bone-300">Connect your wallet to see disputes you've been drawn for.</p>
//           <button onClick={connect} className="btn-primary shrink-0">
//             Connect wallet
//           </button>
//         </div>
//       )}

//       <div className="grid sm:grid-cols-3 gap-4 mb-10">
//         <MiniStat label="Times drawn as juror" value={sampleReputation.timesJuror} />
//         <MiniStat
//           label="Voted with majority"
//           value={`${sampleReputation.juryAccuracy}/${sampleReputation.timesJuror}`}
//         />
//         <MiniStat label="Reputation score" value={sampleReputation.score} accent />
//       </div>

//       <section className="mb-10">
//         <p className="label-caps mb-3">Awaiting your vote</p>
//         {pending.length === 0 ? (
//           <p className="text-sm text-bone-500">No disputes currently need your vote.</p>
//         ) : (
//           <div className="space-y-3">
//             {pending.map((d) => (
//               <Link
//                 key={d.id}
//                 to={`/disputes/${d.id}`}
//                 className="panel panel-accent border-l-marigold-500 p-4 flex items-center justify-between hover:border-l-marigold-400 transition-colors"
//               >
//                 <div>
//                   <p className="text-bone-100 text-sm">{d.summary}</p>
//                   <p className="text-xs text-bone-500 mt-1">{d.circle}</p>
//                 </div>
//                 <span className="text-xs text-marigold-400 shrink-0 ml-4">Vote now →</span>
//               </Link>
//             ))}
//           </div>
//         )}
//       </section>

//       <section>
//         <p className="label-caps mb-3">Past service</p>
//         <div className="space-y-3">
//           {past.map((d) => (
//             <div key={d.id} className="panel p-4 flex items-center justify-between opacity-80">
//               <div>
//                 <p className="text-bone-100 text-sm">{d.summary}</p>
//                 <p className="text-xs text-bone-500 mt-1">{d.circle}</p>
//               </div>
//               <span className="text-xs text-sage-500 shrink-0 ml-4">Resolved · {d.outcome}</span>
//             </div>
//           ))}
//         </div>
//       </section>
//     </div>
//   );
// }

// function MiniStat({ label, value, accent }) {
//   return (
//     <div className="panel p-4 text-center">
//       <p className={`font-display text-2xl ${accent ? "text-marigold-400" : "text-bone-100"}`}>{value}</p>
//       <p className="text-xs text-bone-500 mt-1">{label}</p>
//     </div>
//   );
// }
