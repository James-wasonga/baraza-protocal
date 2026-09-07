import React from "react";
import { Link } from "react-router-dom";

const STATUS_STYLE = {
  Filed: "text-dusk-400 border-dusk-500",
  AwaitingJury: "text-dusk-400 border-dusk-500",
  Voting: "text-marigold-400 border-marigold-500",
  Resolved: "text-sage-500 border-sage-500",
  Dismissed: "text-bone-500 border-ink-border",
  Expired: "text-rust-500 border-rust-500",
};

export default function DisputeCard({ dispute }) {
  return (
    <Link
      to={`/disputes/${dispute.id}`}
      className="panel panel-accent border-l-dusk-500 hover:border-l-marigold-500 block p-5 transition-colors"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="label-caps mb-1">{dispute.circle}</p>
          <h3 className="text-bone-100 font-medium leading-snug truncate max-w-md">{dispute.summary}</h3>
          <p className="font-mono text-xs text-bone-500 mt-2">
            {dispute.claimant} <span className="text-bone-500/60">vs</span> {dispute.respondent}
          </p>
        </div>
        <span
          className={`shrink-0 text-xs px-2.5 py-1 rounded-sm border ${STATUS_STYLE[dispute.status] || ""}`}
        >
          {dispute.status}
        </span>
      </div>
      <div className="woven-rule my-4" />
      <div className="flex items-center justify-between text-xs text-bone-500">
        <span>Bond: {dispute.bondAmountEth} ETH / party</span>
        <span>Filed {dispute.filedAt}</span>
      </div>
    </Link>
  );
}
