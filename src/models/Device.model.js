 
const mongoose = require("mongoose");

const deviceSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    deviceId: { type: String, required: true, unique: true, trim: true }, // Hardware ID / MAC
    deviceName: { type: String, default: "My Meter" },
    location: { type: String, trim: true },
    isOnline: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    lastSeen: { type: Date },
    firmware: { type: String, default: "1.0.0" },
    registeredAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Device", deviceSchema);