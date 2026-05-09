const { body } = require("express-validator");

exports.sendOTPRules = [
  body("mobile")
    .notEmpty().withMessage("Mobile is required")
    .matches(/^[6-9]\d{9}$/).withMessage("Invalid Indian mobile number"),
];

exports.verifyOTPRules = [
  body("mobile").notEmpty().withMessage("Mobile required"),
  body("otp").isLength({ min: 6, max: 6 }).withMessage("OTP must be 6 digits"),
];