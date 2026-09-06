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