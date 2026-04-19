const mongoose = require("mongoose");

const planSchema = new mongoose.Schema({
  name: { type: String, required: true },       // Basic / Standard / Premium
  price: { type: Number, required: true },
  durationDays: { type: Number, required: true },
  dailyLimitLitres: { type: Number, required: true }, // Max L/day allowed on this plan
  features: [String],
  isActive: { type: Boolean, default: true },
});

const subscriptionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    plan: { type: planSchema, required: true },
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date, required: true },
    isActive: { type: Boolean, default: true },
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
    },
    autoRenew: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Quick lookup: is this user's subscription active right now?
subscriptionSchema.index({ userId: 1, isActive: 1, endDate: 1 });

module.exports = mongoose.model("Subscription", subscriptionSchema);