const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema(
  {
    mobile: {
      type: String,
      required: [true, "Mobile is required"],
      trim: true,
      index: true,
    },
    otp: {
      type: String,
      required: [true, "OTP is required"],
    },
    purpose: {
      type: String,
      enum: ["login", "signup", "reset_password"],
      required: [true, "OTP purpose is required"],
      default: "login",
    },
    expiresAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
    },
    verified: {
      type: Boolean,
      default: false,
    },
    // Track failed attempts to prevent brute-force
    attempts: {
      type: Number,
      default: 0,
      max: [5, "Too many attempts"],
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Auto-delete expired OTPs via MongoDB TTL index
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Compound index: fast lookup by mobile + purpose
otpSchema.index({ mobile: 1, purpose: 1 });

module.exports = mongoose.model("OTP", otpSchema);
