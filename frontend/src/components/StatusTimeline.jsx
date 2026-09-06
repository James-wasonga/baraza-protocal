import React from "react";

const STAGES = ["Filed", "AwaitingJury", "Voting", "Resolved"];
const STAGE_LABEL = {
  Filed: "Filed",
  AwaitingJury: "Bonding & jury draw",
  Voting: "Jury voting",
  Resolved: "Resolved",
  Dismissed: "Dismissed",
  Expired: "Expired",
};

export default function StatusTimeline({ status }) {
  const terminal = status === "Dismissed" || status === "Expired";
  const activeIndex = terminal ? STAGES.length : STAGES.indexOf(status);

  return (
    <div className="flex items-center w-full">
      {STAGES.map((stage, i) => {
        const done = i < activeIndex || (terminal && i <= 0);
        const current = i === activeIndex && !terminal;
        return (
          <React.Fragment key={stage}>
            <div className="flex flex-col items-center gap-1.5 shrink-0">
              <div
                className={`h-3 w-3 rounded-full border-2 ${
                  done
                    ? "bg-marigold-500 border-marigold-500"
                    : current
                    ? "border-marigold-500 bg-ink-900"
                    : "border-ink-border bg-ink-900"
                }`}
              />
              <span className={`text-[11px] whitespace-nowrap ${current ? "text-marigold-400" : "text-bone-500"}`}>
                {STAGE_LABEL[stage]}
              </span>
            </div>
            {i < STAGES.length - 1 && (
              <div className={`h-px flex-1 mx-2 mb-4 ${i < activeIndex ? "bg-marigold-500" : "bg-ink-border"}`} />
            )}
          </React.Fragment>
        );
      })}
      {terminal && (
        <span className="ml-3 mb-4 text-[11px] text-rust-500 whitespace-nowrap">{STAGE_LABEL[status]}</span>
      )}
    </div>
  );
}
