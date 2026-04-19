 
const mongoose = require("mongoose");

const planSchema = new mongoose.Schema({
  name: { type: String, required: true },         // Basic, Standard, Premium
  price: { type: Number, required: true },
  durationDays: { type: Number, required: true },
  features: [String],
  isActive: { type: Boolean, default: true },
});

const subscriptionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    plan: { type: planSchema, required: true },
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date, required: true },
    isActive: { type: Boolean, default: true },
    paymentId: { type: mongoose.Schema.Types.ObjectId, ref: "Payment" },
    autoRenew: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Subscription", subscriptionSchema);