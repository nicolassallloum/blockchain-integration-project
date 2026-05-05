🔹 STEP 29 — Audit Logging & Traceability
Blockchain Integration Project
Role: Audit and Compliance Engineer
Objective: Build a complete audit logging and traceability layer across the Blockchain API Middleware, PostgreSQL, Hyperledger Fabric calls, and future Spring Boot integration requests.
This step will allow you to trace:


Every API request


Wallet creation


Wallet login


Blockchain submit/evaluate calls


Successful transactions


Failed transactions


System errors


Requests coming from Spring Boot


Full request lifecycle using requestId / correlationId



1. Audit Logging Design
1.1 Traceability Strategy
Every request should have:
FieldPurposerequest_idUnique ID for each API requestcorrelation_idShared ID across Spring Boot → Node.js → Fabric → PostgreSQLsource_systemCaller system such as SPRING_BOOT, BLOCKCHAIN_API, CURL, POSTMANevent_typeType of event: wallet creation, login, transaction, errorevent_statusSUCCESS, FAILED, ERROR, PENDINGcustomer_idCustomer involved, when availablewallet_addressWallet involved, when availabletransaction_idOff-chain transaction ID, when availablefabric_tx_idHyperledger Fabric transaction ID, when availablehttp_methodAPI methodendpointAPI endpointip_addressClient IPuser_agentClient device/clientrequest_payloadMasked request bodyresponse_payloadMasked response bodyerror_messageError details, when failedcreated_atAudit event timestamp

2. PostgreSQL Audit Table
Create this file:
nano /home/nix/u01/blockchain-integration/postgresql/step-29-audit-logging.sql
Paste:
-- ============================================================-- STEP 29 — Audit Logging & Traceability-- Blockchain Integration Project-- PostgreSQL Audit Table-- ============================================================BEGIN;CREATE SCHEMA IF NOT EXISTS blockchain;CREATE TABLE IF NOT EXISTS blockchain.blockchain_audit_log (    audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),    request_id VARCHAR(100),    correlation_id VARCHAR(100),    event_type VARCHAR(100) NOT NULL,    event_category VARCHAR(100),    event_status VARCHAR(30) NOT NULL,    source_system VARCHAR(100),    request_source VARCHAR(100),    http_method VARCHAR(20),    endpoint TEXT,    controller_name VARCHAR(150),    service_name VARCHAR(150),    customer_id VARCHAR(100),    organization_id UUID,    organization_code VARCHAR(100),    wallet_address VARCHAR(150),    transaction_id UUID,    fabric_tx_id VARCHAR(150),    blockchain_function VARCHAR(150),    chaincode_name VARCHAR(150),    channel_name VARCHAR(150),    ip_address VARCHAR(100),    user_agent TEXT,    request_payload JSONB,    response_payload JSONB,    metadata JSONB,    error_code VARCHAR(100),    error_message TEXT,    error_stack TEXT,    duration_ms INTEGER,    created_by VARCHAR(100),    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());CREATE INDEX IF NOT EXISTS idx_audit_request_idON blockchain.blockchain_audit_log (request_id);CREATE INDEX IF NOT EXISTS idx_audit_correlation_idON blockchain.blockchain_audit_log (correlation_id);CREATE INDEX IF NOT EXISTS idx_audit_event_typeON blockchain.blockchain_audit_log (event_type);CREATE INDEX IF NOT EXISTS idx_audit_event_statusON blockchain.blockchain_audit_log (event_status);CREATE INDEX IF NOT EXISTS idx_audit_customer_idON blockchain.blockchain_audit_log (customer_id);CREATE INDEX IF NOT EXISTS idx_audit_wallet_addressON blockchain.blockchain_audit_log (wallet_address);CREATE INDEX IF NOT EXISTS idx_audit_transaction_idON blockchain.blockchain_audit_log (transaction_id);CREATE INDEX IF NOT EXISTS idx_audit_fabric_tx_idON blockchain.blockchain_audit_log (fabric_tx_id);CREATE INDEX IF NOT EXISTS idx_audit_created_atON blockchain.blockchain_audit_log (created_at DESC);CREATE INDEX IF NOT EXISTS idx_audit_event_status_created_atON blockchain.blockchain_audit_log (event_status, created_at DESC);CREATE INDEX IF NOT EXISTS idx_audit_source_system_created_atON blockchain.blockchain_audit_log (source_system, created_at DESC);COMMIT;
Run:
psql -h 172.31.13.133 -p 5444 -U postgres -d vfds_dev \-f /home/nix/u01/blockchain-integration/postgresql/step-29-audit-logging.sql
Validate:
psql -h 172.31.13.133 -p 5444 -U postgres -d vfds_dev -c "\d blockchain.blockchain_audit_log"

