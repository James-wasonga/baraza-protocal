// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./ReputationSBT.sol";

/// @title BarazaRegistry
/// @notice On-chain registry of trust groups ("circles") — chamas, ROSCAs, trade
///         partnerships, or any informal group that wants an enforceable
///         dispute path. A circle is just a named set of member addresses;
///         DisputeEscrow reads membership from here to build juror pools.
contract BarazaRegistry is AccessControl {
    bytes32 public constant CIRCLE_ADMIN_ROLE = keccak256("CIRCLE_ADMIN_ROLE");

    struct Circle {
        string name;            // human-readable name, e.g. "Kilimani Traders Chama"
        string circleType;      // "chama" | "rosca" | "trade_partnership" | "other"
        address creator;
        uint64 createdAt;
        bool active;
    }

    ReputationSBT public immutable reputation;

    uint256 private _nextCircleId = 1;
    mapping(uint256 => Circle) public circles;
    mapping(uint256 => address[]) private _circleMembers;
    mapping(uint256 => mapping(address => bool)) public isMember;
    mapping(address => uint256[]) private _circlesOf;

    event CircleCreated(uint256 indexed circleId, string name, string circleType, address indexed creator);
    event MemberAdded(uint256 indexed circleId, address indexed member);
    event MemberRemoved(uint256 indexed circleId, address indexed member);

    error NotCircleAdmin();
    error AlreadyMember();
    error NotAMember();
    error CircleInactive();

    modifier onlyCircleCreatorOr(uint256 circleId, address who) {
        if (circles[circleId].creator != who && !hasRole(CIRCLE_ADMIN_ROLE, who)) revert NotCircleAdmin();
        _;
    }

    constructor(address admin, address reputationSBT) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(CIRCLE_ADMIN_ROLE, admin);
        reputation = ReputationSBT(reputationSBT);
    }

    function createCircle(string calldata name, string calldata circleType, address[] calldata initialMembers)
        external
        returns (uint256 circleId)
    {
        circleId = _nextCircleId++;
        circles[circleId] = Circle({
            name: name,
            circleType: circleType,
            creator: msg.sender,
            createdAt: uint64(block.timestamp),
            active: true
        });

        _addMember(circleId, msg.sender);
        for (uint256 i = 0; i < initialMembers.length; i++) {
            if (!isMember[circleId][initialMembers[i]]) {
                _addMember(circleId, initialMembers[i]);
            }
        }

        emit CircleCreated(circleId, name, circleType, msg.sender);
    }

    function addMember(uint256 circleId, address member) external onlyCircleCreatorOr(circleId, msg.sender) {
        if (!circles[circleId].active) revert CircleInactive();
        if (isMember[circleId][member]) revert AlreadyMember();
        _addMember(circleId, member);
    }

    function removeMember(uint256 circleId, address member) external onlyCircleCreatorOr(circleId, msg.sender) {
        if (!isMember[circleId][member]) revert NotAMember();
        isMember[circleId][member] = false;

        address[] storage members = _circleMembers[circleId];
        for (uint256 i = 0; i < members.length; i++) {
            if (members[i] == member) {
                members[i] = members[members.length - 1];
                members.pop();
                break;
            }
        }
        emit MemberRemoved(circleId, member);
    }

    function deactivateCircle(uint256 circleId) external onlyCircleCreatorOr(circleId, msg.sender) {
        circles[circleId].active = false;
    }

    function _addMember(uint256 circleId, address member) internal {
        isMember[circleId][member] = true;
        _circleMembers[circleId].push(member);
        _circlesOf[member].push(circleId);
        reputation.ensureProfile(member);
        emit MemberAdded(circleId, member);
    }

    function membersOf(uint256 circleId) external view returns (address[] memory) {
        return _circleMembers[circleId];
    }

    function circlesOf(address member) external view returns (uint256[] memory) {
        return _circlesOf[member];
    }

    function memberCount(uint256 circleId) external view returns (uint256) {
        return _circleMembers[circleId].length;
    }
}
