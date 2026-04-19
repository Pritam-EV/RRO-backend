const WaterLog = require("../models/WaterLog.model");
const Device = require("../models/Device.model");

// POST /api/water/log — called by ESP32 device
const logWaterUsage = async (req, res, next) => {
  try {
    const {
      deviceId,
      userId,
      waterQty,
      flowRate,
      totalQtyToday,
      totalQtySinceReset,
      valveStatus,
      valveChangedBy,
      sessionStart,
      sessionEnd,
      sessionDurationSecs,
      tdsIn,
      tdsOut,
    } = req.body;

    if (!deviceId || !userId || waterQty === undefined || !valveStatus) {
      return res.status(400).json({
        success: false,
        message: "deviceId, userId, waterQty, valveStatus are required",
      });
    }

    const log = await WaterLog.create({
      deviceId,
      userId,
      waterQty,
      flowRate,
      totalQtyToday,
      totalQtySinceReset,
      valveStatus,
      valveChangedBy: valveChangedBy || "auto",
      sessionStart,
      sessionEnd,
      sessionDurationSecs,
      tdsIn,
      tdsOut,
      recordedAt: new Date(),
    });

    // Update device last seen & online status
    await Device.findByIdAndUpdate(deviceId, {
      lastSeen: new Date(),
      isOnline: true,
    });

    res.status(201).json({ success: true, data: log });
  } catch (err) {
    next(err);
  }
};

// GET /api/water/:deviceId — paginated logs
const getDeviceLogs = async (req, res, next) => {
  try {
    const { deviceId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      WaterLog.find({ deviceId })
        .sort({ recordedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      WaterLog.countDocuments({ deviceId }),
    ]);

    res.json({
      success: true,
      data: logs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/water/:deviceId/today — today's summary
const getTodaySummary = async (req, res, next) => {
  try {
    const { deviceId } = req.params;

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const logs = await WaterLog.find({
      deviceId,
      recordedAt: { $gte: startOfDay },
    }).lean();

    const totalQty = logs.reduce((sum, l) => sum + (l.waterQty || 0), 0);
    const sessions = logs.filter((l) => l.sessionDurationSecs > 0).length;
    const avgTdsOut =
      logs.filter((l) => l.tdsOut).reduce((sum, l) => sum + l.tdsOut, 0) /
        (logs.filter((l) => l.tdsOut).length || 1);

    res.json({
      success: true,
      data: {
        totalQtyToday: parseFloat(totalQty.toFixed(2)),
        sessionCount: sessions,
        avgTdsOut: parseFloat(avgTdsOut.toFixed(1)),
        logCount: logs.length,
      },
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/water/:deviceId/history?range=7d|30d
const getUsageHistory = async (req, res, next) => {
  try {
    const { deviceId } = req.params;
    const range = req.query.range || "7d";
    const days = range === "30d" ? 30 : 7;

    const since = new Date();
    since.setDate(since.getDate() - days);

    const logs = await WaterLog.find({
      deviceId,
      recordedAt: { $gte: since },
    })
      .sort({ recordedAt: 1 })
      .lean();

    // Group by date
    const grouped = {};
    logs.forEach((log) => {
      const date = new Date(log.recordedAt).toISOString().split("T")[0];
      if (!grouped[date]) grouped[date] = 0;
      grouped[date] += log.waterQty || 0;
    });

    const history = Object.entries(grouped).map(([date, qty]) => ({
      date,
      qty: parseFloat(qty.toFixed(2)),
    }));

    res.json({ success: true, data: history });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/water/:deviceId/valve — open/close valve
const controlValve = async (req, res, next) => {
  try {
    const { deviceId } = req.params;
    const { valveStatus, reason } = req.body;

    if (!["ON", "OFF"].includes(valveStatus)) {
      return res.status(400).json({
        success: false,
        message: "valveStatus must be ON or OFF",
      });
    }

    const log = await WaterLog.create({
      deviceId,
      userId: req.user._id,
      waterQty: 0,
      valveStatus,
      valveChangedBy: reason || "user",
      recordedAt: new Date(),
    });

    // TODO: Send MQTT command to device here
    // mqttClient.publish(`device/${deviceId}/valve`, valveStatus);

    res.json({
      success: true,
      message: `Valve turned ${valveStatus}`,
      data: log,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  logWaterUsage,
  getDeviceLogs,
  getTodaySummary,
  getUsageHistory,
  controlValve,
};