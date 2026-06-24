const express = require('express');

const {
  healthCheck,
  previewSourceRecords,
  detectCreateRecords,
  createValidationRun
} = require('../controllers/blockchain-proof-history-sync.controller');

const router = express.Router();

router.get('/health', healthCheck);
router.get('/source/:recordType/preview', previewSourceRecords);
router.get('/source/:recordType/detect-create', detectCreateRecords);
router.post('/runs/test/:recordType', createValidationRun);

module.exports = router;
