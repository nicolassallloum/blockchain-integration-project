'use strict';

/**
 * STEP 27 — Route Security Policy Middleware
 */

const authConfig = require('../config/auth.config');
const { validateUserJwt, validateSystemJwt, validateAnyJwt } = require('./jwt.middleware');
const { validateApiKey } = require('./apiKey.middleware');
const {
  requireRoles,
  requirePermissions,
  requireTokenType
} = require('./authorization.middleware');

const roles = authConfig.roles;
const tokenTypes = authConfig.tokenTypes;

/**
 * Customer/user access.
 */
const userAccess = [
  validateUserJwt,
  requireTokenType(tokenTypes.USER)
];

/**
 * Admin or compliance access.
 */
const adminAccess = [
  validateUserJwt,
  requireRoles([
    roles.SUPER_ADMIN,
    roles.ADMIN,
    roles.COMPLIANCE_OFFICER
  ])
];

/**
 * Internal service access using API key and system JWT.
 */
const serviceAccess = [
  validateApiKey,
  validateSystemJwt,
  requireTokenType(tokenTypes.SYSTEM),
  requireRoles([roles.SYSTEM])
];

/**
 * Either user or internal service token.
 */
const userOrServiceAccess = [
  validateAnyJwt
];

/**
 * Fabric submit/evaluate should usually be service-only.
 */
const fabricServiceAccess = [
  validateApiKey,
  validateSystemJwt,
  requirePermissions([
    'fabric:submit'
  ])
];

module.exports = {
  userAccess,
  adminAccess,
  serviceAccess,
  userOrServiceAccess,
  fabricServiceAccess
};
