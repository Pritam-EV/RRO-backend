 
const mongoose = require("mongoose");

const referSchema = new mongoose.Schema(
  {
    referrerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    referredUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    referralCode: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "completed", "rewarded"],
      default: "pending",
    },
    rewardAmount: { type: Number, default: 50 },
    rewardedAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Refer", referSchema);