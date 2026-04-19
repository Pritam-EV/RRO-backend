const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Zoho Payments fields
    zohoPaymentId: { type: String },                   // payment_id from Zoho
    zohoSessionId: { type: String },                   // payments_session_id from Zoho
    referenceNumber: { type: String, required: true, unique: true }, // our internal ref

    amount: { type: Number, required: true },
    currency: { type: String, default: "INR" },

    purpose: {
      type: String,
      enum: ["topup", "product", "subscription"],
      required: true,
    },

    // Zoho status values
    status: {
      type: String,
      enum: [
        "initiated",
        "succeeded",
        "failed",
        "canceled",
        "incomplete",
        "refunded",
        "partially_refunded",
        "blocked",
        "disputed",
        "pending",                                     // our internal pre-initiation state
      ],
      default: "pending",
    },

    paymentMethod: { type: String },                   // upi / card / net_banking / bank_transfer
    amountCaptured: { type: Number },
    amountRefunded: { type: Number, default: 0 },
    feeAmount: { type: Number },
    netAmount: { type: Number },
    description: { type: String },
    receiptEmail: { type: String },
    paidAt: { type: Date },

    // Store full Zoho webhook / API response for audit
    rawResponse: { type: mongoose.Schema.Types.Mixed },

    // metadata we send to Zoho (key-value, max 5)
    metaData: [
      {
        key: { type: String, maxlength: 20 },
        value: { type: String, maxlength: 500 },
      },
    ],
  },
  { timestamps: true }
);

paymentSchema.index({ userId: 1, createdAt: -1 });
paymentSchema.index({ referenceNumber: 1 });
paymentSchema.index({ zohoPaymentId: 1 });

module.exports = mongoose.model("Payment", paymentSchema);