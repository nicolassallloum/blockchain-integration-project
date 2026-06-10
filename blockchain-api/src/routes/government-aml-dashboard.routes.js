'use strict';

const express = require('express');
const router = express.Router();
const db = require('../config/database');

function successResponse(res, data) {
  return res.json({
    success: true,
    data,
    timestamp: new Date().toISOString()
  });
}

function errorResponse(res, error, message = 'AML dashboard request failed.') {
  console.error('[AML Dashboard Error]', error);

  return res.status(500).json({
    success: false,
    message,
    error: error.message,
    timestamp: new Date().toISOString()
  });
}

function normalizeChartRows(rows, labelKey = 'label', valueKey = 'value') {
  return rows.map((row) => ({
    label: row[labelKey] || 'UNKNOWN',
    value: Number(row[valueKey] || 0)
  }));
}

/**
 * GET /api/v1/government-blockchain/aml-dashboard/summary
 *
 * Cards:
 * - Total AML Alerts
 * - Open Alerts
 * - High Risk Alerts
 * - Closed Alerts
 * - Alerts Today
 */
router.get('/summary', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        COUNT(*)::int AS total_aml_alerts,

        COUNT(*) FILTER (
          WHERE UPPER(COALESCE(alert_status, 'OPEN')) IN ('OPEN', 'NEW', 'IN_REVIEW', 'ESCALATED')
        )::int AS open_alerts,

        COUNT(*) FILTER (
          WHERE UPPER(COALESCE(severity, '')) IN ('HIGH', 'CRITICAL')
             OR COALESCE(risk_score, 0) >= 71
        )::int AS high_risk_alerts,

        COUNT(*) FILTER (
          WHERE UPPER(COALESCE(alert_status, '')) IN ('CLOSED', 'RESOLVED', 'APPROVED', 'REJECTED')
        )::int AS closed_alerts,

        COUNT(*) FILTER (
          WHERE created_at::date = CURRENT_DATE
        )::int AS alerts_today
      FROM blockchain.aml_alerts;
    `);

    const row = result.rows[0] || {};

    return successResponse(res, {
      totalAmlAlerts: Number(row.total_aml_alerts || 0),
      openAlerts: Number(row.open_alerts || 0),
      highRiskAlerts: Number(row.high_risk_alerts || 0),
      closedAlerts: Number(row.closed_alerts || 0),
      alertsToday: Number(row.alerts_today || 0)
    });
  } catch (error) {
    return errorResponse(res, error, 'Failed to load AML dashboard summary.');
  }
});

/**
 * GET /api/v1/government-blockchain/aml-dashboard/charts
 *
 * Charts:
 * - Alerts by Risk Level
 * - Alerts by Status
 * - Alerts by Date
 * - Top AML Rules Triggered
 */
router.get('/charts', async (req, res) => {
  try {
    const riskLevelResult = await db.query(`
      SELECT
        UPPER(COALESCE(severity, 'UNKNOWN')) AS label,
        COUNT(*)::int AS value
      FROM blockchain.aml_alerts
      GROUP BY UPPER(COALESCE(severity, 'UNKNOWN'))
      ORDER BY
        CASE UPPER(COALESCE(severity, 'UNKNOWN'))
          WHEN 'CRITICAL' THEN 1
          WHEN 'HIGH' THEN 2
          WHEN 'MEDIUM' THEN 3
          WHEN 'LOW' THEN 4
          ELSE 5
        END;
    `);

    const statusResult = await db.query(`
      SELECT
        UPPER(COALESCE(alert_status, 'UNKNOWN')) AS label,
        COUNT(*)::int AS value
      FROM blockchain.aml_alerts
      GROUP BY UPPER(COALESCE(alert_status, 'UNKNOWN'))
      ORDER BY value DESC, label ASC;
    `);

    const dateResult = await db.query(`
      SELECT
        created_at::date::text AS label,
        COUNT(*)::int AS value
      FROM blockchain.aml_alerts
      WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY created_at::date
      ORDER BY created_at::date ASC;
    `);

    const topRulesResult = await db.query(`
      SELECT
        COALESCE(r.rule_name, a.rule_code, 'UNKNOWN') AS label,
        COUNT(*)::int AS value,
        COALESCE(a.rule_code, 'UNKNOWN') AS rule_code
      FROM blockchain.aml_alerts a
      LEFT JOIN blockchain.aml_rules r
        ON r.rule_code = a.rule_code
      GROUP BY COALESCE(r.rule_name, a.rule_code, 'UNKNOWN'), COALESCE(a.rule_code, 'UNKNOWN')
      ORDER BY value DESC, label ASC
      LIMIT 10;
    `);

    return successResponse(res, {
      alertsByRiskLevel: normalizeChartRows(riskLevelResult.rows),
      alertsByStatus: normalizeChartRows(statusResult.rows),
      alertsByDate: normalizeChartRows(dateResult.rows),
      topAmlRulesTriggered: topRulesResult.rows.map((row) => ({
        label: row.label || 'UNKNOWN',
        ruleCode: row.rule_code || 'UNKNOWN',
        value: Number(row.value || 0)
      }))
    });
  } catch (error) {
    return errorResponse(res, error, 'Failed to load AML dashboard chart data.');
  }
});

module.exports = router;
