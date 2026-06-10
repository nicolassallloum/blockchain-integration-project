'use strict';

const express = require('express');
const router = express.Router();
const db = require('../config/database');

function successResponse(res, message, data = {}) {
  return res.json({
    success: true,
    message,
    ...data,
    timestamp: new Date().toISOString()
  });
}

function errorResponse(res, error, message = 'AML alerts queue request failed.') {
  console.error('[AML Alerts Queue Error]', error);

  return res.status(500).json({
    success: false,
    message,
    error: error.message,
    timestamp: new Date().toISOString()
  });
}

function normalizeOfficer(value) {
  const officer = String(value || '').trim();
  return officer || 'Compliance Officer';
}

function normalizeNotes(value) {
  return String(value || '').trim();
}

/**
 * GET /api/v1/government-blockchain/aml-alerts-queue
 *
 * Loads AML alerts that need officer review.
 * Included statuses:
 * - OPEN
 * - NEW
 * - PENDING
 * - PENDING_REVIEW
 * - IN_REVIEW
 * - REVIEW
 */
router.get('/', async (req, res) => {
  try {
    const result = await db.query(`
      WITH queue_alerts AS (
        SELECT
          a.alert_id::text AS alert_id,
          COALESCE(
            r.full_name,
            gt.resident_full_name,
            gt.resident_name,
            a.customer_id,
            a.wallet_address,
            'Unknown Resident'
          ) AS resident_name,
          COALESCE(
            a.transaction_id::text,
            gt.transaction_reference,
            a.request_id,
            '-'
          ) AS transaction_id,
          CASE
            WHEN UPPER(COALESCE(a.severity, '')) IN ('CRITICAL', 'HIGH') THEN 'HIGH'
            WHEN UPPER(COALESCE(a.severity, '')) = 'MEDIUM' THEN 'MEDIUM'
            WHEN UPPER(COALESCE(a.severity, '')) = 'LOW' THEN 'LOW'
            WHEN COALESCE(a.risk_score, 0) >= 71 THEN 'HIGH'
            WHEN COALESCE(a.risk_score, 0) >= 31 THEN 'MEDIUM'
            ELSE 'LOW'
          END AS risk_level,
          COALESCE(a.risk_score, 0)::int AS risk_score,
          COALESCE(ar.rule_name, a.rule_code, 'Unknown AML Rule') AS rule_name,
          COALESCE(a.rule_code, ar.rule_code, '-') AS rule_code,
          CASE
            WHEN UPPER(COALESCE(a.alert_status, 'OPEN')) IN ('PENDING_REVIEW', 'PENDING', 'REVIEW', 'IN_REVIEW') THEN 'PENDING_REVIEW'
            WHEN UPPER(COALESCE(a.alert_status, 'OPEN')) IN ('NEW', 'OPEN') THEN 'OPEN'
            ELSE UPPER(COALESCE(a.alert_status, 'OPEN'))
          END AS status,
          a.alert_status AS raw_status,
          a.reason,
          a.reviewed_by,
          a.reviewed_at,
          a.review_notes,
          a.created_at,
          jsonb_build_object(
            'walletAddress', a.wallet_address,
            'customerId', a.customer_id,
            'counterpartyWalletAddress', a.counterparty_wallet_address,
            'counterpartyCustomerId', a.counterparty_customer_id,
            'requestId', a.request_id,
            'riskAction', a.risk_action,
            'severity', a.severity,
            'transactionAmount', a.transaction_amount,
            'currencyCode', a.currency_code,
            'transactionType', a.transaction_type,
            'organizationCode', a.organization_code,
            'organizationName', a.organization_name,
            'alertDetails', a.alert_details
          ) AS details
        FROM blockchain.aml_alerts a
        LEFT JOIN blockchain.aml_rules ar
          ON ar.rule_id = a.rule_id
          OR ar.rule_code = a.rule_code
        LEFT JOIN blockchain.residents r
          ON r.resident_id::text = a.customer_id::text
          OR r.wallet_address = a.wallet_address
        LEFT JOIN blockchain.government_transactions gt
          ON gt.transaction_id::text = a.transaction_id::text
          OR gt.transaction_reference = a.request_id
          OR gt.resident_id::text = a.customer_id::text
        WHERE UPPER(COALESCE(a.alert_status, 'OPEN')) IN (
          'OPEN',
          'NEW',
          'PENDING',
          'PENDING_REVIEW',
          'IN_REVIEW',
          'REVIEW'
        )
      )
      SELECT
        (
          SELECT jsonb_build_object(
            'totalOpen', COUNT(*),
            'openAlerts', COUNT(*) FILTER (WHERE status = 'OPEN'),
            'pendingReview', COUNT(*) FILTER (WHERE status = 'PENDING_REVIEW'),
            'highRisk', COUNT(*) FILTER (WHERE risk_level = 'HIGH')
          )
          FROM queue_alerts
        ) AS summary,
        COALESCE(
          (
            SELECT jsonb_agg(
              jsonb_build_object(
                'alertId', alert_id,
                'residentName', resident_name,
                'transactionId', transaction_id,
                'riskLevel', risk_level,
                'riskScore', risk_score,
                'ruleName', rule_name,
                'ruleCode', rule_code,
                'status', status,
                'rawStatus', raw_status,
                'reason', reason,
                'reviewedBy', reviewed_by,
                'reviewedAt', reviewed_at,
                'reviewNotes', review_notes,
                'createdDate', created_at,
                'details', details
              )
              ORDER BY created_at DESC NULLS LAST
            )
            FROM queue_alerts
          ),
          '[]'::jsonb
        ) AS data;
    `);

    const row = result.rows[0] || {};

    return successResponse(res, 'AML alerts queue loaded successfully.', {
      summary: row.summary || {
        totalOpen: 0,
        openAlerts: 0,
        pendingReview: 0,
        highRisk: 0
      },
      data: row.data || []
    });
  } catch (error) {
    return errorResponse(res, error, 'Failed to load AML alerts queue.');
  }
});

