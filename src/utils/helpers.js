 
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

// ── JWT ─────────────────────────────────────────────
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
};

const verifyToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};

// ── OTP ─────────────────────────────────────────────
const generateOTP = (length = 6) => {
  return Math.floor(10 ** (length - 1) + Math.random() * 9 * 10 ** (length - 1)).toString();
};

// SMS send via MSG91 (swap with Twilio if needed)
const sendOTPviaSMS = async (mobile, otp) => {
  if (process.env.NODE_ENV === "development") {
    console.log(`📲 OTP for ${mobile}: ${otp}`);
    return true;
  }
  // MSG91 integration
  const url = `https://api.msg91.com/api/v5/otp?template_id=${process.env.MSG91_TEMPLATE_ID}&mobile=91${mobile}&authkey=${process.env.MSG91_AUTH_KEY}&otp=${otp}`;
  const res = await fetch(url);
  return res.ok;
};

// ── Date Helpers ─────────────────────────────────────
const addMinutes = (date, minutes) => new Date(date.getTime() + minutes * 60000);

const addDays = (date, days) => new Date(date.getTime() + days * 24 * 60 * 60 * 1000);

const isExpired = (expiryDate) => new Date() > new Date(expiryDate);

// ── Misc ─────────────────────────────────────────────
const generateOrderId = () => "RRO-" + Date.now() + "-" + crypto.randomBytes(3).toString("hex").toUpperCase();

module.exports = {
  generateToken,
  verifyToken,
  generateOTP,
  sendOTPviaSMS,
  addMinutes,
  addDays,
  isExpired,
  generateOrderId,
};