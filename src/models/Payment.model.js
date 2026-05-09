const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    subscriptionId: { type: mongoose.Schema.Types.ObjectId, ref: "Subscription", default: null, index: true },
    planId: { type: mongoose.Schema.Types.ObjectId, ref: "Plan", default: null },
    amount: { type: Number, required: true },
    currency: { type: String, default: "INR" },
    provider: { type: String, enum: ["cashfree", "razorpay", "manual"], required: true },
    orderId: { type: String, default: null, index: true },
    transactionId: { type: String, default: null, index: true },
    paymentStatus: {
      type: String,
      enum: ["created", "pending", "success", "failed", "refunded", "partially_refunded"],
      default: "created",
      index: true,
    },
    paymentMethod: { type: String, default: null },
    gatewayResponse: { type: mongoose.Schema.Types.Mixed, default: null },
    paidAt: { type: Date, default: null },
    refundAmount: { type: Number, default: 0 },
    refundReason: { type: String, default: null },
  },
  { timestamps: true }
);
paymentSchema.index({ userId: 1, createdAt: -1 });
paymentSchema.index({ referenceNumber: 1 });
paymentSchema.index({ zohoPaymentId: 1 });

module.exports = mongoose.model("Payment", paymentSchema);