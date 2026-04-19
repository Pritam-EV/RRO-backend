const sendSuccess = (res, data = {}, message = "Success", statusCode = 200) => {
  return res.status(statusCode).json({ success: true, message, data });
};

const sendError = (res, message = "Something went wrong", statusCode = 400, errors = null) => {
  const payload = { success: false, message };
  if (errors) payload.errors = errors;
  return res.status(statusCode).json(payload);
};

const sendCreated = (res, data = {}, message = "Created successfully") => {
  return sendSuccess(res, data, message, 201);
};

module.exports = { sendSuccess, sendError, sendCreated };