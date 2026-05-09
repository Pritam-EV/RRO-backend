const { validationResult } = require("express-validator");
const { sendError } = require("../utils/apiResponse");

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendError(res, errors.array()[0].msg, 400, errors.array());
  }
  next();
};
module.exports = validate;