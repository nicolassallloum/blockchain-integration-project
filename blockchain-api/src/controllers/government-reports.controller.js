'use strict';

const db = require('../config/database');

function successResponse(res, data, message = 'Reports request completed successfully.') {
  return res.json({
    success: true,
    message,
    data,
    timestamp: new Date().toISOString()
  });
}

function errorResponse(res, error, message = 'Reports request failed.') {
  console.error('[Government Reports Error]', error);

  return res.status(500).json({
    success: false,
    message,
    error: error.message,
    timestamp: new Date().toISOString()
  });
}

function normalizeReportCode(value) {
  return String(value || '').trim().toUpperCase();
}

function normalizeFormat(value) {
  const format = String(value || 'PDF').trim().toUpperCase();

  if (['PDF', 'EXCEL', 'CSV'].includes(format)) {
    return format;
  }

  return 'PDF';
}

function normalizeGeneratedBy(value) {
  const generatedBy = String(value || '').trim();
  return generatedBy || 'Admin User';
}

function normalizeLimit(value, fallback = 10, max = 100) {
  const parsed = Number.parseInt(value, 10);

  if (Number.isNaN(parsed)) {
    return fallback;
  }

  return Math.min(Math.max(parsed, 1), max);
}

function generateReportNo() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const random = Math.floor(100000 + Math.random() * 900000);

  return `REP-${y}${m}${d}-${random}`;
}

async function tableExists(client, tableName) {
  const result = await client.query(
    `SELECT to_regclass($1) IS NOT NULL AS exists;`,
    [`blockchain.${tableName}`]
  );

  return Boolean(result.rows[0]?.exists);
}

async function getDashboard(req, res) {
  try {
    const summaryResult = await db.query(`
      SELECT
        (SELECT COUNT(*) FROM blockchain.report_templates WHERE COALESCE(is_active, TRUE) = TRUE)::int AS available_reports,
        (SELECT COUNT(*) FROM blockchain.generated_reports WHERE generated_at::date = CURRENT_DATE)::int AS generated_today,
        (SELECT COUNT(*) FROM blockchain.report_schedules WHERE COALESCE(is_active, TRUE) = TRUE)::int AS scheduled_reports,
        (
          SELECT COUNT(*)
          FROM blockchain.generated_reports
          WHERE UPPER(COALESCE(status, '')) IN ('FAILED', 'ERROR')
        )::int AS failed_reports;
    `);

    const templatesResult = await db.query(`
      SELECT
        report_template_id::text AS "reportTemplateId",
        report_code AS "reportCode",
        report_name AS "reportName",
        report_category AS "reportCategory",
        description,
        output_formats AS "outputFormats",
        is_active AS "isActive",
        created_at AS "createdAt"
      FROM blockchain.report_templates
      WHERE COALESCE(is_active, TRUE) = TRUE
      ORDER BY
        CASE report_code
          WHEN 'TRANSACTION_SUMMARY' THEN 1
          WHEN 'DIGITAL_STAMPS' THEN 2
          WHEN 'AML_COMPLIANCE' THEN 3
          WHEN 'BLOCKCHAIN_PROOF' THEN 4
          WHEN 'AUDIT_LOGS' THEN 5
          ELSE 99
        END,
        report_name;
    `);

    const recentResult = await db.query(`
      SELECT
        generated_report_id::text AS "generatedReportId",
        report_no AS "reportNo",
        report_code AS "reportCode",
        report_name AS "reportName",
        generated_by AS "generatedBy",
        format,
        status,
        file_path AS "filePath",
        filters,
        row_count AS "rowCount",
        error_message AS "errorMessage",
        generated_at AS "generatedAt"
      FROM blockchain.generated_reports
      ORDER BY generated_at DESC, report_no DESC
      LIMIT 10;
    `);

    const row = summaryResult.rows[0] || {};

    return successResponse(res, {
      summary: {
        availableReports: Number(row.available_reports || 0),
        generatedToday: Number(row.generated_today || 0),
        scheduledReports: Number(row.scheduled_reports || 0),
        failedReports: Number(row.failed_reports || 0)
      },
      reportCards: templatesResult.rows,
      recentReports: recentResult.rows
    }, 'Reports dashboard loaded successfully.');
  } catch (error) {
    return errorResponse(res, error, 'Failed to load reports dashboard.');
  }
}

