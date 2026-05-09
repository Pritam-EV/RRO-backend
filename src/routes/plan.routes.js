const express = require("express");
const { body, validationResult } = require("express-validator");

const router = express.Router();
const plan = require("../controllers/plan.controller");

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

const createPlanRules = [
  body("planId").trim().notEmpty().withMessage("Plan ID is required"),
  body("brandName").trim().notEmpty().withMessage("Brand name is required").isLength({ max: 80 }).withMessage("Brand name cannot exceed 80 characters"),
  body("modelName").trim().notEmpty().withMessage("Model name is required").isLength({ max: 80 }).withMessage("Model name cannot exceed 80 characters"),
  body("perMonthAmount").notEmpty().withMessage("Per month amount is required").isFloat({ min: 0 }).withMessage("Per month amount must be a valid number"),
  body("deposit").notEmpty().withMessage("Deposit is required").isFloat({ min: 0 }).withMessage("Deposit must be a valid number"),
  body("installationCharges").optional().isFloat({ min: 0 }).withMessage("Installation charges must be a valid number"),
  body("monthlyLitreLimit").notEmpty().withMessage("Monthly litre limit is required").isFloat({ min: 0 }).withMessage("Monthly litre limit must be a valid number"),
  body("comment").optional({ checkFalsy: true }).trim().isLength({ max: 300 }).withMessage("Comment cannot exceed 300 characters"),
  body("image").optional({ checkFalsy: true }).trim(),
  body("sortOrder").optional().isInt({ min: 0 }).withMessage("Sort order must be a valid integer"),
];

const updatePlanRules = [
  body("brandName").optional().trim().isLength({ max: 80 }).withMessage("Brand name cannot exceed 80 characters"),
  body("modelName").optional().trim().isLength({ max: 80 }).withMessage("Model name cannot exceed 80 characters"),
  body("perMonthAmount").optional().isFloat({ min: 0 }).withMessage("Per month amount must be a valid number"),
  body("deposit").optional().isFloat({ min: 0 }).withMessage("Deposit must be a valid number"),
  body("installationCharges").optional().isFloat({ min: 0 }).withMessage("Installation charges must be a valid number"),
  body("monthlyLitreLimit").optional().isFloat({ min: 0 }).withMessage("Monthly litre limit must be a valid number"),
  body("comment").optional({ checkFalsy: true }).trim().isLength({ max: 300 }).withMessage("Comment cannot exceed 300 characters"),
  body("image").optional({ checkFalsy: true }).trim(),
  body("sortOrder").optional().isInt({ min: 0 }).withMessage("Sort order must be a valid integer"),
];

router.get("/", plan.getPlans);
router.get("/:planId", plan.getPlanByPlanId);
router.post("/", createPlanRules, validate, plan.createPlan);
router.put("/:id", updatePlanRules, validate, plan.updatePlan);
router.delete("/:id", plan.deletePlan);

module.exports = router;