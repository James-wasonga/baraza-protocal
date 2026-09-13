const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");

const config = require("./config/env");
const disputeRoutes = require("./routes/disputes");
const mpesaRoutes = require("./routes/mpesa");
const circleRoutes = require("./routes/circles");
const reputationRoutes = require("./routes/reputation");
const errorHandler = require("./middleware/errorHandler");
const blockchain = require("./services/blockchainService");

const app = express();

app.use(helmet());
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());
app.use(morgan(config.nodeEnv === "development" ? "dev" : "combined"));
app.use(rateLimit({ windowMs: 60_000, max: 120 }));

app.get("/api/health", async (req, res) => {
  res.json({
    ok: true,
    chainConfigured: blockchain.ready,
    mockMpesa: config.mpesa.mock,
    env: config.nodeEnv
  });
});

app.use("/api/disputes", disputeRoutes);
app.use("/api/mpesa", mpesaRoutes);
app.use("/api/circles", circleRoutes);
app.use("/api/reputation", reputationRoutes);

app.use((req, res) => res.status(404).json({ error: "Not found" }));
app.use(errorHandler);

const server = app.listen(config.port, () => {
  console.log(`Baraza Protocol backend listening on :${config.port} (${config.nodeEnv})`);
  if (!blockchain.ready) {
    console.warn(
      "⚠️  Chain service not configured — fill in backend/.env with deployed contract " +
      "addresses and a relayer private key (see contracts-solidity/deployments/*.json)."
    );
  }
  if (config.mpesa.mock) {
    console.log("ℹ️  MOCK_MPESA=true — STK Push calls are simulated, no real Safaricom credentials needed.");
  }
});

module.exports = { app, server };