async function getTemplates(req, res) {
  try {
    const result = await db.query(`
      SELECT
        report_template_id::text AS "reportTemplateId",
        report_code AS "reportCode",
        report_name AS "reportName",
        report_category AS "reportCategory",
        description,
        output_formats AS "outputFormats",
        is_active AS "isActive",
        created_at AS "createdAt"
      FROM blockchain.report_templates
      WHERE COALESCE(is_active, TRUE) = TRUE
      ORDER BY report_name;
    `);

    return successResponse(res, result.rows, 'Report templates loaded successfully.');
  } catch (error) {
    return errorResponse(res, error, 'Failed to load report templates.');
  }
}

async function getRecentReports(req, res) {
  try {
    const limit = normalizeLimit(req.query.limit, 10, 100);

    const result = await db.query(
      `
      SELECT
        generated_report_id::text AS "generatedReportId",
        report_no AS "reportNo",
        report_code AS "reportCode",
        report_name AS "reportName",
        generated_by AS "generatedBy",
        format,
        status,
        file_path AS "filePath",
        filters,
        row_count AS "rowCount",
        error_message AS "errorMessage",
        generated_at AS "generatedAt"
      FROM blockchain.generated_reports
      ORDER BY generated_at DESC, report_no DESC
      LIMIT $1;
      `,
      [limit]
    );

    return successResponse(res, result.rows, 'Recent generated reports loaded successfully.');
  } catch (error) {
    return errorResponse(res, error, 'Failed to load recent generated reports.');
  }
}

async function getTransactionSummaryReport(client) {
  const summary = await client.query(`
    SELECT
      COUNT(*)::int AS total_transactions,
      COUNT(*) FILTER (WHERE UPPER(COALESCE(transaction_status, '')) IN ('COMPLETED', 'APPROVED', 'SUCCESS'))::int AS completed_transactions,
      COUNT(*) FILTER (WHERE UPPER(COALESCE(transaction_status, '')) IN ('PENDING', 'IN_PROGRESS', 'SUBMITTED'))::int AS pending_transactions,
      COUNT(*) FILTER (WHERE UPPER(COALESCE(transaction_status, '')) IN ('FAILED', 'REJECTED', 'ERROR'))::int AS failed_transactions,
      COALESCE(SUM(COALESCE(total_fee, amount, 0)), 0)::numeric AS total_fees,
      COUNT(*) FILTER (WHERE created_at::date = CURRENT_DATE)::int AS transactions_today
    FROM blockchain.government_transactions;
  `);

  const byStatus = await client.query(`
    SELECT
      UPPER(COALESCE(transaction_status, 'UNKNOWN')) AS label,
      COUNT(*)::int AS value
    FROM blockchain.government_transactions
    GROUP BY UPPER(COALESCE(transaction_status, 'UNKNOWN'))
    ORDER BY value DESC, label ASC;
  `);

  const byMinistry = await client.query(`
    SELECT
      COALESCE(ministry_name, 'Unknown Ministry') AS label,
      COUNT(*)::int AS value,
      COALESCE(SUM(COALESCE(total_fee, amount, 0)), 0)::numeric AS amount
    FROM blockchain.government_transactions
    GROUP BY COALESCE(ministry_name, 'Unknown Ministry')
    ORDER BY value DESC, label ASC
    LIMIT 10;
  `);

  const recent = await client.query(`
    SELECT
      transaction_id::text AS "transactionId",
      transaction_reference AS "transactionReference",
      COALESCE(resident_full_name, resident_name, resident_id, 'Unknown Resident') AS "residentName",
      COALESCE(service_name, 'Unknown Service') AS "serviceName",
      COALESCE(ministry_name, 'Unknown Ministry') AS "ministryName",
      COALESCE(total_fee, amount, 0)::numeric AS "totalFee",
      COALESCE(currency_code, currency, 'GOV') AS "currencyCode",
      COALESCE(transaction_status, 'UNKNOWN') AS "status",
      COALESCE(blockchain_status, 'UNKNOWN') AS "blockchainStatus",
      created_at AS "createdAt"
    FROM blockchain.government_transactions
    ORDER BY created_at DESC NULLS LAST, transaction_id DESC
    LIMIT 20;
  `);

  return {
    reportCode: 'TRANSACTION_SUMMARY',
    title: 'Transaction Summary Report',
    summary: summary.rows[0] || {},
    charts: {
      byStatus: byStatus.rows,
      byMinistry: byMinistry.rows
    },
    rows: recent.rows
  };
}

