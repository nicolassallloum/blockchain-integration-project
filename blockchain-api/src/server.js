'use strict';

/**
 * Blockchain API Middleware Server
 * Blockchain Integration Project
 *
 * Cleaned for:
 * - Correct route loading order
 * - Government transactions route
 * - Government services route
 * - Resident search route
 * - CORS support
 * - Request logging
 * - Professional 404 and global error handling
 */

require('dotenv').config();

const express = require('express');
const path = require('path');
const blockchainProofsRoutes = require('./routes/government-blockchain-proofs.routes');
const governmentSettingsRoutes = require('./routes/government-blockchain/settings.routes');
const governmentDashboardRoutes = require('./routes/government-dashboard.routes');
const riskFraudScreeningRoutes = require('./routes/government-risk-fraud-screening.routes');
const valooresBlockchainRoutes = require('./routes/valoores-blockchain.routes');
const valooresAmlRulesSyncService = require('./services/valoores-aml-rules-sync.service');
const blockchainApiProofService = require('./services/blockchain-api-proof.service');
const licenseRecoveryRoutes =
  require('../routes/licenseRecoveryRoutes');

const licenseAccessRoutes =
  require('../routes/licenseAccessRoutes');
const licenseWalletRoutes =
  require('../routes/licenseWalletRoutes');

const {
  licensePool
} = require('./config/license-database');
const cors = require('cors');
const crypto = require('crypto');
const os = require('os');
const residentWalletsRoutes = require('./routes/resident-wallets.routes');
const paymentsDigitalStampsRoutes = require('./routes/payments-digital-stamps.routes');
const documentsKycRoutes = require('./routes/documents-kyc.routes');
const governmentDocumentsRoutes = require('./routes/government-documents.routes');
const governmentAmlDashboardRoutes = require('./routes/government-aml-dashboard.routes');
const governmentValooresAmlRulesRoutes = require('./routes/government-valoores-aml-rules.routes');
const governmentValooresCustomerKycRoutes = require('./routes/government-valoores-customer-kyc.routes');
const governmentAmlAlertsQueueRoutes = require('./routes/government-aml-alerts-queue.routes');
const governmentAmlCasesRoutes = require('./routes/government-aml-cases.routes');
const governmentReportsRoutes = require('./routes/government-reports.routes');
const hashVerificationRoutes = require('./routes/hash-verification.routes');
const governmentAuditLogsRoutes = require('./routes/government-audit-logs.routes');
const auditBlockchainProofRoutes = require('./routes/audit-blockchain-proof.routes');
const auditBatchProofRoutes = require('./routes/audit-batch-proof.routes');
const dataChangeHighRiskAlertRoutes = require('./routes/data-change-high-risk-alert.routes');
const dataChangeInvalidRecordReviewRoutes = require('./routes/data-change-invalid-record-review.routes');
const dataChangeComplianceProofRuleRoutes = require('./routes/data-change-compliance-proof-rule.routes');
const dataChangeBulkComplianceApprovalRoutes = require('./routes/data-change-bulk-compliance-approval.routes');
const auditSessionContextMiddleware = require('./middleware/auditSessionContext.middleware');
const auditValidationRoutes = require('./routes/audit-validation.routes');
const app = express();

// Serve internal UI files from /public
app.use(express.static(path.join(__dirname, '..', 'public')));
const postgresBrowserRoutes = require('./routes/postgres-browser.routes');

try {
  valooresAmlRulesSyncService.startAutoSyncScheduler();
} catch (error) {
  console.error('[VALOORES_AML_RULES_AUTO_SYNC_BOOT_ERROR]', error.message);
}

try {
  blockchainApiProofService.startAutomaticRetryScheduler();
} catch (error) {
  console.error('[BLOCKCHAIN_AUTO_RETRY_BOOT_ERROR]', error.message);
}


app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Phase 27: capture application user/request context for PostgreSQL audit triggers.
app.use(auditSessionContextMiddleware);
app.use('/api/v1/audit-validation', auditValidationRoutes);
console.log('[ROUTE MOUNTED] /api/v1/audit-validation');

