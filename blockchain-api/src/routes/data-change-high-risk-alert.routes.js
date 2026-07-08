const express = require('express');
const controller = require('../controllers/data-change-high-risk-alert.controller');

const router = express.Router();

router.get('/health', controller.health);
router.get('/summary', controller.summary);
router.post('/scan', controller.scan);
router.get('/alerts', controller.list);
router.get('/alerts/:alertIdOrKey', controller.detail);
router.patch('/alerts/:alertIdOrKey/status', controller.updateStatus);

module.exports = router;
