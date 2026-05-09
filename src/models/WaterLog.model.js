// src/models/WaterLog.model.js
const mongoose = require("mongoose");

const waterLogSchema = new mongoose.Schema(
  {
    // ── References ──────────────────────────────────────
    deviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Device",
      required: true,
      index: true,
    },
    deviceStringId: {
      type: String,   // "RRO001" — stored for fast lookup without populate
      required: true,
      uppercase: true,
      trim: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // ── Daily Water Data (from MQTT, once per day) ──────
    date: {
      type: String,   // "2026-05-10" — ISO date string, used as upsert key
      required: true,
      index: true,
    },
    totalMlToday: {
      type: Number,   // total ml consumed today — cumulative, sent by device
      default: 0,
      min: 0,
    },
    totalLitresToday: {
      type: Number,   // computed: totalMlToday / 1000
      default: 0,
    },

    // ── Valve ────────────────────────────────────────────
    valveStatus: {
      type: String,
      enum: ["ON", "OFF"],
      default: "ON",
    },
    valveChangedBy: {
      type: String,
      enum: ["device", "user", "admin", "auto"],
      default: "device",
    },

    // ── Device Status at time of log ─────────────────────
    deviceStatus: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
    lastActiveAt: {
      type: Date,
      default: null,
    },

    // ── Source ───────────────────────────────────────────
    source: {
      type: String,
      enum: ["mqtt", "manual", "api"],
      default: "mqtt",
    },
  },
  {
    timestamps: true,   // createdAt = first log of day, updatedAt = last update
    versionKey: false,
  }
);

// ── Compound unique index: one document per device per day ──
waterLogSchema.index({ deviceStringId: 1, date: 1 }, { unique: true });

// ── For dashboard queries ────────────────────────────────
waterLogSchema.index({ deviceId: 1, date: -1 });
waterLogSchema.index({ userId: 1, date: -1 });

module.exports = mongoose.model("WaterLog", waterLogSchema);