const earlyGovernmentCors = cors({
  origin: [
    'http://localhost:4200',
    'http://127.0.0.1:4200',
    'http://172.31.13.90:4200'
  ],
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Accept',
    'Content-Type',
    'Authorization',
    'x-api-key',
    'x-request-id',
    'x-correlation-id',
    'x-source-system',
    'x-request-source'
  ],
  exposedHeaders: ['x-request-id', 'x-correlation-id'],
  credentials: false,
  optionsSuccessStatus: 204
});

app.use('/api/v1/government-blockchain', earlyGovernmentCors);
app.options(/^\/api\/v1\/government-blockchain(\/.*)?$/, earlyGovernmentCors);
app.use('/api/v1/postgres-browser', postgresBrowserRoutes);
const documentsKycCors = cors({
  origin: [
    'http://localhost:4200',
    'http://127.0.0.1:4200',
    'http://172.31.13.90:4200'
  ],
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  credentials: true
});

app.use('/api/v1/government-blockchain/documents-kyc', documentsKycCors);
app.options(/^\/api\/v1\/government-blockchain\/documents-kyc(\/.*)?$/, documentsKycCors);
app.use('/api/v1/valoores-blockchain', valooresBlockchainRoutes);
app.use('/api/v1/government-blockchain/documents-kyc', documentsKycRoutes);

app.use('/api/v1/government-blockchain/documents', governmentDocumentsRoutes);
console.log('[ROUTE MOUNTED] /api/v1/government-blockchain/documents');

app.use('/api/v1/government-blockchain/hash-verification', hashVerificationRoutes);
console.log('[ROUTE MOUNTED] /api/v1/government-blockchain/hash-verification');

app.use('/api/v1/government-blockchain/risk-fraud-screening', riskFraudScreeningRoutes);
console.log('[ROUTE MOUNTED] /api/v1/government-blockchain/risk-fraud-screening');

app.use('/api/v1/government-blockchain/valoores-aml-rules', governmentValooresAmlRulesRoutes);
console.log('[ROUTE MOUNTED] /api/v1/government-blockchain/valoores-aml-rules');

app.use('/api/v1/government-blockchain/valoores-customer-kyc', governmentValooresCustomerKycRoutes);
console.log('[ROUTE MOUNTED] /api/v1/government-blockchain/valoores-customer-kyc');

app.use('/api/v1/government-blockchain/audit-logs', governmentAuditLogsRoutes);
console.log('[ROUTE MOUNTED] /api/v1/government-blockchain/audit-logs');
app.use('/api/v1/government-blockchain/audit-proofs', auditBlockchainProofRoutes);
console.log('[ROUTE MOUNTED] /api/v1/government-blockchain/audit-proofs');
app.use('/api/v1/government-blockchain/audit-batch-proofs', auditBatchProofRoutes);
console.log('[ROUTE MOUNTED] /api/v1/government-blockchain/audit-batch-proofs');
app.use('/api/v1/government-blockchain/high-risk-data-change-alerts', dataChangeHighRiskAlertRoutes);
console.log('[ROUTE MOUNTED] /api/v1/government-blockchain/high-risk-data-change-alerts');
app.use('/api/v1/government-blockchain/invalid-record-reviews', dataChangeInvalidRecordReviewRoutes);
console.log('[ROUTE MOUNTED] /api/v1/government-blockchain/invalid-record-reviews');
app.use('/api/v1/government-blockchain/compliance-proof-rules', dataChangeComplianceProofRuleRoutes);
console.log('[ROUTE MOUNTED] /api/v1/government-blockchain/compliance-proof-rules');
app.use('/api/v1/government-blockchain/bulk-compliance-approvals', dataChangeBulkComplianceApprovalRoutes);
console.log('[ROUTE MOUNTED] /api/v1/government-blockchain/bulk-compliance-approvals');

app.use('/api/v1/government-blockchain/settings', governmentSettingsRoutes);
console.log('[ROUTE MOUNTED] /api/v1/government-blockchain/settings');

