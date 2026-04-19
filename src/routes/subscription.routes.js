 
const express = require("express");
const router = express.Router();
const sub = require("../controllers/subscription.controller");
const { protect } = require("../middlewares/auth.middleware");

router.get("/plans", sub.getPlans);                     // Public
router.get("/active", protect, sub.getActiveSub);
router.post("/subscribe", protect, sub.subscribe);
router.post("/webhook", sub.subscriptionWebhook);       // Cashfree

module.exports = router;