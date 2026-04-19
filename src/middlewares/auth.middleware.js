 
const jwt = require("jsonwebtoken");
const User = require("../models/User.model");
const { sendError } = require("../utils/apiResponse");

const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return sendError(res, "No token provided", 401);
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id).select("-__v");
    if (!user || !user.isActive) {
      return sendError(res, "User not found or deactivated", 401);
    }

    req.user = user;
    next();
  } catch (err) {
    return sendError(res, "Invalid or expired token", 401);
  }
};

const adminOnly = (req, res, next) => {
  if (req.user?.role !== "admin") {
    return sendError(res, "Admin access only", 403);
  }
  next();
};

module.exports = { protect, adminOnly };