const mongoose = require("mongoose");

const waterLogSchema = new mongoose.Schema(
  {
    deviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Device",
      required: [true, "Device ID is required"],
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
    },

    // ── Water Measurement ──────────────────────────────
    waterQty: {
      type: Number,
      required: [true, "Water quantity is required"],
      min: [0, "Water quantity cannot be negative"],
    },
    flowRate: {
      type: Number,
      default: 0,
    },
    totalQtyToday: {
      type: Number,
      default: 0,
    },
    totalQtySinceReset: {
      type: Number,
      default: 0,
    },

    // ── Valve Control ──────────────────────────────────
    valveStatus: {
      type: String,
      enum: ["ON", "OFF"],
      required: [true, "Valve status is required"],
    },
    valveChangedBy: {
      type: String,
      enum: ["user", "auto", "admin", "limit_exceeded", "subscription_expired"],
      default: "auto",
    },

    // ── Session Info ───────────────────────────────────
    sessionStart: {
      type: Date,
      default: null,
    },
    sessionEnd: {
      type: Date,
      default: null,
    },
    sessionDurationSecs: {
      type: Number,
      default: 0,
    },

    // ── Water Quality ──────────────────────────────────
    tdsIn: {
      type: Number,       // TDS before RO filter (ppm)
      default: null,
    },
    tdsOut: {
      type: Number,       // TDS after RO filter (ppm)
      default: null,
    },

    // ── Timestamp ─────────────────────────────────────
    recordedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,     // adds createdAt + updatedAt
    versionKey: false,    // removes __v field
  }
);

// ── Indexes ───────────────────────────────────────────
// For device log queries (most common — paginated log fetch)
waterLogSchema.index({ deviceId: 1, recordedAt: -1 });

// For today's summary & history queries
waterLogSchema.index({ deviceId: 1, userId: 1, recordedAt: -1 });

// For valve status queries
waterLogSchema.index({ deviceId: 1, valveStatus: 1 });

// ── Virtual: session duration in minutes ──────────────
waterLogSchema.virtual("sessionDurationMins").get(function () {
  return this.sessionDurationSecs
    ? parseFloat((this.sessionDurationSecs / 60).toFixed(2))
    : 0;
});

// ── Virtual: TDS rejection rate % ────────────────────
waterLogSchema.virtual("tdsRejectionRate").get(function () {
  if (this.tdsIn && this.tdsOut && this.tdsIn > 0) {
    return parseFloat(
      (((this.tdsIn - this.tdsOut) / this.tdsIn) * 100).toFixed(1)
    );
  }
  return null;
});

module.exports = mongoose.model("WaterLog", waterLogSchema);