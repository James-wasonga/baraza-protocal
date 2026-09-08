// Realistic sample data used when no contracts are configured yet (fresh
// clone, before `npm run deploy:sepolia`) so every screen is fully
// browsable and demo-able out of the box. Once VITE_DISPUTE_ESCROW_ADDRESS
// etc. are set in frontend/.env, live on-chain data takes over — see
// src/hooks/useContracts.js's `configured` flag.

export const sampleCircles = [
  {
    id: 1,
    name: "Kilimani Traders Chama",
    type: "chama",
    memberCount: 14,
    createdAt: "2026-03-02",
    members: [
      "0x71C7656EC7ab88b098defB751B7401B5f6d8976",
      "0x4B2e1234A9c8f8b6D5e3a2C1B0F9e8D7C6B5A4F3",
      "0x9F1a5678B2c3D4e5F6a7B8c9D0e1F2a3B4c5D6E7",
      "0x2Dab9012C3d4E5f6A7b8C9d0E1f2A3b4C5d6E778",
    ],
  },
  {
    id: 2,
    name: "Nakuru-Kampala Produce Partners",
    type: "trade_partnership",
    memberCount: 6,
    createdAt: "2026-05-18",
    members: [
      "0x9F1a5678B2c3D4e5F6a7B8c9D0e1F2a3B4c5D6E7",
      "0x2Dab9012C3d4E5f6A7b8C9d0E1f2A3b4C5d6E778",
      "0x88Ff3456C7d8E9f0A1b2C3d4E5f6A7b8C9d03Ca1",
    ],
  },
  {
    id: 3,
    name: "Umoja Women's ROSCA",
    type: "rosca",
    memberCount: 20,
    createdAt: "2026-01-11",
    members: [
      "0x88Ff3456C7d8E9f0A1b2C3d4E5f6A7b8C9d03Ca1",
      "0x150c7890D1e2F3a4B5c6D7e8F9a0B1c2D3e4F90A",
      "0x5aC2345D6e7F8a9B0c1D2e3F4a5B6c7D8e9F44Ef",
    ],
  },
];

export const sampleDisputes = [
  {
    id: 1,
    circle: "Kilimani Traders Chama",
    claimant: "0x71C7...9a3F",
    respondent: "0x4B2e...11Dc",
    summary: "Respondent did not deliver contributed goods for round 4 payout.",
    bondAmountEth: "0.01",
    status: "Voting",
    votesForClaimant: 2,
    votesForRespondent: 1,
    jurySize: 3,
    filedAt: "2026-08-29",
    votingDeadline: "2026-09-06",
  },
  {
    id: 2,
    circle: "Nakuru-Kampala Produce Partners",
    claimant: "0x9F1a...c02B",
    respondent: "0x2Dab...77E4",
    summary: "Cross-border shipment arrived short by 40kg against invoice.",
    bondAmountEth: "0.02",
    status: "AwaitingJury",
    votesForClaimant: 0,
    votesForRespondent: 0,
    jurySize: 3,
    filedAt: "2026-09-01",
    votingDeadline: null,
  },
  {
    id: 3,
    circle: "Umoja Women's ROSCA",
    claimant: "0x88Ff...3Ca1",
    respondent: "0x150c...9B0A",
    summary: "Payout recipient claims contribution was never received.",
    bondAmountEth: "0.005",
    status: "Resolved",
    outcome: "Claimant",
    votesForClaimant: 3,
    votesForRespondent: 0,
    jurySize: 3,
    filedAt: "2026-08-14",
    votingDeadline: "2026-08-21",
  },
];

export const sampleJury = [
  { address: "0x5aC2...44Ef", score: 640, vote: "Claimant" },
  { address: "0x0dE9...81Ab", score: 590, vote: "Claimant" },
  { address: "0xC71b...02Fa", score: 705, vote: null },
];

export const sampleEvidence = [
  { submitter: "Claimant", label: "M-Pesa statement excerpt", hash: "bafybeih...k2yq" },
  { submitter: "Claimant", label: "WhatsApp delivery thread (screenshots)", hash: "bafybeig...9dmn" },
  { submitter: "Respondent", label: "Signed goods receipt", hash: "bafybeic...7prt" },
];

export const sampleReputation = {
  score: 610,
  disputesFiled: 3,
  disputesWon: 2,
  disputesLost: 1,
  timesJuror: 11,
  juryAccuracy: 9,
};