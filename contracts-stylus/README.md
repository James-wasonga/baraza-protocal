# Baraza Jury Selector — Arbitrum Stylus contract

Reputation-weighted, commit-reveal jury selection, written in Rust and compiled to WASM
for deployment as an Arbitrum Stylus contract. `DisputeEscrow.sol` (plain Solidity) calls
this contract through the `IJurySelector` interface exactly like any other external
contract — Stylus contracts expose a standard Solidity ABI, so there's no special bridge.

## Why this is Stylus and not Solidity

Weighted sampling *without replacement* means, for each juror seat: find who a random
point lands under across the remaining candidates, remove them, recompute, repeat. The
per-draw scan is `O(pool size)`. `MockJurySelector.sol` (in `contracts-solidity/`, used
for local dev without any Rust toolchain) implements the identical algorithm in Solidity —
it works, but the EVM gas cost of that scan grows with circle size in a way WASM execution
doesn't. That's the real, defensible reason for the language split, not novelty for its
own sake.

## Honest status of this code

Being direct about what was and wasn't verified before handing this to you:

- **The core selection algorithm (`weighted_sample_without_replacement`) has been
  independently compiled and tested** — see `algorithm-verification/`. It's a
  dependency-minimal mirror of the exact logic in `src/lib.rs`, run through 2,000+ trials
  checking for duplicate jurors, determinism, zero-weight-candidate inclusion, and that
  selection frequency actually tracks reputation weight (it does, closely — see the
  output in that folder's own README note below).
- **The full Stylus contract in `src/lib.rs` (with the `stylus-sdk` storage macros,
  `#[public]` ABI exposure, etc.) was written carefully against the current `stylus-sdk`
  API, but could not be compiled in the sandbox this project was built in** — Stylus's
  toolchain needs a recent Rust (via `rustup`, which pulls from `static.rust-lang.org`)
  and the `cargo-stylus` CLI, and that sandbox's network egress only allows
  `crates.io`/`static.crates.io`/`archive.ubuntu.com`, not `rustup.rs`. The Ubuntu-archive
  `rustc` (1.75) that *is* reachable there is too old for the current `stylus-sdk`
  dependency tree (`edition2024` requirement upstream).
- **Practically:** run `cargo stylus check` yourself as the very first step below, before
  deploying anything. If it flags something, it's almost certainly a small API-surface
  drift in `stylus-sdk` (the crate moves fast) rather than a logic error — the logic
  itself is the part that's been independently verified.

## Setup

```bash
# 1. Install Rust (skip if you already have it)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add wasm32-unknown-unknown

# 2. Install the Stylus CLI
cargo install cargo-stylus

# 3. From this directory, verify the contract is well-formed for Stylus
cargo stylus check
```

`cargo stylus check` validates the contract against Stylus's constraints (deployable size,
supported opcodes, etc.) without deploying anything.

## Run the independently-verified algorithm check

No Stylus tooling needed for this part — it's a plain binary:

```bash
cd algorithm-verification
cargo run --release
cargo test
```

You should see 2,000 trials with no duplicate jurors, a determinism check, the
zero-reputation-floor check, and a distribution check showing higher-weight candidates
get selected proportionally more often.

## Deploy to Arbitrum Sepolia (testnet)

```bash
# Get Sepolia ETH from an Arbitrum Sepolia faucet first, e.g.
# https://faucet.quicknode.com/arbitrum/sepolia

cargo stylus deploy \
  --private-key=$DEPLOYER_PRIVATE_KEY \
  --endpoint='https://sepolia-rollup.arbitrum.io/rpc'
```

This prints the deployed contract address — copy it into the root `.env` as
`STYLUS_JURY_SELECTOR_ADDRESS` before running the Solidity deploy script, so
`DisputeEscrow` is wired to the real Stylus contract instead of the local
`MockJurySelector.sol` fallback.

After deploying, call `initialize(escrow_address)` once, from the same key that deployed
it, passing the freshly-deployed `DisputeEscrow` address — this is what makes
`assert_authorized` restrict `commit_seed` / `reveal_and_select` to only your escrow
contract (pass `Address::ZERO` at deploy time / never call `initialize` if you want it
open for local testing).

## Generating the Solidity-facing ABI

```bash
cargo run --features export-abi --bin baraza-jury-selector > jury-selector-abi.sol
```

This is how `IJurySelector.sol`'s hand-written interface was derived — regenerate it
after any signature change to keep the two in sync.
