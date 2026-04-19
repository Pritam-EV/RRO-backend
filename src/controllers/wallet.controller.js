 
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess, sendError } = require("../utils/apiResponse");
const Payment = require("../models/Payment.model");
const { generateOrderId } = require("../utils/helpers");

// GET /api/wallet
exports.getWallet = asyncHandler(async (req, res) => {
  let wallet = await Wallet.findOne({ userId: req.user._id });
  if (!wallet) wallet = await Wallet.create({ userId: req.user._id });
  sendSuccess(res, { wallet });
});

// GET /api/wallet/transactions
exports.getTransactions = asyncHandler(async (req, res) => {
  const wallet = await Wallet.findOne({ userId: req.user._id });
  if (!wallet) return sendError(res, "Wallet not found", 404);
  const transactions = wallet.transactions.sort((a, b) => b.createdAt - a.createdAt);
  sendSuccess(res, { transactions, balance: wallet.balance });
});

// POST /api/wallet/topup/initiate  → Creates Cashfree order
exports.initiateTopup = asyncHandler(async (req, res) => {
  const { amount } = req.body;
  if (!amount || amount < 10) return sendError(res, "Minimum topup is ₹10");

  const orderId = generateOrderId();
  const cashfreeEnv = process.env.CASHFREE_ENV || "TEST";
  const baseUrl = cashfreeEnv === "PROD"
    ? "https://api.cashfree.com/pg"
    : "https://sandbox.cashfree.com/pg";

  const body = {
    order_id: orderId,
    order_amount: amount,
    order_currency: "INR",
    customer_details: {
      customer_id: req.user._id.toString(),
      customer_phone: req.user.mobile,
      customer_name: req.user.name || "RRO User",
    },
    order_meta: {
      return_url: `${process.env.FRONTEND_URL}/product/redirect?orderId=${orderId}`,
      notify_url: `${process.env.BACKEND_URL}/api/wallet/topup/webhook`,
    },
  };

  const response = await fetch(`${baseUrl}/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-version": "2023-08-01",
      "x-client-id": process.env.CASHFREE_APP_ID,
      "x-client-secret": process.env.CASHFREE_SECRET_KEY,
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  if (!response.ok) return sendError(res, data.message || "Cashfree error");

  await Payment.create({
    userId: req.user._id,
    orderId,
    amount,
    purpose: "topup",
    status: "pending",
    rawResponse: data,
  });

  sendSuccess(res, { orderId, paymentSessionId: data.payment_session_id }, "Topup initiated");
});

// POST /api/wallet/topup/webhook  → Cashfree calls this after payment
exports.topupWebhook = asyncHandler(async (req, res) => {
  const { data: eventData, type } = req.body;
  if (type !== "PAYMENT_SUCCESS_WEBHOOK") return res.sendStatus(200);

  const { order } = eventData;
  const payment = await Payment.findOne({ orderId: order.order_id });
  if (!payment || payment.status === "success") return res.sendStatus(200);

  payment.status = "success";
  payment.cashfreePaymentId = eventData.payment?.cf_payment_id;
  payment.paidAt = new Date();
  payment.rawResponse = req.body;
  await payment.save();

  const wallet = await Wallet.findOne({ userId: payment.userId });
  wallet.balance += payment.amount;
  wallet.transactions.push({
    type: "credit",
    amount: payment.amount,
    description: `Wallet topup via Cashfree`,
    referenceId: order.order_id,
    balanceAfter: wallet.balance,
  });
  await wallet.save();

  res.sendStatus(200);
});

// GET /api/wallet/payments
exports.getPayments = asyncHandler(async (req, res) => {
  const payments = await Payment.find({ userId: req.user._id }).sort({ createdAt: -1 });
  sendSuccess(res, { payments });
});