'use strict';

/**
 * STEP 27 — JWT Validation Middleware
 */

const authConfig = require('../config/auth.config');
const {
  verifyUserToken,
  verifySystemToken
} = require('../utils/token.util');
const { AuthError } = require('../utils/authErrors');

function extractBearerToken(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization;

  if (!authHeader) {
    throw new AuthError('Missing Authorization header', 401, 'AUTH_HEADER_MISSING');
  }

  if (!authHeader.startsWith('Bearer ')) {
    throw new AuthError('Invalid Authorization header format. Expected Bearer token.', 401, 'INVALID_AUTH_HEADER');
  }

  return authHeader.substring(7).trim();
}

/**
 * Validate normal user JWT.
 */
function validateUserJwt(req, res, next) {
  try {
    if (!authConfig.authEnabled) {
      return next();
    }

    const token = extractBearerToken(req);
    const decoded = verifyUserToken(token);

    if (decoded.tokenType !== authConfig.tokenTypes.USER) {
      throw new AuthError('Invalid token type. User token required.', 401, 'INVALID_TOKEN_TYPE');
    }

    req.auth = {
      authenticated: true,
      tokenType: decoded.tokenType,
      userId: decoded.userId || null,
      customerId: decoded.customerId || null,
      walletAddress: decoded.walletAddress || null,
      organizationId: decoded.organizationId || null,
      roles: decoded.roles || [],
      permissions: decoded.permissions || [],
      rawTokenPayload: decoded
    };

    return next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return next(new AuthError('JWT token expired', 401, 'TOKEN_EXPIRED'));
    }

    if (error.name === 'JsonWebTokenError') {
      return next(new AuthError('Invalid JWT token', 401, 'INVALID_TOKEN'));
    }

    return next(error);
  }
}

/**
 * Validate internal service/system JWT.
 */
function validateSystemJwt(req, res, next) {
  try {
    if (!authConfig.authEnabled) {
      return next();
    }

    const token = extractBearerToken(req);
    const decoded = verifySystemToken(token);

    if (decoded.tokenType !== authConfig.tokenTypes.SYSTEM) {
      throw new AuthError('Invalid token type. System token required.', 401, 'INVALID_TOKEN_TYPE');
    }

    req.auth = {
      authenticated: true,
      tokenType: decoded.tokenType,
      serviceName: decoded.serviceName,
      serviceId: decoded.serviceId,
      roles: decoded.roles || [],
      permissions: decoded.permissions || [],
      rawTokenPayload: decoded
    };

    return next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return next(new AuthError('System JWT token expired', 401, 'SYSTEM_TOKEN_EXPIRED'));
    }

    if (error.name === 'JsonWebTokenError') {
      return next(new AuthError('Invalid system JWT token', 401, 'INVALID_SYSTEM_TOKEN'));
    }

    return next(error);
  }
}

/**
 * Accept either USER token or SYSTEM token.
 */
function validateAnyJwt(req, res, next) {
  try {
    if (!authConfig.authEnabled) {
      return next();
    }

    const token = extractBearerToken(req);

    try {
      const decodedUser = verifyUserToken(token);

      if (decodedUser.tokenType === authConfig.tokenTypes.USER) {
        req.auth = {
          authenticated: true,
          tokenType: decodedUser.tokenType,
          userId: decodedUser.userId || null,
          customerId: decodedUser.customerId || null,
          walletAddress: decodedUser.walletAddress || null,
          organizationId: decodedUser.organizationId || null,
          roles: decodedUser.roles || [],
          permissions: decodedUser.permissions || [],
          rawTokenPayload: decodedUser
        };

        return next();
      }
    } catch (_) {
      // Continue and try system token.
    }

    const decodedSystem = verifySystemToken(token);

    if (decodedSystem.tokenType !== authConfig.tokenTypes.SYSTEM) {
      throw new AuthError('Invalid token type', 401, 'INVALID_TOKEN_TYPE');
    }

    req.auth = {
      authenticated: true,
      tokenType: decodedSystem.tokenType,
      serviceName: decodedSystem.serviceName,
      serviceId: decodedSystem.serviceId,
      roles: decodedSystem.roles || [],
      permissions: decodedSystem.permissions || [],
      rawTokenPayload: decodedSystem
    };

    return next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return next(new AuthError('JWT token expired', 401, 'TOKEN_EXPIRED'));
    }

    if (error.name === 'JsonWebTokenError') {
      return next(new AuthError('Invalid JWT token', 401, 'INVALID_TOKEN'));
    }

    return next(error);
  }
}

module.exports = {
  validateUserJwt,
  validateSystemJwt,
  validateAnyJwt
};
