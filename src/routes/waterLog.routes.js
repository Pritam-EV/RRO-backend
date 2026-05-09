// src/routes/waterLog.routes.js
const express = require("express");
const router  = express.Router();
const { protect } = require("../middlewares/auth.middleware");
const {
  getTodaySummary,
  getUsageHistory,
  getOverviewData,
  controlValve,
} = require("../controllers/waterLog.controller");

// All routes protected — user must be logged in
router.use(protect);

router.get("/:deviceId/overview", getOverviewData);   // ← OverviewPage uses this
router.get("/:deviceId/today",    getTodaySummary);
router.get("/:deviceId/history",  getUsageHistory);
router.patch("/:deviceId/valve",  controlValve);

module.exports = router;