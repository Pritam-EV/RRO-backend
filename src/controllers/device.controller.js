 
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess, sendError } = require("../utils/apiResponse");
const Device = require("../models/Device.model");
const WaterLog = require("../models/WaterLog.model");
// POST /api/device/connect
exports.connectDevice = asyncHandler(async (req, res) => {
  const { deviceId, deviceName, location } = req.body;
  if (!deviceId) return sendError(res, "Device ID required");

  const existing = await Device.findOne({ deviceId });
  if (existing) {
    if (existing.userId.toString() !== req.user._id.toString()) {
      return sendError(res, "Device already registered to another user", 409);
    }
    return sendSuccess(res, { device: existing }, "Device already connected");
  }

  const device = await Device.create({
    userId: req.user._id,
    deviceId,
    deviceName: deviceName || "My Meter",
    location,
  });
  sendSuccess(res, { device }, "Device connected successfully", 201);
});

// GET /api/device/list
exports.getMyDevices = asyncHandler(async (req, res) => {
  const devices = await Device.find({ userId: req.user._id, isActive: true });
  sendSuccess(res, { devices });
});

// GET /api/device/overview/:deviceId
exports.getOverview = asyncHandler(async (req, res) => {
  const device = await Device.findOne({
    deviceId: req.params.deviceId,
    userId: req.user._id,
  });
  if (!device) return sendError(res, "Device not found", 404);

  // Latest reading
  const latest = await WaterLog.findOne({ deviceId: device._id }).sort({ recordedAt: -1 });
  sendSuccess(res, { device, latestReading: latest });
});

// GET /api/device/usage/:deviceId?from=&to=
exports.getUsage = asyncHandler(async (req, res) => {
  const { from, to, limit = 100 } = req.query;
  const device = await Device.findOne({ deviceId: req.params.deviceId, userId: req.user._id });
  if (!device) return sendError(res, "Device not found", 404);

  const filter = { deviceId: device._id };
  if (from || to) {
    filter.recordedAt = {};
    if (from) filter.recordedAt.$gte = new Date(from);
    if (to) filter.recordedAt.$lte = new Date(to);
  }

  const logs = await WaterLog.find(filter)
    .sort({ recordedAt: -1 })
    .limit(parseInt(limit));

  sendSuccess(res, { logs, count: logs.length });
});

// POST /api/device/log  (called by ESP32/firmware via MQTT bridge or HTTP)
exports.postWaterLog = asyncHandler(async (req, res) => {
  const { deviceId, voltage, current, power, energy, powerFactor, frequency } = req.body;
  if (!deviceId) return sendError(res, "deviceId required");

  const device = await Device.findOne({ deviceId });
  if (!device) return sendError(res, "Device not registered", 404);

  device.isOnline = true;
  device.lastSeen = new Date();
  await device.save();

  const log = await WaterLog.create({
    deviceId: device._id,
    userId: device.userId,
    voltage, current, power, energy, powerFactor, frequency,
  });

  sendSuccess(res, { log }, "Reading saved", 201);
});

// DELETE /api/device/:deviceId
exports.removeDevice = asyncHandler(async (req, res) => {
  const device = await Device.findOne({ deviceId: req.params.deviceId, userId: req.user._id });
  if (!device) return sendError(res, "Device not found", 404);
  device.isActive = false;
  await device.save();
  sendSuccess(res, {}, "Device removed");
});