3. Event Types Standard
Use these event types in the Node.js API.
const AUDIT_EVENT_TYPES = {  API_REQUEST: 'API_REQUEST',  API_RESPONSE: 'API_RESPONSE',  WALLET_CREATE_REQUEST: 'WALLET_CREATE_REQUEST',  WALLET_CREATE_SUCCESS: 'WALLET_CREATE_SUCCESS',  WALLET_CREATE_FAILED: 'WALLET_CREATE_FAILED',  WALLET_LOGIN_REQUEST: 'WALLET_LOGIN_REQUEST',  WALLET_LOGIN_SUCCESS: 'WALLET_LOGIN_SUCCESS',  WALLET_LOGIN_FAILED: 'WALLET_LOGIN_FAILED',  BLOCKCHAIN_SUBMIT_REQUEST: 'BLOCKCHAIN_SUBMIT_REQUEST',  BLOCKCHAIN_SUBMIT_SUCCESS: 'BLOCKCHAIN_SUBMIT_SUCCESS',  BLOCKCHAIN_SUBMIT_FAILED: 'BLOCKCHAIN_SUBMIT_FAILED',  BLOCKCHAIN_EVALUATE_REQUEST: 'BLOCKCHAIN_EVALUATE_REQUEST',  BLOCKCHAIN_EVALUATE_SUCCESS: 'BLOCKCHAIN_EVALUATE_SUCCESS',  BLOCKCHAIN_EVALUATE_FAILED: 'BLOCKCHAIN_EVALUATE_FAILED',  TRANSACTION_REQUEST: 'TRANSACTION_REQUEST',  TRANSACTION_SUCCESS: 'TRANSACTION_SUCCESS',  TRANSACTION_FAILED: 'TRANSACTION_FAILED',  SPRING_BOOT_REQUEST: 'SPRING_BOOT_REQUEST',  SPRING_BOOT_RESPONSE: 'SPRING_BOOT_RESPONSE',  SYSTEM_ERROR: 'SYSTEM_ERROR'};module.exports = AUDIT_EVENT_TYPES;

4. Add Audit Event Constants
Create:
nano src/constants/audit.constants.js
Paste:
'use strict';const AUDIT_EVENT_TYPES = {  API_REQUEST: 'API_REQUEST',  API_RESPONSE: 'API_RESPONSE',  WALLET_CREATE_REQUEST: 'WALLET_CREATE_REQUEST',  WALLET_CREATE_SUCCESS: 'WALLET_CREATE_SUCCESS',  WALLET_CREATE_FAILED: 'WALLET_CREATE_FAILED',  WALLET_LOGIN_REQUEST: 'WALLET_LOGIN_REQUEST',  WALLET_LOGIN_SUCCESS: 'WALLET_LOGIN_SUCCESS',  WALLET_LOGIN_FAILED: 'WALLET_LOGIN_FAILED',  BLOCKCHAIN_SUBMIT_REQUEST: 'BLOCKCHAIN_SUBMIT_REQUEST',  BLOCKCHAIN_SUBMIT_SUCCESS: 'BLOCKCHAIN_SUBMIT_SUCCESS',  BLOCKCHAIN_SUBMIT_FAILED: 'BLOCKCHAIN_SUBMIT_FAILED',  BLOCKCHAIN_EVALUATE_REQUEST: 'BLOCKCHAIN_EVALUATE_REQUEST',  BLOCKCHAIN_EVALUATE_SUCCESS: 'BLOCKCHAIN_EVALUATE_SUCCESS',  BLOCKCHAIN_EVALUATE_FAILED: 'BLOCKCHAIN_EVALUATE_FAILED',  TRANSACTION_REQUEST: 'TRANSACTION_REQUEST',  TRANSACTION_SUCCESS: 'TRANSACTION_SUCCESS',  TRANSACTION_FAILED: 'TRANSACTION_FAILED',  SPRING_BOOT_REQUEST: 'SPRING_BOOT_REQUEST',  SPRING_BOOT_RESPONSE: 'SPRING_BOOT_RESPONSE',  SYSTEM_ERROR: 'SYSTEM_ERROR'};const AUDIT_EVENT_STATUS = {  SUCCESS: 'SUCCESS',  FAILED: 'FAILED',  ERROR: 'ERROR',  PENDING: 'PENDING'};const AUDIT_EVENT_CATEGORY = {  API: 'API',  WALLET: 'WALLET',  AUTHENTICATION: 'AUTHENTICATION',  BLOCKCHAIN: 'BLOCKCHAIN',  TRANSACTION: 'TRANSACTION',  INTEGRATION: 'INTEGRATION',  SYSTEM: 'SYSTEM'};module.exports = {  AUDIT_EVENT_TYPES,  AUDIT_EVENT_STATUS,  AUDIT_EVENT_CATEGORY};

