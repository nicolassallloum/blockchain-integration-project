const express = require('express');
const { Pool } = require('pg');

const router = express.Router();

const pool = new Pool({
  host: process.env.PGHOST || process.env.DB_HOST || '172.31.13.133',
  port: Number(process.env.PGPORT || process.env.DB_PORT || 5444),
  database: process.env.PGDATABASE || process.env.DB_NAME || 'vfds_dev',
  user: process.env.PGUSER || process.env.DB_USER || 'pgdata',
  password: process.env.PGPASSWORD || process.env.DB_PASSWORD || 'pgdata@Valoores05',
});

function normalizeRiskLevel(value, score) {
  const raw = String(value || '').trim().toUpperCase();

  if (['CRITICAL', 'HIGH'].includes(raw)) return 'HIGH';
  if (raw === 'MEDIUM') return 'MEDIUM';
  if (raw === 'LOW') return 'LOW';

  const numericScore = Number(score || 0);

  if (numericScore >= 71) return 'HIGH';
  if (numericScore >= 31) return 'MEDIUM';
  return 'LOW';
}

function normalizeStatus(value) {
  const raw = String(value || '').trim().toUpperCase();

  if (['RESOLVED', 'CLOSED', 'APPROVED', 'REJECTED', 'COMPLETED'].includes(raw)) {
    return 'RESOLVED';
  }

  if (['REVIEW', 'PENDING_REVIEW', 'PENDING', 'IN_REVIEW'].includes(raw)) {
    return 'IN_REVIEW';
  }

  if (['OPEN', 'NEW', 'ALLOW', 'BLOCK'].includes(raw)) {
    return raw;
  }

  return raw || 'OPEN';
}

function buildFilters(query) {
  const conditions = [];
  const values = [];

  if (query.riskLevel) {
    values.push(String(query.riskLevel).trim().toUpperCase());
    conditions.push(`risk_level = $${values.length}`);
  }

  if (query.status) {
    values.push(String(query.status).trim().toUpperCase());
    conditions.push(`status = $${values.length}`);
  }

  if (query.residentName) {
    values.push(`%${String(query.residentName).trim()}%`);
    conditions.push(`resident_name ILIKE $${values.length}`);
  }

  if (query.transactionId) {
    values.push(`%${String(query.transactionId).trim()}%`);
    conditions.push(`transaction_id ILIKE $${values.length}`);
  }

  if (query.dateFrom) {
    values.push(query.dateFrom);
    conditions.push(`created_at::date >= $${values.length}::date`);
  }

  if (query.dateTo) {
    values.push(query.dateTo);
    conditions.push(`created_at::date <= $${values.length}::date`);
  }

  return {
    whereSql: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '',
    values,
  };
}


/**
 * GET /api/v1/government-blockchain/risk-fraud-screening/summary
 */
