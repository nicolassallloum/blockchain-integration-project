'use strict';

const express = require('express');
const db = require('../config/database');
const fabricService = require('../services/fabric.service');
const valooresAmlRulesSyncService = require('../services/valoores-aml-rules-sync.service');
const amlRulesProofService = require('../services/aml-rules-blockchain-proof.service');

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
      rule_id::text AS "RULE ID",
      rule_desc_normalized::text AS "RULE DESC",
      rule_status_code::text AS "RULE STATUS",
      rule_start_date::text AS "RULE START DATE",
      rule_expiry_date::text AS "RULE EXPIRY DATE",
      rule_creation_ts_utc::text AS "RULE CREATION DATE",
      NULL::text AS "RULE CREATOR",
      rule_update_ts_utc::text AS "RULE UPDATE DATE",
      NULL::text AS "RULE UPDATOR",
      rule_message_normalized::text AS "RULE MESSAGE",
      rule_query_id::text AS "RULE QUERY ID",
      rule_logic_fingerprint::text AS "RULE SQL QUERY",
      rule_logic_created_date::text AS "RULE QUERY CREATION DATE",
      NULL::text AS "RULE QUERY CREATED BY",
      rule_query_id::text AS "RULE APPLCIATION QUERY ID",
      rule_logic_updated_date::text AS "RULE QUERY UPDATE DATE",
      NULL::text AS "RULE QUERY UPDATE BY"
    FROM blockchain.valoores_aml_rules
    ORDER BY rule_id, rule_query_id
    LIMIT ${limit};
  `;
}

function getRuleId(row) {
  return String(row['RULE ID'] || '').trim();
}


/**
 * GET /api/v1/government-blockchain/valoores-aml-rules/proof/preview/:sourceRecordId
 *
 * Builds the Phase 13 AML Rule proof payload from blockchain.valoores_aml_rules only.
 * This endpoint does not submit to Fabric.
 */
router.get('/proof/preview/:sourceRecordId', async (req, res) => {
  try {
    const result = await amlRulesProofService.previewAmlRuleProof(
      req.params.sourceRecordId,
      {
        submittedBy: req.query.submittedBy || 'phase-13-api-preview'
      }
    );

    return successResponse(
      res,
      result,
      'AML Rule blockchain proof preview generated successfully.'
    );
  } catch (error) {
    return errorResponse(res, error, 'Failed to preview AML Rule blockchain proof.');
  }
});

/**
 * POST /api/v1/government-blockchain/valoores-aml-rules/proof/submit
 * POST /api/v1/government-blockchain/valoores-aml-rules/proof/submit/:sourceRecordId
 *
 * Submits one AML Rule proof using blockchain.valoores_aml_rules as the only proof input source.
 */
async function submitAmlRuleProofRequest(req, res) {
  try {
    const sourceRecordId = (
      req.params.sourceRecordId ||
      req.body.sourceRecordId ||
      req.body.source_record_id ||
      req.query.sourceRecordId ||
      req.query.source_record_id
    );

    const result = await amlRulesProofService.submitAmlRuleProof(
      sourceRecordId,
      {
        submittedBy: req.body.submittedBy ||
          req.body.submitted_by ||
          req.query.submittedBy ||
          'phase-13-api-submit'
      }
    );

    return successResponse(
      res,
      result,
      'AML Rule blockchain proof submitted successfully.'
    );
  } catch (error) {
    return errorResponse(res, error, 'Failed to submit AML Rule blockchain proof.');
  }
}

router.post('/proof/submit', submitAmlRuleProofRequest);
router.post('/proof/submit/:sourceRecordId', submitAmlRuleProofRequest);


/**
 * GET /api/v1/government-blockchain/valoores-aml-rules/proof/verify/preview/:sourceRecordId
 *
 * Builds the Phase 13 AML Rule verification payload from blockchain.valoores_aml_rules only.
 * This endpoint does not call Fabric.
 */
router.get('/proof/verify/preview/:sourceRecordId', async (req, res) => {
  try {
    const result = await amlRulesProofService.previewAmlRuleVerification(
      req.params.sourceRecordId,
      {
        verifiedBy: req.query.verifiedBy || 'phase-13-api-verify-preview'
      }
    );

    return successResponse(
      res,
      result,
      'AML Rule blockchain proof verification preview generated successfully.'
    );
  } catch (error) {
    return errorResponse(res, error, 'Failed to preview AML Rule blockchain proof verification.');
  }
});

/**
 * POST /api/v1/government-blockchain/valoores-aml-rules/proof/verify
 * POST /api/v1/government-blockchain/valoores-aml-rules/proof/verify/:sourceRecordId
 *
 * Verifies one AML Rule proof using blockchain.valoores_aml_rules as the only proof input source.
 */
async function verifyAmlRuleProofRequest(req, res) {
  try {
    const sourceRecordId = (
      req.params.sourceRecordId ||
      req.body.sourceRecordId ||
      req.body.source_record_id ||
      req.query.sourceRecordId ||
      req.query.source_record_id
    );

    const result = await amlRulesProofService.verifyAmlRuleProof(
      sourceRecordId,
      {
        verifiedBy: req.body.verifiedBy ||
          req.body.verified_by ||
          req.query.verifiedBy ||
          'phase-13-api-verify'
      }
    );

    return successResponse(
      res,
      result,
      'AML Rule blockchain proof verified successfully.'
    );
  } catch (error) {
    return errorResponse(res, error, 'Failed to verify AML Rule blockchain proof.');
  }
}

router.post('/proof/verify', verifyAmlRuleProofRequest);
router.post('/proof/verify/:sourceRecordId', verifyAmlRuleProofRequest);


/**
 * GET /api/v1/government-blockchain/valoores-aml-rules/proof/status
 * GET /api/v1/government-blockchain/valoores-aml-rules/proof/status/:sourceRecordId
 *
 * Shows AML Rules blockchain submission and verification status.
 * Source records come from blockchain.valoores_aml_rules.
 * Proof status comes from blockchain.blockchain_history.
 */
router.get('/proof/status', async (req, res) => {
  try {
    const result = await amlRulesProofService.getAmlRulesBlockchainStatus({
      limit: req.query.limit,
      offset: req.query.offset,
      search: req.query.search
    });

    return successResponse(
      res,
      result,
      'AML Rules blockchain status loaded successfully.'
    );
  } catch (error) {
    return errorResponse(res, error, 'Failed to load AML Rules blockchain status.');
  }
});

router.get('/proof/status/:sourceRecordId', async (req, res) => {
  try {
    const result = await amlRulesProofService.getAmlRulesBlockchainStatus({
      sourceRecordId: req.params.sourceRecordId,
      limit: 1,
      offset: 0
    });

    return successResponse(
      res,
      result,
      'AML Rule blockchain status loaded successfully.'
    );
  } catch (error) {
    return errorResponse(res, error, 'Failed to load AML Rule blockchain status.');
  }
});

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



/* ===== VALOORES AML RULES DASHBOARD API START ===== */

/**
 * GET /api/v1/government-blockchain/valoores-aml-rules/dashboard
 * Dashboard summary + AML rules table from PostgreSQL view + Fabric sync status.
 */
router.get('/dashboard', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || '100', 10), 500);
  const offset = Math.max(parseInt(req.query.offset || '0', 10), 0);
  const search = String(req.query.search || '').trim();

  try {
    const summarySql = `
      SELECT
        COUNT(*)::int AS aml_rules_count,

        COUNT(*) FILTER (
          WHERE DATE("RULE UPDATE DATE") = CURRENT_DATE
        )::int AS aml_rules_updated_today,

        COUNT(*) FILTER (
          WHERE DATE("RULE CREATION DATE") = CURRENT_DATE
        )::int AS aml_rules_created_today,

        COUNT(*) FILTER (
          WHERE COALESCE(rule_status_code::text, '') = '3'
            AND COALESCE(rule_start_date, CURRENT_DATE) <= CURRENT_DATE
            AND (rule_expiry_date IS NULL OR rule_expiry_date >= CURRENT_DATE)
        )::int AS active_aml_rules,

        COUNT(*) FILTER (
          WHERE rule_expiry_date IS NOT NULL
            AND rule_expiry_date < CURRENT_DATE
        )::int AS expired_aml_rules
      FROM blockchain.valoores_aml_rules
    `;

    const searchWhere = search
      ? `
        WHERE
          COALESCE(v.rule_id::text, '') ILIKE $3
          OR COALESCE(v.rule_desc_normalized::text, '') ILIKE $3
          OR COALESCE(v.rule_message_normalized::text, '') ILIKE $3
          OR COALESCE(v.rule_query_id::text, '') ILIKE $3
          OR COALESCE(v.rule_logic_fingerprint::text, '') ILIKE $3
      `
      : '';

    const dataSql = `
      SELECT
        v.rule_id::text AS rule_id,
        v.rule_query_id::text AS rule_query_id,
        ('AML_RULE_' || v.rule_id::text || '_' || COALESCE(v.rule_query_id::text, '0')) AS fabric_ledger_key,
        v.rule_desc_normalized::text AS rule_desc,
        v.rule_status_code::text AS rule_status,
        v.rule_start_date AS rule_start_date,
        v.rule_expiry_date AS rule_expiry_date,
        v.rule_creation_ts_utc AS rule_creation_date,
        NULL::text AS rule_creator,
        v.rule_update_ts_utc AS rule_update_date,
        NULL::text AS rule_updator,
        v.rule_message_normalized::text AS rule_message,
        v.rule_logic_fingerprint::text AS rule_sql_query,
        v.rule_logic_created_date AS rule_query_creation_date,
        NULL::text AS rule_query_created_by,
        v.rule_query_id::text AS rule_application_query_id,
        v.rule_logic_updated_date AS rule_query_update_date,
        NULL::text AS rule_query_update_by,

        CASE
          WHEN v.rule_expiry_date IS NOT NULL
           AND v.rule_expiry_date < CURRENT_DATE
          THEN 'EXPIRED'
          WHEN COALESCE(v.rule_status_code::text, '') = '3'
           AND COALESCE(v.rule_start_date, CURRENT_DATE) <= CURRENT_DATE
           AND (v.rule_expiry_date IS NULL OR v.rule_expiry_date >= CURRENT_DATE)
          THEN 'ACTIVE'
          ELSE 'INACTIVE'
        END AS computed_rule_status,

        fs.sync_status,
        fs.fabric_status,
        fs.fabric_tx_id,
        fs.last_submitted_at,
        fs.updated_at AS sync_updated_at

      FROM blockchain.valoores_aml_rules v
      LEFT JOIN blockchain.valoores_aml_rules_fabric_sync fs
        ON fs.rule_key = ('AML_RULE_' || v.rule_id::text || '_' || COALESCE(v.rule_query_id::text, '0'))
      ${searchWhere}
      ORDER BY v.rule_id, v.rule_query_id
      LIMIT $1 OFFSET $2
    `;

    const countSql = `
      SELECT COUNT(*)::int AS total
      FROM blockchain.valoores_aml_rules v
      ${searchWhere}
    `;

    const summaryResult = await db.query(summarySql);

    const params = search ? [limit, offset, `%${search}%`] : [limit, offset];
    const countParams = search ? [`%${search}%`] : [];

    const dataResult = await db.query(dataSql, params);
    const countResult = await db.query(countSql, countParams);

    const summary = summaryResult.rows[0] || {};

    return res.json({
      success: true,
      message: 'Valoores AML rules dashboard loaded successfully.',
      data: {
        cards: {
          amlRulesCount: summary.aml_rules_count || 0,
          amlRulesUpdatedToday: summary.aml_rules_updated_today || 0,
          amlRulesCreatedToday: summary.aml_rules_created_today || 0,
          activeAmlRules: summary.active_aml_rules || 0,
          expiredAmlRules: summary.expired_aml_rules || 0,
        },
        pagination: {
          limit,
          offset,
          total: countResult.rows[0]?.total || 0,
          returned: dataResult.rows.length,
        },
        filters: {
          search,
        },
        records: dataResult.rows,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[VALOORES_AML_RULES_DASHBOARD_ERROR]', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to load Valoores AML rules dashboard.',
      error: error.message,
      data: null,
      timestamp: new Date().toISOString(),
    });
  }
});

/* ===== VALOORES AML RULES DASHBOARD API END ===== */


module.exports = router;