async function getDigitalStampsReport(client) {
  const summary = await client.query(`
    SELECT
      COUNT(*)::int AS total_stamps,
      COUNT(*) FILTER (WHERE UPPER(COALESCE(stamp_status, '')) IN ('ISSUED', 'ACTIVE'))::int AS issued_or_active,
      COUNT(*) FILTER (WHERE UPPER(COALESCE(stamp_status, '')) = 'REDEEMED')::int AS redeemed,
      COUNT(*) FILTER (WHERE UPPER(COALESCE(stamp_status, '')) IN ('FAILED', 'EXPIRED', 'CANCELLED'))::int AS failed_or_expired,
      COALESCE(SUM(amount), 0)::numeric AS total_amount,
      COUNT(*) FILTER (WHERE created_at::date = CURRENT_DATE)::int AS issued_today
    FROM blockchain.digital_stamp_payments;
  `);

  const byStatus = await client.query(`
    SELECT
      UPPER(COALESCE(stamp_status, 'UNKNOWN')) AS label,
      COUNT(*)::int AS value
    FROM blockchain.digital_stamp_payments
    GROUP BY UPPER(COALESCE(stamp_status, 'UNKNOWN'))
    ORDER BY value DESC, label ASC;
  `);

  const recent = await client.query(`
    SELECT
      id::text AS "id",
      payment_ref AS "paymentRef",
      resident_name AS "residentName",
      service_name AS "serviceName",
      stamp_id AS "stampId",
      amount,
      currency_code AS "currencyCode",
      payment_status AS "paymentStatus",
      stamp_status AS "stampStatus",
      created_at AS "createdAt"
    FROM blockchain.digital_stamp_payments
    ORDER BY created_at DESC, id DESC
    LIMIT 20;
  `);

  return {
    reportCode: 'DIGITAL_STAMPS',
    title: 'Digital Stamps Report',
    summary: summary.rows[0] || {},
    charts: {
      byStatus: byStatus.rows
    },
    rows: recent.rows
  };
}

