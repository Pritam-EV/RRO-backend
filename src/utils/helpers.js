const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");

// ── JWT ─────────────────────────────────────────────────
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
};

const verifyToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};

// ── Password ───────────────────────────────────────────
const SALT_ROUNDS = 12;

/**
 * Hash a plaintext password.
 * Always await this — bcrypt is async.
 */
const hashPassword = async (plainPassword) => {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
};

/**
 * Compare plaintext password against stored hash.
 * Returns boolean.
 */
const comparePassword = async (plainPassword, hashedPassword) => {
  return bcrypt.compare(plainPassword, hashedPassword);
};

// ── OTP ────────────────────────────────────────────────
/**
 * Generate a numeric OTP of given length.
 * Uses crypto for better randomness.
 */
const generateOTP = (length = 6) => {
  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length) - 1;
  const range = max - min;
  const rand = crypto.randomInt(0, range + 1);
  return String(min + rand);
};

// SMS send via MSG91
const sendOTPviaSMS = async (mobile, otp) => {
  if (process.env.NODE_ENV === "development") {
    console.log(`📲 [DEV] OTP for ${mobile}: ${otp}`);
    return true;
  }
  const url = `https://api.msg91.com/api/v5/otp?template_id=${process.env.MSG91_TEMPLATE_ID}&mobile=91${mobile}&authkey=${process.env.MSG91_AUTH_KEY}&otp=${otp}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`MSG91 error: ${res.status} ${res.statusText}`);
  }
  return true;
};

// ── Date Helpers ─────────────────────────────────────────
const addMinutes = (date, minutes) => new Date(date.getTime() + minutes * 60_000);

const addDays = (date, days) => new Date(date.getTime() + days * 86_400_000);

const isExpired = (expiryDate) => new Date() > new Date(expiryDate);

// ── Order ID ────────────────────────────────────────────
const generateOrderId = () =>
  "RRO-" + Date.now() + "-" + crypto.randomBytes(3).toString("hex").toUpperCase();

module.exports = {
  generateToken,
  verifyToken,
  hashPassword,
  comparePassword,
  generateOTP,
  sendOTPviaSMS,
  addMinutes,
  addDays,
  isExpired,
  generateOrderId,
};
