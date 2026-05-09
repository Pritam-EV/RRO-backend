const mongoose = require("mongoose");

const deviceSchema = new mongoose.Schema(
  {
userIds: {
  type: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    }
  ],
  default: [],
  index: true,
},
    deviceId: {
      type: String,
      required: [true, "Device ID is required"],
      unique: true,
      trim: true,
      uppercase: true,
    },

    serialNumber: {
      type: String,
      required: [true, "Serial number is required"],
      unique: true,
      trim: true,
    },

    brandName: {
      type: String,
      required: [true, "Brand name is required"],
      trim: true,
      maxlength: [80, "Brand name cannot exceed 80 characters"],
    },

    modelName: {
      type: String,
      trim: true,
      default: null,
      maxlength: [80, "Model name cannot exceed 80 characters"],
    },

    deviceType: {
      type: String,
      trim: true,
      default: "RO",
      enum: ["RO", "Water Purifier", "RO+UV", "RO+UF", "Other"],
    },

    status: {
      type: String,
      enum: ["linked", "active", "inactive", "service_due"],
      default: "linked",
    },

    isOnline: {
      type: Boolean,
      default: false,
    },

    lastSeenAt: {
      type: Date,
      default: null,
    },

    installationDate: {
      type: Date,
      default: Date.now,
    },

    lastServiced: {
      type: Date,
      default: null,
    },

    locationLabel: {
      type: String,
      trim: true,
      default: null,
      maxlength: [120, "Location label cannot exceed 120 characters"],
    },

    notes: {
      type: String,
      trim: true,
      default: null,
      maxlength: [500, "Notes cannot exceed 500 characters"],
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

module.exports = mongoose.model("Device", deviceSchema);
