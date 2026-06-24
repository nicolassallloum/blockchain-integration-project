const express = require('express');
const router = express.Router();
const db = require('../config/database');

const ALLOWED_STATUSES = ['Open', 'In Review', 'Escalated', 'Closed'];

function normalizePriorityFromAlert(alert) {
  const severity = String(alert?.severity || '').toUpperCase();
  const riskScore = Number(alert?.risk_score || 0);

  if (severity === 'CRITICAL' || riskScore >= 85) return 'High';
  if (severity === 'HIGH' || riskScore >= 60) return 'High';
  if (severity === 'MEDIUM' || riskScore >= 35) return 'Medium';
  return 'Low';
}

function normalizeRiskLevel(alert) {
  const severity = String(alert?.severity || '').toUpperCase();
  const riskScore = Number(alert?.risk_score || 0);

  if (severity) return severity;
  if (riskScore >= 85) return 'HIGH';
  if (riskScore >= 60) return 'HIGH';
  if (riskScore >= 35) return 'MEDIUM';
  return 'LOW';
}

async function tableExists(tableName) {
  const result = await db.query(
    `
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'blockchain'
        AND table_name = $1
    ) AS exists
    `,
    [tableName]
  );

  return Boolean(result.rows[0]?.exists);
}

async function getNextCaseNumber(client) {
  const result = await client.query(`
    SELECT COALESCE(
      MAX(NULLIF(regexp_replace(case_number, '\\D', '', 'g'), '')::int),
      0
    ) + 1 AS next_number
    FROM blockchain.aml_cases
    WHERE case_number ILIKE 'CASE-AML-%'
  `);

  const nextNumber = Number(result.rows[0]?.next_number || 1);
  return `CASE-AML-${String(nextNumber).padStart(4, '0')}`;
}

async function insertCaseAction(client, {
  caseId,
  actionType,
  oldStatus = null,
  newStatus = null,
  actionBy = null,
  actionNote = null
}) {
  await client.query(
    `
    INSERT INTO blockchain.aml_case_actions (
      case_id,
      action_type,
      old_status,
      new_status,
      action_by,
      action_note,
      created_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, now())
    `,
    [caseId, actionType, oldStatus, newStatus, actionBy, actionNote]
  );
}

function buildTransactionJoin(hasBlockchainTransactions) {
  if (!hasBlockchainTransactions) {
    return `
      NULL::jsonb AS transaction
    `;
  }

  return `
    jsonb_build_object(
      'transactionId', tx.transaction_id,
      'transactionAmount', tx.transaction_amount,
      'currencyCode', tx.currency_code,
      'transactionType', tx.transaction_type,
      'createdAt', tx.created_at
    ) AS transaction
  `;
}

/**
 * GET /api/v1/government-blockchain/aml-cases/summary
 */
