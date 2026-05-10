// src/controllers/subscription.controller.js
const Subscription = require("../models/Subscription.model");
const Plan         = require("../models/Plan.model");
const Device       = require("../models/Device.model");
const { sendSuccess, sendError } = require("../utils/apiResponse");

/* ─── Statuses that mean "still live" ─── */
const ACTIVE_STATUSES = [
  "payment_pending",
  "paid_pending_installation",
  "installation_assigned",
  "installed",
  "active",
];

/* ─── GET /api/subscriptions/plans ─── */
const getPlans = async (req, res) => {
  try {
    const plans = await Plan.find({ isActive: true }).sort({ sortOrder: 1 });
    return sendSuccess(res, { plans }, "Available plans");
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

/* ─── POST /api/subscriptions/order ─── */
const createOrder = async (req, res) => {
  try {
    const { planId, deliveryAddress, paymentMethod, deliverySlot } = req.body;
    const user = req.user;

    if (!planId || !deliveryAddress || !paymentMethod || !deliverySlot)
      return sendError(res, "planId, deliveryAddress, paymentMethod and deliverySlot are required", 400);

    const { fullName, mobile, address, pincode, city } = deliveryAddress;
    if (!fullName || !mobile || !address || !pincode || !city)
      return sendError(res, "All delivery address fields are required", 400);

    const plan = await Plan.findById(planId);
    if (!plan || !plan.isActive)
      return sendError(res, "Plan not found or no longer available", 404);

    const duplicate = await Subscription.findOne({
      userId: user._id,
      planId: plan._id,
      status: { $in: ACTIVE_STATUSES },
    });
    if (duplicate)
      return sendError(res, "You already have an active or pending subscription for this plan", 409);

    const subscriptionCode   = `RRO-${Date.now()}-${user._id.toString().slice(-4).toUpperCase()}`;
    const amount             = plan.perMonthAmount || plan.price || 0;
    const depositAmount      = plan.deposit        || plan.depositAmount || 0;
    const installationAmount = plan.installationCharges || 0;
    const firstPayment       = amount + depositAmount + installationAmount;

    const slotMap = {
      "tmrw-am": "Tomorrow, 9:00 AM – 1:00 PM",
      "tmrw-pm": "Tomorrow, 2:00 PM – 6:00 PM",
      "day2-am": "Day after tomorrow, 9:00 AM – 1:00 PM",
      "day2-pm": "Day after tomorrow, 2:00 PM – 6:00 PM",
    };

    const subscription = await Subscription.create({
      userId: user._id, planId: plan._id, subscriptionCode,
      status: "payment_pending", paymentStatus: "pending",
      amount, depositAmount,
      billingCycleMonths: plan.billingCycleMonths || 1,
      notes: JSON.stringify({
        deliveryAddress: { fullName, mobile, address, pincode, city },
        paymentMethod,
        deliverySlot: slotMap[deliverySlot] || deliverySlot,
        firstPayment, installationAmount,
        orderedAt: new Date().toISOString(),
      }),
    });

    return sendSuccess(res, {
      subscriptionId:   subscription._id,
      subscriptionCode: subscription.subscriptionCode,
      status:           subscription.status,
      paymentStatus:    subscription.paymentStatus,
      firstPayment,
      plan: {
        brandName: plan.brandName, modelName: plan.modelName,
        perMonthAmount: amount, deposit: depositAmount,
        installationCharges: installationAmount,
      },
      deliverySlot: slotMap[deliverySlot] || deliverySlot,
      message: "Your order has been placed. Payment and installation are pending.",
    }, "Order placed successfully");
  } catch (err) {
    console.error("createOrder error:", err.message);
    return sendError(res, err.message, 500);
  }
};

/* ─── GET /api/subscriptions/my ──────────────────────────────────────────
   Returns ALL live subscriptions as an array.
   Active cards and pending cards are separated on the frontend.
   ──────────────────────────────────────────────────────────────────────── */
const getMySubscription = async (req, res) => {
  try {
    // ✅ find() not findOne() — returns ALL matching documents
    const subscriptions = await Subscription.find({
      userId: req.user._id,
      status: { $in: ACTIVE_STATUSES },
    })
      .sort({ createdAt: -1 })                                              // ✅ sort works on find()
      .populate("planId",   "brandName modelName perMonthAmount deposit billingCycleMonths")
      .populate("deviceId", "deviceId brandName modelName status isOnline");

    return sendSuccess(res, {
      subscriptions,                              // ← array, all live subs
      subscription: subscriptions[0] || null,     // ← backward compat for old callers
      hasActiveSubscription: subscriptions.length > 0,
    }, "Subscription details");
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

/* ─── GET /api/subscriptions/history ─────────────────────────────────────
   Only expired / cancelled — true past orders.
   ──────────────────────────────────────────────────────────────────────── */
const getSubscriptionHistory = async (req, res) => {
  try {
    const subscriptions = await Subscription.find({
      userId: req.user._id,
      status: { $nin: ACTIVE_STATUSES },   // expired, cancelled, refunded, payment_failed
    })
      .sort({ createdAt: -1 })
      .populate("planId", "brandName modelName perMonthAmount");

    return sendSuccess(res, { subscriptions }, "Subscription history");
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

/* ─── PATCH /api/subscriptions/:code/link-device ─── */
const linkDeviceToSubscription = async (req, res) => {
  const { subscriptionCode } = req.params;
  const { deviceId } = req.body;

  const subscription = await Subscription.findOne({
    subscriptionCode: subscriptionCode.toUpperCase(),
    paymentStatus: "success",
  });
  if (!subscription) return sendError(res, "Subscription not found or payment pending", 404);

  const device = await Device.findOne({ deviceId: deviceId.toUpperCase() });
  if (!device) return sendError(res, "Device not found", 404);

  subscription.deviceId    = device._id;
  subscription.installedAt = new Date();
  subscription.startDate   = new Date();
  const end = new Date();
  end.setMonth(end.getMonth() + (subscription.billingCycleMonths || 1));
  subscription.endDate = end;
  subscription.status  = "active";
  await subscription.save();

  if (!device.userIds.includes(subscription.userId))
    device.userIds.push(subscription.userId);
  device.status = "active";
  await device.save();

  return sendSuccess(res, { subscription, device }, "Device linked and subscription activated");
};

module.exports = {
  getPlans,
  createOrder,
  getMySubscription,
  getSubscriptionHistory,
  linkDeviceToSubscription,
};