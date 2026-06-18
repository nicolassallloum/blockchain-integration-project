'use strict';

const express = require('express');
const db = require('../config/database');
const fabricService = require('../services/fabric.service');
const valooresAmlRulesSyncService = require('../services/valoores-aml-rules-sync.service');

const router = express.Router();

function successResponse(res, data, message = 'Request completed successfully.') {
  return res.status(200).json({
    success: true,
    message,
    data,
    timestamp: new Date().toISOString()
  });
}

function errorResponse(res, error, message = 'Valoores AML rules request failed.') {
  console.error('[VALOORES_AML_RULES_ERROR]', error);

  return res.status(500).json({
    success: false,
    message,
    error: error.message,
    timestamp: new Date().toISOString()
  });
}

function normalizeLimit(value, defaultLimit = 100, maxLimit = 1000) {
  const parsed = Number(value || defaultLimit);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return defaultLimit;
  }

  return Math.min(Math.floor(parsed), maxLimit);
}

function getAmlRulesSourceSql(limit) {
  return `
    SELECT
      "RULE ID"::text AS "RULE ID",
      "RULE DESC" AS "RULE DESC",
      "RULE STATUS"::text AS "RULE STATUS",
      "RULE START DATE"::text AS "RULE START DATE",
      "RULE EXPIRY DATE"::text AS "RULE EXPIRY DATE",
      "RULE CREATION DATE"::text AS "RULE CREATION DATE",
      "RULE CREATOR"::text AS "RULE CREATOR",
      "RULE UPDATE DATE"::text AS "RULE UPDATE DATE",
      "RULE UPDATOR"::text AS "RULE UPDATOR",
      "RULE MESSAGE" AS "RULE MESSAGE",
      "RULE QUERY ID"::text AS "RULE QUERY ID",
      "RULE SQL QUERY" AS "RULE SQL QUERY",
      "RULE QUERY CREATION DATE"::text AS "RULE QUERY CREATION DATE",
      "RULE QUERY CREATED BY"::text AS "RULE QUERY CREATED BY",
      "RULE APPLCIATION QUERY ID"::text AS "RULE APPLCIATION QUERY ID",
      "RULE QUERY UPDATE DATE"::text AS "RULE QUERY UPDATE DATE",
      "RULE QUERY UPDATE BY"::text AS "RULE QUERY UPDATE BY"
    FROM blockchain.valoores_aml_rules
    ORDER BY "RULE ID", "RULE QUERY ID"
    LIMIT ${limit};
  `;
}

function getRuleId(row) {
  return String(row['RULE ID'] || '').trim();
}

/**
 * GET /api/v1/government-blockchain/valoores-aml-rules/source?limit=100
 *
 * Reads directly from PostgreSQL view:
 * blockchain.valoores_aml_rules
 */
router.get('/source', async (req, res) => {
  try {
    const limit = normalizeLimit(req.query.limit, 100, 1000);
    const result = await db.query(getAmlRulesSourceSql(limit));

    return successResponse(
      res,
      {
        source: 'PostgreSQL',
        schema: 'blockchain',
        view: 'valoores_aml_rules',
        totalReturned: result.rows.length,
        records: result.rows
      },
      'Valoores AML rules source records loaded successfully.'
    );
  } catch (error) {
    return errorResponse(res, error, 'Failed to load Valoores AML rules source records.');
  }
});

/**
 * POST /api/v1/government-blockchain/valoores-aml-rules/sync?limit=100
 *
 * Reads PostgreSQL view and saves records to Fabric/CouchDB using SaveAmlRule.
 */
router.post('/sync', async (req, res) => {
  try {
    const limit = normalizeLimit(req.query.limit || req.body.limit, 100, 1000);
    const force = String(req.query.force || req.body.force || 'false').toLowerCase() === 'true';

    const result = await valooresAmlRulesSyncService.syncValooresAmlRules({
      limit,
      force,
      createdBy: req.body.createdBy || 'system',
      requestId: req.requestId,
      correlationId: req.correlationId
    });

    return successResponse(
      res,
      result,
      'Valoores AML rules sync completed.'
    );
  } catch (error) {
    return errorResponse(res, error, 'Failed to sync Valoores AML rules to Fabric.');
  }
});

/**
 * GET /api/v1/government-blockchain/valoores-aml-rules/sync-status
 */