router.get('/summary', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        COUNT(*)::int AS total_cases,
        COUNT(*) FILTER (WHERE case_status = 'Open')::int AS open_cases,
        COUNT(*) FILTER (WHERE case_status = 'Escalated')::int AS escalated_cases,
        COUNT(*) FILTER (WHERE case_status = 'Closed')::int AS closed_cases
      FROM blockchain.aml_cases
    `);

    const row = result.rows[0] || {};

    return res.json({
      success: true,
      data: {
        totalCases: Number(row.total_cases || 0),
        openCases: Number(row.open_cases || 0),
        escalatedCases: Number(row.escalated_cases || 0),
        closedCases: Number(row.closed_cases || 0)
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[AML CASES SUMMARY ERROR]', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load AML case summary.',
      error: error.message
    });
  }
});

/**
 * GET /api/v1/government-blockchain/aml-cases
 */
router.get('/', async (req, res) => {
  try {
    const { status, priority, assignedTo } = req.query;

    const where = [];
    const params = [];

    if (status) {
      params.push(status);
      where.push(`c.case_status = $${params.length}`);
    }

    if (priority) {
      params.push(priority);
      where.push(`c.priority = $${params.length}`);
    }

    if (assignedTo) {
      params.push(`%${assignedTo}%`);
      where.push(`COALESCE(c.assigned_to, c.assigned_team, '') ILIKE $${params.length}`);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const result = await db.query(
      `
      SELECT
        c.case_id,
        c.case_number,
        c.alert_id,
        c.resident_id,
        c.wallet_address,
        c.transaction_id,
        c.case_title,
        c.case_description,
        c.priority,
        c.case_status,
        c.assigned_to,
        c.assigned_team,
        c.opened_by,
        c.opened_at,
        c.reviewed_at,
        c.escalated_at,
        c.closed_at,
        c.closure_reason,
        c.risk_score,
        c.risk_level,
        c.created_at,
        c.updated_at,

        a.alert_status,
        a.rule_code,
        a.severity,
        a.reason AS alert_reason,
        a.customer_id,
        a.transaction_amount,
        a.currency_code,
        a.transaction_type,
        a.risk_action,

        r.full_name AS resident_full_name,
        r.national_id_number,
        r.mobile_number,
        r.email,

        rw.wallet_balance,
        rw.wallet_status,
        rw.wallet_currency

      FROM blockchain.aml_cases c
      LEFT JOIN blockchain.aml_alerts a
        ON a.alert_id = c.alert_id
      LEFT JOIN blockchain.residents r
        ON r.resident_id::text = c.resident_id::text
        OR r.wallet_address = c.wallet_address
        OR r.resident_id::text = a.customer_id
      LEFT JOIN blockchain.resident_wallets rw
        ON rw.wallet_address = c.wallet_address
        OR rw.wallet_address = a.wallet_address
      ${whereSql}
      ORDER BY c.created_at DESC NULLS LAST, c.opened_at DESC NULLS LAST
      `,
      params
    );

    return res.json({
      success: true,
      data: result.rows.map(row => ({
        caseId: row.case_id,
        caseNumber: row.case_number,
        alertId: row.alert_id,
        residentId: row.resident_id,
        walletAddress: row.wallet_address,
        transactionId: row.transaction_id,
        title: row.case_title,
        description: row.case_description,
        priority: row.priority,
        status: row.case_status,
        assignedTo: row.assigned_to,
        assignedTeam: row.assigned_team,
        openedBy: row.opened_by,
        openedAt: row.opened_at,
        reviewedAt: row.reviewed_at,
        escalatedAt: row.escalated_at,
        closedAt: row.closed_at,
        closureReason: row.closure_reason,
        riskScore: row.risk_score,
        riskLevel: row.risk_level,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        alert: {
          status: row.alert_status,
          ruleCode: row.rule_code,
          severity: row.severity,
          reason: row.alert_reason,
          customerId: row.customer_id,
          amount: row.transaction_amount,
          currency: row.currency_code,
          type: row.transaction_type,
          riskAction: row.risk_action
        },
        resident: {
          fullName: row.resident_full_name,
          nationalIdNumber: row.national_id_number,
          mobileNumber: row.mobile_number,
          email: row.email
        },
        wallet: {
          address: row.wallet_address,
          balance: row.wallet_balance,
          status: row.wallet_status,
          currency: row.wallet_currency
        }
      })),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[AML CASES LIST ERROR]', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load AML cases.',
      error: error.message
    });
  }
});

/**
 * GET /api/v1/government-blockchain/aml-cases/:caseId
 */
router.get('/:caseId', async (req, res) => {
  try {
    const { caseId } = req.params;
    const hasBlockchainTransactions = await tableExists('blockchain_transactions');
    const transactionSelect = buildTransactionJoin(hasBlockchainTransactions);

    const txJoin = hasBlockchainTransactions
      ? `LEFT JOIN blockchain.blockchain_transactions tx ON tx.transaction_id = c.transaction_id`
      : '';

    const result = await db.query(
      `
      SELECT
        c.*,

        jsonb_build_object(
          'alertId', a.alert_id,
          'alertStatus', a.alert_status,
          'ruleCode', a.rule_code,
          'severity', a.severity,
          'reason', a.reason,
          'customerId', a.customer_id,
          'walletAddress', a.wallet_address,
          'riskScore', a.risk_score,
          'transactionAmount', a.transaction_amount,
          'currencyCode', a.currency_code,
          'transactionType', a.transaction_type,
          'riskAction', a.risk_action,
          'createdAt', a.created_at,
          'alertDetails', a.alert_details
        ) AS alert,

        jsonb_build_object(
          'residentId', r.resident_id,
          'fullName', r.full_name,
          'nationalIdNumber', r.national_id_number,
          'mobileNumber', r.mobile_number,
          'email', r.email,
          'riskCategory', r.risk_category,
          'kycStatus', r.kyc_status
        ) AS resident,

        jsonb_build_object(
          'walletAddress', rw.wallet_address,
          'walletBalance', rw.wallet_balance,
          'walletStatus', rw.wallet_status,
          'walletCurrency', rw.wallet_currency,
          'blockchainStatus', rw.blockchain_status
        ) AS wallet,

        ${transactionSelect}

      FROM blockchain.aml_cases c
      LEFT JOIN blockchain.aml_alerts a
        ON a.alert_id = c.alert_id
      LEFT JOIN blockchain.residents r
        ON r.resident_id::text = c.resident_id::text
        OR r.wallet_address = c.wallet_address
        OR r.resident_id::text = a.customer_id
      LEFT JOIN blockchain.resident_wallets rw
        ON rw.wallet_address = c.wallet_address
        OR rw.wallet_address = a.wallet_address
      ${txJoin}
      WHERE c.case_id::text = $1
         OR c.case_number = $1
      LIMIT 1
      `,
      [caseId]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        success: false,
        message: 'AML case not found.'
      });
    }

    const caseRow = result.rows[0];

    const actions = await db.query(
      `
      SELECT
        action_id,
        case_id,
        action_type,
        old_status,
        new_status,
        action_by,
        action_note,
        created_at
      FROM blockchain.aml_case_actions
      WHERE case_id = $1
      ORDER BY created_at ASC
      `,
      [caseRow.case_id]
    );

    return res.json({
      success: true,
      data: {
        caseId: caseRow.case_id,
        caseNumber: caseRow.case_number,
        alertId: caseRow.alert_id,
        residentId: caseRow.resident_id,
        walletAddress: caseRow.wallet_address,
        transactionId: caseRow.transaction_id,
        title: caseRow.case_title,
        description: caseRow.case_description,
        priority: caseRow.priority,
        status: caseRow.case_status,
        assignedTo: caseRow.assigned_to,
        assignedTeam: caseRow.assigned_team,
        openedBy: caseRow.opened_by,
        openedAt: caseRow.opened_at,
        reviewedAt: caseRow.reviewed_at,
        escalatedAt: caseRow.escalated_at,
        closedAt: caseRow.closed_at,
        closureReason: caseRow.closure_reason,
        investigationNotes: caseRow.investigation_notes,
        riskScore: caseRow.risk_score,
        riskLevel: caseRow.risk_level,
        blockchainProofId: caseRow.blockchain_proof_id,
        createdAt: caseRow.created_at,
        updatedAt: caseRow.updated_at,
        alert: caseRow.alert,
        resident: caseRow.resident,
        wallet: caseRow.wallet,
        transaction: caseRow.transaction,
        actions: actions.rows
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[AML CASE DETAIL ERROR]', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load AML case details.',
      error: error.message
    });
  }
});

/**
 * POST /api/v1/government-blockchain/aml-cases
 */
router.post('/', async (req, res) => {
  const client = await db.getClient();

  try {
    const {
      alertId,
      assignedTo = 'Unassigned',
      assignedTeam = 'AML Compliance',
      priority,
      description,
      openedBy = 'System'
    } = req.body || {};

    if (!alertId) {
      return res.status(400).json({
        success: false,
        message: 'alertId is required.'
      });
    }

    await client.query('BEGIN');

    const existingCase = await client.query(
      `
      SELECT case_id, case_number
      FROM blockchain.aml_cases
      WHERE alert_id = $1
      LIMIT 1
      `,
      [alertId]
    );

    if (existingCase.rows.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        message: 'AML case already exists for this alert.',
        data: existingCase.rows[0]
      });
    }

    const alertResult = await client.query(
      `
      SELECT *
      FROM blockchain.aml_alerts
      WHERE alert_id = $1
      LIMIT 1
      `,
      [alertId]
    );

    if (!alertResult.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'AML alert not found.'
      });
    }

    const alert = alertResult.rows[0];

    const residentResult = await client.query(
      `
      SELECT resident_id
      FROM blockchain.residents
      WHERE wallet_address = $1
         OR resident_id::text = $2
      ORDER BY created_at DESC NULLS LAST
      LIMIT 1
      `,
      [alert.wallet_address, alert.customer_id]
    );

    const residentId = residentResult.rows[0]?.resident_id || null;
    const caseNumber = await getNextCaseNumber(client);
    const finalPriority = priority || normalizePriorityFromAlert(alert);
    const riskLevel = normalizeRiskLevel(alert);

    const created = await client.query(
      `
      INSERT INTO blockchain.aml_cases (
        case_number,
        alert_id,
        resident_id,
        wallet_address,
        transaction_id,
        case_title,
        case_description,
        priority,
        case_status,
        assigned_to,
        assigned_team,
        opened_by,
        opened_at,
        risk_score,
        risk_level,
        created_at,
        updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, 'Open',
        $9, $10, $11, now(),
        $12, $13, now(), now()
      )
      RETURNING *
      `,
      [
        caseNumber,
        alert.alert_id,
        residentId,
        alert.wallet_address,
        alert.transaction_id,
        'AML Investigation Case',
        description || alert.reason || 'AML alert investigation case',
        finalPriority,
        assignedTo,
        assignedTeam,
        openedBy,
        alert.risk_score,
        riskLevel
      ]
    );

    await insertCaseAction(client, {
      caseId: created.rows[0].case_id,
      actionType: 'CASE_CREATED',
      oldStatus: null,
      newStatus: 'Open',
      actionBy: openedBy,
      actionNote: `Case ${caseNumber} created from alert ${alert.alert_id}`
    });

    await client.query('COMMIT');

    return res.status(201).json({
      success: true,
      message: 'AML case created successfully.',
      data: created.rows[0],
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[AML CASE CREATE ERROR]', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create AML case.',
      error: error.message
    });
  } finally {
    client.release();
  }
});

/**
 * PATCH /api/v1/government-blockchain/aml-cases/:caseId/assign
 */
router.patch('/:caseId/assign', async (req, res) => {
  const client = await db.getClient();

  try {
    const { caseId } = req.params;
    const {
      assignedTo = null,
      assignedTeam = null,
      actionBy = 'System',
      note = null
    } = req.body || {};

    await client.query('BEGIN');

    const existing = await client.query(
      `
      SELECT *
      FROM blockchain.aml_cases
      WHERE case_id::text = $1
         OR case_number = $1
      LIMIT 1
      `,
      [caseId]
    );

    if (!existing.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'AML case not found.'
      });
    }

    const oldCase = existing.rows[0];

    const updated = await client.query(
      `
      UPDATE blockchain.aml_cases
      SET
        assigned_to = COALESCE($2, assigned_to),
        assigned_team = COALESCE($3, assigned_team),
        reviewed_at = now(),
        updated_at = now()
      WHERE case_id = $1
      RETURNING *
      `,
      [oldCase.case_id, assignedTo, assignedTeam]
    );

    await insertCaseAction(client, {
      caseId: oldCase.case_id,
      actionType: 'ASSIGNED',
      oldStatus: oldCase.case_status,
      newStatus: oldCase.case_status,
      actionBy,
      actionNote: note || `Assigned to ${assignedTo || oldCase.assigned_to || 'N/A'} / ${assignedTeam || oldCase.assigned_team || 'N/A'}`
    });

    await client.query('COMMIT');

    return res.json({
      success: true,
      message: 'AML case assigned successfully.',
      data: updated.rows[0],
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[AML CASE ASSIGN ERROR]', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to assign AML case.',
      error: error.message
    });
  } finally {
    client.release();
  }
});

/**
 * PATCH /api/v1/government-blockchain/aml-cases/:caseId/status
 */
router.patch('/:caseId/status', async (req, res) => {
  const client = await db.getClient();

  try {
    const { caseId } = req.params;
    const {
      status,
      actionBy = 'System',
      note = null
    } = req.body || {};

    if (!ALLOWED_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Allowed statuses: ${ALLOWED_STATUSES.join(', ')}`
      });
    }

    await client.query('BEGIN');

    const existing = await client.query(
      `
      SELECT *
      FROM blockchain.aml_cases
      WHERE case_id::text = $1
         OR case_number = $1
      LIMIT 1
      `,
      [caseId]
    );

    if (!existing.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'AML case not found.'
      });
    }

    const oldCase = existing.rows[0];

    const updated = await client.query(
      `
      UPDATE blockchain.aml_cases
      SET
        case_status = $2::varchar,
        reviewed_at = CASE WHEN $2::varchar IN ('In Review', 'Escalated', 'Closed') THEN now() ELSE reviewed_at END,
        escalated_at = CASE WHEN $2::varchar = 'Escalated' THEN now() ELSE escalated_at END,
        closed_at = CASE WHEN $2::varchar = 'Closed' THEN COALESCE(closed_at, now()) ELSE closed_at END,
        updated_at = now()
      WHERE case_id = $1
      RETURNING *
      `,
      [oldCase.case_id, status]
    );

    await insertCaseAction(client, {
      caseId: oldCase.case_id,
      actionType: 'STATUS_CHANGED',
      oldStatus: oldCase.case_status,
      newStatus: status,
      actionBy,
      actionNote: note || `Status changed from ${oldCase.case_status} to ${status}`
    });

    await client.query('COMMIT');

    return res.json({
      success: true,
      message: 'AML case status updated successfully.',
      data: updated.rows[0],
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[AML CASE STATUS ERROR]', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update AML case status.',
      error: error.message
    });
  } finally {
    client.release();
  }
});

