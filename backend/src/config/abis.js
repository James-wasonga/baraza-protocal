// Minimal ABI fragments — only what the backend actually calls or listens
// for. Keep these in sync with contracts-solidity/contracts/*.sol. For the
// frontend's full ABI needs, see frontend/src/lib/abis.js instead (it needs
// the read-heavy view functions too).

const DisputeEscrowABI = [
  "function fileDispute(uint256 circleId, address respondent, uint256 bondAmount, string summary, bytes32[] initialEvidence) returns (uint256)",
  "function confirmBondOffchain(uint256 disputeId, address party)",
  "function commitJurySeed(uint256 disputeId, bytes32 seedCommitment)",
  "function revealAndSelectJury(uint256 disputeId, bytes32 seed, address[] pool, uint16[] weights, uint8 jurySize) returns (address[])",
  "function getDispute(uint256 disputeId) view returns (uint256 circleId, address claimant, address respondent, uint256 bondAmount, uint8 status, string summary, uint256 votingDeadline, uint8 outcome)",
  "function getJury(uint256 disputeId) view returns (address[])",
  "function getEvidence(uint256 disputeId) view returns (bytes32[])",
  "function getVoteTally(uint256 disputeId) view returns (uint8, uint8)",
  "event DisputeFiled(uint256 indexed disputeId, uint256 indexed circleId, address indexed claimant, address respondent, uint256 bondAmount, string summary)",
  "event BondPosted(uint256 indexed disputeId, address indexed party, bool viaMpesa)",
  "event JurySelected(uint256 indexed disputeId, address[] jury)",
  "event DisputeResolved(uint256 indexed disputeId, uint8 outcome, address winner, address loser)"
];

const BarazaRegistryABI = [
  "function createCircle(string name, string circleType, address[] initialMembers) returns (uint256)",
  "function addMember(uint256 circleId, address member)",
  "function membersOf(uint256 circleId) view returns (address[])",
  "function circlesOf(address member) view returns (uint256[])",
  "function isMember(uint256 circleId, address member) view returns (bool)",
  "function circles(uint256) view returns (string name, string circleType, address creator, uint64 createdAt, bool active)",
  "event CircleCreated(uint256 indexed circleId, string name, string circleType, address indexed creator)"
];

const ReputationSBTABI = [
  "function scoreOf(address member) view returns (uint16)",
  "function tokenIdOf(address member) view returns (uint256)",
  "function profiles(uint256 tokenId) view returns (uint16 score, uint32 disputesFiled, uint32 disputesWon, uint32 disputesLost, uint32 timesJuror, uint32 juryAccuracy, uint64 lastUpdated)"
];

module.exports = { DisputeEscrowABI, BarazaRegistryABI, ReputationSBTABI };
