// src/controllers/waterLog.controller.js
const WaterLog  = require("../models/WaterLog.model");
const Device    = require("../models/Device.model");
const { sendSuccess, sendError } = require("../utils/apiResponse");
const { publishValveCommand }    = require("../mqtt/mqttClient");

// ── GET /api/water/:deviceId/today ────────────────────────
// Returns today's log for the device
exports.getTodaySummary = async (req, res) => {
  try {
    const device = await Device.findOne({
      deviceId: req.params.deviceId.toUpperCase(),
      userIds:  req.user._id,
    });
    if (!device) return sendError(res, "Device not found", 404);

    const today = new Date().toISOString().split("T")[0];
    const log   = await WaterLog.findOne({ deviceStringId: device.deviceId, date: today });

    return sendSuccess(res, {
      date:             today,
      totalMlToday:     log?.totalMlToday     ?? 0,
      totalLitresToday: log?.totalLitresToday ?? 0,
      valveStatus:      log?.valveStatus      ?? device.valveStatus ?? "ON",
      deviceStatus:     log?.deviceStatus     ?? device.status,
      lastActiveAt:     log?.lastActiveAt     ?? device.lastSeenAt,
      isOnline:         device.isOnline,
    }, "Today summary");
  } catch (e) {
    return sendError(res, e.message, 500);
  }
};

// ── GET /api/water/:deviceId/history?days=30 ─────────────
// Returns daily logs for past N days (default 30)
exports.getUsageHistory = async (req, res) => {
  try {
    const device = await Device.findOne({
      deviceId: req.params.deviceId.toUpperCase(),
      userIds:  req.user._id,
    });
    if (!device) return sendError(res, "Device not found", 404);

    const days  = Math.min(parseInt(req.query.days) || 30, 90);
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceStr = since.toISOString().split("T")[0];

    const logs = await WaterLog.find({
      deviceStringId: device.deviceId,
      date: { $gte: sinceStr },
    })
      .sort({ date: -1 })
      .select("date totalMlToday totalLitresToday valveStatus deviceStatus lastActiveAt -_id");

    // total consumption over period
    const totalLitres = logs.reduce((sum, l) => sum + (l.totalLitresToday || 0), 0);

    return sendSuccess(res, {
      deviceId:    device.deviceId,
      days,
      totalLitres: parseFloat(totalLitres.toFixed(3)),
      logs,
    }, "Usage history");
  } catch (e) {
    return sendError(res, e.message, 500);
  }
};

// ── GET /api/water/:deviceId/overview ────────────────────
// Used by OverviewPage — totalLitres ALL TIME + today data
exports.getOverviewData = async (req, res) => {
  try {
    const device = await Device.findOne({
      deviceId: req.params.deviceId.toUpperCase(),
      userIds:  req.user._id,
    });
    if (!device) return sendError(res, "Device not found", 404);

    // All-time total
    const allTime = await WaterLog.aggregate([
      { $match: { deviceStringId: device.deviceId } },
      { $group: { _id: null, totalLitres: { $sum: "$totalLitresToday" } } },
    ]);

    // Today
    const today    = new Date().toISOString().split("T")[0];
    const todayLog = await WaterLog.findOne({ deviceStringId: device.deviceId, date: today });

    return sendSuccess(res, {
      device: {
        deviceId:    device.deviceId,
        isOnline:    device.isOnline,
        valveStatus: device.valveStatus,
        status:      device.status,
        lastSeenAt:  device.lastSeenAt,
      },
      totalLitres:      parseFloat((allTime[0]?.totalLitres ?? 0).toFixed(3)),
      todayLitres:      todayLog?.totalLitresToday ?? 0,
      todayValve:       todayLog?.valveStatus ?? device.valveStatus ?? "ON",
    }, "Overview data");
  } catch (e) {
    return sendError(res, e.message, 500);
  }
};

// ── PATCH /api/water/:deviceId/valve ─────────────────────
// User controls valve from app → publishes MQTT command
exports.controlValve = async (req, res) => {
  try {
    const { valve } = req.body;   // "ON" or "OFF"
    if (!["ON", "OFF"].includes(valve)) {
      return sendError(res, "valve must be ON or OFF", 400);
    }

    const device = await Device.findOne({
      deviceId: req.params.deviceId.toUpperCase(),
      userIds:  req.user._id,
    });
    if (!device) return sendError(res, "Device not found", 404);

    // Publish MQTT command to device
    const sent = publishValveCommand(device.deviceId, valve);

    // Optimistically update DB (device will confirm via next telemetry)
    await Device.findByIdAndUpdate(device._id, { valveStatus: valve });

    return sendSuccess(res, {
      deviceId:    device.deviceId,
      valve,
      commandSent: sent,
    }, `Valve ${valve} command sent`);
  } catch (e) {
    return sendError(res, e.message, 500);
  }
};