const express = require("express");
const { z } = require("zod");
const blockchain = require("../services/blockchainService");

const router = express.Router();

const addressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid address");

router.get("/:id", async (req, res, next) => {
  try {
    const disputeId = req.params.id;
    const [dispute, jury, voteTally] = await Promise.all([
      blockchain.getDispute(disputeId),
      blockchain.getJury(disputeId).catch(() => []),
      blockchain.getVoteTally(disputeId).catch(() => ({ forClaimant: 0, forRespondent: 0 }))
    ]);
    res.json({ disputeId, ...dispute, jury, voteTally });
  } catch (err) {
    next(err);
  }
});

const selectJurySchema = z.object({
  jurySize: z.number().int().positive().optional()
});

/// Triggers the commit-reveal jury draw for a dispute once both bonds are
/// in. There's no automatic on-chain event listener yet — this route is
/// the only way jury selection happens today. Call it manually (from an
/// admin view, a demo script, or curl) once both parties have bonded; a
/// listener on the `BondPosted` event that calls this automatically is the
/// natural next step, not yet built.
router.post("/:id/select-jury", async (req, res, next) => {
  try {
    const { jurySize } = selectJurySchema.parse(req.body || {});
    const result = await blockchain.selectJuryForDispute(req.params.id, jurySize || 3);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

const bondSchema = z.object({
  disputeId: z.union([z.string(), z.number()]),
  party: addressSchema,
  phoneNumber: z.string().min(9),
  bondAmountWei: z.string()
});

module.exports = router;