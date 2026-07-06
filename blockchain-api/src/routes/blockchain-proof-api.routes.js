const express = require('express');

const controller = require('../controllers/blockchain-proof-api.controller');

const router = express.Router();
const historyController = require('../controllers/blockchain-proof-history.controller');
const verificationController = require('../controllers/blockchain-proof-verification.controller');
const amlHistoryController = require('../controllers/blockchain-proof-aml-history.controller');
const customerHistoryController = require('../controllers/blockchain-proof-customer-history.controller');
const amlCaseClosureHistoryController = require('../controllers/blockchain-proof-aml-case-closure-history.controller');
const transactionHistoryController = require('../controllers/blockchain-proof-transaction-history.controller');
const screeningHistoryController = require('../controllers/blockchain-proof-screening-history.controller');
const retryController = require('../controllers/blockchain-proof-retry.controller');
const verificationLogicController = require('../controllers/blockchain-proof-verification-logic.controller');
const genericVerificationController = require('../controllers/blockchain-proof-generic-verification.controller');
const dashboardController = require('../controllers/blockchain-proof-dashboard.controller');

router.get('/health', controller.health);

router.get('/records/:recordType/create-candidates', controller.createCandidates);
router.get('/records/:recordType/update-candidates', controller.updateCandidates);
router.get('/records/:recordType/unchanged', controller.unchangedRecords);

router.get('/records/:recordType/hash-preview', controller.hashPreview);
router.get('/records/:recordType/hash', controller.hashOne);

router.get('/records/:recordType/blockchain-key-preview', controller.blockchainKeyPreview);
router.get('/records/:recordType/blockchain-key', controller.blockchainKeyOne);

router.get('/records/:recordType/proof-only/preview', controller.proofOnlyPreview);
router.post('/records/:recordType/proof-only/submit', controller.proofOnlySubmit);

router.get('/history/:historyId/transaction-link', controller.transactionLink);
router.post('/history/:historyId/link-transaction', controller.linkTransaction);


/**
 * Step 16 — Blockchain proof history APIs
 * Read-only proof-history endpoints.
 */
router.get('/history/health', historyController.health);
router.get('/history/summary', historyController.summary);
router.get('/history', historyController.listHistory);
router.get('/history/:historyId', historyController.getHistoryById);
router.get('/records/:recordType/history/latest', historyController.getLatestRecordHistory);
router.get('/records/:recordType/history', historyController.listRecordHistory);


/**
 * Step 17 — Blockchain proof verification APIs
 * Read-only verification endpoints.
 * Live Fabric verification logic is reserved for Step 23.
 */
router.get('/verification/health', verificationController.health);
router.get('/verification/summary', verificationController.summary);
router.get('/verification/logs', verificationController.listLogs);
router.get('/verification/logs/:verificationId', verificationController.getLogById);
router.get('/records/:recordType/verification/preview', verificationController.preview);
router.get('/records/:recordType/verification/latest', verificationController.getLatestRecordLog);
router.get('/records/:recordType/verification/logs', verificationController.listRecordLogs);


/**
 * Step 18 — AML history first
 * Creates PostgreSQL history rows for AML proof records only.
 * Does not submit to Fabric.
 */
router.get('/records/AML/history/source-count', amlHistoryController.sourceCount);
router.get('/records/AML/history/preview', amlHistoryController.preview);
router.post('/records/AML/history/sync', amlHistoryController.sync);



/**
 * Step 11 — AML case closure history
 * Creates PostgreSQL history rows for AML_CASE_CLOSURE proof records and submits proof to Fabric.
 * Does not expose closure reason, investigation notes, full case description, or sensitive payloads.
 */
router.get('/records/AML_CASE_CLOSURE/history/source-discovery', amlCaseClosureHistoryController.sourceDiscovery);
router.get('/records/AML_CASE_CLOSURE/history/source-count', amlCaseClosureHistoryController.sourceCount);
router.get('/records/AML_CASE_CLOSURE/history/preview', amlCaseClosureHistoryController.preview);
router.post('/records/AML_CASE_CLOSURE/history/sync', amlCaseClosureHistoryController.sync);

