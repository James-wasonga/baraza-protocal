// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// Test-only stand-in for USDG (6 decimals, freely mintable) — used ONLY in
/// the local Hardhat test harness. Never deployed to a real network; on
/// Arbitrum Sepolia and mainnet, the real Paxos USDG contract is used
/// instead (see deploy.js / .env.example for the official addresses).
contract MockERC20 is ERC20 {
    constructor() ERC20("Mock USDG", "mUSDG") {}
    function decimals() public pure override returns (uint8) { return 6; }
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}