router.get('/sync-status', async (req, res) => {
  try {
    const summary = await valooresAmlRulesSyncService.getSyncSummary();

    return successResponse(
      res,
      summary,
      'Valoores AML rules sync status loaded successfully.'
    );
  } catch (error) {
    return errorResponse(res, error, 'Failed to load Valoores AML rules sync status.');
  }
});

/**
 * GET /api/v1/government-blockchain/valoores-aml-rules/fabric/:ruleId/:ruleQueryId
 */
router.get('/fabric/:ruleId/:ruleQueryId', async (req, res) => {
  try {
    const { ruleId, ruleQueryId } = req.params;

    const fabricResult = await fabricService.evaluateTransaction(
      'GetAmlRule',
      [ruleId, ruleQueryId],
      {
        requestId: req.requestId,
        correlationId: req.correlationId,
        sourceSystem: 'BLOCKCHAIN_API',
        requestSource: 'VALOORES_AML_RULES_FABRIC_CHECK',
        createdBy: 'system'
      }
    );

    return successResponse(
      res,
      fabricResult,
      'Valoores AML rule loaded from Fabric successfully.'
    );
  } catch (error) {
    return errorResponse(res, error, 'Failed to load Valoores AML rule from Fabric.');
  }
});

/**
 * GET /api/v1/government-blockchain/valoores-aml-rules/history/:ruleId/:ruleQueryId
 */
router.get('/history/:ruleId/:ruleQueryId', async (req, res) => {
  try {
    const { ruleId, ruleQueryId } = req.params;

    const fabricResult = await fabricService.evaluateTransaction(
      'GetAmlRuleHistory',
      [ruleId, ruleQueryId],
      {
        requestId: req.requestId,
        correlationId: req.correlationId,
        sourceSystem: 'BLOCKCHAIN_API',
        requestSource: 'VALOORES_AML_RULES_HISTORY_CHECK',
        createdBy: 'system'
      }
    );

    return successResponse(
      res,
      fabricResult,
      'Valoores AML rule history loaded from Fabric successfully.'
    );
  } catch (error) {
    return errorResponse(res, error, 'Failed to load Valoores AML rule history from Fabric.');
  }
});

/**
 * GET /api/v1/government-blockchain/valoores-aml-rules/fabric/:ruleId
 */
router.get('/fabric/:ruleId', async (req, res) => {
  try {
    const { ruleId } = req.params;

    const fabricResult = await fabricService.evaluateTransaction(
      'GetAmlRule',
      [ruleId],
      {
        requestId: req.requestId,
        correlationId: req.correlationId,
        sourceSystem: 'BLOCKCHAIN_API',
        requestSource: 'VALOORES_AML_RULES_FABRIC_CHECK',
        createdBy: 'system'
      }
    );

    return successResponse(
      res,
      fabricResult,
      'Valoores AML rule loaded from Fabric successfully.'
    );
  } catch (error) {
    return errorResponse(res, error, 'Failed to load Valoores AML rule from Fabric.');
  }
});

/**
 * GET /api/v1/government-blockchain/valoores-aml-rules/history/:ruleId
 */
router.get('/history/:ruleId', async (req, res) => {
  try {
    const { ruleId } = req.params;

    const fabricResult = await fabricService.evaluateTransaction(
      'GetAmlRuleHistory',
      [ruleId],
      {
        requestId: req.requestId,
        correlationId: req.correlationId,
        sourceSystem: 'BLOCKCHAIN_API',
        requestSource: 'VALOORES_AML_RULES_HISTORY_CHECK',
        createdBy: 'system'
      }
    );

    return successResponse(
      res,
      fabricResult,
      'Valoores AML rule history loaded from Fabric successfully.'
    );
  } catch (error) {
    return errorResponse(res, error, 'Failed to load Valoores AML rule history from Fabric.');
  }
});

/**
 * GET /api/v1/government-blockchain/valoores-aml-rules/all-fabric
 */
router.get('/all-fabric', async (req, res) => {
  try {
    const fabricResult = await fabricService.evaluateTransaction(
      'GetAllAmlRules',
      [],
      {
        requestId: req.requestId,
        correlationId: req.correlationId,
        sourceSystem: 'BLOCKCHAIN_API',
        requestSource: 'VALOORES_AML_RULES_ALL_FABRIC',
        createdBy: 'system'
      }
    );

    return successResponse(
      res,
      fabricResult,
      'All Valoores AML rules loaded from Fabric successfully.'
    );
  } catch (error) {
    return errorResponse(res, error, 'Failed to load all Valoores AML rules from Fabric.');
  }
});

module.exports = router;
