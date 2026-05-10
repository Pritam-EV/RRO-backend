// src/utils/zohoPayments.js
const axios  = require("axios");
const crypto = require("crypto");    // Node built-in — no install needed
const { ZOHO_PAYMENTS_BASE_URL } = require("../config/constants");
const { getZohoAccessToken }      = require("./zohoToken");

/* ── Auth headers for every Zoho API call ─────────────────── */
const zohoHeaders = async () => {
  const token = await getZohoAccessToken();
  return {
    Authorization: `Zoho-oauthtoken ${token}`,
    "Content-Type": "application/json",
  };
};

/* ── Create Payment Session ───────────────────────────────── */
const createPaymentSession = async ({
  amount,
  referenceNumber,
  description,
  email,
  phone,
  metaData = [],
}) => {
  const headers = await zohoHeaders();

  const payload = {
    amount:           amount.toFixed(2),
    currency:         "INR",
    reference_number: referenceNumber,
    description,
    receipt_email:    email,
    phone,
    meta_data:        metaData.slice(0, 5),   // Zoho max 5 metadata pairs
  };

  const res = await axios.post(
    `${ZOHO_PAYMENTS_BASE_URL}/paymentsessions?account_id=${process.env.ZOHO_ACCOUNT_ID}`,
    payload,
    { headers }
  );

  return res.data;
};

/* ── Get Payment by Zoho payment_id ──────────────────────── */
const getPaymentById = async (zohoPaymentId) => {
  const headers = await zohoHeaders();
  const res = await axios.get(
    `${ZOHO_PAYMENTS_BASE_URL}/payments/${zohoPaymentId}?account_id=${process.env.ZOHO_ACCOUNT_ID}`,
    { headers }
  );
  return res.data?.payment || null;
};

/* ── Get Payments List ────────────────────────────────────── */
const getPaymentsList = async ({ status, page = 1, perPage = 25 } = {}) => {
  const headers = await zohoHeaders();
  const params  = new URLSearchParams({
    account_id: process.env.ZOHO_ACCOUNT_ID,
    page,
    per_page:   perPage,
  });
  if (status) params.append("status", status);

  const res = await axios.get(
    `${ZOHO_PAYMENTS_BASE_URL}/payments?${params.toString()}`,
    { headers }
  );
  return res.data?.payments || [];
};

/* ── Verify Webhook Signature (HMAC-SHA256) ───────────────── 
 *
 *  Zoho sends:  X-Zoho-Signature: <base64-encoded HMAC-SHA256>
 *  We compute:  HMAC-SHA256(rawBody, ZOHO_WEBHOOK_SIGNING_SECRET)
 *  Then compare using timingSafeEqual to prevent timing attacks.
 *
 *  req.body MUST be the raw Buffer — guaranteed by:
 *    app.use("/api/payments/webhook", express.raw({ type: "application/json" }))
 *  in app.js (already set up correctly).
 */
const verifyWebhookSignature = (rawBody, signatureHeader) => {
  const secret = process.env.ZOHO_WEBHOOK_SIGNING_SECRET;

  if (!secret) {
    console.error("❌ ZOHO_WEBHOOK_SIGNING_SECRET not set in .env");
    return false;
  }
  if (!signatureHeader) {
    console.warn("⚠️ Webhook: missing X-Zoho-Signature header");
    return false;
  }

  try {
    const expected = crypto
      .createHmac("sha256", secret)
      .update(rawBody)           // rawBody is Buffer from express.raw()
      .digest("base64");

    const expectedBuf  = Buffer.from(expected,         "base64");
    const receivedBuf  = Buffer.from(signatureHeader,  "base64");

    // timingSafeEqual prevents timing attacks — lengths must match
    if (expectedBuf.length !== receivedBuf.length) return false;

    return crypto.timingSafeEqual(expectedBuf, receivedBuf);
  } catch (err) {
    console.error("❌ Webhook signature verification error:", err.message);
    return false;
  }
};

/* ── Legacy token compare (kept for backward-compat fallback) ── */
const verifyWebhookToken = (token) =>
  token === process.env.ZOHO_WEBHOOK_TOKEN;

module.exports = {
  createPaymentSession,
  getPaymentById,
  getPaymentsList,
  verifyWebhookSignature,   // ← new secure version
  verifyWebhookToken,       // ← kept for backward compat
};