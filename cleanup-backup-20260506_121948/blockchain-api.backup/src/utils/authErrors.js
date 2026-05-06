'use strict';

/**
 * STEP 27 — Authentication & Authorization Error Utilities
 */

class AuthError extends Error {
  constructor(message, statusCode = 401, errorCode = 'AUTH_ERROR') {
    super(message);
    this.name = 'AuthError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
  }
}

class ForbiddenError extends Error {
  constructor(message = 'Access denied') {
    super(message);
    this.name = 'ForbiddenError';
    this.statusCode = 403;
    this.errorCode = 'FORBIDDEN';
  }
}

module.exports = {
  AuthError,
  ForbiddenError
};
