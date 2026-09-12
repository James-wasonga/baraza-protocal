//! Standalone, dependency-minimal mirror of `contracts-stylus/src/lib.rs`'s
//! `weighted_sample_without_replacement`. This crate exists ONLY to let the
//! core selection algorithm be compiled and property-tested in an
//! environment without the full Stylus/alloy toolchain — see the note in
//! the root README about why the Stylus contract itself couldn't be built
//! in this sandbox. The selection logic here is line-for-line equivalent;
//! it uses a plain u64-chunked big-number modulo instead of alloy's U256,
//! which is mathematically identical for a 256-bit dividend and a divisor
//! that fits in u64 (true here: total weight is a sum of u16s).

use tiny_keccak::{Hasher, Keccak};

pub type Address = [u8; 20];

fn concat_hash(a: &[u8], b: &[u8]) -> [u8; 32] {
    let mut hasher = Keccak::v256();
    hasher.update(a);
    hasher.update(b);
    let mut out = [0u8; 32];
    hasher.finalize(&mut out);
    out
}

/// (256-bit big-endian number) mod (divisor), divisor <= u64::MAX.
/// Standard byte-at-a-time long-division-by-substitution algorithm —
/// mathematically identical to `U256::from_be_bytes(bytes) % U256::from(divisor)`.
fn mod_u256_by_u64(bytes: &[u8; 32], divisor: u64) -> u64 {
    let mut rem: u128 = 0;
    for &b in bytes.iter() {
        rem = (rem * 256 + b as u128) % divisor as u128;
    }
    rem as u64
}

pub fn weighted_sample_without_replacement(
    pool: &[Address],
    weights: &[u16],
    count: usize,
    seed: &[u8; 32],
    dispute_id: &[u8; 32],
) -> Vec<Address> {
    let n = pool.len();
    let remaining_weight: Vec<u64> = weights
        .iter()
        .map(|&w| if w == 0 { 1u64 } else { w as u64 })
        .collect();
    let mut taken = vec![false; n];

    let mut entropy = concat_hash(seed, dispute_id);
    let mut selected = Vec::with_capacity(count);

    for round in 0..count {
        let total: u64 = remaining_weight
            .iter()
            .zip(taken.iter())
            .filter(|(_, &t)| !t)
            .map(|(w, _)| *w)
            .sum();

        if total == 0 {
            break;
        }

        entropy = concat_hash(&entropy, &(round as u32).to_be_bytes());
        let point = mod_u256_by_u64(&entropy, total);

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

fn addr(byte: u8) -> Address {
    let mut bytes = [0u8; 20];
    bytes[19] = byte;
    bytes
}

fn main() {
    println!("Running Baraza jury-selection algorithm verification...\n");

    // 1. Basic sanity run
    let pool = vec![addr(1), addr(2), addr(3), addr(4), addr(5)];
    let weights = vec![500u16, 900, 100, 700, 300];
    let seed = [7u8; 32];
    let dispute_id = [9u8; 32];
    let selected = weighted_sample_without_replacement(&pool, &weights, 3, &seed, &dispute_id);
    println!("Sample draw (3 of 5): {:?}", selected.iter().map(|a| a[19]).collect::<Vec<_>>());
    assert_eq!(selected.len(), 3);

    // 2. No duplicates, ever, across many trials
    for trial in 0..2000u32 {
        let seed = {
            let mut s = [0u8; 32];
            s[0..4].copy_from_slice(&trial.to_be_bytes());
            s
        };
        let selected = weighted_sample_without_replacement(&pool, &weights, 3, &seed, &dispute_id);
        let mut unique = selected.clone();
        unique.sort();
        unique.dedup();
        assert_eq!(unique.len(), selected.len(), "duplicate found in trial {trial}");
    }
    println!("✅ 2000 trials, no duplicate jurors in any draw");

    // 3. Determinism: same seed + dispute_id -> same jury, always
    let a = weighted_sample_without_replacement(&pool, &weights, 3, &seed, &dispute_id);
    let b = weighted_sample_without_replacement(&pool, &weights, 3, &seed, &dispute_id);
    assert_eq!(a, b);
    println!("✅ deterministic given identical seed + dispute id");

    // 4. Zero-weight candidates are still selectable (floored to weight 1)
    let pool2 = vec![addr(1), addr(2)];
    let weights2 = vec![0u16, 1000];
    let sel2 = weighted_sample_without_replacement(&pool2, &weights2, 2, &seed, &dispute_id);
    assert_eq!(sel2.len(), 2);
    println!("✅ zero-reputation members remain includable (floored weight)");

    // 5. Distribution sanity check: higher weight => selected more often
    // (statistical, not exact — run many trials and check monotonic ordering
    // roughly holds for a skewed weight set)
    let pool3 = vec![addr(1), addr(2), addr(3)];
    let weights3 = vec![50u16, 500, 950]; // heavily skewed
    let mut counts = [0u32; 3];
    for trial in 0..5000u32 {
        let mut s = [0u8; 32];
        s[0..4].copy_from_slice(&trial.to_be_bytes());
        s[31] = 0xAB;
        let sel = weighted_sample_without_replacement(&pool3, &weights3, 1, &s, &dispute_id);
        let idx = pool3.iter().position(|p| *p == sel[0]).unwrap();
        counts[idx] += 1;
    }
    println!(
        "Single-seat draw over 5000 trials, weights [50, 500, 950] -> picked counts: {:?}",
        counts
    );
    assert!(counts[2] > counts[1], "highest-weight candidate should be picked most often");
    assert!(counts[1] > counts[0], "mid-weight candidate should beat lowest-weight");
    println!("✅ selection frequency tracks reputation weight, as designed");

    println!("\nAll checks passed. This is the exact selection algorithm used in");
    println!("contracts-stylus/src/lib.rs::weighted_sample_without_replacement.");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn no_duplicates_across_many_seeds() {
        let pool = vec![addr(1), addr(2), addr(3), addr(4), addr(5)];
        let weights = vec![500u16, 900, 100, 700, 300];
        for trial in 0..500u32 {
            let mut seed = [0u8; 32];
            seed[0..4].copy_from_slice(&trial.to_be_bytes());
            let dispute_id = [9u8; 32];
            let selected = weighted_sample_without_replacement(&pool, &weights, 3, &seed, &dispute_id);
            let mut unique = selected.clone();
            unique.sort();
            unique.dedup();
            assert_eq!(unique.len(), selected.len());
        }
    }

    #[test]
    fn deterministic() {
        let pool = vec![addr(1), addr(2), addr(3), addr(4)];
        let weights = vec![500u16, 500, 500, 500];
        let seed = [3u8; 32];
        let dispute_id = [4u8; 32];
        let a = weighted_sample_without_replacement(&pool, &weights, 2, &seed, &dispute_id);
        let b = weighted_sample_without_replacement(&pool, &weights, 2, &seed, &dispute_id);
        assert_eq!(a, b);
    }
}
