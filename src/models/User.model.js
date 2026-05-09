const mongoose = require("mongoose");
const crypto = require("crypto");

const userSchema = new mongoose.Schema(
  {
    // ── Identity ──────────────────────────────────────────
    name: { type: String, trim: true },
    mobile: {
      type: String,
      required: [true, "Mobile number is required"],
      unique: true,
      trim: true,
      match: [/^[6-9]\d{9}$/, "Invalid Indian mobile number"],
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: null,
      match: [/^\S+@\S+\.\S+$/, "Invalid email address"],
    },
    city: { type: String, trim: true },
    address: { type: String, trim: true },

    // ── Auth ─────────────────────────────────────────────
    // Set after /register. Null for OTP-only users until they set a password.
    password: {
      type: String,
      default: null,
      select: false,          // never returned in queries by default
    },
    firebaseUid: {
      type: String,
      unique: true,
      sparse: true,           // allows multiple null values
    },
    isVerifiedMobile: {
      type: Boolean,
      default: false,         // true after first successful OTP verify
    },

    // ── Profile ───────────────────────────────────────────
    isProfileComplete: {
      type: Boolean,
      default: false,         // true after /register completes
    },
    isActive: { type: Boolean, default: true },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },

    // ── Referral ─────────────────────────────────────────
    referralCode: {
      type: String,
      unique: true,
    },
    referredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// ── Pre-save: generate referral code ─────────────────────
userSchema.pre("save", function () {
  if (!this.referralCode) {
    this.referralCode = "RRO" + crypto.randomBytes(3).toString("hex").toUpperCase();
  }
});

// ── Instance method: check if profile is complete ────────
userSchema.methods.checkProfileComplete = function () {
  this.isProfileComplete = !!(this.name && this.mobile && this.password);
  return this.isProfileComplete;
};

module.exports = mongoose.model("User", userSchema);
