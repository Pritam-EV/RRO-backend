const mongoose = require("mongoose");

const waterLogSchema = new mongoose.Schema(
  {
    deviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Device",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Water flow data from RO device
    waterQty: { type: Number, required: true },         // Litres dispensed in this session
    flowRate: { type: Number },                         // L/min at time of reading
    totalQtyToday: { type: Number },                    // Cumulative litres for the day
    totalQtySinceReset: { type: Number },               // Cumulative since last reset

    // Valve state
    valveStatus: {
      type: String,
      enum: ["ON", "OFF"],
      required: true,
    },
    valveChangedBy: {
      type: String,
      enum: ["user", "auto", "admin", "limit_exceeded"],
      default: "user",
    },

    // Session tracking
    sessionStart: { type: Date },
    sessionEnd: { type: Date },
    sessionDurationSecs: { type: Number },              // Seconds valve was ON

    // Wallet deduction for this session (prepaid RO)
    walletDeducted: { type: Number, default: 0 },       // ₹ deducted
    ratePerLitre: { type: Number },                     // ₹/litre at time of log

    // Optional TDS / quality reading if sensor available
    tdsIn: { type: Number },                            // TDS ppm before filter
    tdsOut: { type: Number },                           // TDS ppm after filter

    recordedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Fast queries: device logs by date
waterLogSchema.index({ deviceId: 1, recordedAt: -1 });
// Daily aggregation query
waterLogSchema.index({ deviceId: 1, userId: 1, recordedAt: -1 });

module.exports = mongoose.model("WaterLog", waterLogSchema);