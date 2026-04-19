const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const errorHandler = require("./middlewares/error.middleware");       // ✅ fixed

const authRoutes         = require("./routes/auth.routes");           // ✅ fixed
const deviceRoutes       = require("./routes/device.routes");
const waterLogRoutes     = require("./routes/waterLog.routes");
const paymentRoutes      = require("./routes/payment.routes");
const subscriptionRoutes = require("./routes/subscription.routes");
const productRoutes      = require("./routes/product.routes");
const referRoutes        = require("./routes/refer.routes");

const app = express();

app.use(helmet());
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

app.use(
  cors({
    origin: [
      process.env.FRONTEND_URL,
      "http://localhost:5173",
      "http://localhost:3000",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  })
);

// Raw body for Zoho Webhook — MUST be before express.json()
app.use("/api/payments/webhook", express.raw({ type: "application/json" }));

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/health", (req, res) => {
  res.json({ status: "ok", env: process.env.NODE_ENV, ts: new Date() });
});

app.use("/api/auth",          authRoutes);
app.use("/api/devices",       deviceRoutes);
app.use("/api/water",         waterLogRoutes);    // ✅ /api/water not /api/wallet
app.use("/api/payments",      paymentRoutes);
app.use("/api/subscriptions", subscriptionRoutes);
app.use("/api/products",      productRoutes);
app.use("/api/refer",         referRoutes);

app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

app.use(errorHandler);

module.exports = app;