5. Request ID / Correlation ID Middleware
Create:
nano src/middleware/requestId.middleware.js
Paste:
'use strict';const crypto = require('crypto');function generateRequestId() {  return `REQ_${crypto.randomBytes(12).toString('hex').toUpperCase()}`;}function requestIdMiddleware(req, res, next) {  const incomingRequestId =    req.headers['x-request-id'] ||    req.headers['x-correlation-id'] ||    null;  const incomingCorrelationId =    req.headers['x-correlation-id'] ||    incomingRequestId ||    null;  const requestId = incomingRequestId || generateRequestId();  const correlationId = incomingCorrelationId || requestId;  req.requestId = requestId;  req.correlationId = correlationId;  req.sourceSystem =    req.headers['x-source-system'] ||    req.body?.sourceSystem ||    'BLOCKCHAIN_API';  req.requestSource =    req.headers['x-request-source'] ||    req.body?.requestSource ||    'API';  req.requestStartTime = Date.now();  res.setHeader('x-request-id', requestId);  res.setHeader('x-correlation-id', correlationId);  next();}module.exports = requestIdMiddleware;

6. Node.js Audit Service
Create:
nano src/services/audit.service.js
Paste:
'use strict';const db = require('../config/database');function safeJson(value) {  if (!value) return null;  try {    return JSON.parse(JSON.stringify(value));  } catch (error) {    return {      warning: 'Unable to serialize payload',      message: error.message    };  }}function maskSensitiveData(payload) {  if (!payload || typeof payload !== 'object') {    return payload || null;  }  const cloned = safeJson(payload);  const sensitiveFields = [    'password',    'passwordHash',    'token',    'accessToken',    'refreshToken',    'authorization',    'apiKey',    'x-api-key',    'secret',    'privateKey',    'mnemonic',    'recoveryWords',    'otp'  ];  function maskObject(obj) {    if (!obj || typeof obj !== 'object') return;    Object.keys(obj).forEach((key) => {      const lowerKey = key.toLowerCase();      if (sensitiveFields.some((field) => lowerKey.includes(field.toLowerCase()))) {        obj[key] = '***MASKED***';      } else if (typeof obj[key] === 'object') {        maskObject(obj[key]);      }    });  }  maskObject(cloned);  return cloned;}class AuditService {  async log(event = {}) {    try {      const query = `        INSERT INTO blockchain.blockchain_audit_log (          request_id,          correlation_id,          event_type,          event_category,          event_status,          source_system,          request_source,          http_method,          endpoint,          controller_name,          service_name,          customer_id,          organization_id,          organization_code,          wallet_address,          transaction_id,          fabric_tx_id,          blockchain_function,          chaincode_name,          channel_name,          ip_address,          user_agent,          request_payload,          response_payload,          metadata,          error_code,          error_message,          error_stack,          duration_ms,          created_by        )        VALUES (          $1, $2, $3, $4, $5,          $6, $7, $8, $9, $10,          $11, $12, $13, $14, $15,          $16, $17, $18, $19, $20,          $21, $22, $23, $24, $25,          $26, $27, $28, $29, $30        )        RETURNING audit_id, created_at      `;      const values = [        event.requestId || event.request_id || null,        event.correlationId || event.correlation_id || null,        event.eventType || event.event_type,        event.eventCategory || event.event_category || null,        event.eventStatus || event.event_status,        event.sourceSystem || event.source_system || null,        event.requestSource || event.request_source || null,        event.httpMethod || event.http_method || null,        event.endpoint || null,        event.controllerName || event.controller_name || null,        event.serviceName || event.service_name || null,        event.customerId || event.customer_id || null,        event.organizationId || event.organization_id || null,        event.organizationCode || event.organization_code || null,        event.walletAddress || event.wallet_address || null,        event.transactionId || event.transaction_id || null,        event.fabricTxId || event.fabric_tx_id || null,        event.blockchainFunction || event.blockchain_function || null,        event.chaincodeName || event.chaincode_name || process.env.FABRIC_CHAINCODE_NAME || null,        event.channelName || event.channel_name || process.env.FABRIC_CHANNEL_NAME || null,        event.ipAddress || event.ip_address || null,        event.userAgent || event.user_agent || null,        maskSensitiveData(event.requestPayload || event.request_payload || null),        maskSensitiveData(event.responsePayload || event.response_payload || null),        safeJson(event.metadata || null),        event.errorCode || event.error_code || null,        event.errorMessage || event.error_message || null,        event.errorStack || event.error_stack || null,        event.durationMs || event.duration_ms || null,        event.createdBy || event.created_by || null      ];      const result = await db.query(query, values);      return {        success: true,        auditId: result.rows[0]?.audit_id,        createdAt: result.rows[0]?.created_at      };    } catch (error) {      console.error('Audit log insert failed:', {        message: error.message,        stack: error.stack      });      return {        success: false,        message: error.message      };    }  }  buildRequestContext(req) {    return {      requestId: req.requestId,      correlationId: req.correlationId,      sourceSystem: req.sourceSystem,      requestSource: req.requestSource,      httpMethod: req.method,      endpoint: req.originalUrl,      ipAddress:        req.headers['x-forwarded-for'] ||        req.socket?.remoteAddress ||        req.ip ||        null,      userAgent: req.headers['user-agent'] || null,      createdBy: req.user?.username || req.body?.createdBy || 'system'    };  }}module.exports = new AuditService();