async function getAmlComplianceReport(client) {
  const summary = await client.query(`
    SELECT
      (SELECT COUNT(*) FROM blockchain.aml_alerts)::int AS total_alerts,
      (
        SELECT COUNT(*)
        FROM blockchain.aml_alerts
        WHERE UPPER(COALESCE(alert_status, 'OPEN')) IN ('OPEN', 'NEW', 'PENDING', 'PENDING_REVIEW', 'IN_REVIEW', 'REVIEW')
      )::int AS open_alerts,
      (
        SELECT COUNT(*)
        FROM blockchain.aml_alerts
        WHERE UPPER(COALESCE(severity, '')) IN ('HIGH', 'CRITICAL')
           OR COALESCE(risk_score, 0) >= 71
      )::int AS high_risk_alerts,
      (
        SELECT COUNT(*)
        FROM blockchain.aml_cases
      )::int AS total_cases,
      (
        SELECT COUNT(*)
        FROM blockchain.aml_cases
        WHERE UPPER(COALESCE(case_status, 'OPEN')) IN ('OPEN', 'IN_REVIEW', 'ESCALATED')
      )::int AS open_cases;
  `);

  const bySeverity = await client.query(`
    SELECT
      UPPER(COALESCE(severity, 'UNKNOWN')) AS label,
      COUNT(*)::int AS value
    FROM blockchain.aml_alerts
    GROUP BY UPPER(COALESCE(severity, 'UNKNOWN'))
    ORDER BY value DESC, label ASC;
  `);

  const byStatus = await client.query(`
    SELECT
      UPPER(COALESCE(alert_status, 'UNKNOWN')) AS label,
      COUNT(*)::int AS value
    FROM blockchain.aml_alerts
    GROUP BY UPPER(COALESCE(alert_status, 'UNKNOWN'))
    ORDER BY value DESC, label ASC;
  `);

  const recent = await client.query(`
    SELECT
      alert_id::text AS "alertId",
      COALESCE(customer_id, wallet_address, 'Unknown Customer') AS "customerId",
      COALESCE(rule_code, 'UNKNOWN_RULE') AS "ruleCode",
      COALESCE(alert_status, 'OPEN') AS "status",
      COALESCE(severity, 'UNKNOWN') AS "severity",
      COALESCE(risk_score, 0)::int AS "riskScore",
      reason,
      reviewed_by AS "reviewedBy",
      reviewed_at AS "reviewedAt",
      created_at AS "createdAt"
    FROM blockchain.aml_alerts
    ORDER BY created_at DESC NULLS LAST
    LIMIT 20;
  `);

  return {
    reportCode: 'AML_COMPLIANCE',
    title: 'AML Compliance Report',
    summary: summary.rows[0] || {},
    charts: {
      bySeverity: bySeverity.rows,
      byStatus: byStatus.rows
    },
    rows: recent.rows
  };
}

