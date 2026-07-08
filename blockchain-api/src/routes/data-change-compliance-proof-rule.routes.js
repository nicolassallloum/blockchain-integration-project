const express = require('express');
const controller = require('../controllers/data-change-compliance-proof-rule.controller');

const router = express.Router();

router.get('/health', controller.health);
router.get('/summary', controller.summary);
router.get('/rules', controller.rules);
router.get('/candidates', controller.candidates);
router.get('/evaluations', controller.evaluations);
router.post('/evaluate/:auditId', controller.evaluate);
router.post('/scan', controller.scan);

module.exports = router;
