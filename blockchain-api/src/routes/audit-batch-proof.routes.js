const express = require('express');
const controller = require('../controllers/audit-batch-proof.controller');

const router = express.Router();

router.get('/health', controller.health);
router.get('/summary', controller.summary);
router.get('/batches', controller.listBatches);
router.post('/batches', controller.createBatch);
router.get('/batches/:batchIdOrKey', controller.getBatch);
router.post('/batches/:batchIdOrKey/submit', controller.submitBatch);
router.post('/batches/:batchIdOrKey/verify', controller.verifyBatchProof);
router.post('/batches/:batchIdOrKey/items/:auditId/verify', controller.verifyBatchItem);
router.get('/fabric/:batchIdOrKey', controller.getFabricBatchProof);

module.exports = router;
