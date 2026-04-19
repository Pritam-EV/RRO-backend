 
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess, sendError } = require("../utils/apiResponse");
const Product = require("../models/Product.model");
const Order = require("../models/Order.model");
const Payment = require("../models/Payment.model");
const { generateOrderId } = require("../utils/helpers");

// GET /api/product
exports.getProducts = asyncHandler(async (req, res) => {
  const products = await Product.find({ isActive: true });
  sendSuccess(res, { products });
});

// GET /api/product/:id
exports.getProductById = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product || !product.isActive) return sendError(res, "Product not found", 404);
  sendSuccess(res, { product });
});

// POST /api/product/checkout  → Create order + Cashfree payment
exports.checkout = asyncHandler(async (req, res) => {
  const { items, deliveryAddress } = req.body;
  if (!items || !items.length) return sendError(res, "Cart is empty");

  // Validate products + calculate total
  let totalAmount = 0;
  const orderItems = [];
  for (const item of items) {
    const product = await Product.findById(item.productId);
    if (!product || !product.isActive) return sendError(res, `Product ${item.productId} not found`);
    if (product.stock < (item.qty || 1)) return sendError(res, `${product.name} is out of stock`);
    orderItems.push({ productId: product._id, name: product.name, price: product.price, qty: item.qty || 1 });
    totalAmount += product.price * (item.qty || 1);
  }

  const orderId = generateOrderId();
  const order = await Order.create({
    userId: req.user._id,
    items: orderItems,
    totalAmount,
    deliveryAddress,
    status: "pending",
  });

  const cashfreeEnv = process.env.CASHFREE_ENV || "TEST";
  const baseUrl = cashfreeEnv === "PROD"
    ? "https://api.cashfree.com/pg"
    : "https://sandbox.cashfree.com/pg";

  const body = {
    order_id: orderId,
    order_amount: totalAmount,
    order_currency: "INR",
    customer_details: {
      customer_id: req.user._id.toString(),
      customer_phone: req.user.mobile,
      customer_name: req.user.name || "RRO User",
    },
    order_meta: {
      return_url: `${process.env.FRONTEND_URL}/product/redirect?orderId=${orderId}`,
      notify_url: `${process.env.BACKEND_URL}/api/product/webhook`,
    },
  };

  const response = await fetch(`${baseUrl}/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-version": "2023-08-01",
      "x-client-id": process.env.CASHFREE_APP_ID,
      "x-client-secret": process.env.CASHFREE_SECRET_KEY,
    },
    body: JSON.stringify(body),
  });

  const cfData = await response.json();
  if (!response.ok) return sendError(res, cfData.message || "Payment init failed");

  const payment = await Payment.create({
    userId: req.user._id,
    orderId,
    amount: totalAmount,
    purpose: "product",
    referenceId: order._id.toString(),
    status: "pending",
  });

  order.paymentId = payment._id;
  await order.save();

  sendSuccess(res, { orderId, paymentSessionId: cfData.payment_session_id, order }, "Checkout initiated");
});

// POST /api/product/webhook  → Cashfree webhook for product orders
exports.orderWebhook = asyncHandler(async (req, res) => {
  const { data: eventData, type } = req.body;
  if (type !== "PAYMENT_SUCCESS_WEBHOOK") return res.sendStatus(200);

  const { order: cfOrder } = eventData;
  const payment = await Payment.findOne({ orderId: cfOrder.order_id });
  if (!payment || payment.status === "success") return res.sendStatus(200);

  payment.status = "success";
  payment.paidAt = new Date();
  await payment.save();

  const order = await Order.findOne({ paymentId: payment._id });
  if (order) {
    order.status = "paid";
    order.paymentStatus = "paid";
    await order.save();
    // Reduce stock
    for (const item of order.items) {
      await Product.findByIdAndUpdate(item.productId, { $inc: { stock: -item.qty } });
    }
  }

  res.sendStatus(200);
});

// GET /api/product/orders
exports.getMyOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({ userId: req.user._id }).sort({ createdAt: -1 });
  sendSuccess(res, { orders });
});

// POST /api/product  (Admin — add product)
exports.addProduct = asyncHandler(async (req, res) => {
  const product = await Product.create(req.body);
  sendSuccess(res, { product }, "Product added", 201);
});