7. API Request Audit Middleware
Create:
nano src/middleware/auditRequest.middleware.js
Paste:
'use strict';const auditService = require('../services/audit.service');const {  AUDIT_EVENT_TYPES,  AUDIT_EVENT_STATUS,  AUDIT_EVENT_CATEGORY} = require('../constants/audit.constants');async function auditRequestMiddleware(req, res, next) {  const requestContext = auditService.buildRequestContext(req);  await auditService.log({    ...requestContext,    eventType: AUDIT_EVENT_TYPES.API_REQUEST,    eventCategory: AUDIT_EVENT_CATEGORY.API,    eventStatus: AUDIT_EVENT_STATUS.PENDING,    requestPayload: req.body || null,    metadata: {      query: req.query || null,      params: req.params || null    }  });  const originalJson = res.json;  res.json = function patchedJson(body) {    const durationMs = Date.now() - req.requestStartTime;    auditService.log({      ...requestContext,      eventType: AUDIT_EVENT_TYPES.API_RESPONSE,      eventCategory: AUDIT_EVENT_CATEGORY.API,      eventStatus: res.statusCode >= 400        ? AUDIT_EVENT_STATUS.FAILED        : AUDIT_EVENT_STATUS.SUCCESS,      responsePayload: body,      durationMs,      metadata: {        statusCode: res.statusCode      }    }).catch((error) => {      console.error('API response audit failed:', error.message);    });    return originalJson.call(this, body);  };  next();}module.exports = auditRequestMiddleware;

8. Register Middleware in server.js or app.js
Open your main server file:
nano src/server.js
Add imports near the top:
const requestIdMiddleware = require('./middleware/requestId.middleware');const auditRequestMiddleware = require('./middleware/auditRequest.middleware');
Then register them after JSON parser and before routes:
app.use(express.json({ limit: '10mb' }));app.use(requestIdMiddleware);app.use(auditRequestMiddleware);
Correct order:
app.use(express.json({ limit: '10mb' }));app.use(requestIdMiddleware);app.use(auditRequestMiddleware);app.use('/api/v1', routes);

9. Add Audit Logging to Wallet Creation
Open:
nano src/controllers/wallet.controller.js
Add imports:
const auditService = require('../services/audit.service');const {  AUDIT_EVENT_TYPES,  AUDIT_EVENT_STATUS,  AUDIT_EVENT_CATEGORY} = require('../constants/audit.constants');
Inside wallet creation function, before processing:
await auditService.log({  ...auditService.buildRequestContext(req),  eventType: AUDIT_EVENT_TYPES.WALLET_CREATE_REQUEST,  eventCategory: AUDIT_EVENT_CATEGORY.WALLET,  eventStatus: AUDIT_EVENT_STATUS.PENDING,  customerId: req.body.customerId,  organizationCode: req.body.organizationId,  requestPayload: req.body,  controllerName: 'wallet.controller',  serviceName: 'wallet.service'});
On success:
await auditService.log({  ...auditService.buildRequestContext(req),  eventType: AUDIT_EVENT_TYPES.WALLET_CREATE_SUCCESS,  eventCategory: AUDIT_EVENT_CATEGORY.WALLET,  eventStatus: AUDIT_EVENT_STATUS.SUCCESS,  customerId: result?.data?.wallet?.customerId || req.body.customerId,  organizationId: result?.data?.wallet?.organizationId || null,  organizationCode: result?.data?.wallet?.organizationCode || req.body.organizationId,  walletAddress: result?.data?.wallet?.walletAddress || null,  fabricTxId: result?.data?.fabricTxId || null,  responsePayload: result,  controllerName: 'wallet.controller',  serviceName: 'wallet.service'});
On failure/catch:
await auditService.log({  ...auditService.buildRequestContext(req),  eventType: AUDIT_EVENT_TYPES.WALLET_CREATE_FAILED,  eventCategory: AUDIT_EVENT_CATEGORY.WALLET,  eventStatus: AUDIT_EVENT_STATUS.FAILED,  customerId: req.body.customerId,  organizationCode: req.body.organizationId,  errorCode: error.code || 'WALLET_CREATE_ERROR',  errorMessage: error.message,  errorStack: error.stack,  requestPayload: req.body,  controllerName: 'wallet.controller',  serviceName: 'wallet.service'});

