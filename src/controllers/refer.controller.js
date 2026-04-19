 
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess, sendError } = require("../utils/apiResponse");
const Refer = require("../models/Refer.model");
const User = require("../models/User.model");

// GET /api/refer  → Get user's referral code + stats
exports.getReferInfo = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  const referrals = await Refer.find({ referrerId: req.user._id }).populate(
    "referredUserId", "name mobile createdAt"
  );
  const rewardTotal = referrals
    .filter((r) => r.status === "rewarded")
    .reduce((sum, r) => sum + r.rewardAmount, 0);

  sendSuccess(res, {
    referralCode: user.referralCode,
    referralLink: `${process.env.FRONTEND_URL}/?ref=${user.referralCode}`,
    totalReferrals: referrals.length,
    rewardedReferrals: referrals.filter((r) => r.status === "rewarded").length,
    totalRewardEarned: rewardTotal,
    referrals,
  });
});

// POST /api/refer/apply  → Apply referral code (if not applied during profile)
exports.applyReferralCode = asyncHandler(async (req, res) => {
  const { referralCode } = req.body;
  const user = await User.findById(req.user._id);

  if (user.referredBy) return sendError(res, "Referral code already applied");
  if (!referralCode) return sendError(res, "Referral code required");

  const referrer = await User.findOne({ referralCode });
  if (!referrer) return sendError(res, "Invalid referral code");
  if (referrer._id.toString() === user._id.toString()) return sendError(res, "Cannot use your own code");

  user.referredBy = referrer._id;
  await user.save();

  await Refer.create({
    referrerId: referrer._id,
    referredUserId: user._id,
    referralCode,
    status: "completed",
  });

  sendSuccess(res, {}, "Referral code applied");
});