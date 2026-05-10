// src/jobs/expirePayments.js
const Payment = require("../models/Payment.model");

const expireStalePayments = async () => {
  const result = await Payment.updateMany(
    {
      status:    "pending",
      expiresAt: { $lt: new Date() },   // past expiry
    },
    {
      $set: { status: "canceled" },
    }
  );
  if (result.modifiedCount > 0) {
    console.log(`[Cron] Expired ${result.modifiedCount} stale pending payments`);
  }
};

module.exports = expireStalePayments;