async function buildProofUnion(client) {
  const parts = [];

  if (await tableExists(client, 'government_ministry_wallets')) {
    parts.push(`
      SELECT
        CONCAT('PROOF-WALLET-MINISTRY-', wallet_id::text) AS proof_id,
        'Wallet Creation Proof'::text AS proof_type,
        'MINISTRY_WALLET'::text AS entity_type,
        wallet_id::text AS entity_id,
        COALESCE(tx_id, ledger_reference) AS blockchain_transaction_hash,
        COALESCE(blockchain_status, wallet_status, 'UNKNOWN') AS blockchain_status,
        created_at AS submitted_date,
        'government_ministry_wallets'::text AS source_table
      FROM blockchain.government_ministry_wallets
      WHERE COALESCE(tx_id, ledger_reference, blockchain_status) IS NOT NULL
    `);
  }

  if (await tableExists(client, 'resident_wallets')) {
    parts.push(`
      SELECT
        CONCAT('PROOF-WALLET-RESIDENT-', id::text) AS proof_id,
        'Wallet Creation Proof'::text AS proof_type,
        'RESIDENT_WALLET'::text AS entity_type,
        COALESCE(resident_id, id::text) AS entity_id,
        fabric_tx_id AS blockchain_transaction_hash,
        COALESCE(blockchain_status, wallet_status, 'UNKNOWN') AS blockchain_status,
        created_at AS submitted_date,
        'resident_wallets'::text AS source_table
      FROM blockchain.resident_wallets
      WHERE COALESCE(fabric_tx_id, blockchain_status) IS NOT NULL
    `);
  }

  if (await tableExists(client, 'government_transactions')) {
    parts.push(`
      SELECT
        CONCAT('PROOF-TXN-', transaction_id::text) AS proof_id,
        'Transaction Approval Proof'::text AS proof_type,
        'GOVERNMENT_TRANSACTION'::text AS entity_type,
        COALESCE(transaction_reference, transaction_id::text) AS entity_id,
        blockchain_tx_id AS blockchain_transaction_hash,
        COALESCE(blockchain_status, transaction_status, 'UNKNOWN') AS blockchain_status,
        COALESCE(blockchain_submitted_at, updated_at, created_at) AS submitted_date,
        'government_transactions'::text AS source_table
      FROM blockchain.government_transactions
      WHERE COALESCE(blockchain_tx_id, blockchain_status) IS NOT NULL
    `);
  }

  if (await tableExists(client, 'transaction_documents')) {
    parts.push(`
      SELECT
        CONCAT('PROOF-DOC-', id::text) AS proof_id,
        'Document Verification Proof'::text AS proof_type,
        'TRANSACTION_DOCUMENT'::text AS entity_type,
        COALESCE(transaction_reference, transaction_id::text, id::text) AS entity_id,
        document_hash AS blockchain_transaction_hash,
        COALESCE(status, 'DOCUMENT_HASHED') AS blockchain_status,
        COALESCE(updated_at, created_at) AS submitted_date,
        'transaction_documents'::text AS source_table
      FROM blockchain.transaction_documents
      WHERE COALESCE(document_hash, status) IS NOT NULL
    `);
  }

  if (await tableExists(client, 'digital_stamp_payments')) {
    parts.push(`
      SELECT
        CONCAT('PROOF-STAMP-', id::text) AS proof_id,
        'Digital Stamp Proof'::text AS proof_type,
        'DIGITAL_STAMP'::text AS entity_type,
        COALESCE(stamp_id, payment_ref, id::text) AS entity_id,
        COALESCE(stamp_id, payment_ref) AS blockchain_transaction_hash,
        COALESCE(stamp_status, payment_status, 'UNKNOWN') AS blockchain_status,
        created_at AS submitted_date,
        'digital_stamp_payments'::text AS source_table
      FROM blockchain.digital_stamp_payments
      WHERE COALESCE(stamp_id, payment_ref, stamp_status, payment_status) IS NOT NULL
    `);
  }

  if (parts.length === 0) {
    return `
      SELECT
        NULL::text AS proof_id,
        NULL::text AS proof_type,
        NULL::text AS entity_type,
        NULL::text AS entity_id,
        NULL::text AS blockchain_transaction_hash,
        NULL::text AS blockchain_status,
        NULL::timestamp AS submitted_date,
        NULL::text AS source_table
      WHERE FALSE
    `;
  }

  return parts.join('\nUNION ALL\n');
}

async function getBlockchainProofReport(client) {
  const proofUnion = await buildProofUnion(client);

  const summary = await client.query(`
    WITH proofs AS (
      ${proofUnion}
    )
    SELECT
      COUNT(*)::int AS total_proofs,
      COUNT(*) FILTER (WHERE UPPER(COALESCE(blockchain_status, '')) IN ('SUCCESS', 'COMPLETED', 'APPROVED', 'VALID', 'REDEEMED', 'ISSUED', 'ACTIVE'))::int AS successful_proofs,
      COUNT(*) FILTER (WHERE UPPER(COALESCE(blockchain_status, '')) IN ('FAILED', 'ERROR', 'REJECTED', 'INVALID'))::int AS failed_proofs,
      COUNT(*) FILTER (WHERE submitted_date::date = CURRENT_DATE)::int AS proofs_today
    FROM proofs;
  `);

  const byType = await client.query(`
    WITH proofs AS (
      ${proofUnion}
    )
    SELECT
      COALESCE(proof_type, 'UNKNOWN') AS label,
      COUNT(*)::int AS value
    FROM proofs
    GROUP BY COALESCE(proof_type, 'UNKNOWN')
    ORDER BY value DESC, label ASC;
  `);

  const recent = await client.query(`
    WITH proofs AS (
      ${proofUnion}
    )
    SELECT
      proof_id AS "proofId",
      proof_type AS "proofType",
      entity_type AS "entityType",
      entity_id AS "entityId",
      blockchain_transaction_hash AS "blockchainTransactionHash",
      blockchain_status AS "blockchainStatus",
      submitted_date AS "submittedDate",
      source_table AS "sourceTable"
    FROM proofs
    ORDER BY submitted_date DESC NULLS LAST, proof_id DESC
    LIMIT 20;
  `);

  return {
    reportCode: 'BLOCKCHAIN_PROOF',
    title: 'Blockchain Proof Report',
    summary: summary.rows[0] || {},
    charts: {
      byType: byType.rows
    },
    rows: recent.rows
  };
}

