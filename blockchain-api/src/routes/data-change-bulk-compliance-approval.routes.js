const express = require('express');
const controller = require('../controllers/data-change-bulk-compliance-approval.controller');

const router = express.Router();

router.get('/health', controller.health);
router.get('/summary', controller.summary);
router.get('/candidates', controller.candidates);
router.get('/batches', controller.batches);
router.get('/batches/:batchIdOrKey', controller.batchDetail);
router.post('/batches', controller.create);
router.post('/batches/:batchIdOrKey/approve', controller.approve);
router.post('/batches/:batchIdOrKey/reject', controller.reject);

module.exports = router;
