const express = require("express");
const blockchain = require("../services/blockchainService");

const router = express.Router();

router.get("/:address", async (req, res, next) => {
  try {
    const score = await blockchain.reputationScore(req.params.address);
    res.json({ address: req.params.address, score });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
