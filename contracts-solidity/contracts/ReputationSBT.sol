// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/// @title ReputationSBT
/// @notice Non-transferable (soulbound) reputation token for Baraza Protocol.
///         Minted the first time a wallet is party to a resolved dispute, then
///         updated in place afterwards. One token per address, ever.
/// @dev Reputation score is stored on-chain as a bounded integer (0-1000) so it
///      can be read cheaply by the Stylus jury-selection contract without an
///      off-chain indexer.
contract ReputationSBT is ERC721, AccessControl {
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");

    uint16 public constant MIN_SCORE = 0;
    uint16 public constant MAX_SCORE = 1000;
    uint16 public constant STARTING_SCORE = 500;

    struct Profile {
        uint16 score;          // reputation score, 0-1000
        uint32 disputesFiled;
        uint32 disputesWon;
        uint32 disputesLost;
        uint32 timesJuror;
        uint32 juryAccuracy;   // count of juror votes that matched final outcome
        uint64 lastUpdated;
    }

    mapping(address => uint256) public tokenIdOf;
    mapping(uint256 => Profile) public profiles;
    uint256 private _nextId = 1;

    event ProfileMinted(address indexed member, uint256 indexed tokenId);
    event ScoreAdjusted(address indexed member, int32 delta, uint16 newScore, string reason);

    error AlreadyMinted();
    error NotMinted();
    error SoulboundToken();

    constructor(address admin) ERC721("Baraza Reputation", "BARAZA-REP") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ISSUER_ROLE, admin);
    }

    /// @notice Mint a fresh soulbound profile for `member` if they don't have one yet.
    function ensureProfile(address member) public onlyRole(ISSUER_ROLE) returns (uint256 tokenId) {
        tokenId = tokenIdOf[member];
        if (tokenId != 0) return tokenId;

        tokenId = _nextId++;
        tokenIdOf[member] = tokenId;
        profiles[tokenId] = Profile({
            score: STARTING_SCORE,
            disputesFiled: 0,
            disputesWon: 0,
            disputesLost: 0,
            timesJuror: 0,
            juryAccuracy: 0,
            lastUpdated: uint64(block.timestamp)
        });
        _safeMint(member, tokenId);
        emit ProfileMinted(member, tokenId);
    }

    /// @notice Adjust a member's score after a dispute resolves or a juror vote is scored.
    /// @param delta Signed change, clamped to [MIN_SCORE, MAX_SCORE].
    function adjustScore(address member, int32 delta, string calldata reason) external onlyRole(ISSUER_ROLE) {
        uint256 tokenId = tokenIdOf[member];
        if (tokenId == 0) revert NotMinted();

        Profile storage p = profiles[tokenId];
        int32 next = int32(uint32(p.score)) + delta;
        if (next < int32(uint32(MIN_SCORE))) next = int32(uint32(MIN_SCORE));
        if (next > int32(uint32(MAX_SCORE))) next = int32(uint32(MAX_SCORE));
        p.score = uint16(uint32(next));
        p.lastUpdated = uint64(block.timestamp);

        emit ScoreAdjusted(member, delta, p.score, reason);
    }

    function recordDisputeOutcome(address member, bool won) external onlyRole(ISSUER_ROLE) {
        uint256 tokenId = tokenIdOf[member];
        if (tokenId == 0) revert NotMinted();
        Profile storage p = profiles[tokenId];
        p.disputesFiled += 1;
        if (won) p.disputesWon += 1;
        else p.disputesLost += 1;
    }

    function recordJurorService(address member, bool votedWithMajority) external onlyRole(ISSUER_ROLE) {
        uint256 tokenId = tokenIdOf[member];
        if (tokenId == 0) revert NotMinted();
        Profile storage p = profiles[tokenId];
        p.timesJuror += 1;
        if (votedWithMajority) p.juryAccuracy += 1;
    }

    function scoreOf(address member) external view returns (uint16) {
        uint256 tokenId = tokenIdOf[member];
        if (tokenId == 0) return STARTING_SCORE; // unregistered members start neutral
        return profiles[tokenId].score;
    }

    // ---- Soulbound enforcement: block every transfer path except mint ----

    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) revert SoulboundToken();
        return super._update(to, tokenId, auth);
    }

    function approve(address, uint256) public pure override(ERC721) {
        revert SoulboundToken();
    }

    function setApprovalForAll(address, bool) public pure override(ERC721) {
        revert SoulboundToken();
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
