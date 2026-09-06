import React, { useState } from "react";
import { useParams } from "react-router-dom";
import StatusTimeline from "../components/StatusTimeline.jsx";
import JuryCircle from "../components/JuryCircle.jsx";
import { useWallet } from "../hooks/useWallet.jsx";
import { useContracts } from "../hooks/useContracts.js";
import { sampleDisputes, sampleJury, sampleEvidence } from "../lib/sampleData.js";

export default function DisputeDetail() {
  const { id } = useParams();
  const { address, connect } = useWallet();
  const { configured, disputeEscrow, withSigner } = useContracts();
  const [voting, setVoting] = useState(false);
  const [voteError, setVoteError] = useState(null);
  const [localVote, setLocalVote] = useState(null);

  // Falls back to sample data outside live/configured mode so the page is
  // always fully browsable.
  const dispute = sampleDisputes.find((d) => String(d.id) === String(id)) || sampleDisputes[0];
  const jury = sampleJury;
  const isJuror = jury.some((j) => j.address === address);
  const userVote = localVote || jury.find((j) => j.address === address)?.vote;

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
        await (await contract.castVote(dispute.id, voteEnum)).wait();
      }
      setLocalVote(choice);
    } catch (e) {
      setVoteError(e?.reason || e?.message || "Vote failed.");
    } finally {
      setVoting(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-5 sm:px-8 py-12">
      <p className="label-caps text-marigold-400 mb-2">{dispute.circle}</p>
      <h1 className="font-display text-3xl text-bone-100 mb-6 max-w-2xl">{dispute.summary}</h1>

      <div className="panel p-6 mb-8">
        <StatusTimeline status={dispute.status} />
      </div>

      <div className="grid lg:grid-cols-[1.4fr,1fr] gap-8">
        <div className="space-y-8">
          <section className="panel p-6">
            <p className="label-caps mb-4">Parties</p>
            <div className="grid sm:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-bone-500 text-xs mb-1">Claimant</p>
                <p className="font-mono text-bone-100">{dispute.claimant}</p>
              </div>
              <div>
                <p className="text-bone-500 text-xs mb-1">Respondent</p>
                <p className="font-mono text-bone-100">{dispute.respondent}</p>
              </div>
              <div>
                <p className="text-bone-500 text-xs mb-1">Bond per party</p>
                <p className="text-bone-100">{dispute.bondAmountEth} ETH</p>
              </div>
              <div>
                <p className="text-bone-500 text-xs mb-1">Filed</p>
                <p className="text-bone-100">{dispute.filedAt}</p>
              </div>
            </div>
          </section>

          <section className="panel p-6">
            <p className="label-caps mb-4">Evidence</p>
            <ul className="space-y-3">
              {sampleEvidence.map((e, i) => (
                <li key={i} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="text-bone-100">{e.label}</p>
                    <p className="text-xs text-bone-500">Submitted by {e.submitter}</p>
                  </div>
                  <span className="font-mono text-xs text-dusk-400">{e.hash}</span>
                </li>
              ))}
            </ul>
          </section>

          {dispute.status === "Voting" && (
            <section className="panel p-6">
              <p className="label-caps mb-1">Jury vote</p>
              <p className="text-sm text-bone-300 mb-4">
                {dispute.votesForClaimant + dispute.votesForRespondent} of {dispute.jurySize} jurors
                have voted. A strict majority resolves the case automatically.
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

          {dispute.status === "Resolved" && (
            <section className="panel panel-accent border-l-sage-500 p-6">
              <p className="label-caps mb-1">Outcome</p>
              <p className="text-bone-100">
                Resolved in favor of the <span className="text-sage-500">{dispute.outcome}</span>.
                Bonds settled and reputation scores updated on-chain.
              </p>
            </section>
          )}
        </div>

        <aside className="panel p-6 h-fit">
          <p className="label-caps mb-4 text-center">Jury circle</p>
          <JuryCircle jurors={jury} />
          <div className="mt-6 space-y-2">
            {jury.map((j) => (
              <div key={j.address} className="flex items-center justify-between text-xs">
                <span className="font-mono text-bone-300">{j.address}</span>
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
