const mongoose = require("mongoose");

const planSchema = new mongoose.Schema(
  {
    name: String,
    code: { type: String, unique: true, uppercase: true, trim: true },
    brandId: { type: mongoose.Schema.Types.ObjectId, ref: "Brand", default: null },
    description: String,
    deviceType: { type: String, default: "RO" },
    price: Number,
    depositAmount: { type: Number, default: 0 },
    billingCycleMonths: { type: Number, default: 1 },
    waterLimitLitres: { type: Number, default: null },
    serviceVisitsIncluded: { type: Number, default: 0 },
    filterReplacementIncluded: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const subscriptionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    deviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Device",
      default: null,
      index: true,
    },
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Plan",
      required: true,
      index: true,
    },
    brandId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Brand",
      default: null,
      index: true,
    },
    technicianId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Technician",
      default: null,
      index: true,
    },
    subscriptionCode: {
      type: String,
      unique: true,
      trim: true,
      uppercase: true,
    },
    status: {
      type: String,
      enum: [
        "initiated",
        "payment_pending",
        "payment_failed",
        "paid_pending_installation",
        "installation_assigned",
        "installed",
        "active",
        "paused",
        "expired",
        "cancelled",
        "refunded",
      ],
      default: "initiated",
      index: true,
    },
    startDate: {
      type: Date,
      default: null,
    },
    endDate: {
      type: Date,
      default: null,
    },
    installedAt: {
      type: Date,
      default: null,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    depositAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    currency: {
      type: String,
      default: "INR",
    },
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      default: null,
    },
    transactionId: {
      type: String,
      default: null,
      trim: true,
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "success", "failed", "refunded", "partially_refunded"],
      default: "pending",
      index: true,
    },
    billingCycleMonths: {
      type: Number,
      default: 1,
    },
    renewalOfSubscriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subscription",
      default: null,
    },
    notes: {
      type: String,
      default: null,
      trim: true,
    },
  },
  { timestamps: true }
);

// Quick lookup: is this user's subscription active right now?
subscriptionSchema.index({ userId: 1, isActive: 1, endDate: 1 });

module.exports = mongoose.model("Subscription", subscriptionSchema);