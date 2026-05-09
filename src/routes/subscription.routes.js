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

module.exports = router;