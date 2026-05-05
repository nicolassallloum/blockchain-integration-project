🔹 STEP 27 — Authentication & Authorization Layer
Goal
Build a production-ready security layer for the Blockchain API Middleware with:


JWT validation middleware


API key validation middleware


Role-based authorization


Service-to-service authentication


User token vs system token separation


Protected routes


Centralized error handling


Security best practices


Full Node.js code



1. Install Required Packages
From your API project:
cd /home/nix/u01/blockchain-integration/blockchain-apinpm install jsonwebtoken bcryptjs uuid

2. Update .env
Add these values:
# ==================================================# STEP 27 - AUTHENTICATION & AUTHORIZATION# ==================================================JWT_SECRET=CHANGE_THIS_TO_A_LONG_RANDOM_SECRET_VALUEJWT_EXPIRES_IN=1hSYSTEM_JWT_SECRET=CHANGE_THIS_TO_A_LONG_RANDOM_SYSTEM_SECRET_VALUESYSTEM_JWT_EXPIRES_IN=15mAPI_KEY_HEADER=x-api-keyINTERNAL_SERVICE_API_KEY=CHANGE_THIS_TO_INTERNAL_SERVICE_API_KEYAUTH_ENABLED=true
Generate strong values:
openssl rand -hex 48openssl rand -hex 48openssl rand -hex 32
Use the generated values for:
JWT_SECRET=SYSTEM_JWT_SECRET=INTERNAL_SERVICE_API_KEY=

3. Create Security Folder Structure
mkdir -p src/middlewaremkdir -p src/utilsmkdir -p src/config

4. Create src/utils/authErrors.js
nano src/utils/authErrors.js
Paste:
'use strict';/** * STEP 27 — Authentication & Authorization Error Utilities */class AuthError extends Error {  constructor(message, statusCode = 401, errorCode = 'AUTH_ERROR') {    super(message);    this.name = 'AuthError';    this.statusCode = statusCode;    this.errorCode = errorCode;  }}class ForbiddenError extends Error {  constructor(message = 'Access denied') {    super(message);    this.name = 'ForbiddenError';    this.statusCode = 403;    this.errorCode = 'FORBIDDEN';  }}module.exports = {  AuthError,  ForbiddenError};

5. Create src/config/auth.config.js
nano src/config/auth.config.js
Paste:
'use strict';/** * STEP 27 — Authentication Configuration */require('dotenv').config();const authConfig = {  authEnabled: process.env.AUTH_ENABLED !== 'false',  jwt: {    secret: process.env.JWT_SECRET || 'dev-user-secret-change-me',    expiresIn: process.env.JWT_EXPIRES_IN || '1h',    issuer: process.env.JWT_ISSUER || 'blockchain-api',    audience: process.env.JWT_AUDIENCE || 'blockchain-api-users'  },  systemJwt: {    secret: process.env.SYSTEM_JWT_SECRET || 'dev-system-secret-change-me',    expiresIn: process.env.SYSTEM_JWT_EXPIRES_IN || '15m',    issuer: process.env.SYSTEM_JWT_ISSUER || 'blockchain-api',    audience: process.env.SYSTEM_JWT_AUDIENCE || 'internal-services'  },  apiKey: {    headerName: process.env.API_KEY_HEADER || 'x-api-key',    internalServiceApiKey: process.env.INTERNAL_SERVICE_API_KEY || 'dev-internal-api-key-change-me'  },  roles: {    SUPER_ADMIN: 'SUPER_ADMIN',    ADMIN: 'ADMIN',    COMPLIANCE_OFFICER: 'COMPLIANCE_OFFICER',    BANK_OPERATOR: 'BANK_OPERATOR',    CUSTOMER: 'CUSTOMER',    SYSTEM: 'SYSTEM',    AUDITOR: 'AUDITOR'  },  tokenTypes: {    USER: 'USER',    SYSTEM: 'SYSTEM'  }};module.exports = authConfig;

