const express = require('express');

const controller = require('../controllers/blockchain-proof-api.controller');

const router = express.Router();
const historyController = require('../controllers/blockchain-proof-history.controller');
const verificationController = require('../controllers/blockchain-proof-verification.controller');

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

module.exports = router;
