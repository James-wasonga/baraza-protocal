// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./IJurySelector.sol";

/// @title MockJurySelector
/// @notice Solidity re-implementation of the Stylus jury-selection contract's
///         interface, for local development and unit testing without the
///         cargo-stylus toolchain installed. Uses the same commit-reveal +
///         weighted-random algorithm, just less gas-efficient — this is a
///         drop-in stand-in, not a simplification of the logic.
///         Swap DisputeEscrow's `jurySelector` to the real Stylus deployment
///         for production (see contracts-stylus/).
contract MockJurySelector is IJurySelector {
    mapping(bytes32 => bytes32) public seedCommitments;
    mapping(bytes32 => address[]) private _juries;

    error NoCommitment();
    error SeedMismatch();
    error PoolTooSmall();

    function commitSeed(bytes32 disputeId, bytes32 seedCommitment) external override {
        seedCommitments[disputeId] = seedCommitment;
    }

    function revealAndSelect(
        bytes32 disputeId,
        bytes32 seed,
        address[] calldata pool,
        uint16[] calldata weights,
        uint8 jurySize
    ) external override returns (address[] memory selected) {
        if (seedCommitments[disputeId] == bytes32(0)) revert NoCommitment();
        if (keccak256(abi.encodePacked(seed)) != seedCommitments[disputeId]) revert SeedMismatch();
        if (pool.length < jurySize) revert PoolTooSmall();

        // Weighted sampling without replacement: repeatedly draw a point in
        // [0, totalWeight), find the candidate it falls under, remove them,
        // recompute total, repeat. O(n * jurySize) — fine for chama-sized
        // pools (tens of members); the Stylus version optimizes this for
        // larger pools using a Fenwick-tree walk in Rust.
        uint256 n = pool.length;
        address[] memory candidates = new address[](n);
        uint256[] memory w = new uint256[](n);
        uint256 total = 0;
        for (uint256 i = 0; i < n; i++) {
            candidates[i] = pool[i];
            w[i] = weights[i] == 0 ? 1 : weights[i]; // floor weight of 1 so nobody has zero chance
            total += w[i];
        }

        selected = new address[](jurySize);
        bytes32 entropy = keccak256(abi.encodePacked(seed, disputeId));

        for (uint8 s = 0; s < jurySize; s++) {
            entropy = keccak256(abi.encodePacked(entropy, s));
            uint256 pick = uint256(entropy) % total;

            uint256 cumulative = 0;
            uint256 chosenIdx = 0;
            for (uint256 i = 0; i < n; i++) {
                if (w[i] == 0) continue;
                cumulative += w[i];
                if (pick < cumulative) {
                    chosenIdx = i;
                    break;
                }
            }

            selected[s] = candidates[chosenIdx];
            total -= w[chosenIdx];
            w[chosenIdx] = 0;
        }

        _juries[disputeId] = selected;
    }

    function juryOf(bytes32 disputeId) external view override returns (address[] memory) {
        return _juries[disputeId];
    }
}
