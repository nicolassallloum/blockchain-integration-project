"use strict";

/**
 * 404 Not Found Handler
 * Handles requests to routes that do not exist.
 */
function notFoundHandler(req, res, next) {
  return res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    data: null,
    meta: null,
    timestamp: new Date().toISOString(),
  });
}

module.exports = notFoundHandler;
