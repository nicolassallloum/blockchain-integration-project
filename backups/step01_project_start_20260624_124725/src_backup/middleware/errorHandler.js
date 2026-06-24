"use strict";

const config = require("../config");
const logger = require("../utils/logger");

/**
 * Central Error Handler
 * Handles all application errors in one place.
 */
function errorHandler(error, req, res, next) {
  const statusCode = error.statusCode || error.status || 500;

  logger.error("Application error", {
    message: error.message,
    stack: config.app.isProduction ? undefined : error.stack,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
  });

  return res.status(statusCode).json({
    success: false,
    message: config.app.isProduction
      ? "Internal server error"
      : error.message || "Internal server error",
    data: null,
    meta: null,
    timestamp: new Date().toISOString(),
  });
}

module.exports = errorHandler;
