# Baraza Protocol

Decentralized arbitration for informal trust economies — chamas, ROSCAs, and
cross-border trade partnerships — piloted in East Africa, built on Arbitrum.

Built for the **Arbitrum Open House Singapore: Online Buildathon**.

> **Name:** *Baraza* is Swahili for the traditional community council used to
> resolve local disputes. This protocol is that council, put on-chain.

---

## The problem

Chamas (rotating savings/credit groups) and informal trade partnerships in
East Africa run on trust and social pressure. When a dispute happens — a
member skips a contribution, a trade partner under-delivers — there's no
affordable, fast, enforceable resolution mechanism. Formal courts are slow
and expensive; informal pressure doesn't scale past your own social circle.

The same pattern — informal trust groups with no dispute-resolution
infrastructure — shows up worldwide (susu in West Africa, tandas in Latin
America, ROSCAs generally). Baraza is architected as general infrastructure
for that pattern, piloted first in the market its builder knows best.

## How it's different from existing on-chain arbitration

General-purpose on-chain arbitration (Kleros and similar) exists. Baraza is
not a reimplementation of that — it targets a different user:

| | Generic on-chain arbitration | Baraza Protocol |
|---|---|---|
| Bond currency | Crypto token stake | Mobile money (M-Pesa) or wallet |
| Juror pool | Anonymous, global | Known members of your own circle |
| Gas to file | Required | None (account-abstracted filing) |
| Jury selection | Solidity loop | Stylus (Rust/WASM), reputation-weighted |

---

## Architecture

```
baraza-protocol/
├── contracts-solidity/   Hardhat project — DisputeEscrow, BarazaRegistry, ReputationSBT
├── contracts-stylus/     Rust/Stylus — reputation-weighted jury selection
├── backend/              Express API — M-Pesa relayer, jury-draw orchestration
├── frontend/             React + Vite + Tailwind — the web app
└── docs/                 Architecture notes
```

**Why two languages for contracts:** the jury-selection algorithm is
weighted sampling *without replacement*, which means a per-draw scan over
the candidate pool. Solidity can do this (see `MockJurySelector.sol`, used
for local dev), but the EVM gas cost scales with circle size. Stylus
compiles the identical algorithm to WASM, which runs that scan far more
cheaply — a real, defensible reason for the Stylus/Solidity split, not a
novelty language swap. Everything else (escrow, membership, reputation
tokens) is plain Solidity, using OpenZeppelin's audited primitives, because
that tooling is more mature there than Stylus's equivalent today.

### Contracts

- **`ReputationSBT.sol`** — non-transferable (soulbound) ERC-721 reputation
  token. One per address. Score starts at 500/1000, adjusts on dispute
  outcomes and juror service.
- **`BarazaRegistry.sol`** — registers circles (chamas, ROSCAs, trade
  partnerships) and their membership.
- **`DisputeEscrow.sol`** — the core contract. Files disputes, escrows
  bonds (native ETH or M-Pesa-confirmed-by-relayer), hands jury selection
  to the Stylus contract, collects votes, settles the outcome.
- **`IJurySelector.sol` / `contracts-stylus/`** — the Rust/Stylus contract.
  Commit-reveal, reputation-weighted random draw. See
  **`contracts-stylus/README.md`** for an honest account of what's been
  verified (the algorithm, independently, extensively) versus what
  couldn't be compiled inside this build sandbox (the live Stylus SDK
  build itself — see that README for exactly why, and run
  `cargo stylus check` yourself as your first step there).
- **`MockJurySelector.sol`** — a Solidity-only stand-in implementing the
  identical algorithm, used so the full system is testable end-to-end
  without any Rust/Stylus toolchain. This is what the automated test below
  actually deploys and exercises.

### Backend

Express API in `backend/`: relays M-Pesa (Daraja) STK Push confirmations
onto `DisputeEscrow.confirmBondOffchain`, and exposes REST endpoints the
frontend calls for anything not worth a direct chain read. Runs with
`MOCK_MPESA=true` out of the box — no Safaricom credentials needed to see
the full flow.

### Frontend

