import React, { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import StatusTimeline from "../components/StatusTimeline.jsx";
import JuryCircle from "../components/JuryCircle.jsx";
import { useWallet } from "../hooks/useWallet.jsx";
import { useContracts } from "../hooks/useContracts.js";
import { sampleDisputes, sampleJury, sampleEvidence } from "../lib/sampleData.js";
import { DISPUTE_STATUS, VOTE_LABEL } from "../lib/config.js";
import { formatBondAmount } from "../lib/formatAmount.js";
import { shortenAddress } from "../lib/address.js";

export default function DisputeDetail() {
  const { id } = useParams();
  const { address, connect } = useWallet();
  const { configured, disputeEscrow, barazaRegistry, reputationSBT, withSigner, getFeeOverrides } =
    useContracts();

  const [dispute, setDispute] = useState(null);
  const [jury, setJury] = useState([]);
  const [evidence, setEvidence] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [voting, setVoting] = useState(false);
  const [voteError, setVoteError] = useState(null);

  /// Loads (or reloads) this exact dispute by its real on-chain id — this
  /// replaces the old behavior of always rendering sample dispute #1
  /// regardless of which id was in the URL, which is what made every
  /// dispute page look identical.
  const loadDispute = useCallback(async () => {
    if (!configured || !disputeEscrow) return;
    setLoading(true);
    setLoadError(null);
    try {
      const d = await disputeEscrow.getDispute(id);
      if (d.circleId === 0n) {
        setLoadError(`No dispute found with id ${id}.`);
        setDispute(null);
        return;
      }

      let circleName = `Circle #${d.circleId}`;
      if (barazaRegistry) {
        try {
          const c = await barazaRegistry.circles(d.circleId);
          if (c.name) circleName = c.name;
        } catch {
          /* fall back to the generic label above */
        }
      }

      const juryAddrs = await disputeEscrow.getJury(id);
      const jurorRows = await Promise.all(
        juryAddrs.map(async (jurorAddr) => {
          const [score, voted] = await Promise.all([
            reputationSBT ? reputationSBT.scoreOf(jurorAddr).catch(() => 500) : 500,
            disputeEscrow.hasVoted(id, jurorAddr).catch(() => false),
          ]);
          let voteLabel = null;
          if (voted) {
            const v = await disputeEscrow.voteOf(id, jurorAddr).catch(() => 0);
            voteLabel = VOTE_LABEL[Number(v)];
            if (voteLabel === "None") voteLabel = null;
          }
          return { address: jurorAddr, score: Number(score), vote: voteLabel };
        })
      );
      setJury(jurorRows);

      // Evidence: pull the actual EvidenceSubmitted events for this dispute
      // so we can label each hash by who submitted it, same as the UI shows.
      let evidenceRows = [];
      try {
        const evFilter = disputeEscrow.filters.EvidenceSubmitted(id);
        const evEvents = await disputeEscrow.queryFilter(evFilter, 0, "latest");
        evidenceRows = evEvents.map((ev, i) => {
          const submitter = ev.args.submitter.toLowerCase();
          const label =
            submitter === d.claimant.toLowerCase()
              ? "Claimant"
              : submitter === d.respondent.toLowerCase()
              ? "Respondent"
              : "Unknown";
          return { submitter: label, label: `Evidence #${i + 1}`, hash: ev.args.evidenceHash };
        });
      } catch {
        evidenceRows = [];
      }
      setEvidence(evidenceRows);

      const { amount, symbol } = formatBondAmount(d.bondAmount, d.bondToken);
      const [votesForClaimant, votesForRespondent] = await disputeEscrow.getVoteTally(id);

      setDispute({
        id,
        circle: circleName,
        claimant: d.claimant,
        respondent: d.respondent,
        bondDisplay: `${amount} ${symbol}`,
        status: DISPUTE_STATUS[Number(d.status)],
        summary: d.summary,
        outcome: VOTE_LABEL[Number(d.outcome)],
        jurySize: juryAddrs.length,
        votesForClaimant: Number(votesForClaimant),
        votesForRespondent: Number(votesForRespondent),
      });
    } catch (e) {
      console.error("Failed to load dispute from chain:", e);
      setLoadError("Could not load this dispute from the chain.");
      setDispute(null);
    } finally {
      setLoading(false);
    }
  }, [id, configured, disputeEscrow, barazaRegistry, reputationSBT]);

  useEffect(() => {
    if (configured && disputeEscrow) {
      loadDispute();
    }
  }, [loadDispute, configured, disputeEscrow]);

  // Demo mode (no contracts configured): keep the old sample-data behavior
  // so the page is still fully browsable without a deployment.
  const demoDispute = !configured ? sampleDisputes.find((d) => String(d.id) === String(id)) || sampleDisputes[0] : null;
  const demoJury = sampleJury;
  const demoEvidence = sampleEvidence;

  const activeDispute = configured ? dispute : demoDispute;
  const activeJury = configured ? jury : demoJury;
  const activeEvidence = configured ? evidence : demoEvidence;

  const isJuror = activeJury.some((j) => j.address?.toLowerCase() === address?.toLowerCase());
  const userVote = activeJury.find((j) => j.address?.toLowerCase() === address?.toLowerCase())?.vote;

  async function castVote(choice) {
    setVoteError(null);
    if (!address) {
      await connect();
      return;
    }
    setVoting(true);
    try {
      if (configured && disputeEscrow) {
        const contract = await withSigner(disputeEscrow);
        const voteEnum = choice === "Claimant" ? 1 : 2;
        const overrides = await getFeeOverrides();
        await (await contract.castVote(id, voteEnum, overrides)).wait();
        await loadDispute(); // refresh tally/status/outcome — a vote may have just resolved it
      }
    } catch (e) {
      setVoteError(e?.reason || e?.message || "Vote failed.");
    } finally {
      setVoting(false);
    }
  }

  if (configured && loading && !activeDispute) {
    return (
      <div className="mx-auto max-w-5xl px-5 sm:px-8 py-12">
        <p className="text-bone-500 text-sm">Loading dispute from chain…</p>
      </div>
    );
  }

  if (configured && (loadError || !activeDispute)) {
    return (
      <div className="mx-auto max-w-5xl px-5 sm:px-8 py-12">
        <p className="text-rust-500 text-sm">{loadError || `No dispute found with id ${id}.`}</p>
      </div>
    );
  }

  const dispute_ = activeDispute;

  return (
    <div className="mx-auto max-w-5xl px-5 sm:px-8 py-12">
      <p className="label-caps text-marigold-400 mb-2">{dispute_.circle}</p>
      <h1 className="font-display text-3xl text-bone-100 mb-6 max-w-2xl">{dispute_.summary}</h1>

      <div className="panel p-6 mb-8">
        <StatusTimeline status={dispute_.status} />
      </div>

      <div className="grid lg:grid-cols-[1.4fr,1fr] gap-8">
        <div className="space-y-8">
          <section className="panel p-6">
            <p className="label-caps mb-4">Parties</p>
            {/* <div className="grid sm:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-bone-500 text-xs mb-1">Claimant</p>
                <p className="font-mono text-bone-100">{dispute_.claimant}</p>
              </div>
              <div>
                <p className="text-bone-500 text-xs mb-1">Respondent</p>
                <p className="font-mono text-bone-100">{dispute_.respondent}</p>
              </div> */}
                          <div className="grid sm:grid-cols-2 gap-4 text-sm">
              <div className="min-w-0">
                <p className="text-bone-500 text-xs mb-1">Claimant</p>
                <p className="font-mono text-bone-100" title={dispute_.claimant}>
                  {shortenAddress(dispute_.claimant)}
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-bone-500 text-xs mb-1">Respondent</p>
                <p className="font-mono text-bone-100" title={dispute_.respondent}>
                  {shortenAddress(dispute_.respondent)}
                </p>
              </div>
              <div>
                <p className="text-bone-500 text-xs mb-1">Bond per party</p>
                <p className="text-bone-100">{dispute_.bondDisplay || `${dispute_.bondAmountEth} ETH`}</p>
              </div>
              <div>
                <p className="text-bone-500 text-xs mb-1">Filed</p>
                <p className="text-bone-100">{dispute_.filedAt || "—"}</p>
              </div>
            </div>
          </section>

          <section className="panel p-6">
            <p className="label-caps mb-4">Evidence</p>
            {activeEvidence.length === 0 ? (
              <p className="text-sm text-bone-500">No evidence submitted yet.</p>
            ) : (
              <ul className="space-y-3">
                {activeEvidence.map((e, i) => (
                  <li key={i} className="flex items-center justify-between text-sm">
                    <div>
                      <p className="text-bone-100">{e.label}</p>
                      <p className="text-xs text-bone-500">Submitted by {e.submitter}</p>
                    </div>
                    <span className="font-mono text-xs text-dusk-400">
                      {typeof e.hash === "string" ? `${e.hash.slice(0, 10)}...${e.hash.slice(-6)}` : e.hash}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {dispute_.status === "Voting" && (
            <section className="panel p-6">
              <p className="label-caps mb-1">Jury vote</p>
              <p className="text-sm text-bone-300 mb-4">
                {(dispute_.votesForClaimant || 0) + (dispute_.votesForRespondent || 0)} of{" "}
                {dispute_.jurySize || activeJury.length} jurors have voted. A strict majority resolves
                the case automatically.
              </p>
              {isJuror || !configured ? (
                userVote ? (
                  <p className="text-sm text-sage-500">You voted for {userVote}. Thank you.</p>
                ) : (
                  <div className="flex gap-3">
                    <button
                      onClick={() => castVote("Claimant")}
                      disabled={voting}
                      className="btn-primary flex-1"
                    >
                      Vote: Claimant
                    </button>
                    <button
                      onClick={() => castVote("Respondent")}
                      disabled={voting}
                      className="btn-secondary flex-1"
                    >
                      Vote: Respondent
                    </button>
                  </div>
                )
              ) : (
                <p className="text-sm text-bone-500">Only the selected jury can vote on this dispute.</p>
              )}
              {voteError && <p className="text-sm text-rust-500 mt-3">{voteError}</p>}
            </section>
          )}

          {dispute_.status === "Resolved" && (
            <section className="panel panel-accent border-l-sage-500 p-6">
              <p className="label-caps mb-1">Outcome</p>
              <p className="text-bone-100">
                Resolved in favor of the <span className="text-sage-500">{dispute_.outcome}</span>.
                Bonds settled and reputation scores updated on-chain.
              </p>
            </section>
          )}
        </div>

        <aside className="panel p-6 h-fit">
          <p className="label-caps mb-4 text-center">Jury circle</p>
          <JuryCircle jurors={activeJury} />
          <div className="mt-6 space-y-2">
            {activeJury.map((j) => (
              <div key={j.address} className="flex items-center justify-between text-xs">
                <span className="font-mono text-bone-300">{j.address}
                {shortenAddress(j.address)}
                </span>
                <span
                  className={
                    j.vote === "Claimant"
                      ? "text-marigold-400"
                      : j.vote === "Respondent"
                      ? "text-rust-500"
                      : "text-bone-500"
                  }
                >
                  {j.vote || "Not voted"} · rep {j.score}
                </span>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

// import React, { useState } from "react";
// import { useParams } from "react-router-dom";
// import StatusTimeline from "../components/StatusTimeline.jsx";
// import JuryCircle from "../components/JuryCircle.jsx";
// import { useWallet } from "../hooks/useWallet.jsx";
// import { useContracts } from "../hooks/useContracts.js";
// import { sampleDisputes, sampleJury, sampleEvidence } from "../lib/sampleData.js";

// export default function DisputeDetail() {
//   const { id } = useParams();
//   const { address, connect } = useWallet();
//   const { configured, disputeEscrow, withSigner, getFeeOverrides } = useContracts();
//   const [voting, setVoting] = useState(false);
//   const [voteError, setVoteError] = useState(null);
//   const [localVote, setLocalVote] = useState(null);

//   // Falls back to sample data outside live/configured mode so the page is
//   // always fully browsable.
//   const dispute = sampleDisputes.find((d) => String(d.id) === String(id)) || sampleDisputes[0];
//   const jury = sampleJury;
//   const isJuror = jury.some((j) => j.address === address);
//   const userVote = localVote || jury.find((j) => j.address === address)?.vote;

//   async function castVote(choice) {
//     setVoteError(null);
//     if (!address) {
//       await connect();
//       return;
//     }
//     setVoting(true);
//     try {
//       if (configured && disputeEscrow) {
//         const contract = await withSigner(disputeEscrow);
//         const voteEnum = choice === "Claimant" ? 1 : 2;
//         const overrides = await getFeeOverrides();
//         await (await contract.castVote(dispute.id, voteEnum, overrides)).wait();
//       }
//       setLocalVote(choice);
//     } catch (e) {
//       setVoteError(e?.reason || e?.message || "Vote failed.");
//     } finally {
//       setVoting(false);
//     }
//   }

//   return (
//     <div className="mx-auto max-w-5xl px-5 sm:px-8 py-12">
//       <p className="label-caps text-marigold-400 mb-2">{dispute.circle}</p>
//       <h1 className="font-display text-3xl text-bone-100 mb-6 max-w-2xl">{dispute.summary}</h1>

//       <div className="panel p-6 mb-8">
//         <StatusTimeline status={dispute.status} />
//       </div>

//       <div className="grid lg:grid-cols-[1.4fr,1fr] gap-8">
//         <div className="space-y-8">
//           <section className="panel p-6">
//             <p className="label-caps mb-4">Parties</p>
//             <div className="grid sm:grid-cols-2 gap-4 text-sm">
//               <div>
//                 <p className="text-bone-500 text-xs mb-1">Claimant</p>
//                 <p className="font-mono text-bone-100">{dispute.claimant}</p>
//               </div>
//               <div>
//                 <p className="text-bone-500 text-xs mb-1">Respondent</p>
//                 <p className="font-mono text-bone-100">{dispute.respondent}</p>
//               </div>
//               <div>
//                 <p className="text-bone-500 text-xs mb-1">Bond per party</p>
//                 <p className="text-bone-100">{dispute.bondAmountEth} ETH</p>
//               </div>
//               <div>
//                 <p className="text-bone-500 text-xs mb-1">Filed</p>
//                 <p className="text-bone-100">{dispute.filedAt}</p>
//               </div>
//             </div>
//           </section>

//           <section className="panel p-6">
//             <p className="label-caps mb-4">Evidence</p>
//             <ul className="space-y-3">
//               {sampleEvidence.map((e, i) => (
//                 <li key={i} className="flex items-center justify-between text-sm">
//                   <div>
//                     <p className="text-bone-100">{e.label}</p>
//                     <p className="text-xs text-bone-500">Submitted by {e.submitter}</p>
//                   </div>
//                   <span className="font-mono text-xs text-dusk-400">{e.hash}</span>
//                 </li>
//               ))}
//             </ul>
//           </section>

//           {dispute.status === "Voting" && (
//             <section className="panel p-6">
//               <p className="label-caps mb-1">Jury vote</p>
//               <p className="text-sm text-bone-300 mb-4">
//                 {dispute.votesForClaimant + dispute.votesForRespondent} of {dispute.jurySize} jurors
//                 have voted. A strict majority resolves the case automatically.
//               </p>
//               {isJuror || !configured ? (
//                 userVote ? (
//                   <p className="text-sm text-sage-500">You voted for {userVote}. Thank you.</p>
//                 ) : (
//                   <div className="flex gap-3">
//                     <button
//                       onClick={() => castVote("Claimant")}
//                       disabled={voting}
//                       className="btn-primary flex-1"
//                     >
//                       Vote: Claimant
//                     </button>
//                     <button
//                       onClick={() => castVote("Respondent")}
//                       disabled={voting}
//                       className="btn-secondary flex-1"
//                     >
//                       Vote: Respondent
//                     </button>
//                   </div>
//                 )
//               ) : (
//                 <p className="text-sm text-bone-500">Only the selected jury can vote on this dispute.</p>
//               )}
//               {voteError && <p className="text-sm text-rust-500 mt-3">{voteError}</p>}
//             </section>
//           )}

//           {dispute.status === "Resolved" && (
//             <section className="panel panel-accent border-l-sage-500 p-6">
//               <p className="label-caps mb-1">Outcome</p>
//               <p className="text-bone-100">
//                 Resolved in favor of the <span className="text-sage-500">{dispute.outcome}</span>.
//                 Bonds settled and reputation scores updated on-chain.
//               </p>
//             </section>
//           )}
//         </div>

//         <aside className="panel p-6 h-fit">
//           <p className="label-caps mb-4 text-center">Jury circle</p>
//           <JuryCircle jurors={jury} />
//           <div className="mt-6 space-y-2">
//             {jury.map((j) => (
//               <div key={j.address} className="flex items-center justify-between text-xs">
//                 <span className="font-mono text-bone-300">{j.address}</span>
//                 <span
//                   className={
//                     j.vote === "Claimant"
//                       ? "text-marigold-400"
//                       : j.vote === "Respondent"
//                       ? "text-rust-500"
//                       : "text-bone-500"
//                   }
//                 >
//                   {j.vote || "Not voted"} · rep {j.score}
//                 </span>
//               </div>
//             ))}
//           </div>
//         </aside>
//       </div>
//     </div>
//   );
// }
