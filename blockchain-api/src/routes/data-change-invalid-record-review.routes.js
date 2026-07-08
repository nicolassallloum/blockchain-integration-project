const express = require('express');
const controller = require('../controllers/data-change-invalid-record-review.controller');

const router = express.Router();

router.get('/health', controller.health);
router.get('/summary', controller.summary);
router.get('/candidates', controller.candidates);
router.get('/reviews', controller.list);
router.get('/reviews/:reviewIdOrKey', controller.detail);
router.post('/reviews', controller.open);
router.post('/reviews/:reviewIdOrKey/approve-correction', controller.approveCorrection);
router.post('/reviews/:reviewIdOrKey/mark-new-proof-submitted', controller.markNewProofSubmitted);
router.post('/reviews/:reviewIdOrKey/reactivate', controller.reactivate);
router.post('/reviews/:reviewIdOrKey/reject', controller.rejectReactivation);
router.post('/reviews/:reviewIdOrKey/close', controller.close);

module.exports = router;
