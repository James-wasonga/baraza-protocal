// Central place for everything the frontend needs to know about the
// deployed contracts and backend API. Populate these via a .env file (see
// .env.example) — Vite exposes anything prefixed VITE_ on import.meta.env.

export const CONTRACTS = {
  disputeEscrow: import.meta.env.VITE_DISPUTE_ESCROW_ADDRESS || "",
  barazaRegistry: import.meta.env.VITE_BARAZA_REGISTRY_ADDRESS || "",
  reputationSBT: import.meta.env.VITE_REPUTATION_SBT_ADDRESS || "",
  jurySelector: import.meta.env.VITE_JURY_SELECTOR_ADDRESS || "",
};

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api";

export const ARBITRUM_SEPOLIA = {
  chainIdHex: "0x66eee", // 421614
  chainId: 421614,
  chainName: "Arbitrum Sepolia",
  nativeCurrency: { name: "Sepolia ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: ["https://sepolia-rollup.arbitrum.io/rpc"],
  blockExplorerUrls: ["https://sepolia.arbiscan.io"],
};

export const DISPUTE_STATUS = ["Filed", "AwaitingJury", "Voting", "Resolved", "Dismissed", "Expired"];
export const VOTE_LABEL = ["None", "Claimant", "Respondent"];
