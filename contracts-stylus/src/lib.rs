//! Baraza Protocol — Jury Selector (Arbitrum Stylus)
//!
//! Reputation-weighted, commit-reveal jury selection. This is the one piece
//! of Baraza Protocol that lives outside the EVM: it's written in Rust,
//! compiled to WASM, and deployed as a Stylus contract that `DisputeEscrow`
//! (plain Solidity) calls through a normal external-contract call — Stylus
//! contracts expose a standard Solidity ABI, so the two VMs interoperate
//! without any special bridging.
//!
//! Why this needs to exist as a contract instead of a Solidity loop:
//! weighted-random sampling *without replacement* over a pool means, for
//! each of `jury_size` draws, walking the remaining candidates to find who a
//! random point lands under, then removing them and recomputing. Solidity
//! can do this (see `MockJurySelector.sol`, used for local dev), but the
//! per-draw O(n) scan gets expensive fast in EVM gas as chama/circle sizes
//! grow past a couple dozen members. Rust compiled to WASM does the same
//! walk far more cheaply, which is the actual, defensible reason this half
//! of the protocol is Stylus rather than a "for novelty" language swap.
//!
//! Commit-reveal: the disputing parties, jurors, and anyone watching the
//! mempool must not be able to see (and therefore game) the random seed
//! before the candidate pool is finalized. `commit_seed` locks in
//! `keccak256(seed)` in one transaction; `reveal_and_select` — called in a
//! later transaction — checks the reveal matches, then runs the draw.

#![cfg_attr(not(feature = "export-abi"), no_main)]
extern crate alloc;

use alloc::vec::Vec;
use alloy_primitives::{Address, FixedBytes, U256};
use stylus_sdk::{
    abi::Bytes,
    prelude::*,
    storage::{StorageAddress, StorageFixedBytes, StorageMap, StorageVec},
};
use tiny_keccak::{Hasher, Keccak};

sol_storage! {
    #[entrypoint]
    pub struct JurySelector {
        /// disputeId => keccak256(seed) commitment
        mapping(bytes32 => bytes32) seed_commitments;
        /// disputeId => selected jury (populated after reveal_and_select)
        mapping(bytes32 => address[]) juries;
        /// disputeId => true once a jury has been drawn (prevents re-draw)
        mapping(bytes32 => bool) resolved;
        /// contract owner, allowed to update `authorized_caller`
        address owner;
        /// the DisputeEscrow contract permitted to call commit/reveal
        /// (0x0 = unrestricted, useful for local testing)
        address authorized_caller;
    }
}

#[public]
impl JurySelector {
    /// One-time setup after deployment: sets the deployer as owner and,
    /// optionally, pins down which DisputeEscrow address may call this
    /// contract. Safe to call again only by the current owner.
    pub fn initialize(&mut self, escrow_address: Address) -> Result<(), Vec<u8>> {
        if self.owner.get() != Address::ZERO && self.vm().msg_sender() != self.owner.get() {
            return Err(b"already initialized by another owner".to_vec());
        }
        self.owner.set(self.vm().msg_sender());
        self.authorized_caller.set(escrow_address);
        Ok(())
    }

    /// Lock in the hash of a random seed for `dispute_id`. Must happen in a
    /// transaction strictly before `reveal_and_select` for the same id.
    pub fn commit_seed(&mut self, dispute_id: FixedBytes<32>, seed_commitment: FixedBytes<32>) -> Result<(), Vec<u8>> {
        self.assert_authorized()?;
        if self.resolved.get(dispute_id) {
            return Err(b"dispute already resolved".to_vec());
        }
        self.seed_commitments.setter(dispute_id).set(seed_commitment);
        Ok(())
    }

