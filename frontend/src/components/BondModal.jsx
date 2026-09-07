import React, { useState } from "react";
import { parseEther } from "ethers";
import { API_BASE_URL } from "../lib/config.js";

const STEPS = {
  CHOOSE: "choose",
  PHONE: "phone",
  AWAITING_STK: "awaiting_stk",
  CONFIRMING: "confirming",
  CONFIRMED: "confirmed",
  FAILED: "failed",
};

/**
 * Walks the real three-step backend flow:
 *   1. POST /mpesa/initiate      -> { checkoutRequestId }
 *   2. GET  /mpesa/status/:id    -> poll until status === "success"
 *   3. POST /mpesa/confirm-bond  -> backend relayer calls confirmBondOffchain on-chain
 */
export default function BondModal({ disputeId, party, bondAmountEth, onClose, onNativePay }) {
  const [step, setStep] = useState(STEPS.CHOOSE);
  const [phone, setPhone] = useState("");
  const [error, setError] = useState(null);
  const [txHash, setTxHash] = useState(null);

  async function sendStkPush() {
    setError(null);
    setStep(STEPS.AWAITING_STK);
    try {
      const bondAmountWei = parseEther(bondAmountEth || "0").toString();
      const initRes = await fetch(`${API_BASE_URL}/mpesa/initiate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disputeId, party, phoneNumber: phone, bondAmountWei }),
      });
      if (!initRes.ok) throw new Error(`Backend returned ${initRes.status} on /mpesa/initiate`);
      const { checkoutRequestId } = await initRes.json();

      await pollUntilSuccess(checkoutRequestId);

      setStep(STEPS.CONFIRMING);
      const confirmRes = await fetch(`${API_BASE_URL}/mpesa/confirm-bond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkoutRequestId, disputeId, party }),
      });
      if (!confirmRes.ok) throw new Error(`Backend returned ${confirmRes.status} on /mpesa/confirm-bond`);
      const { txHash } = await confirmRes.json();
      setTxHash(txHash);
      setStep(STEPS.CONFIRMED);
    } catch (e) {
      setError(e.message || "Could not reach the backend. Is it running on :4000?");
      setStep(STEPS.FAILED);
    }
  }

  async function pollUntilSuccess(checkoutRequestId, attempts = 15) {
    for (let i = 0; i < attempts; i++) {
      const res = await fetch(`${API_BASE_URL}/mpesa/status/${checkoutRequestId}`);
      if (res.ok) {
        const entry = await res.json();
        if (entry.status === "success") return entry;
        if (entry.status === "failed") throw new Error("M-Pesa payment failed or was cancelled.");
      }
      await new Promise((r) => setTimeout(r, 1200));
    }
    throw new Error("Timed out waiting for M-Pesa confirmation.");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm">
      <div className="panel w-full max-w-md p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-bone-500 hover:text-bone-100 text-sm"
          aria-label="Close"
        >
          ✕
        </button>

        <p className="label-caps mb-1">Post bond</p>
        <h2 className="font-display text-xl text-bone-100 mb-5">{bondAmountEth} ETH equivalent</h2>

        {step === STEPS.CHOOSE && (
          <div className="space-y-3">
            <button onClick={() => setStep(STEPS.PHONE)} className="btn-primary w-full">
              Pay with M-Pesa
            </button>
            <button onClick={onNativePay} className="btn-secondary w-full">
              Pay with connected wallet
            </button>
            <p className="text-xs text-bone-500 pt-1">
              M-Pesa bonds are confirmed on-chain by the Baraza relayer once Safaricom Daraja
              confirms your payment — no gas or seed phrase needed.
            </p>
          </div>
        )}

        {step === STEPS.PHONE && (
          <div className="space-y-3">
            <label className="label-caps block">M-Pesa phone number</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="2547XXXXXXXX"
              className="input-field"
              inputMode="tel"
            />
            <button onClick={sendStkPush} disabled={phone.length < 9} className="btn-primary w-full">
              Send STK push
            </button>
          </div>
        )}

        {(step === STEPS.AWAITING_STK || step === STEPS.CONFIRMING) && (
          <div className="py-8 text-center space-y-3">
            <Spinner />
            <p className="text-sm text-bone-300">
              {step === STEPS.AWAITING_STK
                ? "Check your phone and enter your M-Pesa PIN…"
                : "Payment received — confirming on-chain…"}
            </p>
          </div>
        )}

        {step === STEPS.CONFIRMED && (
          <div className="py-6 text-center space-y-3">
            <div className="mx-auto h-10 w-10 rounded-full bg-sage-500/15 border border-sage-500 flex items-center justify-center text-sage-500">
              ✓
            </div>
            <p className="text-sm text-bone-100">Bond confirmed and recorded on-chain.</p>
            {txHash && <p className="font-mono text-xs text-bone-500 break-all">{txHash}</p>}
            <button onClick={onClose} className="btn-secondary mt-2">
              Close
            </button>
          </div>
        )}

        {step === STEPS.FAILED && (
          <div className="py-4 text-center space-y-3">
            <p className="text-sm text-rust-500">{error}</p>
            <button onClick={() => setStep(STEPS.PHONE)} className="btn-secondary">
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <div className="mx-auto h-8 w-8 rounded-full border-2 border-ink-border border-t-marigold-500 animate-spin" />
  );
}