10. Add Audit Logging to Wallet Login
In wallet.controller.js, inside login endpoint:
Before login validation:
await auditService.log({  ...auditService.buildRequestContext(req),  eventType: AUDIT_EVENT_TYPES.WALLET_LOGIN_REQUEST,  eventCategory: AUDIT_EVENT_CATEGORY.AUTHENTICATION,  eventStatus: AUDIT_EVENT_STATUS.PENDING,  customerId: req.body.customerId,  requestPayload: req.body,  controllerName: 'wallet.controller',  serviceName: 'wallet.service'});
On successful login:
await auditService.log({  ...auditService.buildRequestContext(req),  eventType: AUDIT_EVENT_TYPES.WALLET_LOGIN_SUCCESS,  eventCategory: AUDIT_EVENT_CATEGORY.AUTHENTICATION,  eventStatus: AUDIT_EVENT_STATUS.SUCCESS,  customerId: result?.data?.customerId || req.body.customerId,  walletAddress: result?.data?.walletAddress || null,  responsePayload: {    success: true,    message: 'Wallet login successful',    token: '***MASKED***'  },  controllerName: 'wallet.controller',  serviceName: 'wallet.service'});
On failed login:
await auditService.log({  ...auditService.buildRequestContext(req),  eventType: AUDIT_EVENT_TYPES.WALLET_LOGIN_FAILED,  eventCategory: AUDIT_EVENT_CATEGORY.AUTHENTICATION,  eventStatus: AUDIT_EVENT_STATUS.FAILED,  customerId: req.body.customerId,  errorCode: 'INVALID_CREDENTIALS',  errorMessage: 'Invalid wallet login credentials',  requestPayload: req.body,  controllerName: 'wallet.controller',  serviceName: 'wallet.service'});

11. Add Audit Logging to Fabric Submit/Evaluate
Open:
nano src/services/fabric.service.js
Add imports:
const auditService = require('./audit.service');const {  AUDIT_EVENT_TYPES,  AUDIT_EVENT_STATUS,  AUDIT_EVENT_CATEGORY} = require('../constants/audit.constants');
Inside submitTransaction(functionName, args = [], context = {}):
At start:
await auditService.log({  requestId: context.requestId || null,  correlationId: context.correlationId || null,  eventType: AUDIT_EVENT_TYPES.BLOCKCHAIN_SUBMIT_REQUEST,  eventCategory: AUDIT_EVENT_CATEGORY.BLOCKCHAIN,  eventStatus: AUDIT_EVENT_STATUS.PENDING,  sourceSystem: context.sourceSystem || 'BLOCKCHAIN_API',  requestSource: context.requestSource || 'API',  blockchainFunction: functionName,  chaincodeName: process.env.FABRIC_CHAINCODE_NAME,  channelName: process.env.FABRIC_CHANNEL_NAME,  requestPayload: {    functionName,    args  },  serviceName: 'fabric.service'});
On success:
await auditService.log({  requestId: context.requestId || null,  correlationId: context.correlationId || null,  eventType: AUDIT_EVENT_TYPES.BLOCKCHAIN_SUBMIT_SUCCESS,  eventCategory: AUDIT_EVENT_CATEGORY.BLOCKCHAIN,  eventStatus: AUDIT_EVENT_STATUS.SUCCESS,  sourceSystem: context.sourceSystem || 'BLOCKCHAIN_API',  requestSource: context.requestSource || 'API',  blockchainFunction: functionName,  fabricTxId: result?.transactionId || result?.txId || null,  chaincodeName: process.env.FABRIC_CHAINCODE_NAME,  channelName: process.env.FABRIC_CHANNEL_NAME,  responsePayload: result,  serviceName: 'fabric.service'});
On failure:
await auditService.log({  requestId: context.requestId || null,  correlationId: context.correlationId || null,  eventType: AUDIT_EVENT_TYPES.BLOCKCHAIN_SUBMIT_FAILED,  eventCategory: AUDIT_EVENT_CATEGORY.BLOCKCHAIN,  eventStatus: AUDIT_EVENT_STATUS.FAILED,  sourceSystem: context.sourceSystem || 'BLOCKCHAIN_API',  requestSource: context.requestSource || 'API',  blockchainFunction: functionName,  chaincodeName: process.env.FABRIC_CHAINCODE_NAME,  channelName: process.env.FABRIC_CHANNEL_NAME,  errorCode: error.code || 'FABRIC_SUBMIT_ERROR',  errorMessage: error.message,  errorStack: error.stack,  requestPayload: {    functionName,    args  },  serviceName: 'fabric.service'});

