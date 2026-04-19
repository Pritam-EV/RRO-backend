const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    mobile: { type: String, required: true, unique: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    city: { type: String, trim: true },
    address: { type: String, trim: true },
    firebaseUid: { type: String, unique: true, sparse: true },
    isProfileComplete: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    referralCode: { type: String, unique: true },
    referredBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    role: { type: String, enum: ["user", "admin"], default: "user" },
  },
  { timestamps: true }
);

userSchema.pre("save", function (next) {
  if (!this.referralCode) {
    this.referralCode =
      "RRO" + Math.random().toString(36).substr(2, 6).toUpperCase();
  }
  next();
});

module.exports = mongoose.model("User", userSchema);