/**
 * Step 19 — Customer data history
 * Creates PostgreSQL history rows for CUSTOMER proof records only.
 * Does not submit to Fabric.
 * Does not expose or store customer PII.
 */
router.get('/records/CUSTOMER/history/source-discovery', customerHistoryController.sourceDiscovery);
router.get('/records/CUSTOMER/history/source-count', customerHistoryController.sourceCount);
router.get('/records/CUSTOMER/history/preview', customerHistoryController.preview);
router.post('/records/CUSTOMER/history/sync', customerHistoryController.sync);


/**
 * Step 20 — Transaction data history
 * Creates PostgreSQL history rows for TRANSACTION proof records only.
 * Does not submit to Fabric.
 * Does not expose or store raw transaction payloads.
 */
router.get('/records/TRANSACTION/history/source-discovery', transactionHistoryController.sourceDiscovery);
router.get('/records/TRANSACTION/history/source-count', transactionHistoryController.sourceCount);
router.get('/records/TRANSACTION/history/preview', transactionHistoryController.preview);
router.post('/records/TRANSACTION/history/sync', transactionHistoryController.sync);


/**
 * Step 21 — Screening activity history
 * Creates PostgreSQL history rows for SCREENING_ACTIVITY proof records only.
 * Does not submit to Fabric.
 * Does not expose or store screening payloads, AML rule SQL, or match details.
 */
router.get('/records/SCREENING_ACTIVITY/history/source-discovery', screeningHistoryController.sourceDiscovery);
router.get('/records/SCREENING_ACTIVITY/history/source-count', screeningHistoryController.sourceCount);
router.get('/records/SCREENING_ACTIVITY/history/preview', screeningHistoryController.preview);
router.post('/records/SCREENING_ACTIVITY/history/sync', screeningHistoryController.sync);


/**
 * Step 22 — Retry mechanism
 * Retries proof-only blockchain submissions safely.
 * If no submit endpoint is configured, it records retry attempts only.
 * It never fakes blockchain success.
 */
router.get('/retry/health', retryController.health);
router.get('/retry/candidates', retryController.candidates);
router.post('/retry/run', retryController.run);


/**
 * Step 23 — Verification logic
 * Recomputes PostgreSQL source hash and writes verification logs.
 * Does not fake blockchain success when blockchain transaction ID is missing.
 */
router.get('/verification/logic/health', verificationLogicController.health);
router.get('/verification/candidates', verificationLogicController.candidates);
router.post('/verification/run', verificationLogicController.run);
router.post('/records/:recordType/verification/run', verificationLogicController.runRecord);


/**
 * Phase 17 — Generic blockchain verification APIs
 * Compares current PostgreSQL source hash with Hyperledger Fabric proof hash.
 */
router.post('/verification/by-module-record', genericVerificationController.verifyByModuleAndSourceRecordId);
router.post('/verification/by-blockchain-key', genericVerificationController.verifyByBlockchainKey);


/**
 * Step 24 — Dashboard APIs
 * Proof-safe operational metrics for blockchain proof integration.
 * Does not expose raw source rows or sensitive fields.
 */
router.get('/dashboard/health', dashboardController.health);
router.get('/dashboard/summary', dashboardController.summary);
router.get('/dashboard/record-types', dashboardController.recordTypes);
router.get('/dashboard/sync-status', dashboardController.syncStatus);
router.get('/dashboard/verification-status', dashboardController.verificationStatus);
router.get('/dashboard/retry-summary', dashboardController.retrySummary);
router.get('/dashboard/latest-runs', dashboardController.latestRuns);
router.get('/dashboard/latest-history', dashboardController.latestHistory);
router.get('/dashboard/latest-verification-logs', dashboardController.latestVerificationLogs);
router.get('/dashboard/full', dashboardController.full);

module.exports = router;