router.get('/summary', async (req, res) => {
  const query = `
    WITH risk_rows AS (
      SELECT
        CASE
          WHEN UPPER(COALESCE(a.severity, '')) IN ('CRITICAL', 'HIGH') THEN 'HIGH'
          WHEN UPPER(COALESCE(a.severity, '')) = 'MEDIUM' THEN 'MEDIUM'
          WHEN UPPER(COALESCE(a.severity, '')) = 'LOW' THEN 'LOW'
          WHEN COALESCE(a.risk_score, 0) >= 71 THEN 'HIGH'
          WHEN COALESCE(a.risk_score, 0) >= 31 THEN 'MEDIUM'
          ELSE 'LOW'
        END AS risk_level,
        CASE
          WHEN UPPER(COALESCE(a.alert_status, 'OPEN')) IN ('RESOLVED', 'CLOSED', 'APPROVED', 'REJECTED', 'COMPLETED') THEN 'RESOLVED'
          WHEN UPPER(COALESCE(a.alert_status, 'OPEN')) IN ('REVIEW', 'PENDING_REVIEW', 'PENDING', 'IN_REVIEW') THEN 'IN_REVIEW'
          ELSE UPPER(COALESCE(a.alert_status, 'OPEN'))
        END AS status
      FROM blockchain.aml_alerts a

      UNION ALL

      SELECT
        CASE
          WHEN COALESCE(l.final_risk_score, 0) >= 71 THEN 'HIGH'
          WHEN COALESCE(l.final_risk_score, 0) >= 31 THEN 'MEDIUM'
          ELSE 'LOW'
        END AS risk_level,
        CASE
          WHEN UPPER(COALESCE(l.final_decision, 'OPEN')) = 'ALLOW' THEN 'RESOLVED'
          WHEN UPPER(COALESCE(l.final_decision, 'OPEN')) = 'REVIEW' THEN 'IN_REVIEW'
          WHEN UPPER(COALESCE(l.final_decision, 'OPEN')) = 'BLOCK' THEN 'OPEN'
          ELSE UPPER(COALESCE(l.final_decision, 'OPEN'))
        END AS status
      FROM blockchain.aml_rule_execution_logs l
    )
    SELECT
      COUNT(*)::int AS total_alerts,
      COUNT(*) FILTER (WHERE risk_level = 'HIGH')::int AS high_risk,
      COUNT(*) FILTER (WHERE risk_level = 'MEDIUM')::int AS medium_risk,
      COUNT(*) FILTER (WHERE risk_level = 'LOW')::int AS low_risk,
      COUNT(*) FILTER (WHERE status = 'RESOLVED')::int AS resolved_alerts
    FROM risk_rows;
  `;

  try {
    const result = await pool.query(query);
    const row = result.rows[0] || {};

    return res.json({
      success: true,
      message: 'Risk and fraud screening summary loaded successfully.',
      data: {
        totalAlerts: Number(row.total_alerts || 0),
        highRisk: Number(row.high_risk || 0),
        mediumRisk: Number(row.medium_risk || 0),
        lowRisk: Number(row.low_risk || 0),
        resolvedAlerts: Number(row.resolved_alerts || 0)
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[RISK FRAUD SUMMARY ERROR]', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load risk and fraud screening summary.',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});


/**
 * GET /api/v1/government-blockchain/risk-fraud-screening
 */
router.get('/', async (req, res) => {
  try {
    const { whereSql, values } = buildFilters(req.query);

    const baseSql = `
      WITH risk_rows AS (
        SELECT
          a.alert_id::text AS alert_id,
          COALESCE(r.full_name, gt.resident_full_name, gt.resident_name, a.customer_id, 'Unknown Resident') AS resident_name,
          COALESCE(a.transaction_id::text, gt.transaction_reference, a.request_id, '-') AS transaction_id,
          COALESCE(a.risk_score, 0)::int AS risk_score,
          CASE
            WHEN UPPER(COALESCE(a.severity, '')) IN ('CRITICAL', 'HIGH') THEN 'HIGH'
            WHEN UPPER(COALESCE(a.severity, '')) = 'MEDIUM' THEN 'MEDIUM'
            WHEN UPPER(COALESCE(a.severity, '')) = 'LOW' THEN 'LOW'
            WHEN COALESCE(a.risk_score, 0) >= 71 THEN 'HIGH'
            WHEN COALESCE(a.risk_score, 0) >= 31 THEN 'MEDIUM'
            ELSE 'LOW'
          END AS risk_level,
          COALESCE(a.reason, a.rule_code, 'AML alert generated by screening engine') AS reason,
          CASE
            WHEN UPPER(COALESCE(a.alert_status, 'OPEN')) IN ('RESOLVED', 'CLOSED', 'APPROVED', 'REJECTED', 'COMPLETED') THEN 'RESOLVED'
            WHEN UPPER(COALESCE(a.alert_status, 'OPEN')) IN ('REVIEW', 'PENDING_REVIEW', 'PENDING', 'IN_REVIEW') THEN 'IN_REVIEW'
            ELSE UPPER(COALESCE(a.alert_status, 'OPEN'))
          END AS status,
          a.created_at,
          'AML_ALERT' AS source_type,
          jsonb_build_object(
            'walletAddress', a.wallet_address,
            'customerId', a.customer_id,
            'ruleCode', a.rule_code,
            'riskAction', a.risk_action,
            'severity', a.severity,
            'transactionAmount', a.transaction_amount,
            'currencyCode', a.currency_code,
            'transactionType', a.transaction_type,
            'organizationCode', a.organization_code,
            'organizationName', a.organization_name,
            'details', a.alert_details
          ) AS details
        FROM blockchain.aml_alerts a
        LEFT JOIN blockchain.residents r
          ON r.resident_id = a.customer_id
          OR r.wallet_address = a.wallet_address
        LEFT JOIN blockchain.government_transactions gt
          ON gt.transaction_reference = a.request_id
          OR gt.resident_id = a.customer_id

        UNION ALL

        SELECT
          l.log_id::text AS alert_id,
          COALESCE(r.full_name, l.customer_id, 'Unknown Resident') AS resident_name,
          COALESCE(l.transaction_id::text, l.request_id, '-') AS transaction_id,
          COALESCE(l.final_risk_score, 0)::int AS risk_score,
          CASE
            WHEN COALESCE(l.final_risk_score, 0) >= 71 THEN 'HIGH'
            WHEN COALESCE(l.final_risk_score, 0) >= 31 THEN 'MEDIUM'
            ELSE 'LOW'
          END AS risk_level,
          COALESCE(
            l.execution_details->>'reason',
            CASE
              WHEN COALESCE(l.matched_rules, 0) > 0 THEN 'AML rules matched during transaction screening'
              ELSE 'AML screening completed with no matched fraud rules'
            END
          ) AS reason,
          CASE
            WHEN UPPER(COALESCE(l.final_decision, 'OPEN')) = 'ALLOW' THEN 'RESOLVED'
            WHEN UPPER(COALESCE(l.final_decision, 'OPEN')) = 'REVIEW' THEN 'IN_REVIEW'
            WHEN UPPER(COALESCE(l.final_decision, 'OPEN')) = 'BLOCK' THEN 'OPEN'
            ELSE UPPER(COALESCE(l.final_decision, 'OPEN'))
          END AS status,
          l.created_at,
          'AML_EXECUTION_LOG' AS source_type,
          jsonb_build_object(
            'walletAddress', l.wallet_address,
            'customerId', l.customer_id,
            'counterpartyCustomerId', l.counterparty_customer_id,
            'counterpartyWalletAddress', l.counterparty_wallet_address,
            'transactionAmount', l.transaction_amount,
            'currencyCode', l.currency_code,
            'transactionType', l.transaction_type,
            'rulesChecked', l.rules_checked,
            'matchedRules', l.matched_rules,
            'finalDecision', l.final_decision,
            'executionDetails', l.execution_details
          ) AS details
        FROM blockchain.aml_rule_execution_logs l
        LEFT JOIN blockchain.residents r
          ON r.resident_id = l.customer_id
          OR r.wallet_address = l.wallet_address
      ),
      filtered_rows AS (
        SELECT *
        FROM risk_rows
        ${whereSql}
      )
      SELECT
        (
          SELECT jsonb_build_object(
            'totalAlerts', COUNT(*),
            'highRisk', COUNT(*) FILTER (WHERE risk_level = 'HIGH'),
            'mediumRisk', COUNT(*) FILTER (WHERE risk_level = 'MEDIUM'),
            'lowRisk', COUNT(*) FILTER (WHERE risk_level = 'LOW'),
            'resolvedAlerts', COUNT(*) FILTER (WHERE status = 'RESOLVED')
          )
          FROM filtered_rows
        ) AS summary,
        COALESCE(
          (
            SELECT jsonb_agg(
              jsonb_build_object(
                'alertId', alert_id,
                'residentName', resident_name,
                'transactionId', transaction_id,
                'riskScore', risk_score,
                'riskLevel', risk_level,
                'reason', reason,
                'status', status,
                'createdDate', created_at,
                'sourceType', source_type,
                'details', details
              )
              ORDER BY created_at DESC NULLS LAST
            )
            FROM (
              SELECT *
              FROM filtered_rows
              ORDER BY created_at DESC NULLS LAST
              LIMIT 200
            ) limited_rows
          ),
          '[]'::jsonb
        ) AS data;
    `;

    const result = await pool.query(baseSql, values);
    const row = result.rows[0] || {};

    return res.json({
      success: true,
      message: 'Risk / fraud screening data retrieved successfully.',
      summary: row.summary || {
        totalAlerts: 0,
        highRisk: 0,
        mediumRisk: 0,
        lowRisk: 0,
        resolvedAlerts: 0,
      },
      data: row.data || [],
      filters: {
        riskLevel: req.query.riskLevel || '',
        status: req.query.status || '',
        residentName: req.query.residentName || '',
        transactionId: req.query.transactionId || '',
        dateFrom: req.query.dateFrom || '',
        dateTo: req.query.dateTo || '',
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[RiskFraudScreening] Failed:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve risk / fraud screening data.',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

module.exports = router;
