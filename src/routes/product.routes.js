 
const express = require("express");
const router = express.Router();
const product = require("../controllers/product.controller");
const { protect, adminOnly } = require("../middlewares/auth.middleware");

router.get("/", product.getProducts);                              // Public
router.get("/orders", protect, product.getMyOrders);
router.get("/:id", product.getProductById);                        // Public
router.post("/checkout", protect, product.checkout);
router.post("/webhook", product.orderWebhook);                     // Cashfree
router.post("/", protect, adminOnly, product.addProduct);          // Admin only

module.exports = router;