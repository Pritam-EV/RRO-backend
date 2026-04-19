 
const express = require("express");
const router = express.Router();
const auth = require("../controllers/auth.controller");
const { protect } = require("../middlewares/auth.middleware");

router.post("/send-otp", auth.sendOTP);
router.post("/verify-otp", auth.verifyOTP);
router.post("/firebase-login", auth.firebaseLogin);
router.get("/profile", protect, auth.getProfile);
router.put("/profile", protect, auth.updateProfile);
router.post("/logout", protect, auth.logout);

module.exports = router;