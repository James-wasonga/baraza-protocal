//! Binary entrypoint for `cargo stylus` tooling. The actual contract logic
//! lives in `lib.rs` — this file just re-exports it so `cargo stylus check`
//! / `cargo stylus deploy` have a `[[bin]]` target to build against, which
//! is the convention Stylus's tooling expects.

#![cfg_attr(not(feature = "export-abi"), no_main)]

#[cfg(feature = "export-abi")]
fn main() {
    baraza_jury_selector::print_abi("MIT-OR-APACHE-2.0", "pragma solidity ^0.8.24;");
}

#[cfg(not(feature = "export-abi"))]
fn main() {}
