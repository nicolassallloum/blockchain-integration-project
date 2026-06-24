const express = require('express');

const {
  healthCheck,
  previewSourceRecords,
  detectCreateRecords,
  detectUpdateRecords,
  detectUnchangedRecords,
  generateStableHash,
  validateStableHash,
  previewStableHashes,
  generateBlockchainKey,
  previewBlockchainKeys,
  validateBlockchainKey,
  getFabricSubmitDiagnostics,
  previewProofOnlyPayload,
  submitProofOnly,
  createValidationRun
} = require('../controllers/blockchain-proof-history-sync.controller');

const router = express.Router();

router.get('/health', healthCheck);
router.get('/source/:recordType/preview', previewSourceRecords);
router.get('/source/:recordType/detect-create', detectCreateRecords);
router.get('/source/:recordType/detect-update', detectUpdateRecords);
router.get('/source/:recordType/detect-unchanged', detectUnchangedRecords);
router.get('/source/:recordType/hash-preview', previewStableHashes);
router.get('/source/:recordType/hash/validate', validateStableHash);
router.get('/source/:recordType/hash', generateStableHash);
router.get('/source/:recordType/blockchain-key-preview', previewBlockchainKeys);
router.get('/source/:recordType/blockchain-key', generateBlockchainKey);
router.get('/blockchain-key/validate', validateBlockchainKey);
router.get('/fabric-submit/diagnostics', getFabricSubmitDiagnostics);
router.get('/source/:recordType/proof-only/preview', previewProofOnlyPayload);
router.post('/source/:recordType/proof-only/submit', submitProofOnly);
router.post('/runs/test/:recordType', createValidationRun);

module.exports = router;
