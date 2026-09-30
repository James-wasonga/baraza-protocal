# Key decisions

**Stylus for jury selection, Solidity for everything else.** Weighted
random sampling is the one place raw compute cost scales with circle
size — a real, narrow reason for Stylus, not a novelty language swap.
Escrow, membership, and reputation logic stay in Solidity because
OpenZeppelin's audited primitives are more mature there today.

**USDG as an allowlisted option, not a forced replacement for ETH.**
A stablecoin bond holds a predictable value, which matters for a
refundable deposit. But not every user holds USDG, so ETH stays as the
default path and USDG is opt-in per dispute.

**SHA-256 evidence hashing instead of IPFS pinning.** Hashing proves a
file existed at filing time without exposing it or needing a pinning
service/API key. The trade-off: there's no on-chain-retrievable copy of
the file itself — jurors currently receive it directly from the parties.
Real pinning (Pinata, web3.storage) is the natural upgrade path.

**Manual jury-selection trigger, not an event listener.** Simpler to
build and verify correctly under deadline pressure than a chain-event
listener with its own failure modes. Named as a next step, not hidden.

**A token allowlist on bond currency.** Without it, a claimant could
file a dispute denominated in a worthless or malicious token. The
allowlist is a small addition that closes a real attack surface.