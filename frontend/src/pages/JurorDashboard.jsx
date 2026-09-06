import React from "react";
import { Link } from "react-router-dom";
import { sampleDisputes, sampleReputation } from "../lib/sampleData.js";
import { useWallet } from "../hooks/useWallet.jsx";

export default function JurorDashboard() {
  const { address, connect } = useWallet();
  const pending = sampleDisputes.filter((d) => d.status === "Voting");
  const past = sampleDisputes.filter((d) => d.status === "Resolved");

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
        <MiniStat label="Times drawn as juror" value={sampleReputation.timesJuror} />
        <MiniStat
          label="Voted with majority"
          value={`${sampleReputation.juryAccuracy}/${sampleReputation.timesJuror}`}
        />
        <MiniStat label="Reputation score" value={sampleReputation.score} accent />
      </div>

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
        <div className="space-y-3">
          {past.map((d) => (
            <div key={d.id} className="panel p-4 flex items-center justify-between opacity-80">
              <div>
                <p className="text-bone-100 text-sm">{d.summary}</p>
                <p className="text-xs text-bone-500 mt-1">{d.circle}</p>
              </div>
              <span className="text-xs text-sage-500 shrink-0 ml-4">Resolved · {d.outcome}</span>
            </div>
          ))}
        </div>
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
