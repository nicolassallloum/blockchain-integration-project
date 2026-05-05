'use strict';

/**
 * STEP 27 — Centralized Error Handler
 */

function errorHandler(error, req, res, next) {
  const statusCode = error.statusCode || 500;

  const requestId =
    req.headers['x-request-id'] ||
    req.requestId ||
    null;

  const response = {
    success: false,
    message: error.message || 'Internal server error',
    errorCode: error.errorCode || 'INTERNAL_SERVER_ERROR',
    requestId
  };

  if (process.env.NODE_ENV !== 'production') {
    response.stack = error.stack;
  }

  return res.status(statusCode).json(response);
}

function notFoundHandler(req, res) {
  return res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    errorCode: 'ROUTE_NOT_FOUND',
    requestId: req.headers['x-request-id'] || null
  });
}

module.exports = {
  errorHandler,
  notFoundHandler
};
