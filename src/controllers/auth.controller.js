 
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess, sendError } = require("../utils/apiResponse");
const { generateOTP, sendOTPviaSMS, generateToken, addMinutes } = require("../utils/helpers");
const User = require("../models/User.model");
const OTP = require("../models/OTP.model");
const Wallet = require("../models/Wallet.model");
const Refer = require("../models/Refer.model");
const { OTP_EXPIRY_MINUTES } = require("../config/constants");

// POST /api/auth/send-otp
exports.sendOTP = asyncHandler(async (req, res) => {
  const { mobile, purpose = "login" } = req.body;
  if (!mobile) return sendError(res, "Mobile number required");

  const otp = generateOTP();
  await OTP.findOneAndDelete({ mobile, purpose });  // Remove old OTP
  await OTP.create({
    mobile,
    otp,
    purpose,
    expiresAt: addMinutes(new Date(), OTP_EXPIRY_MINUTES),
  });

  await sendOTPviaSMS(mobile, otp);
  sendSuccess(res, {}, `OTP sent to ${mobile}`);
});

// POST /api/auth/verify-otp
exports.verifyOTP = asyncHandler(async (req, res) => {
  const { mobile, otp, purpose = "login" } = req.body;
  if (!mobile || !otp) return sendError(res, "Mobile and OTP required");

  const record = await OTP.findOne({ mobile, purpose, verified: false });
  if (!record) return sendError(res, "OTP not found or already used");
  if (new Date() > record.expiresAt) return sendError(res, "OTP expired");
  if (record.otp !== otp) return sendError(res, "Invalid OTP");

  record.verified = true;
  await record.save();

  // Find or create user
  let user = await User.findOne({ mobile });
  const isNewUser = !user;

  if (!user) {
    user = await User.create({ mobile });
    await Wallet.create({ userId: user._id, balance: 0 }); // Init wallet
  }

  const token = generateToken(user._id);
  sendSuccess(res, { token, user, isNewUser }, "OTP verified");
});

// POST /api/auth/firebase-login  (Firebase Auth UID login)
exports.firebaseLogin = asyncHandler(async (req, res) => {
  const { firebaseUid, mobile, name, email } = req.body;
  if (!firebaseUid || !mobile) return sendError(res, "firebaseUid and mobile required");

  let user = await User.findOne({ $or: [{ firebaseUid }, { mobile }] });
  const isNewUser = !user;

  if (!user) {
    user = await User.create({ firebaseUid, mobile, name, email });
    await Wallet.create({ userId: user._id, balance: 0 });
  } else if (!user.firebaseUid) {
    user.firebaseUid = firebaseUid;
    await user.save();
  }

  const token = generateToken(user._id);
  sendSuccess(res, { token, user, isNewUser }, "Login successful");
});

// PUT /api/auth/profile  (complete/update profile)
exports.updateProfile = asyncHandler(async (req, res) => {
  const { name, email, city, address, referralCode } = req.body;
  const user = await User.findById(req.user._id);

  if (name) user.name = name;
  if (email) user.email = email;
  if (city) user.city = city;
  if (address) user.address = address;
  user.isProfileComplete = !!(user.name && user.mobile);

  // Apply referral reward on profile completion
  if (referralCode && !user.referredBy) {
    const referrer = await User.findOne({ referralCode });
    if (referrer && referrer._id.toString() !== user._id.toString()) {
      user.referredBy = referrer._id;
      // Credit referrer wallet
      const referrerWallet = await Wallet.findOne({ userId: referrer._id });
      if (referrerWallet) {
        referrerWallet.balance += 50;
        referrerWallet.transactions.push({
          type: "credit", amount: 50,
          description: `Referral reward for ${user.mobile}`,
          balanceAfter: referrerWallet.balance,
        });
        await referrerWallet.save();
      }
      await Refer.create({
        referrerId: referrer._id,
        referredUserId: user._id,
        referralCode,
        status: "rewarded",
        rewardedAt: new Date(),
      });
    }
  }

  await user.save();
  sendSuccess(res, { user }, "Profile updated");
});

// GET /api/auth/profile
exports.getProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select("-__v");
  sendSuccess(res, { user });
});

// POST /api/auth/logout  (client-side token drop, server-side log)
exports.logout = asyncHandler(async (req, res) => {
  sendSuccess(res, {}, "Logged out successfully");
});