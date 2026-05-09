// src/models/WaterLog.model.js
const mongoose = require("mongoose");

const waterLogSchema = new mongoose.Schema(
  {
    deviceId:     { type: String, required: true, unique: true, uppercase: true, trim: true },
    totalMl:      { type: Number, default: 0, min: 0 },   // all-time cumulative, never resets
    totalMlToday: { type: Number, default: 0, min: 0 },   // resets each day by device
    valveStatus:  { type: String, enum: ["ON", "OFF"], default: "ON" },
    deviceStatus: { type: String, enum: ["active", "inactive"], default: "active" },
    lastActiveAt: { type: Date, default: null },
    source:       { type: String, enum: ["mqtt", "manual", "api"], default: "mqtt" },
  },
  { timestamps: true, versionKey: false }
);

waterLogSchema.index({ deviceId: 1 });

module.exports = mongoose.model("WaterLog", waterLogSchema);