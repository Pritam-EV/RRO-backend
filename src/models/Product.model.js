 
const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String },
    price: { type: Number, required: true },
    mrp: { type: Number },
    category: { type: String, default: "general" },
    imageUrl: { type: String },
    stock: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    specs: { type: mongoose.Schema.Types.Mixed },              // Flexible product specs
  },
  { timestamps: true }
);

module.exports = mongoose.model("Product", productSchema);