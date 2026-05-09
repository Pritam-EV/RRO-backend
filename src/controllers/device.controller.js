const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess, sendError } = require("../utils/apiResponse");
const Device = require("../models/Device.model");
const WaterLog = require("../models/WaterLog.model");

// POST /api/devices/connect
exports.connectDevice = asyncHandler(async (req, res) => {
  const { deviceId, serialNumber } = req.body;

  if (!deviceId) return sendError(res, "Device ID is required", 400);
  if (!serialNumber) return sendError(res, "Serial number is required", 400);

  const normalizedDeviceId = deviceId.trim().toUpperCase();
  const normalizedSerialNumber = serialNumber.trim();

  const device = await Device.findOne({
    deviceId: normalizedDeviceId,
    serialNumber: normalizedSerialNumber,
  });

  if (!device) {
    return sendError(res, "Device ID and Serial Number do not match our records", 404);
  }

  const alreadyLinked = device.userIds?.some(
    (id) => id.toString() === req.user._id.toString()
  );

  if (alreadyLinked) {
    return sendSuccess(res, { device }, "Device already linked to your account");
  }

  device.userIds.addToSet(req.user._id);

  if (device.status === "inactive") {
    device.status = "linked";
  }

  await device.save();

  return sendSuccess(res, { device }, "Device linked successfully");
});

// GET /api/devices/list
exports.getMyDevices = asyncHandler(async (req, res) => {
  const devices = await Device.find({
    userIds: req.user._id,
  }).sort({ createdAt: -1 });

  return sendSuccess(res, { devices }, "Devices fetched successfully");
});

// GET /api/devices/overview/:deviceId
// GET /api/devices/overview/:deviceId
exports.getOverview = asyncHandler(async (req, res) => {
  const device = await Device.findOne({
    deviceId: req.params.deviceId.toUpperCase(),
    userIds: req.user._id,
  });
  if (!device) return sendError(res, "Device not found", 404);

  const latest = await WaterLog.findOne({ deviceId: device._id }).sort({ recordedAt: -1 });

  // ADD THIS ↓
  const totalAgg = await WaterLog.aggregate([
    { $match: { deviceId: device._id } },
    { $group: { _id: null, totalLitres: { $sum: "$energy" } } }
  ]);
  const totalLitres = totalAgg[0]?.totalLitres ?? 0;

  return sendSuccess(res, { device, latestReading: latest, totalLitres }, "Overview fetched successfully");
});

// GET /api/devices/usage/:deviceId?from=&to=&limit=
exports.getUsage = asyncHandler(async (req, res) => {
  const { from, to, limit = 100 } = req.query;

  const device = await Device.findOne({
    deviceId: req.params.deviceId.toUpperCase(),
    userIds: req.user._id,
  });

  if (!device) return sendError(res, "Device not found", 404);

  const filter = { deviceId: device._id };

  if (from || to) {
    filter.recordedAt = {};
    if (from) filter.recordedAt.$gte = new Date(from);
    if (to) filter.recordedAt.$lte = new Date(to);
  }

  const logs = await WaterLog.find(filter)
    .sort({ recordedAt: -1 })
    .limit(parseInt(limit, 10));

  return sendSuccess(
    res,
    { logs, count: logs.length },
    "Usage logs fetched successfully"
  );
});

// POST /api/devices/log
exports.postWaterLog = asyncHandler(async (req, res) => {
  const {
    deviceId,
    voltage,
    current,
    power,
    energy,
    powerFactor,
    frequency,
  } = req.body;

  if (!deviceId) return sendError(res, "deviceId required", 400);

  const device = await Device.findOne({
    deviceId: deviceId.trim().toUpperCase(),
  });

  if (!device) return sendError(res, "Device not registered", 404);

  device.isOnline = true;
  device.lastSeenAt = new Date();
  if (device.status === "linked" || device.status === "inactive") {
    device.status = "active";
  }
  await device.save();

  const log = await WaterLog.create({
    deviceId: device._id,
    userId: device.userId,
    voltage,
    current,
    power,
    energy,
    powerFactor,
    frequency,
  });

  return sendSuccess(res, { log }, "Reading saved", 201);
});

// PUT /api/devices/:deviceId
exports.updateDevice = asyncHandler(async (req, res) => {
  const {
    serialNumber,
    brandName,
    modelName,
    deviceType,
    status,
    isOnline,
    installationDate,
    lastServiced,
    locationLabel,
    notes,
  } = req.body;

  const device = await Device.findOne({
    deviceId: req.params.deviceId.toUpperCase(),
    userIds: req.user._id,
  });

  if (!device) return sendError(res, "Device not found", 404);

  if (serialNumber) {
    const normalizedSerial = serialNumber.trim();

    if (normalizedSerial !== device.serialNumber) {
      const duplicate = await Device.findOne({
        serialNumber: normalizedSerial,
        _id: { $ne: device._id },
      });

      if (duplicate) {
        return sendError(res, "Another device already uses this serial number", 409);
      }
    }

    device.serialNumber = normalizedSerial;
  }

  if (brandName !== undefined) device.brandName = brandName.trim();
  if (modelName !== undefined) device.modelName = modelName?.trim() || null;
  if (deviceType !== undefined) device.deviceType = deviceType;
  if (status !== undefined) device.status = status;
  if (isOnline !== undefined) device.isOnline = Boolean(isOnline);
  if (installationDate !== undefined) {
    device.installationDate = installationDate ? new Date(installationDate) : device.installationDate;
  }
  if (lastServiced !== undefined) {
    device.lastServiced = lastServiced ? new Date(lastServiced) : null;
  }
  if (locationLabel !== undefined) device.locationLabel = locationLabel?.trim() || null;
  if (notes !== undefined) device.notes = notes?.trim() || null;

  await device.save();

  return sendSuccess(res, { device }, "Device updated successfully");
});

// DELETE /api/devices/:deviceId
exports.removeDevice = asyncHandler(async (req, res) => {
  const device = await Device.findOne({
    deviceId: req.params.deviceId.toUpperCase(),
    userIds: req.user._id,
  });

  if (!device) return sendError(res, "Device not found", 404);

  device.userIds = device.userIds.filter(
    (id) => id.toString() !== req.user._id.toString()
  );

  if (device.userIds.length === 0) {
    device.status = "inactive";
  }

  await device.save();

  return sendSuccess(res, {}, "Device unlinked successfully");
});