    /// Reveal the seed and draw `jury_size` addresses from `pool`, weighted
    /// by `weights` (parallel array, same length and order as `pool`).
    /// Weight is each candidate's on-chain reputation score (0-1000); a
    /// weight of 0 is floored to 1 so nobody has an absolute-zero chance —
    /// even a freshly-slashed member can, rarely, still be drawn, which
    /// keeps the jury pool from silently shrinking to "always the same
    /// high-reputation few" in a small chama.
    pub fn reveal_and_select(
        &mut self,
        dispute_id: FixedBytes<32>,
        seed: FixedBytes<32>,
        pool: Vec<Address>,
        weights: Vec<u16>,
        jury_size: u8,
    ) -> Result<Vec<Address>, Vec<u8>> {
        self.assert_authorized()?;

        if self.resolved.get(dispute_id) {
            return Err(b"dispute already resolved".to_vec());
        }
        if pool.len() != weights.len() {
            return Err(b"pool/weights length mismatch".to_vec());
        }
        if jury_size == 0 || (jury_size as usize) > pool.len() {
            return Err(b"invalid jury size".to_vec());
        }

        let commitment = self.seed_commitments.get(dispute_id);
        if commitment == FixedBytes::<32>::ZERO {
            return Err(b"no seed commitment found".to_vec());
        }
        if keccak256_bytes32(&seed) != commitment {
            return Err(b"seed does not match commitment".to_vec());
        }

        let selected = weighted_sample_without_replacement(
            &pool,
            &weights,
            jury_size as usize,
            &seed,
            &dispute_id,
        );

        let mut jury_storage = self.juries.setter(dispute_id);
        for addr in selected.iter() {
            jury_storage.push(*addr);
        }
        self.resolved.setter(dispute_id).set(true);

        Ok(selected)
    }

    /// Read back a previously-computed jury (view function).
    pub fn jury_of(&self, dispute_id: FixedBytes<32>) -> Result<Vec<Address>, Vec<u8>> {
        let jury = self.juries.get(dispute_id);
        let mut out = Vec::with_capacity(jury.len());
        for i in 0..jury.len() {
            if let Some(addr) = jury.get(i) {
                out.push(addr);
            }
        }
        Ok(out)
    }

    pub fn is_resolved(&self, dispute_id: FixedBytes<32>) -> Result<bool, Vec<u8>> {
        Ok(self.resolved.get(dispute_id))
    }

    /// Owner-only: rotate which contract is allowed to call commit/reveal,
    /// e.g. after redeploying DisputeEscrow.
    pub fn set_authorized_caller(&mut self, new_caller: Address) -> Result<(), Vec<u8>> {
        if self.vm().msg_sender() != self.owner.get() {
            return Err(b"not owner".to_vec());
        }
        self.authorized_caller.set(new_caller);
        Ok(())
    }
}

impl JurySelector {
    fn assert_authorized(&self) -> Result<(), Vec<u8>> {
        let authorized = self.authorized_caller.get();
        if authorized != Address::ZERO && self.vm().msg_sender() != authorized {
            return Err(b"caller not authorized".to_vec());
        }
        Ok(())
    }
}

/// Weighted sampling without replacement, deterministic given `seed` +
/// `dispute_id`. For each of `count` draws: hash the running entropy to get
/// a pseudo-random point in `[0, total_remaining_weight)`, walk the
/// candidate list accumulating weight until the point falls inside a
/// candidate's slice, select them, remove their weight from the pool, and
/// re-derive entropy for the next draw.
///
/// This is intentionally simple (a linear walk) rather than a Fenwick-tree /
/// binary-indexed structure — for chama-sized pools (tens of members, not
/// thousands) the linear scan costs nothing meaningful in Stylus's ink-metered
/// WASM execution, and simple code is easier for hackathon judges (and
/// future contributors) to audit than a segment tree would be. A Fenwick
/// tree is the natural upgrade path if Baraza ever needs jury pools in the
/// thousands.
fn weighted_sample_without_replacement(
    pool: &[Address],
    weights: &[u16],
    count: usize,
    seed: &FixedBytes<32>,
    dispute_id: &FixedBytes<32>,
) -> Vec<Address> {
    let n = pool.len();
    let mut remaining_weight: Vec<u64> = weights
        .iter()
        .map(|&w| if w == 0 { 1u64 } else { w as u64 })
        .collect();
    let mut taken = alloc::vec![false; n];

    let mut entropy = concat_hash(seed.as_slice(), dispute_id.as_slice());
    let mut selected = Vec::with_capacity(count);

    for round in 0..count {
        let total: u64 = remaining_weight
            .iter()
            .zip(taken.iter())
            .filter(|(_, &t)| !t)
            .map(|(w, _)| *w)
            .sum();

        if total == 0 {
            break; // pool exhausted (shouldn't happen given the jury_size <= pool.len() check)
        }

        entropy = concat_hash(entropy.as_slice(), &(round as u32).to_be_bytes());
        let point = u256_from_be(&entropy) % U256::from(total);
        let point: u64 = point.try_into().unwrap_or(0);

        let mut cumulative: u64 = 0;
        let mut chosen_idx = 0usize;
        for i in 0..n {
            if taken[i] {
                continue;
            }
            cumulative += remaining_weight[i];
            if point < cumulative {
                chosen_idx = i;
                break;
            }
        }

        taken[chosen_idx] = true;
        selected.push(pool[chosen_idx]);
    }

    selected
}

