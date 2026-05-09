const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");
const { body, validationResult } = require("express-validator");

const auth = require("../controllers/auth.controller");
const { protect } = require("../middlewares/auth.middleware");

// ── Inline validation middleware ──────────────────────────────────────────
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: errors.array()[0].msg,
      errors: errors.array(),
    });
  }
  next();
};

// ── Validation rule sets ─────────────────────────────────────────────
const mobileRule = body("mobile")
  .trim()
  .notEmpty().withMessage("Mobile number is required")
  .matches(/^[6-9]\d{9}$/).withMessage("Enter a valid 10-digit Indian mobile number");

const passwordRule = body("password")
  .notEmpty().withMessage("Password is required")
  .isLength({ min: 8 }).withMessage("Password must be at least 8 characters")
  .matches(/[A-Z]/).withMessage("Password must contain at least one uppercase letter")
  .matches(/[0-9]/).withMessage("Password must contain at least one number");

const confirmPasswordRule = body("confirmPassword")
  .notEmpty().withMessage("Please confirm your password")
  .custom((value, { req }) => {
    if (value !== req.body.password) throw new Error("Passwords do not match");
    return true;
  });

const idTokenRule = body("idToken")
  .notEmpty().withMessage("Firebase ID token is required");

const registerRules = [
  mobileRule,
  body("name")
    .trim()
    .notEmpty().withMessage("Full name is required")
    .isLength({ min: 2, max: 60 }).withMessage("Name must be 2–60 characters"),
  body("city")
    .trim()
    .notEmpty().withMessage("City is required"),
  passwordRule,
  confirmPasswordRule,
  body("email")
    .optional({ checkFalsy: true })
    .isEmail().withMessage("Enter a valid email address")
    .normalizeEmail(),
];

// ── Rate limiters ────────────────────────────────────────────────

// OTP / Firebase verify: max 5 per IP per 10 min
const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many OTP requests. Please try again in 10 minutes.",
  },
});

// Sign-in: max 10 per IP per 15 min (prevent brute-force)
const signinLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many sign-in attempts. Please try again in 15 minutes.",
  },
});

// ── Routes ──────────────────────────────────────────────────────────────

// — Signup flow —
// Step 1: Frontend sends Firebase idToken after OTP confirmation
router.post(
  "/firebase-verify",
  otpLimiter,
  [idTokenRule],
  validate,
  auth.firebaseVerify
);

// Step 2: Complete registration (name, city, password)
router.post(
  "/register",
  registerRules,
  validate,
  auth.register
);

// — Login flow —
// Option A: mobile + password
router.post(
  "/signin",
  signinLimiter,
  [mobileRule, body("password").notEmpty().withMessage("Password is required")],
  validate,
  auth.signin
);

// Option B: Firebase OTP login (existing users)
router.post(
  "/firebase-login",
  otpLimiter,
  [idTokenRule],
  validate,
  auth.firebaseLogin
);

// — Forgot / reset password flow —
// Step 1: Frontend confirms Firebase OTP → sends idToken
router.post(
  "/forgot-password",
  otpLimiter,
  [idTokenRule],
  validate,
  auth.forgotPasswordVerify
);

// Step 2: Set new password using resetToken
router.post(
  "/reset-password",
  [
    body("resetToken").notEmpty().withMessage("Reset token is required"),
    passwordRule,
    confirmPasswordRule,
  ],
  validate,
  auth.resetPassword
);

// — Authenticated routes —
router.get("/profile", protect, auth.getProfile);
router.put(
  "/profile",
  protect,
  [
    body("name").optional().trim().isLength({ min: 2 }).withMessage("Name too short"),
    body("email").optional({ checkFalsy: true }).isEmail().withMessage("Invalid email").normalizeEmail(),
    body("city").optional().trim().notEmpty().withMessage("City cannot be empty"),
  ],
  validate,
  auth.updateProfile
);
router.post("/logout", protect, auth.logout);

module.exports = router;
