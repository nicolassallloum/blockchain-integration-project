const express = require('express');

const {
  healthCheck,
  previewSourceRecords,
  createValidationRun
} = require('../controllers/blockchain-proof-history-sync.controller');

const router = express.Router();

router.get('/health', healthCheck);
router.get('/source/:recordType/preview', previewSourceRecords);
router.post('/runs/test/:recordType', createValidationRun);

module.exports = router;
