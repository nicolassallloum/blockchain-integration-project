const express = require('express');
const controller = require('../controllers/data-change-audit-dashboard.controller');

const router = express.Router();

/**
 * Phase 31 — Data Change Audit Dashboard APIs
 *
 * PostgreSQL remains the source of truth.
 * Blockchain stores proof only.
 * Old/new row details are redacted unless an approved audit role requests them.
 */

router.get('/health', controller.health);
router.get('/metrics', controller.metrics);
router.get('/events', controller.list);
router.get('/events/:auditId', controller.detail);
router.get('/dashboard', controller.dashboard);

module.exports = router;