async function getAuditLogsReport(client) {
  const summary = await client.query(`
    SELECT
      COUNT(*)::int AS total_events,
      COUNT(*) FILTER (WHERE UPPER(COALESCE(status, action_status, event_status, '')) IN ('SUCCESS', 'COMPLETED'))::int AS success_events,
      COUNT(*) FILTER (WHERE UPPER(COALESCE(status, action_status, event_status, '')) IN ('FAILED', 'ERROR'))::int AS failed_events,
      COUNT(*) FILTER (WHERE COALESCE(event_at, created_at)::date = CURRENT_DATE)::int AS events_today,
      COUNT(DISTINCT COALESCE(actor_name, actor_id, created_by))::int AS unique_actors
    FROM blockchain.audit_logs;
  `);

  const bySeverity = await client.query(`
    SELECT
      UPPER(COALESCE(severity, 'INFO')) AS label,
      COUNT(*)::int AS value
    FROM blockchain.audit_logs
    GROUP BY UPPER(COALESCE(severity, 'INFO'))
    ORDER BY value DESC, label ASC;
  `);

  const byModule = await client.query(`
    SELECT
      COALESCE(module_name, source_system, entity_type, 'Unknown Module') AS label,
      COUNT(*)::int AS value
    FROM blockchain.audit_logs
    GROUP BY COALESCE(module_name, source_system, entity_type, 'Unknown Module')
    ORDER BY value DESC, label ASC
    LIMIT 10;
  `);

  const recent = await client.query(`
    SELECT
      audit_log_id::text AS "auditLogId",
      COALESCE(entity_type, module_name, 'UNKNOWN') AS "entityType",
      entity_id AS "entityId",
      COALESCE(action_name, action, event_type, 'UNKNOWN_ACTION') AS "action",
      COALESCE(actor_name, actor_id, created_by, 'SYSTEM') AS "actor",
      COALESCE(status, action_status, event_status, 'UNKNOWN') AS "status",
      COALESCE(severity, 'INFO') AS "severity",
      COALESCE(event_at, created_at) AS "eventAt",
      COALESCE(event_description, error_message, '') AS "description"
    FROM blockchain.audit_logs
    ORDER BY COALESCE(event_at, created_at) DESC NULLS LAST
    LIMIT 20;
  `);

  return {
    reportCode: 'AUDIT_LOGS',
    title: 'Audit Logs Report',
    summary: summary.rows[0] || {},
    charts: {
      bySeverity: bySeverity.rows,
      byModule: byModule.rows
    },
    rows: recent.rows
  };
}

async function getReportDataByCode(client, reportCode) {
  switch (reportCode) {
    case 'TRANSACTION_SUMMARY':
      return getTransactionSummaryReport(client);
    case 'DIGITAL_STAMPS':
      return getDigitalStampsReport(client);
    case 'AML_COMPLIANCE':
      return getAmlComplianceReport(client);
    case 'BLOCKCHAIN_PROOF':
      return getBlockchainProofReport(client);
    case 'AUDIT_LOGS':
      return getAuditLogsReport(client);
    default:
      return null;
  }
}

async function getReportDetails(req, res) {
  const client = await db.getClient();

  try {
    const reportCode = normalizeReportCode(req.params.reportCode);

    const report = await getReportDataByCode(client, reportCode);

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report template not found.',
        timestamp: new Date().toISOString()
      });
    }

    return successResponse(res, report, 'Report details loaded successfully.');
  } catch (error) {
    return errorResponse(res, error, 'Failed to load report details.');
  } finally {
    client.release();
  }
}

