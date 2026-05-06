'use strict';

/**
 * STEP 27 — JWT Token Utility
 */

const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const authConfig = require('../config/auth.config');

function generateUserToken({
  userId,
  customerId,
  walletAddress,
  organizationId,
  roles = [],
  permissions = []
}) {
  if (!userId && !customerId && !walletAddress) {
    throw new Error('Cannot generate user token without userId, customerId, or walletAddress');
  }

  const payload = {
    tokenType: authConfig.tokenTypes.USER,
    userId: userId || null,
    customerId: customerId || null,
    walletAddress: walletAddress || null,
    organizationId: organizationId || null,
    roles,
    permissions,
    jti: uuidv4()
  };

  return jwt.sign(payload, authConfig.jwt.secret, {
    expiresIn: authConfig.jwt.expiresIn,
    issuer: authConfig.jwt.issuer,
    audience: authConfig.jwt.audience
  });
}

function generateSystemToken({
  serviceName,
  serviceId,
  roles = ['SYSTEM'],
  permissions = []
}) {
  if (!serviceName) {
    throw new Error('Cannot generate system token without serviceName');
  }

  const payload = {
    tokenType: authConfig.tokenTypes.SYSTEM,
    serviceName,
    serviceId: serviceId || serviceName,
    roles,
    permissions,
    jti: uuidv4()
  };

  return jwt.sign(payload, authConfig.systemJwt.secret, {
    expiresIn: authConfig.systemJwt.expiresIn,
    issuer: authConfig.systemJwt.issuer,
    audience: authConfig.systemJwt.audience
  });
}

function verifyUserToken(token) {
  return jwt.verify(token, authConfig.jwt.secret, {
    issuer: authConfig.jwt.issuer,
    audience: authConfig.jwt.audience
  });
}

function verifySystemToken(token) {
  return jwt.verify(token, authConfig.systemJwt.secret, {
    issuer: authConfig.systemJwt.issuer,
    audience: authConfig.systemJwt.audience
  });
}

module.exports = {
  generateUserToken,
  generateSystemToken,
  verifyUserToken,
  verifySystemToken
};