12. Important Update: Pass Request Context to Fabric Service
Wherever you call Fabric submit/evaluate from controllers or services, pass this object:
const fabricContext = {  requestId: req.requestId,  correlationId: req.correlationId,  sourceSystem: req.sourceSystem,  requestSource: req.requestSource};
Example:
const fabricResult = await fabricService.submitTransaction(  'CreateWallet',  args,  fabricContext);
For evaluate:
const fabricResult = await fabricService.evaluateTransaction(  'GetWalletByCustomerId',  args,  fabricContext);

13. Add Audit Logging to Transactions
Open:
nano src/controllers/transaction.controller.js
Add imports if not already:
const auditService = require('../services/audit.service');const {  AUDIT_EVENT_TYPES,  AUDIT_EVENT_STATUS,  AUDIT_EVENT_CATEGORY} = require('../constants/audit.constants');
Before wallet transfer or organization transfer:
await auditService.log({  ...auditService.buildRequestContext(req),  eventType: AUDIT_EVENT_TYPES.TRANSACTION_REQUEST,  eventCategory: AUDIT_EVENT_CATEGORY.TRANSACTION,  eventStatus: AUDIT_EVENT_STATUS.PENDING,  walletAddress: req.body.senderWalletAddress || req.body.fromWalletAddress || null,  requestPayload: req.body,  controllerName: 'transaction.controller',  serviceName: 'transaction.service'});
On success:
await auditService.log({  ...auditService.buildRequestContext(req),  eventType: AUDIT_EVENT_TYPES.TRANSACTION_SUCCESS,  eventCategory: AUDIT_EVENT_CATEGORY.TRANSACTION,  eventStatus: AUDIT_EVENT_STATUS.SUCCESS,  transactionId: result?.data?.transactionId || null,  fabricTxId: result?.data?.fabricTxId || null,  walletAddress: req.body.senderWalletAddress || req.body.fromWalletAddress || null,  responsePayload: result,  controllerName: 'transaction.controller',  serviceName: 'transaction.service'});
On failure:
await auditService.log({  ...auditService.buildRequestContext(req),  eventType: AUDIT_EVENT_TYPES.TRANSACTION_FAILED,  eventCategory: AUDIT_EVENT_CATEGORY.TRANSACTION,  eventStatus: AUDIT_EVENT_STATUS.FAILED,  walletAddress: req.body.senderWalletAddress || req.body.fromWalletAddress || null,  errorCode: error.code || 'TRANSACTION_ERROR',  errorMessage: error.message,  errorStack: error.stack,  requestPayload: req.body,  controllerName: 'transaction.controller',  serviceName: 'transaction.service'});

14. Add Global System Error Audit Logging
Open your error middleware file, for example:
nano src/middleware/error.middleware.js
Add:
const auditService = require('../services/audit.service');const {  AUDIT_EVENT_TYPES,  AUDIT_EVENT_STATUS,  AUDIT_EVENT_CATEGORY} = require('../constants/audit.constants');
Inside the error handler:
await auditService.log({  ...auditService.buildRequestContext(req),  eventType: AUDIT_EVENT_TYPES.SYSTEM_ERROR,  eventCategory: AUDIT_EVENT_CATEGORY.SYSTEM,  eventStatus: AUDIT_EVENT_STATUS.ERROR,  errorCode: err.code || 'SYSTEM_ERROR',  errorMessage: err.message,  errorStack: err.stack,  requestPayload: req.body || null,  metadata: {    params: req.params || null,    query: req.query || null,    statusCode: err.statusCode || 500  }});

15. Spring Boot Integration Request Strategy
When Spring Boot calls Node.js Blockchain API, Spring Boot should send these headers:
Content-Type: application/jsonx-request-id: REQ_SPRING_20260505_000001x-correlation-id: CORR_CUSTOMER_CUST2017_20260505_000001x-source-system: SPRING_BOOTx-request-source: CORE_BANKING_PORTALx-api-key: <service-api-key>
Example Spring Boot → Node.js wallet creation request:
curl -X POST http://127.0.0.1:3001/api/v1/wallets \-H "Content-Type: application/json" \-H "x-request-id: REQ_SPRING_WALLET_CREATE_001" \-H "x-correlation-id: CORR_CUST2017_WALLET_CREATE_001" \-H "x-source-system: SPRING_BOOT" \-H "x-request-source: CORE_BANKING_PORTAL" \-H "x-api-key: YOUR_SERVICE_API_KEY" \-d '{  "customerId": "CUST2017",  "organizationId": "BANK001",  "fullName": "Nicolas Salloum",  "nationalIdHash": "NID_HASH_2017",  "mobileHash": "MOBILE_HASH_2017",  "emailHash": "EMAIL_HASH_2017",  "passwordHash": "PASSWORD_HASH_2017",  "initialBalance": "1000",  "sourceSystem": "SPRING_BOOT",  "requestSource": "CORE_BANKING_PORTAL",  "createdBy": "spring-boot-service"}'

