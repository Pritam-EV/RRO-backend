const WaterLog = require("../models/WaterLog.model");
const Device = require("../models/Device.model");
const { debitWallet, getOrCreateWallet } = require("../utils/walletHelper");
const { sendSuccess, sendError } = require("../utils/apiResponse");
const { MAX_DAILY_WATER_LIMIT_LITRES, VALVE_OFF } = require("../config/constants");

/**
 * POST /api/water/log
 * Called by ESP32/IoT device via MQTT bridge or direct HTTP
 * Logs a water dispensing session and handles wallet deduction
 */
const logWaterSession = async (req, res) => {
  try {
    const {
      deviceId,         // MongoDB Device _id or hardware deviceId string
      waterQty,         // Litres dispensed this session
      flowRate,
      sessionStart,
      sessionEnd,
      sessionDurationSecs,
      valveStatus,
      valveChangedBy = "user",
      tdsIn,
      tdsOut,
      ratePerLitre,     // ₹/litre — sent by device or default from env
    } = req.body;

    // Resolve device
    const device = await Device.findOne({
      $or: [{ _id: deviceId }, { deviceId }],
    });

    if (!device) return sendError(res, "Device not found", 404);
    if (!device.isActive) return sendError(res, "Device is deactivated", 403);

    const userId = device.userId;

    // Check daily limit
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayLogs = await WaterLog.aggregate([
      { $match: { deviceId: device._id, recordedAt: { $gte: today } } },
      { $group: { _id: null, total: { $sum: "$waterQty" } } },
    ]);
    const usedToday = todayLogs[0]?.total || 0;

    // Auto-OFF valve if daily limit exceeded
    let finalValveStatus = valveStatus;
    let finalValveChangedBy = valveChangedBy;
    if (usedToday + waterQty > MAX_DAILY_WATER_LIMIT_LITRES) {
      finalValveStatus = VALVE_OFF;
      finalValveChangedBy = "limit_exceeded";
    }

    // Wallet deduction
    const rate = ratePerLitre || parseFloat(process.env.WATER_RATE_PER_LITRE || "1");
    const cost = parseFloat((waterQty * rate).toFixed(2));
    let walletDeducted = 0;

    if (cost > 0) {
      try {
        await debitWallet(userId, cost, `Water: ${waterQty}L @ ₹${rate}/L`, device._id.toString());
        walletDeducted = cost;
      } catch (walletErr) {
        // If wallet is empty, turn OFF the valve
        finalValveStatus = VALVE_OFF;
        finalValveChangedBy = "limit_exceeded";
        console.warn(`⚠️ Wallet empty for user ${userId}, valve auto-off`);
      }
    }

    // Save log
    const log = await WaterLog.create({
      deviceId: device._id,
      userId,
      waterQty,
      flowRate,
      totalQtyToday: usedToday + waterQty,
      sessionStart,
      sessionEnd,
      sessionDurationSecs,
      valveStatus: finalValveStatus,
      valveChangedBy: finalValveChangedBy,
      walletDeducted,
      ratePerLitre: rate,
      tdsIn,
      tdsOut,
      recordedAt: new Date(),
    });

    // Update device lastSeen
    await Device.findByIdAndUpdate(device._id, { lastSeen: new Date(), isOnline: true });

    return sendSuccess(res, {
      log,
      valveStatus: finalValveStatus,       // Device reads this to act on valve
      walletDeducted,
      totalQtyToday: usedToday + waterQty,
    }, "Water log saved");
  } catch (err) {
    console.error("logWaterSession error:", err.message);
    return sendError(res, err.message, 500);
  }
};

/**
 * GET /api/water/usage/:deviceId
 * Get water usage logs for a device (user's own)
 */
const getDeviceWaterUsage = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { from, to, limit = 50 } = req.query;

    const device = await Device.findOne({ _id: deviceId, userId: req.user._id });
    if (!device) return sendError(res, "Device not found", 404);

    const query = { deviceId: device._id };
    if (from || to) {
      query.recordedAt = {};
      if (from) query.recordedAt.$gte = new Date(from);
      if (to) query.recordedAt.$lte = new Date(to);
    }

    const logs = await WaterLog.find(query)
      .sort({ recordedAt: -1 })
      .limit(parseInt(limit));

    // Aggregated today's usage
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todaySummary = await WaterLog.aggregate([
      { $match: { deviceId: device._id, recordedAt: { $gte: today } } },
      {
        $group: {
          _id: null,
          totalQty: { $sum: "$waterQty" },
          totalCost: { $sum: "$walletDeducted" },
          sessions: { $sum: 1 },
        },
      },
    ]);

    return sendSuccess(res, {
      logs,
      todaySummary: todaySummary[0] || { totalQty: 0, totalCost: 0, sessions: 0 },
    }, "Water usage logs");
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

/**
 * POST /api/water/valve
 * Manually toggle valve ON/OFF from app
 */
const toggleValve = async (req, res) => {
  try {
    const { deviceId, valveStatus } = req.body;

    if (!["ON", "OFF"].includes(valveStatus)) {
      return sendError(res, "valveStatus must be ON or OFF", 400);
    }

    const device = await Device.findOne({ _id: deviceId, userId: req.user._id });
    if (!device) return sendError(res, "Device not found", 404);
    if (!device.isActive) return sendError(res, "Device deactivated", 403);

    // Check wallet before allowing ON
    if (valveStatus === "ON") {
      const wallet = await getOrCreateWallet(req.user._id);
      if (wallet.balance <= 0) {
        return sendError(res, "Insufficient wallet balance to turn valve ON", 402);
      }
    }

    // Log the valve command (device will pick this up via MQTT/polling)
    const log = await WaterLog.create({
      deviceId: device._id,
      userId: req.user._id,
      waterQty: 0,
      valveStatus,
      valveChangedBy: "user",
      recordedAt: new Date(),
    });

    return sendSuccess(res, { valveStatus, log }, `Valve ${valveStatus} command sent`);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

/**
 * GET /api/water/summary/:deviceId
 * Monthly usage summary for Usage page
 */
const getUsageSummary = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { year, month } = req.query;

    const device = await Device.findOne({ _id: deviceId, userId: req.user._id });
    if (!device) return sendError(res, "Device not found", 404);

    const y = parseInt(year) || new Date().getFullYear();
    const m = parseInt(month) || new Date().getMonth() + 1;

    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 1);

    const dailySummary = await WaterLog.aggregate([
      {
        $match: {
          deviceId: device._id,
          recordedAt: { $gte: start, $lt: end },
        },
      },
      {
        $group: {
          _id: { $dayOfMonth: "$recordedAt" },
          totalQty: { $sum: "$waterQty" },
          totalCost: { $sum: "$walletDeducted" },
          sessions: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const monthTotal = dailySummary.reduce(
      (acc, d) => ({ qty: acc.qty + d.totalQty, cost: acc.cost + d.totalCost }),
      { qty: 0, cost: 0 }
    );

    return sendSuccess(res, { dailySummary, monthTotal, year: y, month: m }, "Usage summary");
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

module.exports = { logWaterSession, getDeviceWaterUsage, toggleValve, getUsageSummary };