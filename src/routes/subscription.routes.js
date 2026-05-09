const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/auth.middleware");
const {
  getPlans,
  createOrder,
  getMySubscription,
  getSubscriptionHistory,
} = require("../controllers/subscription.controller");

router.get("/plans", getPlans);

router.use(protect);
router.post("/order", createOrder);
router.get("/my", getMySubscription);
router.get("/history", getSubscriptionHistory);
// PATCH /api/subscriptions/:subscriptionCode/link-device  (admin/technician only)
router.patch("/:subscriptionCode/link-device", protect, async (req, res) => {
  const { deviceId } = req.body;
  const sub = await Subscription.findOne({
    subscriptionCode: req.params.subscriptionCode.toUpperCase(),
  });
  if (!sub) return sendError(res, "Subscription not found", 404);

  const device = await Device.findOne({ deviceId: deviceId.toUpperCase() });
  if (!device) return sendError(res, "Device not found", 404);

  const now = new Date();
  const end = new Date(now);
  end.setMonth(end.getMonth() + (sub.billingCycleMonths || 1));

  sub.deviceId      = device._id;
  sub.status        = "active";
  sub.paymentStatus = "success";
  sub.installedAt   = now;
  sub.startDate     = now;
  sub.endDate       = end;
  await sub.save();

  // Auto-link userId to device
  device.userIds.addToSet(sub.userId);
  device.status = "active";
  await device.save();

  return sendSuccess(res, { subscription: sub, device }, "Device linked and subscription activated");
});
module.exports = router;