import React, { useEffect, useState } from "react";
import { useWallet } from "../hooks/useWallet.jsx";
import { useContracts } from "../hooks/useContracts.js";
import { sampleReputation } from "../lib/sampleData.js";

export default function ReputationProfile() {
  const { address, connect } = useWallet();
  const { configured, reputationSBT } = useContracts();
  const [profile, setProfile] = useState(sampleReputation);

  useEffect(() => {
    if (!configured || !reputationSBT || !address) return;
    (async () => {
      try {
        const tokenId = await reputationSBT.tokenIdOf(address);
        if (tokenId === 0n) return; // not minted yet — keep sample/neutral display
        const p = await reputationSBT.profiles(tokenId);
        setProfile({
          score: Number(p.score),
          disputesFiled: Number(p.disputesFiled),
          disputesWon: Number(p.disputesWon),
          disputesLost: Number(p.disputesLost),
          timesJuror: Number(p.timesJuror),
          juryAccuracy: Number(p.juryAccuracy),
        });
      } catch (e) {
        console.error("Could not load on-chain reputation, showing sample data.", e);
      }
    })();
  }, [configured, reputationSBT, address]);

  const scorePct = Math.round((profile.score / 1000) * 100);

  return (
    <div className="mx-auto max-w-3xl px-5 sm:px-8 py-12">
      <p className="label-caps text-marigold-400 mb-2">Soulbound reputation</p>
      <h1 className="font-display text-3xl text-bone-100 mb-2">Your standing</h1>
      <p className="text-bone-300 mb-8 max-w-xl">
        Non-transferable, tied to your wallet. It updates automatically as disputes you're
        party to (or vote on) resolve — nothing to claim or stake.
      </p>

      {!address && (
        <div className="panel p-6 mb-8 flex items-center justify-between gap-4">
          <p className="text-sm text-bone-300">Connect your wallet to see your own reputation.</p>
          <button onClick={connect} className="btn-primary shrink-0">
            Connect wallet
          </button>
        </div>
      )}

      <div className="panel p-8 mb-8">
        <div className="flex items-end justify-between mb-3">
          <p className="label-caps">Reputation score</p>
          <p className="font-display text-3xl text-marigold-400">{profile.score}/1000</p>
        </div>
        <div className="h-2 rounded-full bg-ink-900 overflow-hidden">
          <div className="h-full bg-marigold-500" style={{ width: `${scorePct}%` }} />
        </div>
        <p className="text-xs text-bone-500 mt-3">
          New members start at 500. Winning a dispute is +25; losing is −40; voting with the
          jury majority is +5; missing a bond deadline is −15.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <StatCard label="Disputes filed" value={profile.disputesFiled} />
        <StatCard label="Disputes won" value={profile.disputesWon} accent="sage" />
        <StatCard label="Disputes lost" value={profile.disputesLost} accent="rust" />
        <StatCard label="Times served as juror" value={profile.timesJuror} />
      </div>
    </div>
  );
}

function StatCard({ label, value, accent }) {
  const color = accent === "sage" ? "text-sage-500" : accent === "rust" ? "text-rust-500" : "text-bone-100";
  return (
    <div className="panel p-5">
      <p className={`font-display text-2xl ${color}`}>{value}</p>
      <p className="text-xs text-bone-500 mt-1">{label}</p>
    </div>
  );
}
