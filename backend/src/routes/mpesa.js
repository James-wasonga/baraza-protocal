const express = require("express");
const { z } = require("zod");
const mpesa = require("../services/mpesaService");
const blockchain = require("../services/blockchainService");

const router = express.Router();

const initiateSchema = z.object({
  disputeId: z.union([z.string(), z.number()]),
  party: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid address"),
  phoneNumber: z.string().min(9, "Use format 2547XXXXXXXX"),
  bondAmountWei: z.string()
});

/// Step 1 of the gasless M-Pesa bond flow: front end calls this after the
/// user taps "Pay bond via M-Pesa". We convert the wei bond amount to KES,
/// fire the STK Push, and hand back a checkoutRequestId the frontend polls.
router.post("/initiate", async (req, res, next) => {
  try {
    const { disputeId, party, phoneNumber, bondAmountWei } = initiateSchema.parse(req.body);
    const amountKes = mpesa.weiToKes(bondAmountWei);

    const result = await mpesa.initiateStkPush({
      phoneNumber,
      amountKes,
      accountReference: `baraza-dispute-${disputeId}`,
      description: `Baraza dispute #${disputeId} bond`
    });

    res.json({ ...result, amountKes, disputeId, party });
  } catch (err) {
    next(err);
  }
});

/// Step 2: frontend polls this while the user approves the prompt on their
/// phone. Once status flips to "success", the frontend calls /confirm-bond
/// below (or this route can be extended to auto-confirm — kept as two
/// explicit steps here so a demo can show the on-chain tx happening).
router.get("/status/:checkoutRequestId", (req, res) => {
  const entry = mpesa.getStatus(req.params.checkoutRequestId);
  if (!entry) return res.status(404).json({ error: "Unknown checkoutRequestId" });
  res.json(entry);
});

const confirmSchema = z.object({
  checkoutRequestId: z.string(),
  disputeId: z.union([z.string(), z.number()]),
  party: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid address")
});

/// Step 3: once the M-Pesa payment is confirmed, the relayer wallet calls
/// DisputeEscrow.confirmBondOffchain on-chain — this is the actual bridge
/// from "fiat paid" to "bond posted" that lets non-crypto-native users file
/// disputes without ever touching ETH.
router.post("/confirm-bond", async (req, res, next) => {
  try {
    const { checkoutRequestId, disputeId, party } = confirmSchema.parse(req.body);
    const entry = mpesa.getStatus(checkoutRequestId);
    if (!entry || entry.status !== "success") {
      return res.status(409).json({ error: "M-Pesa payment not confirmed yet", status: entry?.status || "unknown" });
    }
    const txHash = await blockchain.confirmBondOffchain(disputeId, party);
    res.json({ confirmed: true, txHash });
  } catch (err) {
    next(err);
  }
});

/// Real Safaricom Daraja posts results here (config.mpesa.callbackUrl).
/// Body shape per Daraja docs: { Body: { stkCallback: { CheckoutRequestID, ResultCode, ... } } }
router.post("/callback", (req, res) => {
  try {
    const callback = req.body?.Body?.stkCallback;
    if (!callback) return res.status(400).json({ error: "Malformed Daraja callback" });
    mpesa.handleCallback(callback.CheckoutRequestID, callback.ResultCode);
    res.json({ received: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to process callback" });
  }
});

module.exports = router;
