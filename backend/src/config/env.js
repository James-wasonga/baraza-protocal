require("dotenv").config();

function required(name, fallback = undefined) {
  const value = process.env[name] ?? fallback;
  return value;
}

const config = {
  port: Number(process.env.PORT || 4000),
  nodeEnv: process.env.NODE_ENV || "development",
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:5173",

  chain: {
    rpcUrl: required("ARBITRUM_RPC_URL", "https://sepolia-rollup.arbitrum.io/rpc"),
    chainId: Number(process.env.CHAIN_ID || 421614),
    relayerPrivateKey: process.env.RELAYER_PRIVATE_KEY || "",
    disputeEscrowAddress: process.env.DISPUTE_ESCROW_ADDRESS || "",
    barazaRegistryAddress: process.env.BARAZA_REGISTRY_ADDRESS || "",
    reputationSbtAddress: process.env.REPUTATION_SBT_ADDRESS || "",
    jurySelectorAddress: process.env.JURY_SELECTOR_ADDRESS || ""
  },

  mpesa: {
    mock: (process.env.MOCK_MPESA || "true").toLowerCase() === "true",
    env: process.env.MPESA_ENV || "sandbox",
    consumerKey: process.env.MPESA_CONSUMER_KEY || "",
    consumerSecret: process.env.MPESA_CONSUMER_SECRET || "",
    shortcode: process.env.MPESA_SHORTCODE || "174379",
    passkey: process.env.MPESA_PASSKEY || "",
    callbackUrl: process.env.MPESA_CALLBACK_URL || ""
  },

  ethToKesRate: Number(process.env.ETH_TO_KES_RATE || 450000)
};

module.exports = config;
