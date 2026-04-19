const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Zoho Payments fields
    zohoPaymentId: { type: String },
    zohoSessionId: { type: String },
    referenceNumber: { type: String, required: true, unique: true },

    amount: { type: Number, required: true },
    currency: { type: String, default: "INR" },

    purpose: {
      type: String,
      enum: ["subscription", "product"],        // No topup — no wallet
      required: true,
    },

    // Maps to Zoho's status values
    status: {
      type: String,
      enum: [
        "pending",
        "initiated",
        "succeeded",
        "failed",
        "canceled",
        "incomplete",
        "refunded",
        "partially_refunded",
        "blocked",
        "disputed",
      ],
      default: "pending",
    },

    paymentMethod: { type: String },            // upi / card / net_banking
    amountCaptured: { type: Number },
    amountRefunded: { type: Number, default: 0 },
    feeAmount: { type: Number },
    netAmount: { type: Number },
    description: { type: String },
    receiptEmail: { type: String },
    paidAt: { type: Date },

    // Full Zoho webhook / API response for audit
    rawResponse: { type: mongoose.Schema.Types.Mixed },

    // Metadata sent to Zoho (max 5 key-value pairs)
    metaData: [
      {
        key: { type: String, maxlength: 20 },
        value: { type: String, maxlength: 500 },
      },
    ],

    // Reference to what was paid for
    subscriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subscription",
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
    },
  },
  { timestamps: true }
);

paymentSchema.index({ userId: 1, createdAt: -1 });
paymentSchema.index({ referenceNumber: 1 });
paymentSchema.index({ zohoPaymentId: 1 });

module.exports = mongoose.model("Payment", paymentSchema);