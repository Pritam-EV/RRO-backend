const Payment = require("../models/Payment.model");
const Wallet = require("../models/Wallet.model");
const { createPaymentSession, getPaymentById, verifyWebhookToken } = require("../utils/zohoPayments");
const { creditWallet } = require("../utils/walletHelper");
const { sendSuccess, sendError } = require("../utils/apiResponse");

/**
 * POST /api/payments/initiate
 * Creates a Zoho payment session and returns session data + API key
 * Frontend uses ZOHO_API_KEY + session token to launch checkout widget
 */
const initiatePayment = async (req, res) => {
  try {
    const { amount, purpose = "topup" } = req.body;
    const user = req.user;

    if (!amount || amount < 10) {
      return sendError(res, "Minimum amount is ₹10", 400);
    }

    // Unique reference for this payment
    const referenceNumber = `RRO-${purpose.toUpperCase()}-${Date.now()}-${user._id.toString().slice(-5)}`;

    // Create session on Zoho
    const zohoResponse = await createPaymentSession({
      amount,
      referenceNumber,
      description: `RRO ${purpose} payment`,
      email: user.email || "",
      phone: user.mobile || "",
      metaData: [
        { key: "userId", value: user._id.toString() },
        { key: "purpose", value: purpose },
      ],
    });

    // Save pending payment record in DB
    const payment = await Payment.create({
      userId: user._id,
      referenceNumber,
      zohoSessionId: zohoResponse?.payment_session?.payments_session_id || null,
      amount,
      purpose,
      status: "pending",
      description: `RRO ${purpose}`,
      receiptEmail: user.email,
      metaData: [
        { key: "userId", value: user._id.toString() },
        { key: "purpose", value: purpose },
      ],
    });

    return sendSuccess(res, {
      paymentId: payment._id,
      referenceNumber,
      zohoApiKey: process.env.ZOHO_API_KEY,          // Used by frontend widget
      zohoSessionId: payment.zohoSessionId,
      amount,
      currency: "INR",
    }, "Payment session created");
  } catch (err) {
    console.error("initiatePayment error:", err.message);
    return sendError(res, err.message || "Payment initiation failed", 500);
  }
};

/**
 * GET /api/payments/verify/:referenceNumber
 * Frontend calls this after payment to confirm status
 */
const verifyPayment = async (req, res) => {
  try {
    const { referenceNumber } = req.params;
    const payment = await Payment.findOne({ referenceNumber, userId: req.user._id });

    if (!payment) return sendError(res, "Payment not found", 404);

    // If already marked succeeded/failed, return cached status
    if (["succeeded", "failed", "canceled"].includes(payment.status)) {
      return sendSuccess(res, { status: payment.status, payment }, "Payment status");
    }

    // Re-check with Zoho if zohoPaymentId is available
    if (payment.zohoPaymentId) {
      const zohoData = await getPaymentById(payment.zohoPaymentId);
      if (zohoData) {
        payment.status = zohoData.status;
        payment.amountCaptured = parseFloat(zohoData.amount_captured || 0);
        payment.amountRefunded = parseFloat(zohoData.amount_refunded || 0);
        payment.feeAmount = parseFloat(zohoData.fee_amount || 0);
        payment.netAmount = parseFloat(zohoData.net_amount || 0);
        payment.paymentMethod = zohoData.payment_method?.type || null;
        payment.rawResponse = zohoData;
        if (zohoData.status === "succeeded") payment.paidAt = new Date();
        await payment.save();

        // Auto-credit wallet for topup
        if (zohoData.status === "succeeded" && payment.purpose === "topup") {
          await _handleTopupCredit(payment);
        }
      }
    }

    return sendSuccess(res, { status: payment.status, payment }, "Payment status");
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

/**
 * POST /api/payments/webhook
 * Zoho sends payment event notifications here
 * Zoho Header: X-Zoho-Webhook-Token
 */
const handleWebhook = async (req, res) => {
  try {
    const webhookToken = req.headers["x-zoho-webhook-token"];
    if (!verifyWebhookToken(webhookToken)) {
      return res.status(401).json({ success: false, message: "Invalid webhook token" });
    }

    const event = req.body;
    const zohoPayment = event?.payment;

    if (!zohoPayment) {
      return res.status(200).json({ received: true });
    }

    const payment = await Payment.findOne({
      referenceNumber: zohoPayment.reference_number,
    });

    if (!payment) {
      console.warn("⚠️ Webhook: Payment not found for ref:", zohoPayment.reference_number);
      return res.status(200).json({ received: true });
    }

    // Update payment record from Zoho data
    payment.zohoPaymentId = zohoPayment.payment_id;
    payment.zohoSessionId = zohoPayment.payments_session_id;
    payment.status = zohoPayment.status;
    payment.amountCaptured = parseFloat(zohoPayment.amount_captured || 0);
    payment.amountRefunded = parseFloat(zohoPayment.amount_refunded || 0);
    payment.feeAmount = parseFloat(zohoPayment.fee_amount || 0);
    payment.netAmount = parseFloat(zohoPayment.net_amount || 0);
    payment.paymentMethod = zohoPayment.payment_method?.type || null;
    payment.rawResponse = zohoPayment;
    if (zohoPayment.status === "succeeded") payment.paidAt = new Date();
    await payment.save();

    // Handle business logic on success
    if (zohoPayment.status === "succeeded") {
      await _handleTopupCredit(payment);
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error("Webhook error:", err.message);
    return res.status(200).json({ received: true });  // Always 200 to Zoho
  }
};

/**
 * GET /api/payments/history
 * User's payment history
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

// ─── Internal helper ──────────────────────────────────────────────────────────

const _handleTopupCredit = async (payment) => {
  try {
    // Avoid double credit
    const alreadyCredited = await Wallet.findOne({
      userId: payment.userId,
      "transactions.referenceId": payment.referenceNumber,
    });
    if (alreadyCredited) return;

    await creditWallet(
      payment.userId,
      payment.amount,
      `Wallet topup via Zoho Payments`,
      payment.referenceNumber
    );
    console.log(`✅ Wallet credited ₹${payment.amount} for user ${payment.userId}`);
  } catch (err) {
    console.error("❌ Wallet credit error:", err.message);
  }
};

module.exports = { initiatePayment, verifyPayment, handleWebhook, getPaymentHistory };