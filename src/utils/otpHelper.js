const OTP = require("../models/OTP.model");
const { OTP_LENGTH } = require("../config/constants");

/**
 * Generate a numeric OTP of given length
 */
const generateOtp = (length = OTP_LENGTH) => {
  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length) - 1;
  return String(Math.floor(min + Math.random() * (max - min + 1)));
};

/**
 * Save OTP to DB (invalidates previous OTPs for same mobile+purpose)
 */
const saveOtp = async (mobile, purpose = "login") => {
  // Delete any existing OTPs for this mobile + purpose
  await OTP.deleteMany({ mobile, purpose });

  const otp = generateOtp();
  await OTP.create({ mobile, otp, purpose });

  return otp;
};

/**
 * Verify OTP — returns true/false and deletes on success
 */
const verifyOtp = async (mobile, otp, purpose = "login") => {
  const record = await OTP.findOne({
    mobile,
    otp,
    purpose,
    expiresAt: { $gt: new Date() },
    verified: false,
  });

  if (!record) return false;

  // Mark as verified and delete
  await OTP.deleteOne({ _id: record._id });
  return true;
};

module.exports = { generateOtp, saveOtp, verifyOtp };