async function countReportRows(client, reportCode) {
  if (reportCode === 'TRANSACTION_SUMMARY') {
    const result = await client.query(`SELECT COUNT(*)::int AS count FROM blockchain.government_transactions;`);
    return Number(result.rows[0]?.count || 0);
  }

  if (reportCode === 'DIGITAL_STAMPS') {
    const result = await client.query(`SELECT COUNT(*)::int AS count FROM blockchain.digital_stamp_payments;`);
    return Number(result.rows[0]?.count || 0);
  }

  if (reportCode === 'AML_COMPLIANCE') {
    const result = await client.query(`
      SELECT
        (
          (SELECT COUNT(*) FROM blockchain.aml_alerts) +
          (SELECT COUNT(*) FROM blockchain.aml_cases)
        )::int AS count;
    `);
    return Number(result.rows[0]?.count || 0);
  }

  if (reportCode === 'BLOCKCHAIN_PROOF') {
    const proofUnion = await buildProofUnion(client);
    const result = await client.query(`
      WITH proofs AS (
        ${proofUnion}
      )
      SELECT COUNT(*)::int AS count FROM proofs;
    `);
    return Number(result.rows[0]?.count || 0);
  }

  if (reportCode === 'AUDIT_LOGS') {
    const result = await client.query(`SELECT COUNT(*)::int AS count FROM blockchain.audit_logs;`);
    return Number(result.rows[0]?.count || 0);
  }

  return 0;
}

async function generateReport(req, res) {
  const client = await db.getClient();

  try {
    const reportCode = normalizeReportCode(req.body?.reportCode || req.body?.report_code);
    const format = normalizeFormat(req.body?.format);
    const generatedBy = normalizeGeneratedBy(req.body?.generatedBy || req.body?.generated_by);
    const filters = req.body?.filters && typeof req.body.filters === 'object'
      ? req.body.filters
      : {};

    if (!reportCode) {
      return res.status(400).json({
        success: false,
        message: 'reportCode is required.',
        timestamp: new Date().toISOString()
      });
    }

    await client.query('BEGIN');

    const templateResult = await client.query(
      `
      SELECT
        report_template_id,
        report_code,
        report_name
      FROM blockchain.report_templates
      WHERE report_code = $1
        AND COALESCE(is_active, TRUE) = TRUE;
      `,
      [reportCode]
    );

    if (!templateResult.rowCount) {
      await client.query('ROLLBACK');

      return res.status(404).json({
        success: false,
        message: 'Active report template not found.',
        timestamp: new Date().toISOString()
      });
    }

    const template = templateResult.rows[0];
    const rowCount = await countReportRows(client, reportCode);
    const reportNo = generateReportNo();

    const insertResult = await client.query(
      `
      INSERT INTO blockchain.generated_reports (
        report_no,
        report_template_id,
        report_code,
        report_name,
        generated_by,
        format,
        status,
        file_path,
        filters,
        row_count,
        error_message
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        'GENERATED',
        NULL,
        $7::jsonb,
        $8,
        NULL
      )
      RETURNING
        generated_report_id::text AS "generatedReportId",
        report_no AS "reportNo",
        report_code AS "reportCode",
        report_name AS "reportName",
        generated_by AS "generatedBy",
        format,
        status,
        file_path AS "filePath",
        filters,
        row_count AS "rowCount",
        error_message AS "errorMessage",
        generated_at AS "generatedAt";
      `,
      [
        reportNo,
        template.report_template_id,
        template.report_code,
        template.report_name,
        generatedBy,
        format,
        JSON.stringify(filters),
        rowCount
      ]
    );

    await client.query('COMMIT');

    return successResponse(
      res,
      insertResult.rows[0],
      'Report generated and saved successfully.'
    );
  } catch (error) {
    await client.query('ROLLBACK');
    return errorResponse(res, error, 'Failed to generate report.');
  } finally {
    client.release();
  }
}

module.exports = {
  getDashboard,
  getTemplates,
  getRecentReports,
  getReportDetails,
  generateReport
};