try {
  app.use('/api/v1/government-blockchain/dashboard', governmentDashboardRoutes);
  console.log('[ROUTE MOUNTED] /api/v1/government-blockchain/dashboard');
} catch (error) {
  console.error('[ROUTE ERROR] government dashboard route failed to mount:', error.message);
}







app.use('/uploads', express.static('uploads'));
/**
 * Optional packages.
 */
function optionalRequire(packageName) {
  try {
    return require(packageName);
  } catch (error) {
    console.warn(`[OPTIONAL_PACKAGE_WARNING] Package not available: ${packageName}`);
    return null;
  }
}

/**
 * Safe route loader.
 */
function safeRoute(routePath, routeName) {
  try {
    const route = require(routePath);
    console.log(`[ROUTES] ${routeName} loaded`);
    return route;
  } catch (error) {
    console.error(`[SERVER_ROUTE_LOAD_WARNING] Failed to load ${routeName}:`, error.message);
    return null;
  }
}

const helmet = optionalRequire('helmet');

/**
 * Server configuration.
 */
const PORT = Number(process.env.PORT || process.env.API_PORT || 3001);
const HOST = process.env.HOST || '0.0.0.0';

const SERVICE_NAME = process.env.SERVICE_NAME || 'Blockchain API Middleware';
const SERVICE_VERSION = process.env.SERVICE_VERSION || '1.0.0';
const NODE_ENV = process.env.NODE_ENV || 'production';
/**
 * CORS configuration.
 */
const allowedOrigins = [
  'http://localhost:4200',
  'http://127.0.0.1:4200',

  'http://localhost:8080',
  'http://127.0.0.1:8080',

  'http://localhost:5173',
  'http://127.0.0.1:5173',

  'http://172.31.13.90:4200',
  'http://172.31.13.90:8080',

  'http://172.31.3.90:4200',
  'http://172.31.3.90:8080'
];

const envAllowedOrigins = String(process.env.CORS_ALLOWED_ORIGINS || process.env.CORS_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

for (const origin of envAllowedOrigins) {
  if (!allowedOrigins.includes(origin)) {
    allowedOrigins.push(origin);
  }
}

const allowedHeaders = [
  'Accept',
  'Content-Type',
  'Authorization',
  'x-api-key',
  'x-request-id',
  'x-correlation-id',
  'x-source-system',
  'x-request-source'
];

const exposedHeaders = [
  'x-request-id',
  'x-correlation-id'
];

const corsOptions = {
  origin(origin, callback) {
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.warn('[CORS_BLOCKED]', {
      origin,
      allowedOrigins
    });

    return callback(new Error(`CORS blocked origin: ${origin}`));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders,
  exposedHeaders,
  credentials: false,
  optionsSuccessStatus: 204,
  preflightContinue: false
};

/**
 * Manual CORS preflight.
 */
app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', allowedHeaders.join(','));
    res.setHeader('Access-Control-Expose-Headers', exposedHeaders.join(','));
    res.setHeader('Access-Control-Max-Age', '86400');
  }

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  return next();
});

/**
 * Normal CORS middleware.
 */
app.use(cors(corsOptions));

/**
 * Security headers.
 */
if (helmet) {
  app.use(
    helmet({
      crossOriginResourcePolicy: false,
      crossOriginEmbedderPolicy: false,
      contentSecurityPolicy: false
    })
  );
}

/**
 * Body parsers.
 */
app.use('/api/v1/government-blockchain/payments-digital-stamps', paymentsDigitalStampsRoutes);

try {
  app.use('/api/v1/government-blockchain/aml-dashboard', governmentAmlDashboardRoutes);
  console.log('[ROUTE MOUNTED] /api/v1/government-blockchain/aml-dashboard');
} catch (error) {
  console.error('[ROUTE ERROR] aml-dashboard route failed to mount:', error.message);
}


try {
  app.use('/api/v1/government-blockchain/aml-alerts-queue', governmentAmlAlertsQueueRoutes);
  console.log('[ROUTE MOUNTED] /api/v1/government-blockchain/aml-alerts-queue');
} catch (error) {
  console.error('[ROUTE ERROR] aml-alerts-queue route failed to mount:', error.message);
}