/**
 * PATCH /api/v1/government-blockchain/aml-cases/:caseId/close
 */
router.patch('/:caseId/close', async (req, res) => {
  const client = await db.getClient();

  try {
    const { caseId } = req.params;
    const {
      closureReason,
      actionBy = 'System',
      note = null
    } = req.body || {};

    if (!closureReason) {
      return res.status(400).json({
        success: false,
        message: 'closureReason is required.'
      });
    }

    await client.query('BEGIN');

    const existing = await client.query(
      `
      SELECT *
      FROM blockchain.aml_cases
      WHERE case_id::text = $1
         OR case_number = $1
      LIMIT 1
      `,
      [caseId]
    );

    if (!existing.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'AML case not found.'
      });
    }

    const oldCase = existing.rows[0];

    const updated = await client.query(
      `
      UPDATE blockchain.aml_cases
      SET
        case_status = 'Closed',
        closure_reason = $2,
        closed_at = now(),
        reviewed_at = COALESCE(reviewed_at, now()),
        updated_at = now()
      WHERE case_id = $1
      RETURNING *
      `,
      [oldCase.case_id, closureReason]
    );

    await insertCaseAction(client, {
      caseId: oldCase.case_id,
      actionType: 'CLOSED',
      oldStatus: oldCase.case_status,
      newStatus: 'Closed',
      actionBy,
      actionNote: note || closureReason
    });

    await client.query('COMMIT');

    return res.json({
      success: true,
      message: 'AML case closed successfully.',
      data: updated.rows[0],
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[AML CASE CLOSE ERROR]', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to close AML case.',
      error: error.message
    });
  } finally {
    client.release();
  }
});

module.exports = router;
