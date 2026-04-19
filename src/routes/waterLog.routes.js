const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/auth.middleware");
const {
  logWaterUsage,
  getDeviceLogs,
  getTodaySummary,
  getUsageHistory,
  controlValve,
} = require("../controllers/waterLog.controller");

router.post("/log", logWaterUsage);
router.get("/:deviceId", protect, getDeviceLogs);
router.get("/:deviceId/today", protect, getTodaySummary);
router.get("/:deviceId/history", protect, getUsageHistory);
router.patch("/:deviceId/valve", protect, controlValve);

module.exports = router;