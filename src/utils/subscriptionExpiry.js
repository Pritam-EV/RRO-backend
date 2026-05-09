// src/utils/subscriptionExpiry.js
const Subscription = require("../models/Subscription.model");
const Device       = require("../models/Device.model");

/**
 * Finds all active subscriptions whose endDate has passed
 * and marks them as expired. Also sets linked device to inactive.
 * Call this on server boot + every hour via cron.
 */
async function expireSubscriptions() {
  try {
    const now = new Date();

    const expired = await Subscription.find({
      status:  { $in: ["active", "installed"] },
      endDate: { $ne: null, $lt: now },
    });

    if (!expired.length) return;

    for (const sub of expired) {
      sub.status = "expired";
      await sub.save();

      // Mark the linked device inactive
      if (sub.deviceId) {
        await Device.findByIdAndUpdate(sub.deviceId, { status: "inactive" });
      }

      console.log(`[Expiry] Subscription ${sub.subscriptionCode} expired.`);
    }

    console.log(`[Expiry] Processed ${expired.length} expired subscription(s).`);
  } catch (e) {
    console.error("[Expiry] Error:", e.message);
  }
}

module.exports = { expireSubscriptions };