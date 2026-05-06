'use strict';

/**
 * STEP 27 — Role-Based Authorization Middleware
 */

const { ForbiddenError, AuthError } = require('../utils/authErrors');

function requireAuth(req, res, next) {
  if (!req.auth || !req.auth.authenticated) {
    return next(new AuthError('Authentication required', 401, 'AUTH_REQUIRED'));
  }

  return next();
}

function requireRoles(allowedRoles = []) {
  return function roleMiddleware(req, res, next) {
    if (!req.auth || !req.auth.authenticated) {
      return next(new AuthError('Authentication required', 401, 'AUTH_REQUIRED'));
    }

    const userRoles = req.auth.roles || [];

    const hasAllowedRole = allowedRoles.some((role) => userRoles.includes(role));

    if (!hasAllowedRole) {
      return next(
        new ForbiddenError(
          `Access denied. Required role: ${allowedRoles.join(' or ')}`
        )
      );
    }

    return next();
  };
}

function requirePermissions(requiredPermissions = []) {
  return function permissionMiddleware(req, res, next) {
    if (!req.auth || !req.auth.authenticated) {
      return next(new AuthError('Authentication required', 401, 'AUTH_REQUIRED'));
    }

    const userPermissions = req.auth.permissions || [];

    const hasAllPermissions = requiredPermissions.every((permission) =>
      userPermissions.includes(permission)
    );

    if (!hasAllPermissions) {
      return next(
        new ForbiddenError(
          `Access denied. Required permissions: ${requiredPermissions.join(', ')}`
        )
      );
    }

    return next();
  };
}

function requireTokenType(requiredTokenType) {
  return function tokenTypeMiddleware(req, res, next) {
    if (!req.auth || !req.auth.authenticated) {
      return next(new AuthError('Authentication required', 401, 'AUTH_REQUIRED'));
    }

    if (req.auth.tokenType !== requiredTokenType) {
      return next(
        new ForbiddenError(
          `Access denied. Required token type: ${requiredTokenType}`
        )
      );
    }

    return next();
  };
}

module.exports = {
  requireAuth,
  requireRoles,
  requirePermissions,
  requireTokenType
};
