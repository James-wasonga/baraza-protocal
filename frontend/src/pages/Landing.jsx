import React from "react";
import { Link } from "react-router-dom";
import JuryCircle from "../components/JuryCircle.jsx";
import { sampleJury } from "../lib/sampleData.js";

export default function Landing() {
  return (
    <div>
      {/* Hero */}
      <section className="mx-auto max-w-6xl px-5 sm:px-8 pt-16 pb-20 grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <p className="label-caps text-marigold-400 mb-4">Decentralized arbitration · Arbitrum</p>
          <h1 className="font-display text-4xl sm:text-5xl leading-[1.08] text-bone-100 mb-6">
            When the deal goes sideways, your chama needs a council —
            <span className="text-marigold-400"> not a courtroom.</span>
          </h1>
          <p className="text-bone-300 text-lg leading-relaxed mb-8 max-w-xl">
            Baraza Protocol brings reputation-weighted, on-chain arbitration to chamas, ROSCAs,
            and informal trade partnerships — piloted in East Africa, built for any trust
            economy that runs on a handshake instead of a contract.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link to="/file" className="btn-primary">
              File a dispute
            </Link>
            <Link to="/disputes" className="btn-secondary">
              Browse open disputes
            </Link>
          </div>
          <div className="flex flex-wrap gap-x-8 gap-y-3 mt-10 text-sm">
            <Stat label="Total disputes resolved" value="1" />
            <Stat label="Active circles" value="3" />
            <Stat label="Avg. resolution time" value="4.2 days" />
          </div>
        </div>
        <div className="panel p-8 flex flex-col items-center">
          <JuryCircle jurors={sampleJury} />
          <p className="text-xs text-bone-500 mt-4 text-center max-w-xs">
            A dispute in <span className="text-bone-300">Kilimani Traders Chama</span> — 3 jurors
            drawn by reputation-weighted random selection, 2 votes cast.
          </p>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-5 sm:px-8 py-16 border-t border-ink-border">
        <p className="label-caps text-marigold-400 mb-2">How it works</p>
        <h2 className="font-display text-3xl text-bone-100 mb-10 max-w-xl">
          From a broken handshake to an enforced, reputation-backed ruling.
        </h2>
        <div className="grid md:grid-cols-4 gap-6">
          <Step
            n="01"
            title="File & post bond"
            body="File against another member of your circle. Post a small refundable bond via M-Pesa (gasless, via account abstraction) or directly from a wallet."
          />
          <Step
            n="02"
            title="Jury drawn"
            body="A Stylus (Rust) contract runs a commit-reveal, reputation-weighted random draw over your circle's members — no single party can predict or game the jury."
          />
          <Step
            n="03"
            title="Evidence & vote"
            body="Both sides submit evidence. Jurors review and cast a binary vote; a strict majority resolves the case automatically on-chain."
          />
          <Step
            n="04"
            title="Settled & scored"
            body="The losing party's bond is forfeited to the winner. Both parties' on-chain reputation (a soulbound token) updates — carrying into every future dispute."
          />
        </div>
      </section>

      {/* Why not just Kleros */}
      <section className="mx-auto max-w-6xl px-5 sm:px-8 py-16 border-t border-ink-border grid lg:grid-cols-2 gap-10">
        <div>
          <p className="label-caps text-marigold-400 mb-2">Built for a different user</p>
          <h2 className="font-display text-2xl text-bone-100 mb-4">
            Not generic crypto arbitration — trust-economy arbitration.
          </h2>
          <p className="text-bone-300 leading-relaxed">
            General-purpose on-chain arbitration exists, but it's built for crypto-native
            disputants staking tokens among anonymous global jurors. Baraza is built for a
            chama member who's never held ETH: bonds are payable in mobile money, dispute
            filing is gasless, and jurors are drawn from people who actually know the circle —
            not strangers.
          </p>
        </div>
        <div className="panel p-6 space-y-4">
          <ComparisonRow label="Bond currency" a="Crypto token stake" b="Mobile money or wallet" />
          <ComparisonRow label="Juror pool" a="Anonymous, global" b="Known circle members" />
          <ComparisonRow label="Gas required to file" a="Yes" b="No (account abstraction)" />
          <ComparisonRow label="Jury selection" a="Solidity loop" b="Stylus (Rust/WASM)" />
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <p className="font-display text-2xl text-bone-100">{value}</p>
      <p className="text-bone-500 text-xs mt-0.5">{label}</p>
    </div>
  );
}

function Step({ n, title, body }) {
  return (
    <div className="panel panel-accent border-l-marigold-500 p-5">
      <span className="font-mono text-xs text-marigold-500">{n}</span>
      <h3 className="font-display text-lg text-bone-100 mt-2 mb-2">{title}</h3>
      <p className="text-sm text-bone-300 leading-relaxed">{body}</p>
    </div>
  );
}

function ComparisonRow({ label, a, b }) {
  return (
    <div className="grid grid-cols-[1fr,1fr,1fr] gap-3 text-sm items-center">
      <span className="text-bone-500">{label}</span>
      <span className="text-bone-500/70 line-through decoration-rust-500/50">{a}</span>
      <span className="text-marigold-400">{b}</span>
    </div>
  );
}
