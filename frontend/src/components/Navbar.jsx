import React from "react";
import { NavLink } from "react-router-dom";
import { useWallet } from "../hooks/useWallet.jsx";

const navLinks = [
  { to: "/", label: "Home", end: true },
  { to: "/disputes", label: "Disputes" },
  { to: "/file", label: "File a dispute" },
  { to: "/jurors", label: "Juror dashboard" },
  { to: "/reputation", label: "Reputation" },
];

function shortAddr(addr) {
  if (!addr) return "";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function Navbar() {
  const { address, connecting, connect, disconnect, isWrongNetwork, switchToArbitrumSepolia } = useWallet();

  return (
    <header className="sticky top-0 z-30 border-b border-ink-border bg-ink-900/90 backdrop-blur">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          <NavLink to="/" className="flex items-center gap-2.5 shrink-0">
            <BarazaMark />
            <span className="font-display text-lg text-bone-100 tracking-tight">Baraza Protocol</span>
          </NavLink>

          <nav className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  `px-3 py-2 text-sm rounded-sm transition-colors ${
                    isActive ? "text-marigold-400 bg-ink-800" : "text-bone-300 hover:text-bone-100"
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            {address && isWrongNetwork && (
              <button
                onClick={switchToArbitrumSepolia}
                className="hidden sm:inline-flex text-xs px-3 py-2 rounded-sm border border-rust-500 text-rust-500 hover:bg-rust-500/10 transition-colors"
              >
                Switch to Arbitrum Sepolia
              </button>
            )}
            {address ? (
              <button
                onClick={disconnect}
                className="font-mono text-sm px-3.5 py-2 rounded-sm border border-ink-border text-bone-100 hover:border-marigold-500 transition-colors"
                title="Click to disconnect"
              >
                {shortAddr(address)}
              </button>
            ) : (
              <button onClick={connect} disabled={connecting} className="btn-primary text-sm px-4 py-2">
                {connecting ? "Connecting…" : "Connect wallet"}
              </button>
            )}
          </div>
        </div>
      </div>
      {/* Mobile nav */}
      <nav className="lg:hidden flex overflow-x-auto gap-1 px-5 pb-3 -mt-1">
        {navLinks.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) =>
              `whitespace-nowrap px-3 py-1.5 text-sm rounded-sm transition-colors ${
                isActive ? "text-marigold-400 bg-ink-800" : "text-bone-300"
              }`
            }
          >
            {link.label}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}

function BarazaMark() {
  // A small circle-of-dots mark — the baraza (council circle) motif, used
  // sparingly as a wordmark glyph rather than a literal illustration.
  const points = Array.from({ length: 7 }, (_, i) => {
    const angle = (i / 7) * Math.PI * 2 - Math.PI / 2;
    const r = 9;
    return [14 + r * Math.cos(angle), 14 + r * Math.sin(angle)];
  });
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" className="shrink-0">
      <circle cx="14" cy="14" r="2.4" fill="#E3A23C" />
      {points.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="1.7" fill={i === 0 ? "#E3A23C" : "#6E8FB0"} opacity={i === 0 ? 1 : 0.75} />
      ))}
    </svg>
  );
}
