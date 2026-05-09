// src/controllers/waterLog.controller.js
const WaterLog = require("../models/WaterLog.model");
const Device   = require("../models/Device.model");
const { sendSuccess, sendError } = require("../utils/apiResponse");
const { publishValveCommand }    = require("../mqtt/mqttClient");

// Helper — find device and verify it belongs to this user
async function findDevice(deviceStringId, userId) {
  return Device.findOne({
    deviceId: deviceStringId.toUpperCase(),
    userIds:  userId,
  });
}

// ── GET /api/water/:deviceId/overview ────────────────────
exports.getOverviewData = async (req, res) => {
  try {
    const device = await findDevice(req.params.deviceId, req.user._id);
    if (!device) return sendError(res, "Device not found or not linked to your account", 404);

    const log = await WaterLog.findOne({ deviceId: device.deviceId });

    return sendSuccess(res, {
      device: {
        deviceId:    device.deviceId,
        isOnline:    device.isOnline,
        valveStatus: device.valveStatus,
        status:      device.status,
        lastSeenAt:  device.lastSeenAt,
      },
      totalMl:      log?.totalMl      ?? 0,
      totalLitres:  parseFloat(((log?.totalMl ?? 0) / 1000).toFixed(3)),
      totalMlToday: log?.totalMlToday ?? 0,
      todayLitres:  parseFloat(((log?.totalMlToday ?? 0) / 1000).toFixed(3)),
      valveStatus:  log?.valveStatus  ?? device.valveStatus ?? "ON",
      deviceStatus: log?.deviceStatus ?? device.status,
      lastActiveAt: log?.lastActiveAt ?? device.lastSeenAt,
    }, "Overview data");
  } catch (e) {
    return sendError(res, e.message, 500);
  }
};

// ── GET /api/water/:deviceId/today ────────────────────────
exports.getTodaySummary = async (req, res) => {
  try {
    const device = await findDevice(req.params.deviceId, req.user._id);
    if (!device) return sendError(res, "Device not found or not linked to your account", 404);

    const log = await WaterLog.findOne({ deviceId: device.deviceId });

    return sendSuccess(res, {
      totalMl:      log?.totalMl      ?? 0,
      totalMlToday: log?.totalMlToday ?? 0,
      todayLitres:  parseFloat(((log?.totalMlToday ?? 0) / 1000).toFixed(3)),
      valveStatus:  log?.valveStatus  ?? device.valveStatus ?? "ON",
      deviceStatus: log?.deviceStatus ?? device.status,
      lastActiveAt: log?.lastActiveAt ?? device.lastSeenAt,
      isOnline:     device.isOnline,
    }, "Today summary");
  } catch (e) {
    return sendError(res, e.message, 500);
  }
};

// ── GET /api/water/:deviceId/history?days=7 ──────────────
// NOTE: With new single-doc schema, history returns current snapshot only.
// Upgrade to a separate DailyLog collection later for full history.
exports.getUsageHistory = async (req, res) => {
  try {
    const device = await findDevice(req.params.deviceId, req.user._id);
    if (!device) return sendError(res, "Device not found or not linked to your account", 404);

    const log = await WaterLog.findOne({ deviceId: device.deviceId });

    return sendSuccess(res, {
      deviceId:     device.deviceId,
      totalMl:      log?.totalMl      ?? 0,
      totalLitres:  parseFloat(((log?.totalMl ?? 0) / 1000).toFixed(3)),
      totalMlToday: log?.totalMlToday ?? 0,
      todayLitres:  parseFloat(((log?.totalMlToday ?? 0) / 1000).toFixed(3)),
      valveStatus:  log?.valveStatus  ?? "ON",
      deviceStatus: log?.deviceStatus ?? "active",
      lastActiveAt: log?.lastActiveAt,
      source:       log?.source       ?? "mqtt",
    }, "Usage data");
  } catch (e) {
    return sendError(res, e.message, 500);
  }
};
// 
// ── PATCH /api/water/:deviceId/valve ─────────────────────
exports.controlValve = async (req, res) => {
  try {
    const { valve } = req.body;
    if (!["ON", "OFF"].includes(valve))
      return sendError(res, "valve must be ON or OFF", 400);

    const device = await findDevice(req.params.deviceId, req.user._id);
    if (!device) return sendError(res, "Device not found or not linked to your account", 404);

    const sent = publishValveCommand(device.deviceId, valve);
    await Device.findByIdAndUpdate(device._id, { valveStatus: valve });
    await WaterLog.findOneAndUpdate(
      { deviceId: device.deviceId },
      { $set: { valveStatus: valve, source: "user" } },
      { upsert: true, new: true }
    );

    return sendSuccess(res, { deviceId: device.deviceId, valve, commandSent: sent },
      `Valve ${valve} command sent`);
  } catch (e) {
    return sendError(res, e.message, 500);
  }
};