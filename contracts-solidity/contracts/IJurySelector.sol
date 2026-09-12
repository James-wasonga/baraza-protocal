// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IJurySelector
/// @notice ABI for the Stylus (Rust/WASM) jury-selection contract. Arbitrum
///         Stylus contracts expose a standard Solidity ABI, so DisputeEscrow
///         (EVM/Solidity) calls into the Stylus contract exactly like any
///         other external contract — this is the seam between the two VMs.
///
///         The Stylus side runs a commit-reveal weighted random draw over the
///         candidate pool, where weight is proportional to each candidate's
///         reputation score. That combinatorial weighting is done in Rust for
///         gas efficiency at pool sizes that would be expensive to loop over
///         in Solidity.
interface IJurySelector {
    /// @notice Register the hash of this dispute's random seed. Must be called
    ///         before `revealAndSelect`, in a separate transaction, so the
    ///         seed can't be chosen after seeing who's in the pool (basic
    ///         commit-reveal to resist juror-pool manipulation).
    function commitSeed(bytes32 disputeId, bytes32 seedCommitment) external;

    /// @notice Reveal the seed and run the weighted draw.
    /// @param disputeId Unique id of the dispute (from DisputeEscrow).
    /// @param seed The pre-image of the earlier commitment.
    /// @param pool Candidate juror addresses (must exclude the two dispute parties).
    /// @param weights Reputation scores (0-1000) for each address in `pool`, same order.
    /// @param jurySize Number of jurors to select (must be odd, e.g. 3 or 5).
    /// @return selected The chosen juror addresses.
    function revealAndSelect(
        bytes32 disputeId,
        bytes32 seed,
        address[] calldata pool,
        uint16[] calldata weights,
        uint8 jurySize
    ) external returns (address[] memory selected);

    /// @notice Read back a previously computed jury without recomputing it.
    function juryOf(bytes32 disputeId) external view returns (address[] memory);
}