try {
  app.use('/api/v1/government-blockchain/aml-cases', governmentAmlCasesRoutes);
  console.log('[ROUTE MOUNTED] /api/v1/government-blockchain/aml-cases');
  app.use('/api/v1/government-blockchain/aml-case-management', governmentAmlCasesRoutes);
  console.log('[ROUTE MOUNTED] /api/v1/government-blockchain/aml-case-management');
} catch (error) {
  console.error('[ROUTE ERROR] aml-cases route failed to mount:', error.message);
}

try {
  app.use('/api/v1/government-blockchain/reports', governmentReportsRoutes);
  console.log('[ROUTE MOUNTED] /api/v1/government-blockchain/reports');
} catch (error) {
  console.error('[ROUTE ERROR] reports route failed to mount:', error.message);
}

try {
  app.use('/api/v1/government-blockchain/blockchain-proofs', blockchainProofsRoutes);
  console.log('[ROUTE MOUNTED] /api/v1/government-blockchain/blockchain-proofs');
} catch (error) {
  console.error('[ROUTE ERROR] blockchain-proofs route failed to mount:', error.message);
}
console.log('[ROUTE LOADED] /api/v1/government-blockchain/payments-digital-stamps');
/**
 * Request ID / Correlation ID middleware.
 */
app.use((req, res, next) => {
  const incomingRequestId =
    req.headers['x-request-id'] ||
    req.headers['x-correlation-id'];

  const requestId =
    incomingRequestId ||
    `REQ_${crypto.randomBytes(12).toString('hex').toUpperCase()}`;

  req.requestId = String(requestId);
  req.correlationId = String(req.headers['x-correlation-id'] || requestId);

  res.setHeader('x-request-id', req.requestId);
  res.setHeader('x-correlation-id', req.correlationId);

  return next();
});

/**
 * Request logger.
 */
app.use((req, res, next) => {
  const startedAt = Date.now();

  res.on('finish', () => {
    const durationMs = Date.now() - startedAt;

    console.log('[HTTP_REQUEST]', {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      durationMs,
      requestId: req.requestId,
      correlationId: req.correlationId,
      origin: req.headers.origin || null
    });
  });

  return next();
});

/**
 * Route imports.
 */
const walletRoutes = safeRoute('./routes/wallet.routes', 'wallet.routes');
const dataGeneratorRoutes = safeRoute('./routes/data-generator.routes', 'data-generator.routes');
const transactionRoutes = safeRoute('./routes/transaction.routes', 'transaction.routes');
const fabricRoutes = safeRoute('./routes/fabric.routes', 'fabric.routes');
const referenceRoutes = safeRoute('./routes/reference.routes', 'reference.routes');
const organizationRoutes = safeRoute('./routes/organization.routes', 'organization.routes');
const projectViewRoutes = safeRoute('./routes/project-view.routes', 'project-view.routes');
const dashboardRoutes = safeRoute('./routes/dashboard.routes', 'dashboard.routes');

const blockchainKycRoutes = safeRoute('./routes/blockchain-kyc.routes', 'blockchain-kyc.routes');

const governmentBlockchainAuthRoutes = safeRoute(
  './routes/governmentBlockchainAuth.routes',
  'governmentBlockchainAuth.routes'
);

const governmentBlockchainReferenceRoutes = safeRoute(
  './routes/government-blockchain/reference.routes',
  'government-blockchain/reference.routes'
);

const governmentMinistryRoutes = safeRoute(
  './routes/government-blockchain/ministry.routes',
  'government-blockchain/ministry.routes'
);

const residentWalletRoutes = safeRoute(
  './routes/residentWallet.routes',
  'residentWallet.routes'
);

const residentRoutes = safeRoute(
  './routes/resident.routes',
  'resident.routes'
);

const governmentServicesRoutes = safeRoute(
  './routes/government-services.routes',
  'government-services.routes'
);


