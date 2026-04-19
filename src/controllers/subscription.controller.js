const Subscription = require("../models/Subscription.model");
const Payment = require("../models/Payment.model");
const { createPaymentSession } = require("../utils/zohoPayments");
const { sendSuccess, sendError } = require("../utils/apiResponse");

// Available plans — in production move these to a Plans collection or env config
const PLANS = [
  {
    name: "Basic",
    price: 99,
    durationDays: 30,
    dailyLimitLitres: 10,
    features: ["10L/day", "Valve control", "Basic usage stats"],
  },
  {
    name: "Standard",
    price: 199,
    durationDays: 30,
    dailyLimitLitres: 20,
    features: ["20L/day", "Valve control", "Full usage analytics", "Email support"],
  },
  {
    name: "Premium",
    price: 349,
    durationDays: 30,
    dailyLimitLitres: 50,
    features: ["50L/day", "Valve control", "Full analytics", "TDS monitoring", "Priority support"],
  },
];

/**
 * GET /api/subscriptions/plans
 * Returns available subscription plans
 */
const getPlans = async (req, res) => {
  try {
    return sendSuccess(res, { plans: PLANS }, "Available plans");
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

/**
 * POST /api/subscriptions/initiate
 * Creates a pending subscription + Zoho payment session.
 * Body: { planName: "Basic" | "Standard" | "Premium" }
 *
 * Flow:
 * 1. Create pending Subscription in DB
 * 2. Create Payment record linked to subscription
 * 3. Return Zoho session details to frontend widget
 * 4. On Zoho webhook success → payment.controller activates subscription
 */
const initiatePlanPurchase = async (req, res) => {
  try {
    const { planName } = req.body;
    const user = req.user;

    const plan = PLANS.find(
      (p) => p.name.toLowerCase() === planName?.toLowerCase()
    );
    if (!plan) {
      return sendError(res, `Plan "${planName}" not found`, 404);
    }

    // Block if user already has active subscription
    const existing = await Subscription.findOne({
      userId: user._id,
      isActive: true,
      endDate: { $gt: new Date() },
    });
    if (existing) {
      return sendError(
        res,
        `You already have an active ${existing.plan.name} plan (expires ${existing.endDate.toDateString()})`,
        409
      );
    }

    const referenceNumber = `RRO-SUB-${Date.now()}-${user._id.toString().slice(-5)}`;

    // Create Zoho payment session
    const zohoResponse = await createPaymentSession({
      amount: plan.price,
      referenceNumber,
      description: `RRO ${plan.name} Plan — ${plan.durationDays} days`,
      email: user.email || "",
      phone: user.mobile || "",
      metaData: [
        { key: "userId", value: user._id.toString() },
        { key: "purpose", value: "subscription" },
        { key: "plan", value: plan.name },
      ],
    });

    // Create Payment record (pending)
    const payment = await Payment.create({
      userId: user._id,
      referenceNumber,
      zohoSessionId:
        zohoResponse?.payment_session?.payments_session_id || null,
      amount: plan.price,
      purpose: "subscription",
      description: `RRO ${plan.name} Plan`,
      receiptEmail: user.email,
      status: "pending",
      metaData: [
        { key: "userId", value: user._id.toString() },
        { key: "plan", value: plan.name },
      ],
    });

    // Create Subscription record (inactive until payment succeeds)
    const subscription = await Subscription.create({
      userId: user._id,
      plan,
      startDate: null,
      endDate: new Date(Date.now() + plan.durationDays * 24 * 60 * 60 * 1000), // Placeholder
      isActive: false,
      paymentId: payment._id,
      autoRenew: false,
    });

    // Link payment to subscription
    payment.subscriptionId = subscription._id;
    await payment.save();

    return sendSuccess(
      res,
      {
        subscriptionId: subscription._id,
        paymentId: payment._id,
        referenceNumber,
        zohoApiKey: process.env.ZOHO_API_KEY,
        zohoSessionId: payment.zohoSessionId,
        amount: plan.price,
        plan,
      },
      "Subscription payment session created"
    );
  } catch (err) {
    console.error("initiatePlanPurchase error:", err.message);
    return sendError(res, err.message, 500);
  }
};

/**
 * GET /api/subscriptions/my
 * Returns the current user's active subscription
 */
const getMySubscription = async (req, res) => {
  try {
    const subscription = await Subscription.findOne({
      userId: req.user._id,
      isActive: true,
      endDate: { $gt: new Date() },
    }).populate("paymentId", "referenceNumber status paidAt amount");

    return sendSuccess(
      res,
      {
        subscription: subscription || null,
        hasActiveSubscription: !!subscription,
      },
      "Subscription details"
    );
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

/**
 * GET /api/subscriptions/history
 * All past subscriptions for the user
 */
const getSubscriptionHistory = async (req, res) => {
  try {
    const subscriptions = await Subscription.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .populate("paymentId", "referenceNumber status paidAt amount");

    return sendSuccess(res, { subscriptions }, "Subscription history");
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

module.exports = {
  getPlans,
  initiatePlanPurchase,
  getMySubscription,
  getSubscriptionHistory,
};