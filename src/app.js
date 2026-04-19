 
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const errorHandler = require("./middlewares/error.middleware");

const app = express();

// ── Security & Parsing ───────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || "*",
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Logging ──────────────────────────────────────────
if (process.env.NODE_ENV !== "test") {
  app.use(morgan("dev"));
}

// ── Rate Limiting (OTP abuse protection) ─────────────
const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,   // 10 minutes
  max: 5,
  message: { success: false, message: "Too many OTP requests, try again in 10 minutes" },
});

// ── Routes ───────────────────────────────────────────
app.use("/api/auth", otpLimiter, require("./routes/auth.routes"));
app.use("/api/device", require("./routes/device.routes"));
app.use("/api/wallet", require("./routes/wallet.routes"));
app.use("/api/product", require("./routes/product.routes"));
app.use("/api/subscription", require("./routes/subscription.routes"));
app.use("/api/refer", require("./routes/refer.routes"));

// ── Health Check ─────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({ success: true, message: "RRO Backend is running 🚀", env: process.env.NODE_ENV });
});

// ── 404 Handler ──────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// ── Global Error Handler ─────────────────────────────
app.use(errorHandler);

module.exports = app;