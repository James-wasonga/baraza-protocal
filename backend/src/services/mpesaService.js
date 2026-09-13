const axios = require("axios");
const config = require("../config/env");

const DARAJA_BASE = {
  sandbox: "https://sandbox.safaricom.co.ke",
  production: "https://api.safaricom.co.ke"
};

// In-memory store of pending STK pushes, keyed by CheckoutRequestID (or, in
// mock mode, by our own generated id). A real deployment would use Redis or
// a DB row instead — kept in-process here to match the rest of this
// backend's "runnable demo, not a production ops setup" scope.
const pending = new Map();

class MpesaService {
  constructor() {
    this.baseUrl = DARAJA_BASE[config.mpesa.env] || DARAJA_BASE.sandbox;
    this.tokenCache = { token: null, expiresAt: 0 };
  }

  async getAccessToken() {
    if (this.tokenCache.token && Date.now() < this.tokenCache.expiresAt) {
      return this.tokenCache.token;
    }
    const credentials = Buffer.from(
      `${config.mpesa.consumerKey}:${config.mpesa.consumerSecret}`
    ).toString("base64");

    const { data } = await axios.get(
      `${this.baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
      { headers: { Authorization: `Basic ${credentials}` } }
    );

    this.tokenCache = {
      token: data.access_token,
      expiresAt: Date.now() + (Number(data.expires_in || 3599) - 60) * 1000
    };
    return this.tokenCache.token;
  }

  timestamp() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return (
      d.getFullYear().toString() +
      pad(d.getMonth() + 1) +
      pad(d.getDate()) +
      pad(d.getHours()) +
      pad(d.getMinutes()) +
      pad(d.getSeconds())
    );
  }

  /// Convert a wei-denominated bond amount to a whole-KES STK Push amount.
  /// Uses the naive rate in config; swap for a real price feed before this
  /// touches real money.
  weiToKes(weiAmount) {
    const eth = Number(weiAmount) / 1e18;
    const kes = Math.max(1, Math.round(eth * config.ethToKesRate));
    return kes;
  }

  /// Initiate an STK Push asking `phoneNumber` to pay their dispute bond.
  /// `reference` should be something like `baraza-dispute-14-claimant` so
  /// the callback can be matched back to the right on-chain confirmation.
  async initiateStkPush({ phoneNumber, amountKes, accountReference, description }) {
    if (config.mpesa.mock) {
      const checkoutRequestId = `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      pending.set(checkoutRequestId, {
        phoneNumber, amountKes, accountReference, description,
        status: "pending", createdAt: Date.now()
      });

      // Simulate the async Daraja callback arriving after a short delay,
      // as if the user approved the prompt on their phone.
      setTimeout(() => {
        const entry = pending.get(checkoutRequestId);
        if (entry) entry.status = "success";
      }, 4000);

      return { checkoutRequestId, mock: true };
    }

    const token = await this.getAccessToken();
    const timestamp = this.timestamp();
    const password = Buffer.from(
      `${config.mpesa.shortcode}${config.mpesa.passkey}${timestamp}`
    ).toString("base64");

    const { data } = await axios.post(
      `${this.baseUrl}/mpesa/stkpush/v1/processrequest`,
      {
        BusinessShortCode: config.mpesa.shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: "CustomerPayBillOnline",
        Amount: amountKes,
        PartyA: phoneNumber,
        PartyB: config.mpesa.shortcode,
        PhoneNumber: phoneNumber,
        CallBackURL: config.mpesa.callbackUrl,
        AccountReference: accountReference,
        TransactionDesc: description
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    pending.set(data.CheckoutRequestID, {
      phoneNumber, amountKes, accountReference, description,
      status: "pending", createdAt: Date.now()
    });

    return { checkoutRequestId: data.CheckoutRequestID, mock: false, merchantRequestId: data.MerchantRequestID };
  }

  /// Poll status of a pending push (used by the frontend while waiting for
  /// the user to approve the prompt, and by the backend before it confirms
  /// the bond on-chain).
  getStatus(checkoutRequestId) {
    return pending.get(checkoutRequestId) || null;
  }

  /// Called by the /api/mpesa/callback route when Daraja posts the result
  /// (or, in mock mode, can be invoked directly for testing).
  handleCallback(checkoutRequestId, resultCode) {
    const entry = pending.get(checkoutRequestId);
    if (!entry) return null;
    entry.status = resultCode === 0 ? "success" : "failed";
    return entry;
  }
}

module.exports = new MpesaService();
