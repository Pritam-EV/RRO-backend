const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess, sendError } = require("../utils/apiResponse");
const Plan = require("../models/Plan.model");

// GET /api/plans
exports.getPlans = asyncHandler(async (req, res) => {
  const plans = await Plan.find({ isActive: true }).sort({
    sortOrder: 1,
    perMonthAmount: 1,
    createdAt: -1,
  });

  return sendSuccess(res, { plans }, "Plans fetched successfully");
});

// GET /api/plans/:planId
exports.getPlanByPlanId = asyncHandler(async (req, res) => {
  const plan = await Plan.findOne({
    planId: req.params.planId.toUpperCase(),
    isActive: true,
  });

  if (!plan) {
    return sendError(res, "Plan not found", 404);
  }

  return sendSuccess(res, { plan }, "Plan fetched successfully");
});

// POST /api/plans
exports.createPlan = asyncHandler(async (req, res) => {
  const {
    planId,
    brandName,
    modelName,
    perMonthAmount,
    deposit,
    installationCharges,
    monthlyLitreLimit,
    comment,
    image,
    sortOrder,
  } = req.body;

  const existing = await Plan.findOne({ planId: planId.trim().toUpperCase() });
  if (existing) {
    return sendError(res, "Plan ID already exists", 409);
  }

  const plan = await Plan.create({
    planId: planId.trim().toUpperCase(),
    brandName: brandName.trim(),
    modelName: modelName.trim(),
    perMonthAmount,
    deposit,
    installationCharges: installationCharges ?? 0,
    monthlyLitreLimit,
    comment: comment?.trim() || null,
    image: image?.trim() || "/plans/default-plan.png",
    sortOrder: sortOrder ?? 0,
  });

  return sendSuccess(res, { plan }, "Plan created successfully", 201);
});

// PUT /api/plans/:id
exports.updatePlan = asyncHandler(async (req, res) => {
  const {
    brandName,
    modelName,
    perMonthAmount,
    deposit,
    installationCharges,
    monthlyLitreLimit,
    comment,
    image,
    isActive,
    sortOrder,
  } = req.body;

  const plan = await Plan.findById(req.params.id);
  if (!plan) {
    return sendError(res, "Plan not found", 404);
  }

  if (brandName !== undefined) plan.brandName = brandName.trim();
  if (modelName !== undefined) plan.modelName = modelName.trim();
  if (perMonthAmount !== undefined) plan.perMonthAmount = perMonthAmount;
  if (deposit !== undefined) plan.deposit = deposit;
  if (installationCharges !== undefined) plan.installationCharges = installationCharges;
  if (monthlyLitreLimit !== undefined) plan.monthlyLitreLimit = monthlyLitreLimit;
  if (comment !== undefined) plan.comment = comment?.trim() || null;
  if (image !== undefined) plan.image = image?.trim() || "/plans/default-plan.png";
  if (isActive !== undefined) plan.isActive = Boolean(isActive);
  if (sortOrder !== undefined) plan.sortOrder = sortOrder;

  await plan.save();

  return sendSuccess(res, { plan }, "Plan updated successfully");
});

// DELETE /api/plans/:id
exports.deletePlan = asyncHandler(async (req, res) => {
  const plan = await Plan.findById(req.params.id);
  if (!plan) {
    return sendError(res, "Plan not found", 404);
  }

  await plan.deleteOne();

  return sendSuccess(res, {}, "Plan deleted successfully");
});