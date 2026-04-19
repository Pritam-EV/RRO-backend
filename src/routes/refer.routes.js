 
const express = require("express");
const router = express.Router();
const refer = require("../controllers/refer.controller");
const { protect } = require("../middlewares/auth.middleware");

router.get("/", protect, refer.getReferInfo);
router.post("/apply", protect, refer.applyReferralCode);

module.exports = router;