const publicAdministrationRoutes = safeRoute(
  './routes/publicAdministration.routes',
  'publicAdministration.routes'
);

const governmentTransactionsRoutes = safeRoute(
  './routes/government-transactions.routes',
  'government-transactions.routes'
);


const governmentApprovalQueueRoutes = safeRoute(
  './routes/government-approval-queue.routes',
  'government-approval-queue.routes'
);

const governmentAccountLoginRoutes = safeRoute(
  './routes/government-account-login.routes',
  'government-account-login.routes'
);

/**
 * Optional generic API route aggregator.
 * Keep after all specific routes.
 */
const apiRoutes = safeRoute('./routes', 'routes/index');

/**
 * Health endpoint.
 */
app.get('/api/v1/health', (req, res) => {
  return res.status(200).json({
    success: true,
    message: `${SERVICE_NAME} is healthy`,
    data: {
      service: SERVICE_NAME,
      version: SERVICE_VERSION,
      environment: NODE_ENV,
      uptimeSeconds: process.uptime(),
      timestamp: new Date().toISOString(),
      system: {
        hostname: os.hostname(),
        platform: process.platform,
        memoryFree: os.freemem(),
        memoryTotal: os.totalmem()
      },
      blockchain: {
        channelName:
          process.env.FABRIC_CHANNEL_NAME ||
          process.env.CHANNEL_NAME ||
          'kycchannelnix1',
        chaincodeName:
          process.env.FABRIC_CHAINCODE_NAME ||
          process.env.CHAINCODE_NAME ||
          'kyc-wallet-chaincode-js',
        mspId:
          process.env.FABRIC_MSP_ID ||
          process.env.MSP_ID ||
          'Org1MSP'
      }
    },
    meta: null,
    timestamp: new Date().toISOString(),
    requestId: req.requestId,
    correlationId: req.correlationId
  });
});

/**
 * API route registrations.
 * IMPORTANT:
 * Specific routes must be registered before generic routes and before 404.
 */

if (governmentBlockchainAuthRoutes) {
  app.use(
    '/api/v1/government-blockchain/auth',
    governmentBlockchainAuthRoutes
  );
  console.log('[ROUTE MOUNTED] /api/v1/government-blockchain/auth');
}

if (governmentAccountLoginRoutes) {
  app.use(
    '/api/v1/government-blockchain/account-login',
    governmentAccountLoginRoutes
  );
  console.log('[ROUTE MOUNTED] /api/v1/government-blockchain/account-login');
}

if (governmentServicesRoutes) {
  app.use(
    '/api/v1/government-blockchain/services',
    governmentServicesRoutes
  );
  console.log('[ROUTE MOUNTED] /api/v1/government-blockchain/services');
}


if (publicAdministrationRoutes) {
  app.use(
    '/api/v1/government-blockchain/public-administrations',
    publicAdministrationRoutes
  );
  console.log('[ROUTE MOUNTED] /api/v1/government-blockchain/public-administrations');
}

if (governmentTransactionsRoutes) {
  app.use(
    '/api/v1/government-blockchain/transactions',
    governmentTransactionsRoutes
  );
  console.log('[ROUTE MOUNTED] /api/v1/government-blockchain/transactions');
}


if (governmentApprovalQueueRoutes) {
  app.use(
    '/api/v1/government-blockchain/approval-queue',
    governmentApprovalQueueRoutes
  );
  console.log('[ROUTE MOUNTED] /api/v1/government-blockchain/approval-queue');
}

/**
 * Resident Wallets route.
 * IMPORTANT:
 * Must be mounted before the generic ministry route:
 * /api/v1/government-blockchain/:ministryId
 */
if (residentWalletsRoutes) {
  app.use(
    '/api/v1/government-blockchain',
    residentWalletsRoutes
  );
  console.log('[ROUTE MOUNTED] /api/v1/government-blockchain/resident-wallets');

  app.use(
    '/api/v1/government-blockchain/digital-kyc',
    residentWalletsRoutes
  );
  console.log('[ROUTE MOUNTED] /api/v1/government-blockchain/digital-kyc/resident-wallets');
}

