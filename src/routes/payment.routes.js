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
// TEMP — test Zoho token only — remove after testing
router.get("/test-zoho-token", protect, async (req, res) => {
  try {
    const { getZohoAccessToken } = require("../utils/zohoToken");
    const token = await getZohoAccessToken();
    res.json({ success: true, tokenPreview: token.slice(0, 20) + "..." });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});
// Protected routes
router.use(protect);
router.post("/initiate", initiatePayment);
router.get("/verify/:referenceNumber", verifyPayment);
router.get("/history", getPaymentHistory);

module.exports = router;