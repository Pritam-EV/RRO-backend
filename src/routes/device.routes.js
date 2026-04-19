 
const express = require("express");
const router = express.Router();
const device = require("../controllers/device.controller");
const { protect } = require("../middlewares/auth.middleware");

router.post("/connect", protect, device.connectDevice);
router.get("/list", protect, device.getMyDevices);
router.get("/overview/:deviceId", protect, device.getOverview);
router.get("/usage/:deviceId", protect, device.getUsage);
router.delete("/:deviceId", protect, device.removeDevice);

// ESP32 firmware posts readings here (no user auth, uses deviceId)
router.post("/log", device.postWaterLog);

module.exports = router;