const mongoose = require("mongoose");

const planSchema = new mongoose.Schema(
  {
    planId: {
      type: String,
      required: [true, "Plan ID is required"],
      unique: true,
      trim: true,
      uppercase: true,
    },

    brandName: {
      type: String,
      required: [true, "Brand name is required"],
      trim: true,
      maxlength: [80, "Brand name cannot exceed 80 characters"],
    },

    modelName: {
      type: String,
      required: [true, "Model name is required"],
      trim: true,
      maxlength: [80, "Model name cannot exceed 80 characters"],
    },

    perMonthAmount: {
      type: Number,
      required: [true, "Per month amount is required"],
      min: [0, "Per month amount cannot be negative"],
    },

    deposit: {
      type: Number,
      required: [true, "Deposit is required"],
      min: [0, "Deposit cannot be negative"],
      default: 0,
    },

    installationCharges: {
      type: Number,
      default: 0,
      min: [0, "Installation charges cannot be negative"],
    },

    monthlyLitreLimit: {
      type: Number,
      required: [true, "Monthly litre limit is required"],
      min: [0, "Monthly litre limit cannot be negative"],
    },

    comment: {
      type: String,
      trim: true,
      default: null,
      maxlength: [300, "Comment cannot exceed 300 characters"],
    },

    image: {
      type: String,
      trim: true,
      required: [true, "Image path is required"],
      default: "/plans/default-plan.png",
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    sortOrder: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

module.exports = mongoose.model("Plan", planSchema);