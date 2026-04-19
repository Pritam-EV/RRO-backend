const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/auth.middleware");
const {
  getPlans,
  initiatePlanPurchase,
  getMySubscription,
  getSubscriptionHistory,
} = require("../controllers/subscription.controller");

router.get("/plans", getPlans);           // Public — anyone can see plans

router.use(protect);
router.post("/initiate", initiatePlanPurchase);
router.get("/my", getMySubscription);
router.get("/history", getSubscriptionHistory);

module.exports = router;