import React from "react";

/**
 * Renders the selected jury as a circle of seats around the dispute — a
 * literal baraza (council circle). Each seat is colored by vote status:
 * unvoted (dusk), voted-claimant (marigold), voted-respondent (rust).
 * This is the one place in the UI that leans into the namesake motif;
 * everywhere else stays a plain ledger/panel layout.
 */
export default function JuryCircle({ jurors = [], size = 260 }) {
  const center = size / 2;
  const radius = size / 2 - 34;
  const seatR = 20;

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width="100%" height="auto" className="max-w-[300px] mx-auto">
      {/* faint circle path */}
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke="#324A3F"
        strokeWidth="1"
        strokeDasharray="2 5"
      />
      {/* center marker: the dispute itself */}
      <circle cx={center} cy={center} r="26" fill="#1B2E27" stroke="#324A3F" />
      <text
        x={center}
        y={center + 4}
        textAnchor="middle"
        fontSize="11"
        fill="#9FB0A8"
        fontFamily="IBM Plex Mono, monospace"
      >
        case
      </text>

      {jurors.map((juror, i) => {
        const angle = (i / jurors.length) * Math.PI * 2 - Math.PI / 2;
        const x = center + radius * Math.cos(angle);
        const y = center + radius * Math.sin(angle);
        const color =
          juror.vote === "Claimant" ? "#E3A23C" : juror.vote === "Respondent" ? "#C15B3E" : "#4C6B8A";
        return (
          <g key={juror.address || i}>
            <line x1={center} y1={center} x2={x} y2={y} stroke="#223A31" strokeWidth="1" />
            <circle cx={x} cy={y} r={seatR} fill="#1B2E27" stroke={color} strokeWidth="2" />
            <circle cx={x} cy={y} r="4" fill={color} />
            <text
              x={x}
              y={y + seatR + 14}
              textAnchor="middle"
              fontSize="9.5"
              fill="#9FB0A8"
              fontFamily="IBM Plex Mono, monospace"
            >
              {juror.address}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
