const Payment = require("../models/Payment.model");
const Subscription = require("../models/Subscription.model");
const Order = require("../models/Order.model");
const {
  createPaymentSession,
  getPaymentById,
  verifyWebhookSignature,   // ← new
} = require("../utils/zohoPayments");
const { sendSuccess, sendError } = require("../utils/apiResponse");

// ─── Initiate Payment ─────────────────────────────────────────────────────────
/**
 * POST /api/payments/initiate
 * Creates a Zoho payment session for subscription or product purchase.
 * Returns zohoApiKey + zohoSessionId for the frontend Zoho widget.
 *
 * Body: { amount, purpose: "subscription"|"product", subscriptionPlanName?, orderId? }
 */
const initiatePayment = async (req, res) => {
  try {
    const { amount, purpose, subscriptionPlanName, orderId } = req.body;
    const user = req.user;

    if (!amount || amount <= 0) {
      return sendError(res, "Invalid amount", 400);
    }
    if (!["subscription", "product"].includes(purpose)) {
      return sendError(res, "purpose must be subscription or product", 400);
    }

    // Build unique reference
    const referenceNumber = `RRO-${purpose.toUpperCase()}-${Date.now()}-${user._id
      .toString()
      .slice(-5)}`;

    // Build description
    const description =
      purpose === "subscription"
        ? `RRO ${subscriptionPlanName || "Plan"} Subscription`
        : `RRO Product Order`;

    // Create Zoho session
    const zohoResponse = await createPaymentSession({
      amount,
      referenceNumber,
      description,
      name:  user.name  || "Customer",
      email: user.email || "",
      phone: user.mobile || "",
      metaData: [
        { key: "userId", value: user._id.toString() },
        { key: "purpose", value: purpose },
        subscriptionPlanName
          ? { key: "plan", value: subscriptionPlanName }
          : null,
        orderId ? { key: "orderId", value: orderId } : null,
      ].filter(Boolean),
    });

    // Save pending payment record
    const paymentData = {
      userId: user._id,
      referenceNumber,
      zohoSessionId:
        zohoResponse?.payment_session?.payments_session_id || null,
      amount,
      purpose,
      description,
      receiptEmail: user.email,
      status: "pending",
      metaData: [
        { key: "userId", value: user._id.toString() },
        { key: "purpose", value: purpose },
      ],
    };

    if (orderId) paymentData.orderId = orderId;

    const payment = await Payment.create(paymentData);

    return sendSuccess(
      res,
      {
        paymentId: payment._id,
        referenceNumber,
        zohoApiKey: process.env.ZOHO_API_KEY,     // Used by frontend checkout widget
        zohoSessionId: payment.zohoSessionId,
        amount,
        currency: "INR",
      },
      "Payment session created"
    );
  } catch (err) {
    console.error("initiatePayment error:", err.message);
    return sendError(res, err.message || "Payment initiation failed", 500);
  }
};

// ─── Verify Payment ───────────────────────────────────────────────────────────
/**
 * GET /api/payments/verify/:referenceNumber
 * Frontend calls this after Zoho widget completes to confirm status.
 */
