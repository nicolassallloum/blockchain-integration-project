const logger = require("../config/logger.config");
const { errorResponse } = require("../utils/apiResponse");

const errorHandlerMiddleware = (err, req, res, next) => {
  const statusCode = err.statusCode || err.status || 500;

  logger.error({
    message: err.message,
    stack: err.stack,
    method: req.method,
    url: req.originalUrl
  });

  return errorResponse({
    res,
    statusCode,
    message: statusCode === 500 ? "Internal Server Error" : err.message,
    errors: process.env.NODE_ENV === "development" ? err.stack : null
  });
};

module.exports = errorHandlerMiddleware;
