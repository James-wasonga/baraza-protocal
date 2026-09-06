import React, { useEffect, useState } from "react";
import DisputeCard from "../components/DisputeCard.jsx";
import { useContracts } from "../hooks/useContracts.js";
import { sampleDisputes } from "../lib/sampleData.js";
import { DISPUTE_STATUS } from "../lib/config.js";

export default function Disputes() {
  const { configured, disputeEscrow } = useContracts();
  const [disputes, setDisputes] = useState(sampleDisputes);
  const [filter, setFilter] = useState("All");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!configured || !disputeEscrow) return;
    setLoading(true);
    (async () => {
      try {
        const filter = disputeEscrow.filters.DisputeFiled();
        const events = await disputeEscrow.queryFilter(filter, 0, "latest");
        const results = await Promise.all(
          events.map(async (ev) => {
            const id = ev.args.disputeId.toString();
            const d = await disputeEscrow.getDispute(id);
            return {
              id,
              circle: `Circle #${d.circleId}`,
              claimant: d.claimant,
              respondent: d.respondent,
              summary: d.summary,
              bondAmountEth: (Number(d.bondAmount) / 1e18).toString(),
              status: DISPUTE_STATUS[d.status],
              filedAt: "",
            };
          })
        );
        setDisputes(results);
      } catch (e) {
        console.error("Failed to load disputes from chain, showing sample data.", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [configured, disputeEscrow]);

  const statuses = ["All", ...new Set(disputes.map((d) => d.status))];
  const visible = filter === "All" ? disputes : disputes.filter((d) => d.status === filter);

  return (
    <div className="mx-auto max-w-4xl px-5 sm:px-8 py-12">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <p className="label-caps text-marigold-400 mb-2">All circles</p>
          <h1 className="font-display text-3xl text-bone-100">Open & resolved disputes</h1>
        </div>
        {!configured && (
          <span className="text-xs text-bone-500 border border-ink-border rounded-sm px-3 py-1.5">
            Showing sample data — deploy contracts and set VITE_DISPUTE_ESCROW_ADDRESS for live data
          </span>
        )}
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {statuses.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`text-sm px-3 py-1.5 rounded-sm border whitespace-nowrap transition-colors ${
              filter === s
                ? "border-marigold-500 text-marigold-400 bg-ink-800"
                : "border-ink-border text-bone-500 hover:text-bone-100"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-bone-500 text-sm">Loading disputes from chain…</p>
      ) : (
        <div className="space-y-4">
          {visible.map((d) => (
            <DisputeCard key={d.id} dispute={d} />
          ))}
          {visible.length === 0 && <p className="text-bone-500 text-sm">No disputes in this state.</p>}
        </div>
      )}
    </div>
  );
}
