 
const express = require("express");
const router = express.Router();
const wallet = require("../controllers/wallet.controller");
const { protect } = require("../middlewares/auth.middleware");

router.get("/", protect, wallet.getWallet);
router.get("/transactions", protect, wallet.getTransactions);
router.post("/topup/initiate", protect, wallet.initiateTopup);
router.post("/topup/webhook", wallet.topupWebhook);       // No auth — Cashfree calls this
router.get("/payments", protect, wallet.getPayments);

module.exports = router;