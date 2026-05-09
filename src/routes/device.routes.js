const express = require("express");
const { body, validationResult } = require("express-validator");

const router = express.Router();
const device = require("../controllers/device.controller");
const { protect } = require("../middlewares/auth.middleware");

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: errors.array()[0].msg,
      errors: errors.array(),
    });
  }
  next();
};

const connectDeviceRules = [
  body("deviceId")
    .trim()
    .notEmpty()
    .withMessage("Device ID is required")
    .matches(/^RRO\d+$/i)
    .withMessage("Device ID must look like RRO001"),

  body("serialNumber")
    .trim()
    .notEmpty()
    .withMessage("Serial number is required"),
];

const updateDeviceRules = [
  body("serialNumber")
    .optional({ checkFalsy: true })
    .trim(),

  body("brandName")
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 80 })
    .withMessage("Brand name cannot exceed 80 characters"),

  body("modelName")
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 80 })
    .withMessage("Model name cannot exceed 80 characters"),

  body("deviceType")
    .optional({ checkFalsy: true })
    .isIn(["RO", "Water Purifier", "RO+UV", "RO+UF", "Other"])
    .withMessage("Invalid device type"),

  body("status")
    .optional({ checkFalsy: true })
    .isIn(["linked", "active", "inactive", "service_due"])
    .withMessage("Invalid status"),

  body("installationDate")
    .optional({ checkFalsy: true })
    .isISO8601()
    .withMessage("Installation date must be valid"),

  body("lastServiced")
    .optional({ checkFalsy: true })
    .isISO8601()
    .withMessage("Last serviced must be a valid date"),

  body("locationLabel")
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 120 })
    .withMessage("Location label cannot exceed 120 characters"),

  body("notes")
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 500 })
    .withMessage("Notes cannot exceed 500 characters"),
];

// Protected routes
router.post("/connect", protect, connectDeviceRules, validate, device.connectDevice);
router.get("/list", protect, device.getMyDevices);
router.get("/overview/:deviceId", protect, device.getOverview);
router.get("/usage/:deviceId", protect, device.getUsage);
router.put("/:deviceId", protect, updateDeviceRules, validate, device.updateDevice);
router.delete("/:deviceId", protect, device.removeDevice);

// Firmware / bridge route
router.post("/log", device.postWaterLog);

module.exports = router;