if (governmentMinistryRoutes) {
  app.use(
    '/api/v1/government-blockchain/ministries',
    governmentMinistryRoutes
  );
  console.log('[ROUTE MOUNTED] /api/v1/government-blockchain/ministries');

  /**
   * Keep this because your old project used the ministry router also
   * under /api/v1/government-blockchain.
   */
}

if (governmentBlockchainReferenceRoutes) {
  app.use(
    '/api/v1/government-blockchain/reference',
    governmentBlockchainReferenceRoutes
  );
  console.log('[ROUTE MOUNTED] /api/v1/government-blockchain/reference');
}

if (residentWalletRoutes) {
  app.use(
    '/api/v1/government-blockchain/digital-kyc/resident-wallets',
    residentWalletRoutes
  );
  console.log('[ROUTE MOUNTED] /api/v1/government-blockchain/digital-kyc/resident-wallets');
}

if (residentRoutes) {
  app.use(
    '/api/v1/government-blockchain/residents',
    residentRoutes
  );
  console.log('[ROUTE MOUNTED] /api/v1/government-blockchain/residents');
}

if (blockchainKycRoutes) {
  app.use('/api/v1/kyc', blockchainKycRoutes);
  console.log('[ROUTE MOUNTED] /api/v1/kyc');
}

if (walletRoutes) {
  app.use('/api/v1/wallets', walletRoutes);
  console.log('[ROUTE MOUNTED] /api/v1/wallets');
}

if (dataGeneratorRoutes) {
  app.use('/api/v1/data-generator', dataGeneratorRoutes);
  console.log('[ROUTE MOUNTED] /api/v1/data-generator');
}

if (transactionRoutes) {
  app.use('/api/v1/transactions', transactionRoutes);
  console.log('[ROUTE MOUNTED] /api/v1/transactions');
}

if (fabricRoutes) {
  app.use('/api/v1/fabric', fabricRoutes);
  console.log('[ROUTE MOUNTED] /api/v1/fabric');
}

if (referenceRoutes) {
  app.use('/api/v1/reference', referenceRoutes);
  console.log('[ROUTE MOUNTED] /api/v1/reference');
}

if (organizationRoutes) {
  app.use('/api/v1/organizations', organizationRoutes);
  console.log('[ROUTE MOUNTED] /api/v1/organizations');
}

if (projectViewRoutes) {
  app.use('/api/v1/project-views', projectViewRoutes);
  console.log('[ROUTE MOUNTED] /api/v1/project-views');
}

if (dashboardRoutes) {
  app.use('/api/v1/dashboard', dashboardRoutes);
  console.log('[ROUTE MOUNTED] /api/v1/dashboard');
}

/**
 * Generic route aggregator must be after specific routes.
 */
if (apiRoutes) {
  app.use('/api/v1', apiRoutes);
  console.log('[ROUTE MOUNTED] /api/v1 generic routes');
}

/**
 * Root endpoint.
 */
app.get('/', (req, res) => {
  return res.status(200).json({
    success: true,
    message: SERVICE_NAME,
    data: {
      version: SERVICE_VERSION,
      environment: NODE_ENV,
      health: '/api/v1/health',

      governmentAuth: '/api/v1/government-blockchain/auth',
      governmentServices: '/api/v1/government-blockchain/services',
      governmentTransactions: '/api/v1/government-blockchain/transactions',
      governmentTransactionServices: '/api/v1/government-blockchain/transactions/services',
      governmentTransactionResidentSearch:
        '/api/v1/government-blockchain/transactions/residents/search',

      wallets: '/api/v1/wallets',
      dataGenerator: '/api/v1/data-generator/run',
      transactions: '/api/v1/transactions',
      fabric: '/api/v1/fabric',
      reference: '/api/v1/reference',
      organizations: '/api/v1/organizations',
      projectViews: '/api/v1/project-views/stats',
      dashboard: '/api/v1/dashboard/summary'
    },
    requestId: req.requestId,
    correlationId: req.correlationId
  });
});

/**
 * 404 handler.
 * Must stay after all routes.
 */
