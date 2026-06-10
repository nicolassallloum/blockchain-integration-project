'use strict';

const express = require('express');
const controller = require('../controllers/government-reports.controller');

const router = express.Router();

/**
 * GET /api/v1/government-blockchain/reports
 * Full dashboard payload for the Reports screen.
 */
router.get('/', controller.getDashboard);

/**
 * GET /api/v1/government-blockchain/reports/templates
 * Active report templates.
 */
router.get('/templates', controller.getTemplates);

/**
 * GET /api/v1/government-blockchain/reports/recent
 * Recent generated report records from PostgreSQL.
 */
router.get('/recent', controller.getRecentReports);

/**
 * GET /api/v1/government-blockchain/reports/:reportCode
 * Real operational data for one report card.
 */
router.get('/:reportCode', controller.getReportDetails);

/**
 * POST /api/v1/government-blockchain/reports/generate
 * Generate a report record and save it in blockchain.generated_reports.
 */
router.post('/generate', controller.generateReport);

module.exports = router;
