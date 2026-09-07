import React from "react";

export default function Footer() {
  return (
    <footer className="border-t border-ink-border mt-20">
      <div className="mx-auto max-w-6xl px-5 sm:px-8 py-10 flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
        <p className="text-sm text-bone-500">
          Baraza Protocol — built for the Arbitrum Open House Singapore: Online Buildathon.
        </p>
        <div className="flex gap-5 text-sm text-bone-500">
          <a
            href="https://sepolia.arbiscan.io"
            target="_blank"
            rel="noreferrer"
            className="hover:text-marigold-400 transition-colors"
          >
            Arbiscan (Sepolia)
          </a>
          <a
            href="https://docs.arbitrum.io/stylus/stylus-content-map"
            target="_blank"
            rel="noreferrer"
            className="hover:text-marigold-400 transition-colors"
          >
            Stylus docs
          </a>
        </div>
      </div>
    </footer>
  );
}
