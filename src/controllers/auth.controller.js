const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess, sendError } = require("../utils/apiResponse");
const {
  generateToken,
  hashPassword,
  comparePassword,
  addMinutes,
} = require("../utils/helpers");
const User = require("../models/User.model");
const OTP = require("../models/OTP.model");
const Refer = require("../models/Refer.model");
const admin = require("../config/firebase");
const { OTP_EXPIRY_MINUTES } = require("../config/constants");

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Normalise a Firebase phone number like "+919876543210" → "9876543210"
 */
const normaliseMobile = (phoneNumber = "") =>
  phoneNumber.replace(/^\+91/, "").trim();

/**
 * Verify a Firebase ID token and extract { firebaseUid, mobile }.
 * Throws if the token is invalid.
 */
const verifyFirebaseToken = async (idToken) => {
  try {
    console.log("✅ verifyFirebaseToken called");
    console.log("✅ idToken received:", !!idToken);

    const decoded = await admin.auth().verifyIdToken(idToken);

    console.log("✅ Token decoded successfully");
    console.log("decoded.uid:", decoded.uid);
    console.log("decoded.phone_number:", decoded.phone_number);

    const firebaseUid = decoded.uid;
    const mobile = normaliseMobile(decoded.phone_number || "");

    if (!firebaseUid || !mobile) {
      const err = new Error("Firebase token missing uid or phone_number");
      err.statusCode = 400;
      throw err;
    }

    return { firebaseUid, mobile };
  } catch (error) {
    console.error("❌ verifyFirebaseToken failed:", error);
    throw error;
  }
};

// ─── SIGNUP FLOW ──────────────────────────────────────────────────────────────

/**
 * POST /api/auth/firebase-verify
 * Called after Firebase Phone OTP is confirmed on the frontend (signup flow).
 * Verifies the Firebase ID token.
 *   - If mobile already exists and profile is complete → error (tell user to sign in)
 *   - If mobile already exists but profile incomplete → allow re-register
 *   - If new mobile → proceed to /register
 * Returns { isNewUser, mobile } — NO JWT yet (account not created).
 */
exports.firebaseVerify = asyncHandler(async (req, res) => {
  console.log("✅ /api/auth/firebase-verify hit");
  console.log("req.body:", req.body);

  const { idToken } = req.body;
  if (!idToken) return sendError(res, "Firebase ID token required", 400);

  const { firebaseUid, mobile } = await verifyFirebaseToken(idToken);

  console.log("✅ Firebase verified user:", { firebaseUid, mobile });

  const existingUser = await User.findOne({ mobile });

  if (existingUser && existingUser.isProfileComplete) {
    return sendError(
      res,
      "This mobile number is already registered. Please sign in.",
      409
    );
  }

  let user = existingUser;

  if (!user) {
    console.log("✅ Creating stub user");
    user = await User.create({
      mobile,
      firebaseUid,
      isVerifiedMobile: true,
    });
  } else {
    console.log("✅ Updating existing stub user");
    if (!user.firebaseUid) user.firebaseUid = firebaseUid;
    user.isVerifiedMobile = true;
    await user.save();
  }

  return sendSuccess(
    res,
    { isNewUser: !existingUser, mobile },
    "Mobile verified. Proceed to complete registration."
  );
});

/**
 * POST /api/auth/register
 * Final signup step. Creates/completes the user account.
 * Requires mobile to have been Firebase-verified first (isVerifiedMobile: true).
 *
 * Body: { mobile, name, city, password, confirmPassword, email?, referralCode? }
 */
exports.register = asyncHandler(async (req, res) => {
  const { mobile, name, city, password, email, referralCode } = req.body;

  // Find the stub user created during firebaseVerify
  const user = await User.findOne({ mobile, isVerifiedMobile: true });
  if (!user) {
    return sendError(
      res,
      "Mobile not verified. Please complete OTP verification first.",
      403
    );
  }

  // Apply profile fields
  user.name = name.trim();
  user.city = city.trim();
  user.password = await hashPassword(password);
  if (email) user.email = email.toLowerCase().trim();

  // Handle referral (only on first registration)
  if (referralCode && !user.referredBy) {
    const referrer = await User.findOne({ referralCode: referralCode.toUpperCase() });
    if (referrer && referrer._id.toString() !== user._id.toString()) {
      user.referredBy = referrer._id;
      await Refer.create({
        referrerId: referrer._id,
        referredUserId: user._id,
        referralCode: referralCode.toUpperCase(),
        status: "rewarded",
        rewardedAt: new Date(),
      });
    }
  }

  user.isProfileComplete = true;
  await user.save();

  const token = generateToken(user._id);

  // Strip password from response
  const userObj = user.toObject();
  delete userObj.password;

  return sendSuccess(
    res,
    { token, user: userObj },
    "Registration successful. Welcome to RRO!",
    201
  );
});

