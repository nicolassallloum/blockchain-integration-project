'use strict';

/**
 * STEP 27 — Authentication Configuration
 */

require('dotenv').config();

const authConfig = {
  authEnabled: process.env.AUTH_ENABLED !== 'false',

  jwt: {
    secret: process.env.JWT_SECRET || 'dev-user-secret-change-me',
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
    issuer: process.env.JWT_ISSUER || 'blockchain-api',
    audience: process.env.JWT_AUDIENCE || 'blockchain-api-users'
  },

  systemJwt: {
    secret: process.env.SYSTEM_JWT_SECRET || 'dev-system-secret-change-me',
    expiresIn: process.env.SYSTEM_JWT_EXPIRES_IN || '15m',
    issuer: process.env.SYSTEM_JWT_ISSUER || 'blockchain-api',
    audience: process.env.SYSTEM_JWT_AUDIENCE || 'internal-services'
  },

  apiKey: {
    headerName: process.env.API_KEY_HEADER || 'x-api-key',
    internalServiceApiKey: process.env.INTERNAL_SERVICE_API_KEY || 'dev-internal-api-key-change-me'
  },

  roles: {
    SUPER_ADMIN: 'SUPER_ADMIN',
    ADMIN: 'ADMIN',
    COMPLIANCE_OFFICER: 'COMPLIANCE_OFFICER',
    BANK_OPERATOR: 'BANK_OPERATOR',
    CUSTOMER: 'CUSTOMER',
    SYSTEM: 'SYSTEM',
    AUDITOR: 'AUDITOR'
  },

  tokenTypes: {
    USER: 'USER',
    SYSTEM: 'SYSTEM'
  }
};

module.exports = authConfig;
