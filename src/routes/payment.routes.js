const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/auth.middleware");
const {
  initiatePayment,
  verifyPayment,
  handleWebhook,
  getPaymentHistory,
} = require("../controllers/payment.controller");

// Webhook — public, Zoho calls this directly
router.post("/webhook", handleWebhook);

// Protected routes
router.use(protect);
router.post("/initiate", initiatePayment);
router.get("/verify/:referenceNumber", verifyPayment);
router.get("/history", getPaymentHistory);

module.exports = router;