try {
  app.use(
    '/api/license-access',
    licenseAccessRoutes(licensePool)
  );

  console.log(
    '[ROUTE MOUNTED] /api/license-access'
  );
} catch (error) {
  console.error(
    '[ROUTE ERROR] License Access route failed to mount:',
    error.message
  );
}
const {
  httpAuditMiddleware
} = require('./utils/professionalAuditLogger');

app.use(
  httpAuditMiddleware
);
try {
  app.use(
    '/api/license-wallets',
    licenseWalletRoutes(licensePool)
  );

  console.log(
    '[ROUTE MOUNTED] /api/license-wallets'
  );
} catch (error) {
  console.error(
    '[ROUTE ERROR] License Wallet route failed to mount:',
    error.message
  );
}

try {
  app.use(
    '/api/license-recovery',
    licenseRecoveryRoutes(licensePool)
  );
console.log(
    '[ROUTE MOUNTED] /api/license-recovery'
  );
} catch (error) {
  console.error(
    '[ROUTE ERROR] License Recovery route failed to mount:',
    error.message
  );
}
app.use((req, res) => {
  return res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    errorCode: 'ROUTE_NOT_FOUND',
    data: null,
    meta: null,
    timestamp: new Date().toISOString(),
    requestId: req.requestId,
    correlationId: req.correlationId || req.requestId
  });
});

/**
 * Global error handler.
 */
app.use((error, req, res, next) => {
  console.error('[GLOBAL_ERROR_HANDLER]', {
    message: error.message,
    code: error.code,
    detail: error.detail,
    constraint: error.constraint,
    table: error.table,
    column: error.column,
    schema: error.schema,
    stack: error.stack,
    requestId: req.requestId,
    correlationId: req.correlationId,
    method: req.method,
    url: req.originalUrl,
    origin: req.headers.origin || null
  });

  const statusCode =
    error.statusCode ||
    error.status ||
    (error.code === '23505' ? 409 : null) ||
    (error.code === '23503' ? 400 : null) ||
    (error.code === '23514' ? 400 : null) ||
    500;

  const isProduction = NODE_ENV === 'production';

  return res.status(statusCode).json({
    success: false,
    message:
      statusCode >= 500
        ? 'Internal server error'
        : error.message || 'Request failed',
    errorCode: error.code || error.errorCode || 'SYSTEM_ERROR',
    data: null,
    meta: null,
    timestamp: new Date().toISOString(),
    requestId: req.requestId,
    correlationId: req.correlationId || req.requestId,
    debug: isProduction
      ? undefined
      : {
          message: error.message,
          code: error.code,
          detail: error.detail,
          constraint: error.constraint,
          table: error.table,
          column: error.column,
          schema: error.schema
        }
  });
});

/**
 * Start server.
 */
const server = app.listen(PORT, HOST, () => {
  console.log('======================================================');
  console.log(`${SERVICE_NAME} started successfully`);
  console.log(`Environment: ${NODE_ENV}`);
  console.log(`Listening: http://${HOST}:${PORT}`);
  console.log(`Health: http://${HOST}:${PORT}/api/v1/health`);
  console.log(`Government Transactions: http://${HOST}:${PORT}/api/v1/government-blockchain/transactions`);
  console.log(`Government Transaction Services: http://${HOST}:${PORT}/api/v1/government-blockchain/transactions/services`);
  console.log(`Resident Search: http://${HOST}:${PORT}/api/v1/government-blockchain/transactions/residents/search`);
  console.log(`Allowed CORS Origins: ${allowedOrigins.join(', ')}`);
  console.log('======================================================');
});

/**
 * Graceful shutdown.
 */
function shutdown(signal) {
  console.log(`[SERVER_SHUTDOWN] Received ${signal}. Closing server...`);

  server.close(() => {
    console.log('[SERVER_SHUTDOWN] HTTP server closed.');
    process.exit(0);
  });

  setTimeout(() => {
    console.error('[SERVER_SHUTDOWN] Forced shutdown after timeout.');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

module.exports = app;
