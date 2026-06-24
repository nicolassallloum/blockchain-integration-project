const express = require('express');

const controller = require('../controllers/blockchain-proof-api.controller');

const router = express.Router();

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

module.exports = router;