/**
 * POST /api/v1/government-blockchain/aml-alerts-queue/:alertId/review
 *
 * Marks alert as reviewed / pending review and saves officer notes.
 */
router.post('/:alertId/review', async (req, res) => {
  const client = await db.getClient();

  try {
    const { alertId } = req.params;
    const officer = normalizeOfficer(req.body.officer || req.body.reviewedBy);
    const notes = normalizeNotes(req.body.notes || req.body.reviewNotes);

    await client.query('BEGIN');

    const currentResult = await client.query(
      `
      SELECT alert_id, alert_status
      FROM blockchain.aml_alerts
      WHERE alert_id = $1::uuid
      FOR UPDATE;
      `,
      [alertId]
    );

    if (!currentResult.rowCount) {
      await client.query('ROLLBACK');

      return res.status(404).json({
        success: false,
        message: 'AML alert not found.',
        timestamp: new Date().toISOString()
      });
    }

    const previousStatus = currentResult.rows[0].alert_status || 'OPEN';

    const updateResult = await client.query(
      `
      UPDATE blockchain.aml_alerts
      SET
        alert_status = 'PENDING_REVIEW',
        reviewed_by = $2,
        reviewed_at = now(),
        review_notes = $3
      WHERE alert_id = $1::uuid
      RETURNING
        alert_id::text,
        alert_status,
        reviewed_by,
        reviewed_at,
        review_notes;
      `,
      [alertId, officer, notes]
    );

    await client.query(
      `
      INSERT INTO blockchain.aml_case_reviews (
        alert_id,
        previous_status,
        new_status,
        decision,
        reviewed_by,
        review_notes,
        action_taken
      )
      VALUES (
        $1::uuid,
        $2,
        'UNDER_REVIEW',
        'ESCALATED',
        $3,
        $4,
        'MARKED_AS_REVIEWED'
      );
      `,
      [alertId, previousStatus, officer, notes]
    );

    await client.query('COMMIT');

    return successResponse(res, 'AML alert marked as reviewed successfully.', {
      data: updateResult.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    return errorResponse(res, error, 'Failed to mark AML alert as reviewed.');
  } finally {
    client.release();
  }
});

/**
 * POST /api/v1/government-blockchain/aml-alerts-queue/:alertId/close
 *
 * Closes alert and saves officer notes.
 */
router.post('/:alertId/close', async (req, res) => {
  const client = await db.getClient();

  try {
    const { alertId } = req.params;
    const officer = normalizeOfficer(req.body.officer || req.body.reviewedBy);
    const notes = normalizeNotes(req.body.notes || req.body.reviewNotes);

    await client.query('BEGIN');

    const currentResult = await client.query(
      `
      SELECT alert_id, alert_status
      FROM blockchain.aml_alerts
      WHERE alert_id = $1::uuid
      FOR UPDATE;
      `,
      [alertId]
    );

    if (!currentResult.rowCount) {
      await client.query('ROLLBACK');

      return res.status(404).json({
        success: false,
        message: 'AML alert not found.',
        timestamp: new Date().toISOString()
      });
    }

    const previousStatus = currentResult.rows[0].alert_status || 'OPEN';

    const updateResult = await client.query(
      `
      UPDATE blockchain.aml_alerts
      SET
        alert_status = 'CLOSED',
        reviewed_by = $2,
        reviewed_at = now(),
        review_notes = $3
      WHERE alert_id = $1::uuid
      RETURNING
        alert_id::text,
        alert_status,
        reviewed_by,
        reviewed_at,
        review_notes;
      `,
      [alertId, officer, notes]
    );

    await client.query(
      `
      INSERT INTO blockchain.aml_case_reviews (
        alert_id,
        previous_status,
        new_status,
        decision,
        reviewed_by,
        review_notes,
        action_taken
      )
      VALUES (
        $1::uuid,
        $2,
        'CLOSED',
        'CLOSED',
        $3,
        $4,
        'CLOSED_ALERT'
      );
      `,
      [alertId, previousStatus, officer, notes]
    );

    await client.query('COMMIT');

    return successResponse(res, 'AML alert closed successfully.', {
      data: updateResult.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    return errorResponse(res, error, 'Failed to close AML alert.');
  } finally {
    client.release();
  }
});

module.exports = router;
