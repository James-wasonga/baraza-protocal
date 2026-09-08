// Kept line-for-line in sync with backend/src/config/abis.js. If you change
// a contract's public interface, update both files (and re-run
// `npm run compile` in contracts-solidity to confirm nothing broke).

export const DisputeEscrowABI = [
  "function fileDispute(uint256 circleId, address respondent, uint256 bondAmount, string summary, bytes32[] initialEvidence) returns (uint256)",
  "function postBondNative(uint256 disputeId) payable",
  "function submitEvidence(uint256 disputeId, bytes32 evidenceHash)",
  "function castVote(uint256 disputeId, uint8 vote)",
  "function dismiss(uint256 disputeId)",
  "function markExpired(uint256 disputeId)",
  "function getDispute(uint256 disputeId) view returns (uint256 circleId, address claimant, address respondent, uint256 bondAmount, uint8 status, string summary, uint256 votingDeadline, uint8 outcome)",
  "function getJury(uint256 disputeId) view returns (address[])",
  "function getEvidence(uint256 disputeId) view returns (bytes32[])",
  "function getVoteTally(uint256 disputeId) view returns (uint8, uint8)",
  "event DisputeFiled(uint256 indexed disputeId, uint256 indexed circleId, address indexed claimant, address respondent, uint256 bondAmount, string summary)",
  "event BondPosted(uint256 indexed disputeId, address indexed party, bool viaMpesa)",
  "event JurySelected(uint256 indexed disputeId, address[] jury)",
  "event VoteCast(uint256 indexed disputeId, address indexed juror, uint8 vote)",
  "event DisputeResolved(uint256 indexed disputeId, uint8 outcome, address winner, address loser)",
];

export const BarazaRegistryABI = [
  "function createCircle(string name, string circleType, address[] initialMembers) returns (uint256)",
  "function addMember(uint256 circleId, address member)",
  "function removeMember(uint256 circleId, address member)",
  "function membersOf(uint256 circleId) view returns (address[])",
  "function circlesOf(address member) view returns (uint256[])",
  "function isMember(uint256 circleId, address member) view returns (bool)",
  "function circles(uint256) view returns (string name, string circleType, address creator, uint64 createdAt, bool active)",
  "function memberCount(uint256 circleId) view returns (uint256)",
  "event CircleCreated(uint256 indexed circleId, string name, string circleType, address indexed creator)",
  "event MemberAdded(uint256 indexed circleId, address indexed member)",
];

export const ReputationSBTABI = [
  "function scoreOf(address member) view returns (uint16)",
  "function tokenIdOf(address member) view returns (uint256)",
  "function profiles(uint256 tokenId) view returns (uint16 score, uint32 disputesFiled, uint32 disputesWon, uint32 disputesLost, uint32 timesJuror, uint32 juryAccuracy, uint64 lastUpdated)",
];
