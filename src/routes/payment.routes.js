const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/auth.middleware");
const {
  initiatePayment,
  verifyPayment,
  handleWebhook,
  getPaymentHistory,
} = require("../controllers/payment.controller");

// Webhook must be raw body — register BEFORE express.json() parses it
// (handled at app.js level with rawBody middleware for /api/payments/webhook)

router.post("/webhook", handleWebhook);              // Public — Zoho calls this

router.use(protect);                                  // All below require auth

router.post("/initiate", initiatePayment);
router.get("/verify/:referenceNumber", verifyPayment);
router.get("/history", getPaymentHistory);

module.exports = router;