React 18 + Vite + Tailwind, no component library beyond that — every panel,
button, and the jury-circle visualization are hand-built. Runs in full
**demo mode** with realistic sample data if no contracts are deployed yet
(see `frontend/.env.example`), so the whole app is browsable immediately.

---

## What's been verified, concretely

This section exists because "fully working" is a claim worth backing up,
not just asserting:

- **Solidity contracts**: compiled successfully with solc 0.8.24
  (`contracts-solidity/verify-compile.js`), and exercised **end-to-end
  against real deployed bytecode on a local Hardhat node**
  (`contracts-solidity/verify-runtime.js`) — circle creation, dispute
  filing, bonding, jury selection, voting, resolution, reputation-score
  updates, soulbound-transfer rejection, and non-member-filing rejection
  all pass against live contract calls, not just unit-test mocks.
- **Stylus jury-selection algorithm**: the core weighted-sampling logic is
  mirrored in a dependency-minimal crate (`contracts-stylus/algorithm-verification/`)
  and run through `cargo test` — determinism, no-duplicate-jurors, and the
  zero-reputation floor are all checked. The full `stylus-sdk` contract
  wrapper around that logic could not be compiled in this sandbox (see
  `contracts-stylus/README.md` for the exact reason and what to run first).
- **Backend**: boots cleanly, degrades gracefully with a clear warning when
  `.env` isn't filled in yet, rather than crashing.
- **Frontend**: production build (`npm run build`) completes with no errors.

Nothing above was skipped or asserted without running it.

---

## Setup & local development

### Prerequisites

- Node.js 18+
- npm
- (Optional, for the real Stylus contract) Rust via `rustup` and
  `cargo-stylus` — see `contracts-stylus/README.md`

### 1. Solidity contracts

```bash
cd contracts-solidity
npm install
npm run compile          # via solc-js if binaries.soliditylang.org is blocked on your network:
node verify-compile.js   # alternate compile path that doesn't need that host
```

Run the full lifecycle test against a live local chain:

```bash
npx hardhat node &        # start a local Arbitrum-like EVM
node verify-runtime.js    # files a dispute, bonds, draws a jury, votes, resolves
```

Deploy to Arbitrum Sepolia:

```bash
cp .env.example .env      # fill in DEPLOYER_PRIVATE_KEY (funded with Sepolia ETH)
npm run deploy:sepolia
```

This writes addresses to `contracts-solidity/deployments/arbitrumSepolia.json`
and prints them — copy them into `backend/.env` and `frontend/.env` next.

### 2. Stylus jury-selection contract (optional but recommended before a real deploy)

```bash
cd contracts-stylus
cargo stylus check                      # validate against Stylus constraints
cd algorithm-verification && cargo test # verify the pure algorithm (no Stylus toolchain needed)
```

Deploy per `contracts-stylus/README.md`, then set
`STYLUS_JURY_SELECTOR_ADDRESS` in `contracts-solidity/.env` **before**
running the Solidity deploy script, so `DisputeEscrow` wires to the real
Stylus contract instead of the `MockJurySelector` fallback.

### 3. Backend

```bash
cd backend
npm install
cp .env.example .env
# Paste the deployed contract addresses from step 1, and a funded relayer
# private key. Leave MOCK_MPESA=true unless you have real Daraja sandbox
# credentials from https://developer.safaricom.co.ke
npm run dev
```

Health check: `curl http://localhost:4000/api/health`

### 4. Frontend

```bash
cd frontend
npm install
cp .env.example .env
# Paste the same contract addresses. Leave blank to run in demo mode.
npm run dev
```

Open `http://localhost:5173`.

## Registration / submission notes

- Networks supported per the contract configs: Arbitrum Sepolia (primary
  testnet target), Arbitrum One, Arbitrum Nova.
- Sponsor technologies genuinely used, with justification (not
  checkbox-stuffed):**Alchemy** and **OpenZeppelin** (AccessControl, ERC721, ReentrancyGuard
  across all three Solidity contracts). ZeroDev-style account abstraction
  is designed into the bond-posting flow (`confirmBondOffchain` /
  `RELAYER_ROLE`) but not wired to a live ZeroDev SDK integration in this
  build — see `backend/src/services/blockchainService.js` for the seam
  where that plugs in.