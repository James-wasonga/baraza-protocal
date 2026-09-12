// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./BarazaRegistry.sol";
import "./ReputationSBT.sol";
import "./IJurySelector.sol";

/// @title DisputeEscrow
/// @notice Core Baraza Protocol contract. Files disputes between two members
///         of a registered circle, escrows their bonds, hands jury selection
///         off to the Stylus contract, collects juror votes, and settles the
///         outcome — forfeiting the losing party's bond and updating both
///         parties' on-chain reputation.
///
/// @dev Bonds can arrive two ways, both ending at the same on-chain state:
///        1. Directly in native currency via `postBondNative` (crypto-native users).
///        2. Off-chain via M-Pesa, confirmed on-chain by the backend relayer
///           calling `confirmBondOffchain` after Safaricom Daraja confirms
///           payment — this is what powers gasless, non-crypto-native filing
///           through ZeroDev account abstraction on the frontend.
contract DisputeEscrow is AccessControl, ReentrancyGuard {
    bytes32 public constant RELAYER_ROLE = keccak256("RELAYER_ROLE");     // backend M-Pesa relayer
    bytes32 public constant ARBITER_ADMIN_ROLE = keccak256("ARBITER_ADMIN_ROLE");

    enum Status {
        Filed,                  // claimant filed, respondent bond outstanding
        AwaitingJury,           // both bonds in, seed committed, awaiting reveal+select
        Voting,                 // jury selected, votes open
        Resolved,               // majority reached, funds settled
        Dismissed,              // claimant withdrew before respondent bonded
        Expired                 // respondent missed the bond deadline
    }

    enum Vote { None, Claimant, Respondent }

    struct Dispute {
        uint256 circleId;
        address claimant;
        address respondent;
        uint256 bondAmount;         // required bond per party, in wei
        bool claimantBonded;
        bool respondentBonded;
        uint256 filedAt;
        uint256 bondDeadline;
        uint256 votingDeadline;
        Status status;
        string summary;             // short human-readable claim (also emitted)
        bytes32[] evidenceHashes;   // IPFS CIDs / content hashes, either party
        address[] jury;
        uint8 votesForClaimant;
        uint8 votesForRespondent;
        Vote outcome;
    }

    IJurySelector public jurySelector;
    BarazaRegistry public immutable registry;
    ReputationSBT public immutable reputation;

    uint256 public constant DEFAULT_BOND_DEADLINE = 3 days;
    uint256 public constant DEFAULT_VOTING_DEADLINE = 4 days;
    uint16 public constant PROTOCOL_FEE_BPS = 500; // 5% of loser's forfeited bond -> juror pool

    uint256 private _nextDisputeId = 1;
    mapping(uint256 => Dispute) private _disputes;
    mapping(uint256 => mapping(address => Vote)) public voteOf;
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    event DisputeFiled(uint256 indexed disputeId, uint256 indexed circleId, address indexed claimant, address respondent, uint256 bondAmount, string summary);
    event BondPosted(uint256 indexed disputeId, address indexed party, bool viaMpesa);
    event EvidenceSubmitted(uint256 indexed disputeId, address indexed submitter, bytes32 evidenceHash);
    event JurySeeded(uint256 indexed disputeId, bytes32 seedCommitment);
    event JurySelected(uint256 indexed disputeId, address[] jury);
    event VoteCast(uint256 indexed disputeId, address indexed juror, Vote vote);
    event DisputeResolved(uint256 indexed disputeId, Vote outcome, address winner, address loser);
    event DisputeDismissed(uint256 indexed disputeId);
    event DisputeExpired(uint256 indexed disputeId);

    error NotCircleMember();
    error InvalidStatus();
    error AlreadyBonded();
    error BondDeadlinePassed();
    error NotAParty();
    error NotAJuror();
    error AlreadyVoted();
    error VotingClosed();
    error JurySizeInvalid();
    error TransferFailed();
    error WrongBondAmount();

    constructor(address admin, address registryAddr, address reputationAddr, address jurySelectorAddr) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ARBITER_ADMIN_ROLE, admin);
        _grantRole(RELAYER_ROLE, admin); // admin can reassign to the real backend relayer key
        registry = BarazaRegistry(registryAddr);
        reputation = ReputationSBT(reputationAddr);
        jurySelector = IJurySelector(jurySelectorAddr);
    }

    // ---------------------------------------------------------------------
    // Filing
    // ---------------------------------------------------------------------

    /// @notice File a dispute against another member of the same circle.
    /// @dev The claimant's bond is posted separately (native or M-Pesa) so
    ///      gasless flows can file first, then confirm payment async.
    function fileDispute(
        uint256 circleId,
        address respondent,
        uint256 bondAmount,
        string calldata summary,
        bytes32[] calldata initialEvidence
    ) external returns (uint256 disputeId) {
        if (!registry.isMember(circleId, msg.sender) || !registry.isMember(circleId, respondent)) {
            revert NotCircleMember();
        }

        disputeId = _nextDisputeId++;
        Dispute storage d = _disputes[disputeId];
        d.circleId = circleId;
        d.claimant = msg.sender;
        d.respondent = respondent;
        d.bondAmount = bondAmount;
        d.filedAt = block.timestamp;
        d.bondDeadline = block.timestamp + DEFAULT_BOND_DEADLINE;
        d.status = Status.Filed;
        d.summary = summary;

        for (uint256 i = 0; i < initialEvidence.length; i++) {
            d.evidenceHashes.push(initialEvidence[i]);
            emit EvidenceSubmitted(disputeId, msg.sender, initialEvidence[i]);
        }

        reputation.ensureProfile(msg.sender);
        reputation.ensureProfile(respondent);

        emit DisputeFiled(disputeId, circleId, msg.sender, respondent, bondAmount, summary);
    }

    // ---------------------------------------------------------------------
    // Bonding
    // ---------------------------------------------------------------------

    function postBondNative(uint256 disputeId) external payable nonReentrant {
        Dispute storage d = _disputes[disputeId];
        if (d.status != Status.Filed) revert InvalidStatus();
        if (msg.sender != d.claimant && msg.sender != d.respondent) revert NotAParty();
        if (msg.value != d.bondAmount) revert WrongBondAmount();
        _markBonded(disputeId, msg.sender, false);
    }

    /// @notice Called by the trusted backend relayer once Safaricom Daraja
    ///         confirms an M-Pesa STK Push for this dispute's bond. The bond
    ///         value is tracked but held by the protocol treasury off-chain
    ///         equivalent; on resolution, payouts are issued back through the
    ///         same M-Pesa rail for non-crypto-native winners.
    function confirmBondOffchain(uint256 disputeId, address party) external onlyRole(RELAYER_ROLE) {
        Dispute storage d = _disputes[disputeId];
        if (d.status != Status.Filed) revert InvalidStatus();
        if (party != d.claimant && party != d.respondent) revert NotAParty();
        _markBonded(disputeId, party, true);
    }

    function _markBonded(uint256 disputeId, address party, bool viaMpesa) internal {
        Dispute storage d = _disputes[disputeId];
        if (block.timestamp > d.bondDeadline) revert BondDeadlinePassed();

        if (party == d.claimant) {
            if (d.claimantBonded) revert AlreadyBonded();
            d.claimantBonded = true;
        } else {
            if (d.respondentBonded) revert AlreadyBonded();
            d.respondentBonded = true;
        }
        emit BondPosted(disputeId, party, viaMpesa);

        if (d.claimantBonded && d.respondentBonded) {
            d.status = Status.AwaitingJury;
        }
    }

    /// @notice Claimant can withdraw before the respondent bonds; claimant's
    ///         bond (if posted natively) is refunded.
    function dismiss(uint256 disputeId) external nonReentrant {
        Dispute storage d = _disputes[disputeId];
        if (msg.sender != d.claimant) revert NotAParty();
        if (d.status != Status.Filed) revert InvalidStatus();

        d.status = Status.Dismissed;
        if (d.claimantBonded && address(this).balance >= d.bondAmount) {
            (bool ok, ) = d.claimant.call{value: d.bondAmount}("");
            if (!ok) revert TransferFailed();
        }
        emit DisputeDismissed(disputeId);
    }

    /// @notice Anyone can call after the bond deadline if the respondent never bonded.
    function markExpired(uint256 disputeId) external nonReentrant {
        Dispute storage d = _disputes[disputeId];
        if (d.status != Status.Filed) revert InvalidStatus();
        if (block.timestamp <= d.bondDeadline) revert BondDeadlinePassed();

        d.status = Status.Expired;
        if (d.claimantBonded && address(this).balance >= d.bondAmount) {
            (bool ok, ) = d.claimant.call{value: d.bondAmount}("");
            if (!ok) revert TransferFailed();
        }
        // Non-response is itself informative: dock a small reputation penalty.
        reputation.adjustScore(d.respondent, -15, "missed-bond-deadline");
        emit DisputeExpired(disputeId);
    }

    // ---------------------------------------------------------------------
    // Evidence
    // ---------------------------------------------------------------------

    function submitEvidence(uint256 disputeId, bytes32 evidenceHash) external {
        Dispute storage d = _disputes[disputeId];
        if (msg.sender != d.claimant && msg.sender != d.respondent) revert NotAParty();
        if (d.status == Status.Resolved || d.status == Status.Dismissed || d.status == Status.Expired) {
            revert InvalidStatus();
        }
        d.evidenceHashes.push(evidenceHash);
        emit EvidenceSubmitted(disputeId, msg.sender, evidenceHash);
    }

    // ---------------------------------------------------------------------
    // Jury selection (delegates weighted randomness to the Stylus contract)
    // ---------------------------------------------------------------------

    function commitJurySeed(uint256 disputeId, bytes32 seedCommitment) external onlyRole(ARBITER_ADMIN_ROLE) {
        Dispute storage d = _disputes[disputeId];
        if (d.status != Status.AwaitingJury) revert InvalidStatus();
        jurySelector.commitSeed(bytes32(disputeId), seedCommitment);
        emit JurySeeded(disputeId, seedCommitment);
    }

    /// @param pool Candidate jurors (typically: circle members minus the two parties).
    /// @param weights Each candidate's current reputation score, same order as `pool`.
    function revealAndSelectJury(
        uint256 disputeId,
        bytes32 seed,
        address[] calldata pool,
        uint16[] calldata weights,
        uint8 jurySize
    ) external onlyRole(ARBITER_ADMIN_ROLE) {
        Dispute storage d = _disputes[disputeId];
        if (d.status != Status.AwaitingJury) revert InvalidStatus();
        if (jurySize == 0 || jurySize % 2 == 0) revert JurySizeInvalid();

        address[] memory selected = jurySelector.revealAndSelect(
            bytes32(disputeId), seed, pool, weights, jurySize
        );

        for (uint256 i = 0; i < selected.length; i++) {
            d.jury.push(selected[i]);
        }
        d.status = Status.Voting;
        d.votingDeadline = block.timestamp + DEFAULT_VOTING_DEADLINE;

        emit JurySelected(disputeId, selected);
    }

    // ---------------------------------------------------------------------
    // Voting & resolution
    // ---------------------------------------------------------------------

    function castVote(uint256 disputeId, Vote vote) external {
        Dispute storage d = _disputes[disputeId];
        if (d.status != Status.Voting) revert InvalidStatus();
        if (block.timestamp > d.votingDeadline) revert VotingClosed();
        if (!_isJuror(disputeId, msg.sender)) revert NotAJuror();
        if (hasVoted[disputeId][msg.sender]) revert AlreadyVoted();
        if (vote == Vote.None) revert InvalidStatus();

        hasVoted[disputeId][msg.sender] = true;
        voteOf[disputeId][msg.sender] = vote;

        if (vote == Vote.Claimant) d.votesForClaimant += 1;
        else d.votesForRespondent += 1;

        emit VoteCast(disputeId, msg.sender, vote);

        // Auto-resolve once a strict majority of the jury has voted one way.
        uint8 majorityThreshold = uint8(d.jury.length / 2) + 1;
        if (d.votesForClaimant >= majorityThreshold) {
            _resolve(disputeId, Vote.Claimant);
        } else if (d.votesForRespondent >= majorityThreshold) {
            _resolve(disputeId, Vote.Respondent);
        }
    }

    function _resolve(uint256 disputeId, Vote outcome) internal nonReentrant {
        Dispute storage d = _disputes[disputeId];
        d.status = Status.Resolved;
        d.outcome = outcome;

        address winner = outcome == Vote.Claimant ? d.claimant : d.respondent;
        address loser = outcome == Vote.Claimant ? d.respondent : d.claimant;

        reputation.recordDisputeOutcome(winner, true);
        reputation.recordDisputeOutcome(loser, false);
        reputation.adjustScore(winner, 25, "dispute-won");
        reputation.adjustScore(loser, -40, "dispute-lost");

        for (uint256 i = 0; i < d.jury.length; i++) {
            address juror = d.jury[i];
            bool votedWithMajority = voteOf[disputeId][juror] == outcome;
            reputation.recordJurorService(juror, votedWithMajority);
            if (votedWithMajority) {
                reputation.adjustScore(juror, 5, "juror-majority-vote");
            }
        }

        uint256 pot = 2 * d.bondAmount;
        uint256 fee = (pot * PROTOCOL_FEE_BPS) / 10_000;
        uint256 payout = pot - fee;

        if (address(this).balance >= payout) {
            (bool ok, ) = winner.call{value: payout}("");
            if (!ok) revert TransferFailed();
        }
        // `fee` remains in the contract as the juror reward pool, claimable
        // off-chain via the backend's payout job (kept simple on-chain).

        emit DisputeResolved(disputeId, outcome, winner, loser);
    }

    function _isJuror(uint256 disputeId, address who) internal view returns (bool) {
        address[] storage jury = _disputes[disputeId].jury;
        for (uint256 i = 0; i < jury.length; i++) {
            if (jury[i] == who) return true;
        }
        return false;
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    function getDispute(uint256 disputeId) external view returns (
        uint256 circleId,
        address claimant,
        address respondent,
        uint256 bondAmount,
        Status status,
        string memory summary,
        uint256 votingDeadline,
        Vote outcome
    ) {
        Dispute storage d = _disputes[disputeId];
        return (d.circleId, d.claimant, d.respondent, d.bondAmount, d.status, d.summary, d.votingDeadline, d.outcome);
    }

    function getJury(uint256 disputeId) external view returns (address[] memory) {
        return _disputes[disputeId].jury;
    }

    function getEvidence(uint256 disputeId) external view returns (bytes32[] memory) {
        return _disputes[disputeId].evidenceHashes;
    }

    function getVoteTally(uint256 disputeId) external view returns (uint8 forClaimant, uint8 forRespondent) {
        Dispute storage d = _disputes[disputeId];
        return (d.votesForClaimant, d.votesForRespondent);
    }

    function setJurySelector(address newSelector) external onlyRole(DEFAULT_ADMIN_ROLE) {
        jurySelector = IJurySelector(newSelector);
    }

    receive() external payable {}
}
