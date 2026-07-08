const express = require('express');
const controller = require('../controllers/audit-blockchain-proof.controller');

const router = express.Router();

router.get('/health', controller.health);
router.get('/summary', controller.summary);
router.get('/pending', controller.pending);
router.post('/submit-next', controller.submitNext);
router.post('/submit/:outboxId', controller.submitByOutboxId);
router.get('/fabric/:auditIdOrBlockchainKey', controller.getFabricProof);
router.post('/verify', controller.verifyFabricProof);

module.exports = router;