const verifyPayment = async (req, res) => {
  try {
    const { referenceNumber } = req.params;

    const payment = await Payment.findOne({
      referenceNumber,
      userId: req.user._id,
    });
    if (!payment) return sendError(res, "Payment not found", 404);

    // Return cached status if already terminal
    if (["succeeded", "failed", "canceled"].includes(payment.status)) {
      return sendSuccess(res, { status: payment.status, payment }, "Payment status");
    }

    // Re-check Zoho if we have their payment ID
    if (payment.zohoPaymentId) {
      const zohoData = await getPaymentById(payment.zohoPaymentId);
      if (zohoData) {
        await _applyZohoData(payment, zohoData);
        await payment.save();

        if (zohoData.status === "succeeded") {
          await _handlePostPayment(payment);
        }
      }
    }

    return sendSuccess(res, { status: payment.status, payment }, "Payment status");
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

// ─── Webhook ──────────────────────────────────────────────────────────────────
/**
 * POST /api/payments/webhook
 * Zoho fires this on every payment event.
 * Header: X-Zoho-Webhook-Token
 */
// ─── Webhook ──────────────────────────────────────────────────────────────────
const handleWebhook = async (req, res) => {
  try {
    // req.body is raw Buffer here (express.raw() set in app.js)
    const rawBody         = req.body;
    const signatureHeader = req.headers["x-zoho-signature"];

    if (!verifyWebhookSignature(rawBody, signatureHeader)) {
      console.warn("⚠️ Webhook: invalid signature — rejected");
      return res.status(401).json({ success: false, message: "Invalid signature" });
    }

    // Parse body after verification
    const event      = JSON.parse(rawBody.toString("utf8"));
    const zohoPayment = event?.payment;

    if (!zohoPayment) return res.status(200).json({ received: true });

    const payment = await Payment.findOne({
      referenceNumber: zohoPayment.reference_number,
    });

    if (!payment) {
      console.warn("⚠️ Webhook: no payment for ref:", zohoPayment.reference_number);
      return res.status(200).json({ received: true });
    }

    // Idempotency — skip if already terminal
    if (["succeeded", "failed", "canceled"].includes(payment.status)) {
      return res.status(200).json({ received: true });
    }

    await _applyZohoData(payment, zohoPayment);
    await payment.save();

    if (zohoPayment.status === "succeeded") {
      await _handlePostPayment(payment);
    }

    console.log(`✅ Webhook processed: ref=${zohoPayment.reference_number} status=${zohoPayment.status}`);
    return res.status(200).json({ received: true });

  } catch (err) {
    console.error("Webhook error:", err.message);
    return res.status(200).json({ received: true }); // Always 200 to Zoho
  }
};

// ─── Payment History ──────────────────────────────────────────────────────────
/**
 * GET /api/payments/history
 */
const getPaymentHistory = async (req, res) => {
  try {
    const payments = await Payment.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .select("-rawResponse -__v");

    return sendSuccess(res, { payments }, "Payment history");
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

// ─── Internal Helpers ─────────────────────────────────────────────────────────

/**
 * Apply Zoho payment data onto a Payment document (does NOT save)
 */
const _applyZohoData = async (payment, zohoData) => {
  payment.zohoPaymentId = zohoData.payment_id || payment.zohoPaymentId;
  payment.zohoSessionId = zohoData.payments_session_id || payment.zohoSessionId;
  payment.status = zohoData.status;
  payment.amountCaptured = parseFloat(zohoData.amount_captured || 0);
  payment.amountRefunded = parseFloat(zohoData.amount_refunded || 0);
  payment.feeAmount = parseFloat(zohoData.fee_amount || 0);
  payment.netAmount = parseFloat(zohoData.net_amount || 0);
  payment.paymentMethod = zohoData.payment_method?.type || null;
  payment.rawResponse = zohoData;
  if (zohoData.status === "succeeded") payment.paidAt = new Date();
};

/**
 * Post-payment business logic after a succeeded payment
 */
const _handlePostPayment = async (payment) => {
  try {
    if (payment.purpose === "subscription") {
      await _activateSubscription(payment);
    } else if (payment.purpose === "product") {
      await _confirmOrder(payment);
    }
  } catch (err) {
    console.error("❌ Post-payment handler error:", err.message);
  }
};

/**
 * Activate subscription on successful payment
 */
const _activateSubscription = async (payment) => {
  // Find the pending subscription linked to this payment
  const subscription = await Subscription.findOne({
    userId: payment.userId,
     paymentStatus: "pending", 
    paymentId: payment._id,
  });

  if (!subscription) {
    console.warn("⚠️ No pending subscription found for payment:", payment._id);
    return;
  }

  const now = new Date();
// Replace the isActive = true + startDate/endDate block with:
subscription.status        = "paid_pending_installation";  // not active yet — device not installed
subscription.paymentStatus = "success";
await subscription.save();

payment.subscriptionId = subscription._id;
await payment.save();

  console.log(`✅ Subscription activated for user ${payment.userId}`);
};

/**
 * Mark order as paid on successful product payment
 */
const _confirmOrder = async (payment) => {
  if (!payment.orderId) return;

  await Order.findByIdAndUpdate(payment.orderId, {
    status: "paid",
    paymentStatus: "paid",
    paymentId: payment._id,
  });

  console.log(`✅ Order ${payment.orderId} marked paid`);
};

module.exports = {
  initiatePayment,
  verifyPayment,
  handleWebhook,
  getPaymentHistory,
};