6. Create src/utils/token.util.js
nano src/utils/token.util.js
Paste:
'use strict';/** * STEP 27 — JWT Token Utility */const jwt = require('jsonwebtoken');const { v4: uuidv4 } = require('uuid');const authConfig = require('../config/auth.config');function generateUserToken({  userId,  customerId,  walletAddress,  organizationId,  roles = [],  permissions = []}) {  if (!userId && !customerId && !walletAddress) {    throw new Error('Cannot generate user token without userId, customerId, or walletAddress');  }  const payload = {    tokenType: authConfig.tokenTypes.USER,    userId: userId || null,    customerId: customerId || null,    walletAddress: walletAddress || null,    organizationId: organizationId || null,    roles,    permissions,    jti: uuidv4()  };  return jwt.sign(payload, authConfig.jwt.secret, {    expiresIn: authConfig.jwt.expiresIn,    issuer: authConfig.jwt.issuer,    audience: authConfig.jwt.audience  });}function generateSystemToken({  serviceName,  serviceId,  roles = ['SYSTEM'],  permissions = []}) {  if (!serviceName) {    throw new Error('Cannot generate system token without serviceName');  }  const payload = {    tokenType: authConfig.tokenTypes.SYSTEM,    serviceName,    serviceId: serviceId || serviceName,    roles,    permissions,    jti: uuidv4()  };  return jwt.sign(payload, authConfig.systemJwt.secret, {    expiresIn: authConfig.systemJwt.expiresIn,    issuer: authConfig.systemJwt.issuer,    audience: authConfig.systemJwt.audience  });}function verifyUserToken(token) {  return jwt.verify(token, authConfig.jwt.secret, {    issuer: authConfig.jwt.issuer,    audience: authConfig.jwt.audience  });}function verifySystemToken(token) {  return jwt.verify(token, authConfig.systemJwt.secret, {    issuer: authConfig.systemJwt.issuer,    audience: authConfig.systemJwt.audience  });}module.exports = {  generateUserToken,  generateSystemToken,  verifyUserToken,  verifySystemToken};