fn concat_hash(a: &[u8], b: &[u8]) -> [u8; 32] {
    let mut hasher = Keccak::v256();
    hasher.update(a);
    hasher.update(b);
    let mut out = [0u8; 32];
    hasher.finalize(&mut out);
    out
}

fn keccak256_bytes32(input: &FixedBytes<32>) -> FixedBytes<32> {
    let mut hasher = Keccak::v256();
    hasher.update(input.as_slice());
    let mut out = [0u8; 32];
    hasher.finalize(&mut out);
    FixedBytes::from(out)
}

fn u256_from_be(bytes: &[u8; 32]) -> U256 {
    U256::from_be_bytes(*bytes)
}

// Unit tests run on the host target (not wasm32), exercising the pure
// selection logic directly without needing a Stylus/Arbitrum test node.
#[cfg(test)]
mod tests {
    use super::*;

    fn addr(byte: u8) -> Address {
        let mut bytes = [0u8; 20];
        bytes[19] = byte;
        Address::from(bytes)
    }

    #[test]
    fn selects_requested_count_with_no_duplicates() {
        let pool = alloc::vec![addr(1), addr(2), addr(3), addr(4), addr(5)];
        let weights = alloc::vec![500u16, 900, 100, 700, 300];
        let seed = FixedBytes::<32>::from([7u8; 32]);
        let dispute_id = FixedBytes::<32>::from([9u8; 32]);

        let selected = weighted_sample_without_replacement(&pool, &weights, 3, &seed, &dispute_id);

        assert_eq!(selected.len(), 3);
        let mut unique = selected.clone();
        unique.sort();
        unique.dedup();
        assert_eq!(unique.len(), 3, "jury must not contain duplicates");
        for s in &selected {
            assert!(pool.contains(s));
        }
    }

    #[test]
    fn is_deterministic_given_same_seed_and_dispute_id() {
        let pool = alloc::vec![addr(1), addr(2), addr(3), addr(4)];
        let weights = alloc::vec![500u16, 500, 500, 500];
        let seed = FixedBytes::<32>::from([3u8; 32]);
        let dispute_id = FixedBytes::<32>::from([4u8; 32]);

        let a = weighted_sample_without_replacement(&pool, &weights, 2, &seed, &dispute_id);
        let b = weighted_sample_without_replacement(&pool, &weights, 2, &seed, &dispute_id);
        assert_eq!(a, b);
    }

    #[test]
    fn different_dispute_ids_produce_different_draws_with_high_probability() {
        let pool = alloc::vec![addr(1), addr(2), addr(3), addr(4), addr(5), addr(6), addr(7), addr(8)];
        let weights = alloc::vec![500u16; 8];
        let seed = FixedBytes::<32>::from([1u8; 32]);

        let a = weighted_sample_without_replacement(&pool, &weights, 3, &seed, &FixedBytes::<32>::from([1u8; 32]));
        let b = weighted_sample_without_replacement(&pool, &weights, 3, &seed, &FixedBytes::<32>::from([2u8; 32]));
        assert_ne!(a, b, "different dispute ids should (almost always) draw a different jury");
    }

    #[test]
    fn zero_weight_candidates_can_still_be_drawn() {
        // A member with a slashed-to-zero reputation still has a nonzero
        // (floored to 1) chance, so the jury pool never silently excludes them.
        let pool = alloc::vec![addr(1), addr(2)];
        let weights = alloc::vec![0u16, 1000];
        let seed = FixedBytes::<32>::from([5u8; 32]);
        let dispute_id = FixedBytes::<32>::from([6u8; 32]);

        let selected = weighted_sample_without_replacement(&pool, &weights, 2, &seed, &dispute_id);
        assert_eq!(selected.len(), 2);
    }
}