16. Example Audit Logs
16.1 Wallet Creation Request
{  "request_id": "REQ_SPRING_WALLET_CREATE_001",  "correlation_id": "CORR_CUST2017_WALLET_CREATE_001",  "event_type": "WALLET_CREATE_REQUEST",  "event_category": "WALLET",  "event_status": "PENDING",  "source_system": "SPRING_BOOT",  "request_source": "CORE_BANKING_PORTAL",  "customer_id": "CUST2017",  "organization_code": "BANK001",  "endpoint": "/api/v1/wallets",  "http_method": "POST"}
16.2 Wallet Creation Success
{  "request_id": "REQ_SPRING_WALLET_CREATE_001",  "correlation_id": "CORR_CUST2017_WALLET_CREATE_001",  "event_type": "WALLET_CREATE_SUCCESS",  "event_category": "WALLET",  "event_status": "SUCCESS",  "customer_id": "CUST2017",  "wallet_address": "WALLET_AEE7B53C59079B041CD63472",  "fabric_tx_id": "7345333a96586858bb5a4972f00df564"}
16.3 Failed Blockchain Submission
{  "request_id": "REQ_STEP_29_TEST_001",  "correlation_id": "REQ_STEP_29_TEST_001",  "event_type": "BLOCKCHAIN_SUBMIT_FAILED",  "event_category": "BLOCKCHAIN",  "event_status": "FAILED",  "blockchain_function": "CreateWallet",  "chaincode_name": "kyc-wallet-chaincode-js",  "channel_name": "kycchannelnix1",  "error_code": "FABRIC_SUBMIT_ERROR",  "error_message": "failed to collect enough transaction endorsements"}

17. Audit Report Queries
17.1 Last 50 Audit Events
SELECT    created_at,    event_type,    event_status,    request_id,    correlation_id,    source_system,    customer_id,    wallet_address,    error_messageFROM blockchain.blockchain_audit_logORDER BY created_at DESCLIMIT 50;

17.2 Trace Full Request Lifecycle by Request ID
SELECT    created_at,    event_type,    event_category,    event_status,    source_system,    request_source,    http_method,    endpoint,    customer_id,    wallet_address,    transaction_id,    fabric_tx_id,    blockchain_function,    error_message,    duration_msFROM blockchain.blockchain_audit_logWHERE request_id = 'REQ_STEP_29_TEST_001'ORDER BY created_at ASC;

17.3 Trace Full Business Flow by Correlation ID
SELECT    created_at,    event_type,    event_status,    source_system,    endpoint,    customer_id,    wallet_address,    transaction_id,    fabric_tx_id,    error_messageFROM blockchain.blockchain_audit_logWHERE correlation_id = 'CORR_CUST2017_WALLET_CREATE_001'ORDER BY created_at ASC;

17.4 Failed Transactions Report
SELECT    created_at,    request_id,    correlation_id,    customer_id,    wallet_address,    transaction_id,    event_type,    error_code,    error_messageFROM blockchain.blockchain_audit_logWHERE event_status IN ('FAILED', 'ERROR')  AND event_category = 'TRANSACTION'ORDER BY created_at DESC;

17.5 Failed Blockchain Submissions
SELECT    created_at,    request_id,    correlation_id,    blockchain_function,    chaincode_name,    channel_name,    fabric_tx_id,    error_code,    error_messageFROM blockchain.blockchain_audit_logWHERE event_type = 'BLOCKCHAIN_SUBMIT_FAILED'ORDER BY created_at DESC;

17.6 Successful Wallet Creations
SELECT    created_at,    request_id,    correlation_id,    customer_id,    organization_code,    wallet_address,    fabric_tx_id,    source_systemFROM blockchain.blockchain_audit_logWHERE event_type = 'WALLET_CREATE_SUCCESS'ORDER BY created_at DESC;

17.7 Wallet Login Attempts
SELECT    created_at,    request_id,    correlation_id,    customer_id,    event_status,    ip_address,    user_agent,    error_messageFROM blockchain.blockchain_audit_logWHERE event_type IN ('WALLET_LOGIN_REQUEST', 'WALLET_LOGIN_SUCCESS', 'WALLET_LOGIN_FAILED')ORDER BY created_at DESC;

17.8 Spring Boot Integration Requests
SELECT    created_at,    request_id,    correlation_id,    event_type,    event_status,    endpoint,    customer_id,    wallet_address,    transaction_id,    error_messageFROM blockchain.blockchain_audit_logWHERE source_system = 'SPRING_BOOT'ORDER BY created_at DESC;

17.9 Average API Duration by Endpoint
SELECT    endpoint,    COUNT(*) AS total_requests,    ROUND(AVG(duration_ms), 2) AS avg_duration_ms,    MAX(duration_ms) AS max_duration_ms,    MIN(duration_ms) AS min_duration_msFROM blockchain.blockchain_audit_logWHERE event_type = 'API_RESPONSE'  AND duration_ms IS NOT NULLGROUP BY endpointORDER BY avg_duration_ms DESC;

