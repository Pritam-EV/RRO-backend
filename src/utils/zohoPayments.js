const axios = require("axios");
const { ZOHO_PAYMENTS_BASE_URL } = require("../config/constants");
const { getZohoAccessToken } = require("./zohoToken");

/**
 * Build headers for every Zoho Payments API call
 */
const zohoHeaders = async () => {
  const token = await getZohoAccessToken();
  return {
    Authorization: `Zoho-oauthtoken ${token}`,
    "Content-Type": "application/json",
  };
};

/**
 * Create a Zoho Payments session (initiates checkout)
 * Called from your backend before redirecting user to pay.
 *
 * @param {Object} opts
 * @param {number} opts.amount          - Amount in INR (e.g. 500)
 * @param {string} opts.referenceNumber - Your internal unique ref (e.g. "TOPUP-1234")
 * @param {string} opts.description     - Payment description
 * @param {string} opts.email           - Customer email
 * @param {string} opts.phone           - Customer phone (with country code)
 * @param {Array}  opts.metaData        - [{key, value}] max 5
 * @returns {Object} Zoho session response
 */
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
    amount: amount.toFixed(2),
    currency: "INR",
    reference_number: referenceNumber,
    description,
    receipt_email: email,
    phone,
    meta_data: metaData.slice(0, 5),                   // Zoho max 5
  };

  const res = await axios.post(
    `${ZOHO_PAYMENTS_BASE_URL}/paymentsessions?account_id=${process.env.ZOHO_ACCOUNT_ID}`,
    payload,
    { headers }
  );

  return res.data;
};

/**
 * Retrieve a specific payment by Zoho payment_id
 * OAuth Scope: ZohoPay.payments.READ
 */
const getPaymentById = async (zohoPaymentId) => {
  const headers = await zohoHeaders();

  const res = await axios.get(
    `${ZOHO_PAYMENTS_BASE_URL}/payments/${zohoPaymentId}?account_id=${process.env.ZOHO_ACCOUNT_ID}`,
    { headers }
  );

  return res.data?.payment || null;
};

/**
 * Retrieve payments list with optional filters
 * OAuth Scope: ZohoPay.payments.READ
 */
const getPaymentsList = async ({ status, page = 1, perPage = 25 } = {}) => {
  const headers = await zohoHeaders();

  const params = new URLSearchParams({
    account_id: process.env.ZOHO_ACCOUNT_ID,
    page,
    per_page: perPage,
  });
  if (status) params.append("status", status);

  const res = await axios.get(
    `${ZOHO_PAYMENTS_BASE_URL}/payments?${params.toString()}`,
    { headers }
  );

  return res.data?.payments || [];
};

/**
 * Verify webhook signature from Zoho
 * Zoho sends X-Zoho-Webhook-Token header
 */
const verifyWebhookToken = (reqToken) => {
  return reqToken === process.env.ZOHO_WEBHOOK_TOKEN;
};

module.exports = {
  createPaymentSession,
  getPaymentById,
  getPaymentsList,
  verifyWebhookToken,
};