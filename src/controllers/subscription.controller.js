 
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess, sendError } = require("../utils/apiResponse");
const Subscription = require("../models/Subscription.model");
const Payment = require("../models/Payment.model");
const { generateOrderId, addDays } = require("../utils/helpers");

// Hardcoded plans (or move to DB later)
const PLANS = [
  { id: "basic", name: "Basic", price: 99, durationDays: 30, features: ["1 Device", "Usage History", "Email Support"] },
  { id: "standard", name: "Standard", price: 199, durationDays: 30, features: ["3 Devices", "Usage Analytics", "Priority Support"] },
  { id: "premium", name: "Premium", price: 399, durationDays: 30, features: ["Unlimited Devices", "Real-time Alerts", "24/7 Support"] },
];

// GET /api/subscription/plans
exports.getPlans = asyncHandler(async (req, res) => {
  sendSuccess(res, { plans: PLANS });
});

// GET /api/subscription/active
exports.getActiveSub = asyncHandler(async (req, res) => {
  const sub = await Subscription.findOne({ userId: req.user._id, isActive: true });
  sendSuccess(res, { subscription: sub });
});

// POST /api/subscription/subscribe  → Initiate Cashfree for subscription
exports.subscribe = asyncHandler(async (req, res) => {
  const { planId } = req.body;
  const plan = PLANS.find((p) => p.id === planId);
  if (!plan) return sendError(res, "Invalid plan");

  const orderId = generateOrderId();
  const cashfreeEnv = process.env.CASHFREE_ENV || "TEST";
  const baseUrl = cashfreeEnv === "PROD"
    ? "https://api.cashfree.com/pg"
    : "https://sandbox.cashfree.com/pg";

  const body = {
    order_id: orderId,
    order_amount: plan.price,
    order_currency: "INR",
    customer_details: {
      customer_id: req.user._id.toString(),
      customer_phone: req.user.mobile,
      customer_name: req.user.name || "RRO User",
    },
    order_meta: {
      return_url: `${process.env.FRONTEND_URL}/subscription?orderId=${orderId}`,
      notify_url: `${process.env.BACKEND_URL}/api/subscription/webhook`,
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

  const cfData = await response.json();
  if (!response.ok) return sendError(res, cfData.message || "Payment init failed");

  await Payment.create({
    userId: req.user._id,
    orderId,
    amount: plan.price,
    purpose: "subscription",
    status: "pending",
    rawResponse: { planId },
  });

  sendSuccess(res, { orderId, paymentSessionId: cfData.payment_session_id }, "Payment initiated");
});

// POST /api/subscription/webhook
exports.subscriptionWebhook = asyncHandler(async (req, res) => {
  const { data: eventData, type } = req.body;
  if (type !== "PAYMENT_SUCCESS_WEBHOOK") return res.sendStatus(200);

  const { order: cfOrder } = eventData;
  const payment = await Payment.findOne({ orderId: cfOrder.order_id });
  if (!payment || payment.status === "success") return res.sendStatus(200);

  payment.status = "success";
  payment.paidAt = new Date();
  await payment.save();

  const planId = payment.rawResponse?.planId;
  const plan = PLANS.find((p) => p.id === planId);
  if (!plan) return res.sendStatus(200);

  // Deactivate old subscription
  await Subscription.updateMany({ userId: payment.userId }, { isActive: false });

  const startDate = new Date();
  await Subscription.create({
    userId: payment.userId,
    plan,
    startDate,
    endDate: addDays(startDate, plan.durationDays),
    paymentId: payment._id,
    isActive: true,
  });

  res.sendStatus(200);
});