17.10 Daily Audit Summary
SELECT    DATE(created_at) AS audit_date,    event_category,    event_status,    COUNT(*) AS total_eventsFROM blockchain.blockchain_audit_logGROUP BY DATE(created_at), event_category, event_statusORDER BY audit_date DESC, event_category, event_status;

18. Test Commands
18.1 Test Wallet Query with Audit Headers
curl -X POST http://127.0.0.1:3001/api/v1/fabric/evaluate \-H "Content-Type: application/json" \-H "x-request-id: REQ_STEP_29_AUDIT_EVALUATE_TEST_001" \-H "x-correlation-id: CORR_STEP_29_AUDIT_EVALUATE_TEST_001" \-H "x-source-system: CURL" \-H "x-request-source: MANUAL_TEST" \-H "x-api-key: 774101c2e4e6e8d46a8bb6c02571f0239ac7c8bd548c22db1162671e502278f7" \-d '{  "functionName": "GetWalletByCustomerId",  "args": ["CUST2017"]}'

18.2 Test Wallet Login Audit
curl -X POST http://127.0.0.1:3001/api/v1/wallets/login \-H "Content-Type: application/json" \-H "x-request-id: REQ_STEP_29_WALLET_LOGIN_AUDIT_001" \-H "x-correlation-id: CORR_CUST2017_LOGIN_AUDIT_001" \-H "x-source-system: CURL" \-H "x-request-source: MANUAL_TEST" \-d '{  "customerId": "CUST2017",  "password": "password123"}'

18.3 Test Failed Login Audit
curl -X POST http://127.0.0.1:3001/api/v1/wallets/login \-H "Content-Type: application/json" \-H "x-request-id: REQ_STEP_29_WALLET_LOGIN_FAILED_AUDIT_001" \-H "x-correlation-id: CORR_CUST2017_LOGIN_FAILED_AUDIT_001" \-H "x-source-system: CURL" \-H "x-request-source: MANUAL_TEST" \-d '{  "customerId": "CUST2017",  "password": "wrong-password"}'

19. Validate Audit Records
psql -h 172.31.13.133 -p 5444 -U postgres -d vfds_dev
Then:
SELECT    created_at,    event_type,    event_status,    request_id,    correlation_id,    source_system,    endpoint,    customer_id,    wallet_address,    error_messageFROM blockchain.blockchain_audit_logORDER BY created_at DESCLIMIT 30;

20. Recommended Folder Structure After STEP 29
Your API should now include:
src/├── constants/│   └── audit.constants.js├── controllers/│   ├── wallet.controller.js│   ├── transaction.controller.js│   └── fabric.controller.js├── middleware/│   ├── requestId.middleware.js│   ├── auditRequest.middleware.js│   ├── error.middleware.js│   └── routeSecurity.middleware.js├── services/│   ├── audit.service.js│   ├── fabric.service.js│   ├── wallet.service.js│   └── transaction.service.js└── server.js

21. Validation Commands
Run syntax checks:
node -c src/constants/audit.constants.jsnode -c src/middleware/requestId.middleware.jsnode -c src/middleware/auditRequest.middleware.jsnode -c src/services/audit.service.jsnode -c src/server.js
Restart API:
pm2 restart blockchain-api
Or if using npm directly:
npm start
If port is already in use:
lsof -i :3001kill -9 <PID>npm start

22. Expected Result
After STEP 29, each request will create audit records like:
API_REQUESTAPI_RESPONSEWALLET_CREATE_REQUESTWALLET_CREATE_SUCCESS / WALLET_CREATE_FAILEDWALLET_LOGIN_REQUESTWALLET_LOGIN_SUCCESS / WALLET_LOGIN_FAILEDBLOCKCHAIN_SUBMIT_REQUESTBLOCKCHAIN_SUBMIT_SUCCESS / BLOCKCHAIN_SUBMIT_FAILEDTRANSACTION_REQUESTTRANSACTION_SUCCESS / TRANSACTION_FAILEDSYSTEM_ERROR
You will be able to trace the complete flow using:
request_idcorrelation_idcustomer_idwallet_addresstransaction_idfabric_tx_id

23. STEP 29 Completion Summary
Completed in this step


Created PostgreSQL audit table


Added indexes for reporting and traceability


Added Node.js audit service


Added request ID and correlation ID middleware


Added API request/response audit middleware


Added sensitive data masking


Added wallet creation audit strategy


Added wallet login audit strategy


Added blockchain submit/evaluate audit strategy


Added transaction audit strategy


Added system error audit strategy


Added Spring Boot integration traceability headers


Added audit report SQL queries


Added test curl commands


Status
STEP 29 — Audit Logging & Traceability: READY FOR IMPLEMENTATION