// ─── SIGNIN FLOW ──────────────────────────────────────────────────────────────

/**
 * POST /api/auth/signin
 * Standard sign-in with mobile + password.
 */
exports.signin = asyncHandler(async (req, res) => {
  const { mobile, password } = req.body;

  // Explicitly select password (field has select:false)
  const user = await User.findOne({ mobile }).select("+password");

  if (!user || !user.isProfileComplete) {
    return sendError(res, "No account found. Please sign up first.", 404);
  }
  if (!user.isActive) {
    return sendError(res, "Your account has been deactivated.", 403);
  }
  if (!user.password) {
    return sendError(
      res,
      "This account uses OTP login. Please use \"Login with OTP\".",
      400
    );
  }

  const isMatch = await comparePassword(password, user.password);
  if (!isMatch) {
    return sendError(res, "Incorrect password.", 401);
  }

  const token = generateToken(user._id);

  const userObj = user.toObject();
  delete userObj.password;

  return sendSuccess(res, { token, user: userObj }, "Sign in successful.");
});

/**
 * POST /api/auth/firebase-login
 * OTP-based login for existing users (Login with OTP option).
 * Firebase OTP is confirmed on frontend → idToken sent here.
 */
exports.firebaseLogin = asyncHandler(async (req, res) => {
  const { idToken } = req.body;
  if (!idToken) return sendError(res, "Firebase ID token required", 400);

  const { firebaseUid, mobile } = await verifyFirebaseToken(idToken);

  let user = await User.findOne({ $or: [{ mobile }, { firebaseUid }] });

  if (!user) {
    return sendError(
      res,
      "No account found for this number. Please sign up first.",
      404
    );
  }
  if (!user.isActive) {
    return sendError(res, "Your account has been deactivated.", 403);
  }

  // Sync firebaseUid if missing
  if (!user.firebaseUid) {
    user.firebaseUid = firebaseUid;
    await user.save();
  }

  const token = generateToken(user._id);

  const userObj = user.toObject();
  delete userObj.password;

  return sendSuccess(res, { token, user: userObj }, "Login successful.");
});

// ─── FORGOT / RESET PASSWORD FLOW ────────────────────────────────────────────

/**
 * POST /api/auth/forgot-password
 * Step 1: verify Firebase OTP on frontend, send idToken here.
 * Returns a short-lived resetToken if OTP is valid.
 */
exports.forgotPasswordVerify = asyncHandler(async (req, res) => {
  const { idToken } = req.body;
  if (!idToken) return sendError(res, "Firebase ID token required", 400);

  const { mobile } = await verifyFirebaseToken(idToken);

  const user = await User.findOne({ mobile });
  if (!user || !user.isProfileComplete) {
    return sendError(res, "No account found for this number.", 404);
  }

  // Issue a short-lived reset token (15 min)
  const resetToken = require("jsonwebtoken").sign(
    { id: user._id, purpose: "reset_password" },
    process.env.JWT_SECRET,
    { expiresIn: "15m" }
  );

  return sendSuccess(
    res,
    { resetToken },
    "OTP verified. Use resetToken to set new password."
  );
});

/**
 * POST /api/auth/reset-password
 * Step 2: set a new password using the resetToken.
 * Body: { resetToken, password, confirmPassword }
 */
exports.resetPassword = asyncHandler(async (req, res) => {
  const { resetToken, password } = req.body;

  let decoded;
  try {
    decoded = require("jsonwebtoken").verify(resetToken, process.env.JWT_SECRET);
  } catch {
    return sendError(res, "Reset token is invalid or expired.", 401);
  }

  if (decoded.purpose !== "reset_password") {
    return sendError(res, "Invalid token purpose.", 401);
  }

  const user = await User.findById(decoded.id);
  if (!user) return sendError(res, "User not found.", 404);

  user.password = await hashPassword(password);
  await user.save();

  return sendSuccess(res, {}, "Password reset successful. Please sign in.");
});

// ─── PROFILE ──────────────────────────────────────────────────────────────────

/**
 * GET /api/auth/profile
 */
exports.getProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  return sendSuccess(res, { user });
});

/**
 * PUT /api/auth/profile
 * Update name, email, city, address.
 */
exports.updateProfile = asyncHandler(async (req, res) => {
  const { name, email, city, address } = req.body;
  const user = await User.findById(req.user._id);

  if (name) user.name = name.trim();
  if (email) user.email = email.toLowerCase().trim();
  if (city) user.city = city.trim();
  if (address) user.address = address.trim();

  user.checkProfileComplete();
  await user.save();

  return sendSuccess(res, { user }, "Profile updated.");
});

/**
 * POST /api/auth/logout
 * Stateless JWT — just acknowledge. Frontend drops the token.
 */
exports.logout = asyncHandler(async (req, res) => {
  return sendSuccess(res, {}, "Logged out successfully.");
});
