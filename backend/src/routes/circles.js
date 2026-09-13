const express = require("express");
const blockchain = require("../services/blockchainService");

const router = express.Router();

router.get("/:circleId/members", async (req, res, next) => {
  try {
    const members = await blockchain.circleMembers(req.params.circleId);
    const withScores = await Promise.all(
      members.map(async (address) => ({
        address,
        reputationScore: await blockchain.reputationScore(address)
      }))
    );
    res.json({ circleId: req.params.circleId, members: withScores });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