7. Create JWT Middleware src/middleware/jwt.middleware.js
nano src/middleware/jwt.middleware.js
Paste:
'use strict';/** * STEP 27 — JWT Validation Middleware */const authConfig = require('../config/auth.config');const {  verifyUserToken,  verifySystemToken} = require('../utils/token.util');const { AuthError } = require('../utils/authErrors');function extractBearerToken(req) {  const authHeader = req.headers.authorization || req.headers.Authorization;  if (!authHeader) {    throw new AuthError('Missing Authorization header', 401, 'AUTH_HEADER_MISSING');  }  if (!authHeader.startsWith('Bearer ')) {    throw new AuthError('Invalid Authorization header format. Expected Bearer token.', 401, 'INVALID_AUTH_HEADER');  }  return authHeader.substring(7).trim();}/** * Validate normal user JWT. */function validateUserJwt(req, res, next) {  try {    if (!authConfig.authEnabled) {      return next();    }    const token = extractBearerToken(req);    const decoded = verifyUserToken(token);    if (decoded.tokenType !== authConfig.tokenTypes.USER) {      throw new AuthError('Invalid token type. User token required.', 401, 'INVALID_TOKEN_TYPE');    }    req.auth = {      authenticated: true,      tokenType: decoded.tokenType,      userId: decoded.userId || null,      customerId: decoded.customerId || null,      walletAddress: decoded.walletAddress || null,      organizationId: decoded.organizationId || null,      roles: decoded.roles || [],      permissions: decoded.permissions || [],      rawTokenPayload: decoded    };    return next();  } catch (error) {    if (error.name === 'TokenExpiredError') {      return next(new AuthError('JWT token expired', 401, 'TOKEN_EXPIRED'));    }    if (error.name === 'JsonWebTokenError') {      return next(new AuthError('Invalid JWT token', 401, 'INVALID_TOKEN'));    }    return next(error);  }}/** * Validate internal service/system JWT. */function validateSystemJwt(req, res, next) {  try {    if (!authConfig.authEnabled) {      return next();    }    const token = extractBearerToken(req);    const decoded = verifySystemToken(token);    if (decoded.tokenType !== authConfig.tokenTypes.SYSTEM) {      throw new AuthError('Invalid token type. System token required.', 401, 'INVALID_TOKEN_TYPE');    }    req.auth = {      authenticated: true,      tokenType: decoded.tokenType,      serviceName: decoded.serviceName,      serviceId: decoded.serviceId,      roles: decoded.roles || [],      permissions: decoded.permissions || [],      rawTokenPayload: decoded    };    return next();  } catch (error) {    if (error.name === 'TokenExpiredError') {      return next(new AuthError('System JWT token expired', 401, 'SYSTEM_TOKEN_EXPIRED'));    }    if (error.name === 'JsonWebTokenError') {      return next(new AuthError('Invalid system JWT token', 401, 'INVALID_SYSTEM_TOKEN'));    }    return next(error);  }}/** * Accept either USER token or SYSTEM token. */function validateAnyJwt(req, res, next) {  try {    if (!authConfig.authEnabled) {      return next();    }    const token = extractBearerToken(req);    try {      const decodedUser = verifyUserToken(token);      if (decodedUser.tokenType === authConfig.tokenTypes.USER) {        req.auth = {          authenticated: true,          tokenType: decodedUser.tokenType,          userId: decodedUser.userId || null,          customerId: decodedUser.customerId || null,          walletAddress: decodedUser.walletAddress || null,          organizationId: decodedUser.organizationId || null,          roles: decodedUser.roles || [],          permissions: decodedUser.permissions || [],          rawTokenPayload: decodedUser        };        return next();      }    } catch (_) {      // Continue and try system token.    }    const decodedSystem = verifySystemToken(token);    if (decodedSystem.tokenType !== authConfig.tokenTypes.SYSTEM) {      throw new AuthError('Invalid token type', 401, 'INVALID_TOKEN_TYPE');    }    req.auth = {      authenticated: true,      tokenType: decodedSystem.tokenType,      serviceName: decodedSystem.serviceName,      serviceId: decodedSystem.serviceId,      roles: decodedSystem.roles || [],      permissions: decodedSystem.permissions || [],      rawTokenPayload: decodedSystem    };    return next();  } catch (error) {    if (error.name === 'TokenExpiredError') {      return next(new AuthError('JWT token expired', 401, 'TOKEN_EXPIRED'));    }    if (error.name === 'JsonWebTokenError') {      return next(new AuthError('Invalid JWT token', 401, 'INVALID_TOKEN'));    }    return next(error);  }}module.exports = {  validateUserJwt,  validateSystemJwt,  validateAnyJwt};

8. Create API Key Middleware src/middleware/apiKey.middleware.js
nano src/middleware/apiKey.middleware.js
Paste:
'use strict';/** * STEP 27 — API Key Validation Middleware */const crypto = require('crypto');const authConfig = require('../config/auth.config');const { AuthError } = require('../utils/authErrors');function safeCompare(a, b) {  const valueA = Buffer.from(String(a || ''), 'utf8');  const valueB = Buffer.from(String(b || ''), 'utf8');  if (valueA.length !== valueB.length) {    return false;  }  return crypto.timingSafeEqual(valueA, valueB);}function validateApiKey(req, res, next) {  try {    if (!authConfig.authEnabled) {      return next();    }    const headerName = authConfig.apiKey.headerName.toLowerCase();    const providedApiKey = req.headers[headerName];    const expectedApiKey = authConfig.apiKey.internalServiceApiKey;    if (!providedApiKey) {      throw new AuthError(`Missing API key header: ${headerName}`, 401, 'API_KEY_MISSING');    }    if (!expectedApiKey || expectedApiKey.includes('change-me')) {      throw new AuthError('Internal API key is not configured securely', 500, 'API_KEY_NOT_CONFIGURED');    }    if (!safeCompare(providedApiKey, expectedApiKey)) {      throw new AuthError('Invalid API key', 401, 'INVALID_API_KEY');    }    req.apiKeyAuth = {      authenticated: true,      headerName    };    return next();  } catch (error) {    return next(error);  }}module.exports = {  validateApiKey};

9. Create Role-Based Authorization Middleware
nano src/middleware/authorization.middleware.js
Paste:
'use strict';/** * STEP 27 — Role-Based Authorization Middleware */const { ForbiddenError, AuthError } = require('../utils/authErrors');function requireAuth(req, res, next) {  if (!req.auth || !req.auth.authenticated) {    return next(new AuthError('Authentication required', 401, 'AUTH_REQUIRED'));  }  return next();}function requireRoles(allowedRoles = []) {  return function roleMiddleware(req, res, next) {    if (!req.auth || !req.auth.authenticated) {      return next(new AuthError('Authentication required', 401, 'AUTH_REQUIRED'));    }    const userRoles = req.auth.roles || [];    const hasAllowedRole = allowedRoles.some((role) => userRoles.includes(role));    if (!hasAllowedRole) {      return next(        new ForbiddenError(          `Access denied. Required role: ${allowedRoles.join(' or ')}`        )      );    }    return next();  };}function requirePermissions(requiredPermissions = []) {  return function permissionMiddleware(req, res, next) {    if (!req.auth || !req.auth.authenticated) {      return next(new AuthError('Authentication required', 401, 'AUTH_REQUIRED'));    }    const userPermissions = req.auth.permissions || [];    const hasAllPermissions = requiredPermissions.every((permission) =>      userPermissions.includes(permission)    );    if (!hasAllPermissions) {      return next(        new ForbiddenError(          `Access denied. Required permissions: ${requiredPermissions.join(', ')}`        )      );    }    return next();  };}function requireTokenType(requiredTokenType) {  return function tokenTypeMiddleware(req, res, next) {    if (!req.auth || !req.auth.authenticated) {      return next(new AuthError('Authentication required', 401, 'AUTH_REQUIRED'));    }    if (req.auth.tokenType !== requiredTokenType) {      return next(        new ForbiddenError(          `Access denied. Required token type: ${requiredTokenType}`        )      );    }    return next();  };}module.exports = {  requireAuth,  requireRoles,  requirePermissions,  requireTokenType};

10. Create Security Error Handler
nano src/middleware/error.middleware.js
Paste:
'use strict';/** * STEP 27 — Centralized Error Handler */function errorHandler(error, req, res, next) {  const statusCode = error.statusCode || 500;  const requestId =    req.headers['x-request-id'] ||    req.requestId ||    null;  const response = {    success: false,    message: error.message || 'Internal server error',    errorCode: error.errorCode || 'INTERNAL_SERVER_ERROR',    requestId  };  if (process.env.NODE_ENV !== 'production') {    response.stack = error.stack;  }  return res.status(statusCode).json(response);}function notFoundHandler(req, res) {  return res.status(404).json({    success: false,    message: `Route not found: ${req.method} ${req.originalUrl}`,    errorCode: 'ROUTE_NOT_FOUND',    requestId: req.headers['x-request-id'] || null  });}module.exports = {  errorHandler,  notFoundHandler};

11. Create Auth Controller
mkdir -p src/controllersnano src/controllers/auth.controller.js
Paste:
'use strict';/** * STEP 27 — Authentication Controller */const bcrypt = require('bcryptjs');const authConfig = require('../config/auth.config');const {  generateUserToken,  generateSystemToken} = require('../utils/token.util');/** * Demo user login. * * In production: * - Validate against PostgreSQL auth table. * - Compare password using bcrypt. * - Load roles from DB. * - Load permissions from DB. */async function loginUser(req, res, next) {  try {    const {      customerId,      walletAddress,      password    } = req.body;    if ((!customerId && !walletAddress) || !password) {      return res.status(400).json({        success: false,        message: 'customerId or walletAddress and password are required',        errorCode: 'VALIDATION_ERROR',        requestId: req.headers['x-request-id'] || null      });    }    /**     * TEMPORARY DEV AUTH LOGIC     *     * Replace this with PostgreSQL lookup:     * SELECT customer_id, wallet_address, password_hash, organization_id, roles     * FROM blockchain.wallets / auth table     * WHERE customer_id = $1 OR wallet_address = $2     */    const demoPasswordHash = await bcrypt.hash('password123', 10);    const passwordValid = await bcrypt.compare(password, demoPasswordHash);    if (!passwordValid) {      return res.status(401).json({        success: false,        message: 'Invalid login credentials',        errorCode: 'INVALID_CREDENTIALS',        data: null,        requestId: req.headers['x-request-id'] || null      });    }    const token = generateUserToken({      userId: customerId || walletAddress,      customerId: customerId || null,      walletAddress: walletAddress || null,      organizationId: null,      roles: [authConfig.roles.CUSTOMER],      permissions: [        'wallet:read',        'transaction:create',        'transaction:read'      ]    });    return res.status(200).json({      success: true,      message: 'User login successful',      data: {        tokenType: 'Bearer',        accessToken: token,        expiresIn: authConfig.jwt.expiresIn      },      requestId: req.headers['x-request-id'] || null    });  } catch (error) {    return next(error);  }}/** * Generate system token for internal services. * * Protected by API key. */async function issueSystemToken(req, res, next) {  try {    const {      serviceName,      serviceId    } = req.body;    if (!serviceName) {      return res.status(400).json({        success: false,        message: 'serviceName is required',        errorCode: 'VALIDATION_ERROR',        requestId: req.headers['x-request-id'] || null      });    }    const token = generateSystemToken({      serviceName,      serviceId: serviceId || serviceName,      roles: [authConfig.roles.SYSTEM],      permissions: [        'wallet:create',        'wallet:read',        'transaction:create',        'transaction:read',        'fabric:submit',        'fabric:evaluate'      ]    });    return res.status(200).json({      success: true,      message: 'System token issued successfully',      data: {        tokenType: 'Bearer',        accessToken: token,        expiresIn: authConfig.systemJwt.expiresIn      },      requestId: req.headers['x-request-id'] || null    });  } catch (error) {    return next(error);  }}/** * Return authenticated principal. */async function me(req, res, next) {  try {    return res.status(200).json({      success: true,      message: 'Authenticated principal retrieved successfully',      data: {        auth: req.auth || null,        apiKeyAuth: req.apiKeyAuth || null      },      requestId: req.headers['x-request-id'] || null    });  } catch (error) {    return next(error);  }}module.exports = {  loginUser,  issueSystemToken,  me};

12. Create Auth Routes
mkdir -p src/routesnano src/routes/auth.routes.js
Paste:
'use strict';/** * STEP 27 — Authentication Routes */const express = require('express');const {  loginUser,  issueSystemToken,  me} = require('../controllers/auth.controller');const { validateApiKey } = require('../middleware/apiKey.middleware');const { validateAnyJwt } = require('../middleware/jwt.middleware');const router = express.Router();/** * User login. */router.post('/login', loginUser);/** * System token issuing. * Requires internal API key. */router.post('/system-token', validateApiKey, issueSystemToken);/** * Current authenticated identity. * Accepts either user token or system token. */router.get('/me', validateAnyJwt, me);module.exports = router;

13. Create Protected Route Policy Helper
nano src/middleware/routeSecurity.middleware.js
Paste:
'use strict';/** * STEP 27 — Route Security Policy Middleware */const authConfig = require('../config/auth.config');const { validateUserJwt, validateSystemJwt, validateAnyJwt } = require('./jwt.middleware');const { validateApiKey } = require('./apiKey.middleware');const {  requireRoles,  requirePermissions,  requireTokenType} = require('./authorization.middleware');const roles = authConfig.roles;const tokenTypes = authConfig.tokenTypes;/** * Customer/user access. */const userAccess = [  validateUserJwt,  requireTokenType(tokenTypes.USER)];/** * Admin or compliance access. */const adminAccess = [  validateUserJwt,  requireRoles([    roles.SUPER_ADMIN,    roles.ADMIN,    roles.COMPLIANCE_OFFICER  ])];/** * Internal service access using API key and system JWT. */const serviceAccess = [  validateApiKey,  validateSystemJwt,  requireTokenType(tokenTypes.SYSTEM),  requireRoles([roles.SYSTEM])];/** * Either user or internal service token. */const userOrServiceAccess = [  validateAnyJwt];/** * Fabric submit/evaluate should usually be service-only. */const fabricServiceAccess = [  validateApiKey,  validateSystemJwt,  requirePermissions([    'fabric:submit'  ])];module.exports = {  userAccess,  adminAccess,  serviceAccess,  userOrServiceAccess,  fabricServiceAccess};

14. Update Existing Routes
You already have route files such as:
src/routes/wallet.routes.jssrc/routes/transaction.routes.jssrc/routes/fabric.routes.js
Now protect them.

14.1 Update src/routes/wallet.routes.js
nano src/routes/wallet.routes.js
Use this structure and adjust if your controller names are slightly different:
'use strict';const express = require('express');const router = express.Router();const walletController = require('../controllers/wallet.controller');const {  userAccess,  serviceAccess,  userOrServiceAccess,  adminAccess} = require('../middleware/routeSecurity.middleware');/** * STEP 27 — Protected Wallet Routes *//** * Create wallet. * Usually called by Spring Boot or internal backend service. */router.post(  '/',  serviceAccess,  walletController.createWallet);/** * Wallet login remains public because it issues a token. * If you already use /wallets/login, keep it public. */if (walletController.loginWallet) {  router.post(    '/login',    walletController.loginWallet  );}/** * Query wallet by customer ID. * User or internal service can access. */if (walletController.getWalletByCustomerId) {  router.get(    '/customer/:customerId',    userOrServiceAccess,    walletController.getWalletByCustomerId  );}/** * Query wallet by wallet address. */if (walletController.getWalletByAddress) {  router.get(    '/address/:walletAddress',    userOrServiceAccess,    walletController.getWalletByAddress  );}/** * Balance query. */if (walletController.getWalletBalance) {  router.get(    '/:walletAddress/balance',    userOrServiceAccess,    walletController.getWalletBalance  );}/** * Admin-only wallet list. */if (walletController.getWallets) {  router.get(    '/',    adminAccess,    walletController.getWallets  );}module.exports = router;

14.2 Update src/routes/transaction.routes.js
nano src/routes/transaction.routes.js
Use:
'use strict';const express = require('express');const router = express.Router();const transactionController = require('../controllers/transaction.controller');const {  userAccess,  serviceAccess,  userOrServiceAccess,  adminAccess} = require('../middleware/routeSecurity.middleware');/** * STEP 27 — Protected Transaction Routes *//** * Wallet-to-wallet transfer. * Can be called by authenticated user or internal service. */router.post(  '/wallet-transfer',  userOrServiceAccess,  transactionController.walletTransfer);/** * Organization transfer. * Usually internal service only. */router.post(  '/organization-transfer',  serviceAccess,  transactionController.organizationTransfer);/** * Transaction history. * User/service/admin allowed. */router.get(  '/',  userOrServiceAccess,  transactionController.getTransactionHistory);/** * Transaction by ID. */if (transactionController.getTransactionById) {  router.get(    '/:transactionId',    userOrServiceAccess,    transactionController.getTransactionById  );}/** * Admin compliance route example. */if (transactionController.getHighRiskTransactions) {  router.get(    '/risk/high',    adminAccess,    transactionController.getHighRiskTransactions  );}module.exports = router;

14.3 Update src/routes/fabric.routes.js
nano src/routes/fabric.routes.js
Use:
'use strict';const express = require('express');const router = express.Router();const fabricController = require('../controllers/fabric.controller');const {  serviceAccess} = require('../middleware/routeSecurity.middleware');/** * STEP 27 — Protected Fabric Routes * * Fabric submit/evaluate should not be public. * Only trusted internal services should access these endpoints. */router.post(  '/submit',  serviceAccess,  fabricController.submitTransaction);router.post(  '/evaluate',  serviceAccess,  fabricController.evaluateTransaction);if (fabricController.getBlockchainStatus) {  router.get(    '/status',    fabricController.getBlockchainStatus  );}module.exports = router;

15. Update src/server.js
Open:
nano src/server.js
Make sure your server includes:
'use strict';require('dotenv').config();const express = require('express');const cors = require('cors');const authRoutes = require('./routes/auth.routes');const walletRoutes = require('./routes/wallet.routes');const transactionRoutes = require('./routes/transaction.routes');const fabricRoutes = require('./routes/fabric.routes');const {  errorHandler,  notFoundHandler} = require('./middleware/error.middleware');const app = express();const PORT = process.env.PORT || 3001;const API_PREFIX = process.env.API_PREFIX || '/api/v1';app.use(cors());app.use(express.json({ limit: '2mb' }));app.use(express.urlencoded({ extended: true }));/** * Basic request ID propagation. */app.use((req, res, next) => {  req.requestId =    req.headers['x-request-id'] ||    `REQ_${Date.now()}_${Math.random().toString(16).slice(2).toUpperCase()}`;  res.setHeader('x-request-id', req.requestId);  next();});/** * Root endpoint. */app.get('/', (req, res) => {  res.status(200).json({    success: true,    message: 'Blockchain API Middleware is running',    apiPrefix: API_PREFIX,    health: `${API_PREFIX}/health`,    blockchainStatus: `${API_PREFIX}/blockchain/status`,    auth: `${API_PREFIX}/auth`,    timestamp: new Date().toISOString()  });});/** * Health endpoint should remain public. */app.get(`${API_PREFIX}/health`, (req, res) => {  res.status(200).json({    success: true,    message: 'Blockchain API Middleware is healthy',    data: {      service: 'Blockchain API Middleware',      version: '1.0.0',      environment: process.env.NODE_ENV || 'development',      uptimeSeconds: process.uptime(),      timestamp: new Date().toISOString()    },    requestId: req.requestId  });});/** * STEP 27 — Auth Routes */app.use(`${API_PREFIX}/auth`, authRoutes);/** * Existing protected business routes. */app.use(`${API_PREFIX}/wallets`, walletRoutes);app.use(`${API_PREFIX}/transactions`, transactionRoutes);app.use(`${API_PREFIX}/fabric`, fabricRoutes);/** * 404 and central error handling. */app.use(notFoundHandler);app.use(errorHandler);app.listen(PORT, '0.0.0.0', () => {  console.log(    JSON.stringify({      level: 'info',      message: `Blockchain API Middleware running on port ${PORT}`,      apiPrefix: API_PREFIX,      environment: process.env.NODE_ENV || 'development'    })  );});module.exports = app;

Important: If your existing server.js already has logger, blockchain status, config loading, or graceful shutdown, do not delete them. Only add the auth routes and error middleware.


16. Syntax Validation
Run:
node -c src/config/auth.config.jsnode -c src/utils/authErrors.jsnode -c src/utils/token.util.jsnode -c src/middleware/jwt.middleware.jsnode -c src/middleware/apiKey.middleware.jsnode -c src/middleware/authorization.middleware.jsnode -c src/middleware/routeSecurity.middleware.jsnode -c src/middleware/error.middleware.jsnode -c src/controllers/auth.controller.jsnode -c src/routes/auth.routes.jsnode -c src/server.js

17. Restart API
If your API is already running, stop it first.
Find process:
sudo lsof -i :3001
Kill it:
sudo kill -9 <PID>
Start again:
cd /home/nix/u01/blockchain-integration/blockchain-apinpm start

18. Test Public Health Endpoint
curl http://127.0.0.1:3001/api/v1/health \-H "Content-Type: application/json" \-H "x-request-id: REQ_STEP_27_HEALTH_TEST"
Expected:
{  "success": true,  "message": "Blockchain API Middleware is healthy"}

19. Test User Login
curl -X POST http://127.0.0.1:3001/api/v1/auth/login \-H "Content-Type: application/json" \-H "x-request-id: REQ_STEP_27_USER_LOGIN" \-d '{  "customerId": "CUST2017",  "password": "password123"}'
Expected:
{  "success": true,  "message": "User login successful",  "data": {    "tokenType": "Bearer",    "accessToken": "JWT_TOKEN_HERE",    "expiresIn": "1h"  }}
Save token:
USER_TOKEN="<PASTE_USER_TOKEN_HERE>"

20. Test /auth/me With User Token
curl -X GET http://127.0.0.1:3001/api/v1/auth/me \-H "Content-Type: application/json" \-H "Authorization: Bearer $USER_TOKEN" \-H "x-request-id: REQ_STEP_27_AUTH_ME_USER"
Expected:
{  "success": true,  "message": "Authenticated principal retrieved successfully",  "data": {    "auth": {      "authenticated": true,      "tokenType": "USER",      "customerId": "CUST2017",      "roles": [        "CUSTOMER"      ]    }  }}

21. Test System Token Generation
Use your real API key from .env.
curl -X POST http://127.0.0.1:3001/api/v1/auth/system-token \-H "Content-Type: application/json" \-H "x-api-key: CHANGE_THIS_TO_INTERNAL_SERVICE_API_KEY" \-H "x-request-id: REQ_STEP_27_SYSTEM_TOKEN" \-d '{  "serviceName": "SPRING_BOOT_CORE_SERVICE",  "serviceId": "spring-boot-core-001"}'
Expected:
{  "success": true,  "message": "System token issued successfully",  "data": {    "tokenType": "Bearer",    "accessToken": "SYSTEM_JWT_TOKEN_HERE",    "expiresIn": "15m"  }}
Save token:
SYSTEM_TOKEN="<PASTE_SYSTEM_TOKEN_HERE>"

22. Test Protected Fabric Route Without Token
curl -X POST http://127.0.0.1:3001/api/v1/fabric/evaluate \-H "Content-Type: application/json" \-H "x-request-id: REQ_STEP_27_FABRIC_NO_AUTH" \-d '{  "functionName": "GetWalletByCustomerId",  "args": ["CUST2017"]}'
Expected:
{  "success": false,  "message": "Missing API key header: x-api-key",  "errorCode": "API_KEY_MISSING"}

23. Test Protected Fabric Route With System Auth
curl -X POST http://127.0.0.1:3001/api/v1/fabric/evaluate \-H "Content-Type: application/json" \-H "x-api-key: CHANGE_THIS_TO_INTERNAL_SERVICE_API_KEY" \-H "Authorization: Bearer $SYSTEM_TOKEN" \-H "x-request-id: REQ_STEP_27_FABRIC_SYSTEM_AUTH" \-d '{  "functionName": "GetWalletByCustomerId",  "args": ["CUST2017"]}'
Expected security result:
{  "success": true}
Or Fabric business error if the wallet does not exist. That means the security layer passed correctly.

24. Test Transaction History With User Token
curl -X GET "http://127.0.0.1:3001/api/v1/transactions?page=1&limit=10" \-H "Content-Type: application/json" \-H "Authorization: Bearer $USER_TOKEN" \-H "x-request-id: REQ_STEP_27_TRANSACTION_HISTORY_USER"
Expected:
{  "success": true,  "message": "Transaction history retrieved successfully"}

25. Test Transaction History Without Token
curl -X GET "http://127.0.0.1:3001/api/v1/transactions?page=1&limit=10" \-H "Content-Type: application/json" \-H "x-request-id: REQ_STEP_27_TRANSACTION_HISTORY_NO_AUTH"
Expected:
{  "success": false,  "message": "Missing Authorization header",  "errorCode": "AUTH_HEADER_MISSING"}

26. Recommended Route Protection Matrix
RouteToken TypeAPI KeyRoleGET /api/v1/healthNoneNoPublicPOST /api/v1/auth/loginNoneNoPublicPOST /api/v1/auth/system-tokenNoneYesInternal onlyGET /api/v1/auth/meUser or SystemNoAny authenticatedPOST /api/v1/walletsSystemYesSYSTEMPOST /api/v1/wallets/loginNoneNoPublicGET /api/v1/wallets/customer/:customerIdUser or SystemOptionalAuthenticatedGET /api/v1/wallets/:walletAddress/balanceUser or SystemOptionalAuthenticatedPOST /api/v1/transactions/wallet-transferUser or SystemOptionalAuthenticatedPOST /api/v1/transactions/organization-transferSystemYesSYSTEMGET /api/v1/transactionsUser or SystemOptionalAuthenticatedPOST /api/v1/fabric/submitSystemYesSYSTEMPOST /api/v1/fabric/evaluateSystemYesSYSTEMGET /api/v1/fabric/statusNoneNoPublic or internal, based on your policy

27. Security Best Practices Applied
This implementation separates:
User Authentication→ JWT signed by JWT_SECRET→ tokenType = USER→ used by customers, bank users, compliance usersSystem Authentication→ API key + JWT signed by SYSTEM_JWT_SECRET→ tokenType = SYSTEM→ used by Spring Boot, integration services, schedulers, backend workersAuthorization→ roles→ permissions→ token type→ route-level access control
Recommended production rules:
1. Never expose Fabric submit/evaluate publicly.2. Keep /fabric/submit and /fabric/evaluate service-only.3. Use HTTPS only.4. Rotate API keys periodically.5. Use separate secrets for user JWT and system JWT.6. Keep JWT expiry short.7. Add refresh tokens later if needed.8. Store password hashes only, never plain passwords.9. Use bcrypt or Argon2 for password hashing.10. Log failed authentication attempts.11. Add rate limiting on login routes.12. Add audit logs for all sensitive operations.

28. Final Validation Commands
Run this complete validation sequence:
cd /home/nix/u01/blockchain-integration/blockchain-apinode -c src/config/auth.config.jsnode -c src/utils/authErrors.jsnode -c src/utils/token.util.jsnode -c src/middleware/jwt.middleware.jsnode -c src/middleware/apiKey.middleware.jsnode -c src/middleware/authorization.middleware.jsnode -c src/middleware/routeSecurity.middleware.jsnode -c src/middleware/error.middleware.jsnode -c src/controllers/auth.controller.jsnode -c src/routes/auth.routes.jsnode -c src/server.jsnpm start

29. STEP 27 Completion Summary
After this step, your Blockchain API has:
JWT validation middleware                 DONEAPI key validation middleware             DONERole-based authorization                  DONEService-to-service authentication         DONEUser token vs system token separation     DONEProtected routes                          DONECentralized error handling                DONESecurity best practices                   DONEFull Node.js code                         DONE

30. Important Note for Your Existing Wallet Login
You already implemented wallet login in Step 22.
So you now have two options:
Option A — Keep Existing /wallets/login
Use your existing wallet login controller and only update it to generate tokens using:
const { generateUserToken } = require('../utils/token.util');
Option B — Use New /auth/login
Use the new centralized authentication route:
POST /api/v1/auth/login
My recommendation:
Keep /wallets/login for wallet-specific login.Add /auth/login as the centralized enterprise authentication endpoint.Later, both should use the same token utility.
This keeps your current work stable and adds the new enterprise security layer cleanly.