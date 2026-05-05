'use strict';

/**
 * STEP 28 — Input Validation Middleware Helper
 */

const { validationResult } = require('express-validator');

function validateRequest(req, res, next) {
  const errors = validationResult(req);

  if (errors.isEmpty()) {
    return next();
  }

  return res.status(400).json({
    success: false,
    message: 'Request validation failed',
    errorCode: 'VALIDATION_ERROR',
    errors: errors.array().map((error) => ({
      field: error.path,
      message: error.msg,
      value: error.value
    })),
    requestId: req.headers['x-request-id'] || null
  });
}

module.exports = {
  validateRequest
};