// src/routes/audit-validation.routes.js
// Mount under /api/v1/audit-validation
// Reads real audit events from application PostgreSQL: blockchain.audit_events.

const express = require('express');
const router = express.Router();

const { applicationPostgres } = require('../db/applicationPostgres');
const { submitAuditValidationProof } = require('../services/auditProof.service');
const fabricService = require('../services/fabric.service');

const ALLOWED_ACTION_TYPES = new Set(['INSERT', 'UPDATE', 'DELETE']);
const ALLOWED_HASH_STATUSES = new Set(['PENDING', 'VALID', 'INVALID']);
const ALLOWED_VALIDATION_STATUSES = new Set(['PENDING', 'APPROVED', 'REJECTED']);
const ALLOWED_BLOCKCHAIN_STATUSES = new Set(['NOT_SUBMITTED', 'SUBMITTED', 'FAILED']);

function getActor(req) {
  return (
    req.user?.username ||
    req.user?.email ||
    req.headers['x-application-user'] ||
    req.headers['x-user'] ||
    'api_user'
  );
}

function intOrDefault(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

function addFilter({ clauses, values }, column, value, validator) {
  if (value === undefined || value === null || value === '') return;
  if (validator && !validator(value)) {
    const err = new Error(`Invalid filter value for ${column}`);
    err.statusCode = 400;
    throw err;
  }
  values.push(value);
  clauses.push(`${column} = $${values.length}`);
}

function buildEventsFilter(query) {
  const clauses = [];
  const values = [];

  addBusinessObjectFilter({ clauses, values }, query.source_object);
  addFilter(
    { clauses, values },
    'action_type',
    query.action_type,
    (v) => ALLOWED_ACTION_TYPES.has(v)
  );
  addFilter(
    { clauses, values },
    'hash_status',
    query.hash_status,
    (v) => ALLOWED_HASH_STATUSES.has(v)
  );
  addFilter(
    { clauses, values },
    'validation_status',
    query.validation_status,
    (v) => ALLOWED_VALIDATION_STATUSES.has(v)
  );
  addFilter(
    { clauses, values },
    'blockchain_status',
    query.blockchain_status,
    (v) => ALLOWED_BLOCKCHAIN_STATUSES.has(v)
  );

  if (query.date_from) {
    values.push(query.date_from);
    clauses.push(`changed_at >= $${values.length}::timestamptz`);
  }

  if (query.date_to) {
    values.push(query.date_to);
    clauses.push(`changed_at < $${values.length}::timestamptz`);
  }

  return {
    whereSql: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
    values,
  };
}


const AUDIT_BUSINESS_OBJECT_SOURCE_MAP = {
  transactions: [
    'Transactions',
    'findba.fin_transaction',
    'blockchain.v_transactions',
    'fin_transaction'
  ],
  aml_alerts: [
    'AML Alerts',
    'sdedba.ref_com_snction_lst_cust_mtch',
    'blockchain.v_aml_alert_by_customer',
    'ref_com_snction_lst_cust_mtch'
  ],
  queries: [
    'Queries',
    'qbedba.qbe_user_query',
    'qbedba.qbe_user_query_details',
    'blockchain.v_queries',
    'qbe_user_query',
    'qbe_user_query_details'
  ],
  customers: [
    'Customers',
    'sdedba.ref_customer',
    'sdedba.cfg_customer_def',
    'sdedba.ref_customer_misc_info',
    'blockchain.v_customers',
    'ref_customer',
    'cfg_customer_def',
    'ref_customer_misc_info'
  ],
  aml_rules: [
    'AML Rules',
    'suitedba.br_business_rule_definition',
    'suitedba.br_business_rule_query',
    'suitedba.br_business_rule_message',
    'blockchain.v_aml_rules',
    'br_business_rule_definition',
    'br_business_rule_query',
    'br_business_rule_message'
  ]
};

function normalizeBusinessObjectKey(value = '') {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function addBusinessObjectFilter(state, value) {
  if (!value) return;

  const key = normalizeBusinessObjectKey(value);
  const sources = AUDIT_BUSINESS_OBJECT_SOURCE_MAP[key] || [value];

  const parts = [];

  for (const source of sources) {
    state.values.push(`%${source}%`);
    const paramIndex = state.values.length;

    parts.push(`source_object::text ILIKE $${paramIndex}`);
  }

  state.clauses.push(`(${parts.join(' OR ')})`);
}

function addRecordPkSearchFilter(state, value, field = '') {
  const cleanValue = String(value || '').trim();
  const cleanField = String(field || '').trim();

  if (!cleanValue) return;

  if (cleanField) {
    state.values.push(`${cleanField}=${cleanValue}`);
    state.clauses.push(`record_pk::text = $${state.values.length}`);
    return;
  }

  if (cleanValue.includes('=')) {
    state.values.push(cleanValue);
    state.clauses.push(`record_pk::text = $${state.values.length}`);
    return;
  }

  state.values.push(`%=${cleanValue}`);
  state.clauses.push(`record_pk::text ILIKE $${state.values.length}`);
}



function addStrictRecordPkFieldValueFilter(state, field, value) {
  const cleanField = String(field || '').trim();
  const cleanValue = String(value || '').trim();

  if (!cleanValue) {
    return;
  }

  if (cleanField) {
    state.values.push(`${cleanField}=${cleanValue}`);
    state.clauses.push(`record_pk::text = $${state.values.length}`);
    return;
  }

  if (cleanValue.includes('=')) {
    state.values.push(cleanValue);
    state.clauses.push(`record_pk::text = $${state.values.length}`);
    return;
  }

  state.values.push(`%=${cleanValue}`);
  state.clauses.push(`record_pk::text ILIKE $${state.values.length}`);
}

router.get('/events', async (req, res, next) => {
  try {
    const limit = intOrDefault(req.query.limit, 50, 1, 500);
    const offset = intOrDefault(req.query.offset, 0, 0, 1000000);
    const { whereSql, values } = buildEventsFilter(req.query);

    const countSql = `
      SELECT count(*)::bigint AS total
      FROM blockchain.audit_events
      ${whereSql}
    `;

    const dataSql = `
      SELECT
        id,
        event_id,
        source_system,
        source_database,
        source_schema,
        source_object,
        source_table,
        source_view,
        record_pk,
        record_pk_field,
        action_type,
        changed_by,
        changed_at,
        application_user,
        request_id,
        correlation_id,
        hash_value,
        recalculated_hash,
        hash_status,
        validation_status,
        blockchain_status,
        blockchain_tx_id,
        ledger_key,
        couchdb_doc_id,
        submitted_at,
        submit_error,
        approved_by,
        approved_at,
        rejected_by,
        rejected_at,
        reject_reason,
        created_at,
        updated_at
      FROM blockchain.audit_events
      ${whereSql}
      ORDER BY changed_at DESC, id DESC
      LIMIT $${values.length + 1}
      OFFSET $${values.length + 2}
    `;

    const [countResult, dataResult] = await Promise.all([
      applicationPostgres.query(countSql, values),
      applicationPostgres.query(dataSql, [...values, limit, offset]),
    ]);

    res.json({
      total: Number(countResult.rows[0]?.total || 0),
      limit,
      offset,
      events: dataResult.rows,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/events/:eventId', async (req, res, next) => {
  try {
    const result = await applicationPostgres.query(
      `
      SELECT *
      FROM blockchain.audit_events
      WHERE event_id = $1
      `,
      [req.params.eventId]
    );

    if (!result.rowCount) {
      return res.status(404).json({ message: 'Audit event not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.post('/events/:eventId/validate', async (req, res, next) => {
  const client = await applicationPostgres.connect();

  try {
    await client.query('BEGIN');

    const result = await client.query(
      `
      SELECT *
      FROM blockchain.audit_events
      WHERE event_id = $1
      FOR UPDATE
      `,
      [req.params.eventId]
    );

    if (!result.rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Audit event not found' });
    }

    const event = result.rows[0];

    // Recalculate inside PostgreSQL from the stored row.
    // This preserves timestamptz microseconds and avoids JS Date millisecond truncation.
    const hashResult = await client.query(
      `
      SELECT blockchain.audit_event_hash(
        event_id,
        source_system,
        source_database,
        source_schema,
        source_object,
        source_table,
        source_view,
        record_pk,
        action_type,
        old_data,
        new_data,
        changed_by,
        changed_at,
        application_user,
        request_id,
        correlation_id
      ) AS recalculated_hash
      FROM blockchain.audit_events
      WHERE event_id = $1
      `,
      [event.event_id]
    );

    const recalculatedHash = hashResult.rows[0].recalculated_hash;
    const hashStatus = recalculatedHash === event.hash_value ? 'VALID' : 'INVALID';

    const updateResult = await client.query(
      `
      UPDATE blockchain.audit_events
      SET
        recalculated_hash = $2,
        hash_status = $3
      WHERE event_id = $1
      RETURNING *
      `,
      [event.event_id, recalculatedHash, hashStatus]
    );

    await client.query('COMMIT');

    res.json({
      message: hashStatus === 'VALID' ? 'Hash validation passed' : 'Hash validation failed',
      event: updateResult.rows[0],
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

router.post('/events/:eventId/approve', async (req, res, next) => {
  try {
    const actor = getActor(req);

    const result = await applicationPostgres.query(
      `
      UPDATE blockchain.audit_events
      SET
        validation_status = 'APPROVED',
        approved_by = $2,
        approved_at = now(),
        rejected_by = NULL,
        rejected_at = NULL,
        reject_reason = NULL
      WHERE event_id = $1
        AND hash_status = 'VALID'
      RETURNING *
      `,
      [req.params.eventId, actor]
    );

    if (!result.rowCount) {
      return res.status(400).json({
        message: 'Event not found or hash_status is not VALID',
      });
    }

    res.json({
      message: 'Audit event approved',
      event: result.rows[0],
    });
  } catch (err) {
    next(err);
  }
});

router.post('/events/:eventId/reject', async (req, res, next) => {
  try {
    const actor = getActor(req);
    const reason = req.body?.reason || null;

    const result = await applicationPostgres.query(
      `
      UPDATE blockchain.audit_events
      SET
        validation_status = 'REJECTED',
        rejected_by = $2,
        rejected_at = now(),
        reject_reason = $3,
        approved_by = NULL,
        approved_at = NULL
      WHERE event_id = $1
      RETURNING *
      `,
      [req.params.eventId, actor, reason]
    );

    if (!result.rowCount) {
      return res.status(404).json({ message: 'Audit event not found' });
    }

    res.json({
      message: 'Audit event rejected',
      event: result.rows[0],
    });
  } catch (err) {
    next(err);
  }
});

router.post('/events/:eventId/submit-blockchain', async (req, res, next) => {
  const client = await applicationPostgres.connect();

  try {
    await client.query('BEGIN');

    const result = await client.query(
      `
      SELECT *
      FROM blockchain.audit_events
      WHERE event_id = $1
      FOR UPDATE
      `,
      [req.params.eventId]
    );

    if (!result.rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Audit event not found' });
    }

    const event = result.rows[0];

    if (event.hash_status !== 'VALID') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        message: 'Only VALID audit events can be submitted to blockchain',
      });
    }

    if (event.validation_status !== 'APPROVED') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        message: 'Only APPROVED audit events can be submitted to blockchain',
      });
    }

    const proofPayload = {
      event_id: event.event_id,
      source_schema: event.source_schema,
      source_object: event.source_object,
      source_table: event.source_table,
      record_pk: event.record_pk,
      action_type: event.action_type,
      hash_value: event.hash_value,
      changed_at: event.changed_at,
      approved_at: event.approved_at,
    };

    try {
      const fabricResult = await submitAuditValidationProof(event.event_id, proofPayload);

      const updateResult = await client.query(
        `
        UPDATE blockchain.audit_events
        SET
          blockchain_status = 'SUBMITTED',
          blockchain_tx_id = $2,
          ledger_key = $3,
          couchdb_doc_id = $4,
          submitted_at = now(),
          submit_error = NULL
        WHERE event_id = $1
        RETURNING *
        `,
        [
          event.event_id,
          fabricResult.blockchain_tx_id,
          fabricResult.ledger_key,
          fabricResult.couchdb_doc_id,
        ]
      );

      await client.query('COMMIT');

      return res.json({
        message: 'Audit validation proof submitted to blockchain',
        proof_payload: proofPayload,
        fabric_result: fabricResult.raw,
        event: updateResult.rows[0],
      });
    } catch (fabricErr) {
      const updateResult = await client.query(
        `
        UPDATE blockchain.audit_events
        SET
          blockchain_status = 'FAILED',
          submit_error = $2
        WHERE event_id = $1
        RETURNING *
        `,
        [event.event_id, fabricErr.message]
      );

      await client.query('COMMIT');

      return res.status(502).json({
        message: 'Blockchain submission failed',
        error: fabricErr.message,
        proof_payload: proofPayload,
        event: updateResult.rows[0],
      });
    }
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});


router.get('/events/:eventId/blockchain-proof', async (req, res, next) => {
  try {
    const result = await applicationPostgres.query(
      `
      SELECT
        event_id,
        hash_value,
        blockchain_status,
        blockchain_tx_id,
        ledger_key
      FROM blockchain.audit_events
      WHERE event_id = $1
      `,
      [req.params.eventId]
    );

    if (!result.rowCount) {
      return res.status(404).json({
        exists: false,
        message: 'Audit event not found in PostgreSQL',
      });
    }

    const event = result.rows[0];

    if (!event.ledger_key) {
      return res.json({
        exists: false,
        postgresql_event_exists: true,
        blockchain_status: event.blockchain_status,
        message: 'No ledger_key saved for this audit event',
        event,
      });
    }

    let proof = null;
    let verified = false;

    try {
      const proofResult = await fabricService.evaluateTransaction(
        'GetAuditEventProof',
        [event.ledger_key]
      );

      proof = Buffer.isBuffer(proofResult)
        ? proofResult.toString('utf8')
        : proofResult;

      const verifyResult = await fabricService.evaluateTransaction(
        'VerifyAuditEventProof',
        [event.ledger_key, event.hash_value]
      );

      let verifyData = verifyResult;

      if (Buffer.isBuffer(verifyData)) {
        verifyData = verifyData.toString('utf8');
      }

      if (typeof verifyData === 'string') {
        try {
          verifyData = JSON.parse(verifyData);
        } catch {
          verifyData = { raw: verifyData };
        }
      }

      if (verifyData && verifyData.data) {
        verifyData = verifyData.data;
      }

      verified =
        verifyData === true ||
        verifyData?.verified === true ||
        verifyData?.status === 'VERIFIED' ||
        proof?.data?.auditEventHash === event.hash_value;
    } catch (fabricErr) {
      return res.status(404).json({
        exists: false,
        postgresql_event_exists: true,
        blockchain_status: event.blockchain_status,
        ledger_key: event.ledger_key,
        message: 'Proof not found or not readable from blockchain',
        error: fabricErr.message,
      });
    }

    return res.json({
      exists: true,
      verified,
      postgresql_event_exists: true,
      blockchain_status: event.blockchain_status,
      blockchain_tx_id: event.blockchain_tx_id,
      ledger_key: event.ledger_key,
      proof,
    });
  } catch (err) {
    next(err);
  }
});


router.get('/dashboard', async (req, res, next) => {
  try {
    const [
      dailyResult,
      totalActionsResult,
      hashStatusResult,
      validationStatusResult,
      blockchainStatusResult,
      objectResult,
    ] = await Promise.all([
      applicationPostgres.query(`
        WITH days AS (
          SELECT generate_series(
            current_date - interval '29 days',
            current_date,
            interval '1 day'
          )::date AS audit_day
        ),
        actions AS (
          SELECT unnest(ARRAY['INSERT','UPDATE','DELETE']) AS action_type
        )
        SELECT
          to_char(d.audit_day, 'YYYY-MM-DD') AS audit_day,
          a.action_type,
          COUNT(e.id)::int AS total_count
        FROM days d
        CROSS JOIN actions a
        LEFT JOIN blockchain.audit_events e
          ON e.changed_at::date = d.audit_day
         AND e.action_type = a.action_type
        GROUP BY d.audit_day, a.action_type
        ORDER BY d.audit_day, a.action_type;
      `),

      applicationPostgres.query(`
        SELECT
          action_type,
          COUNT(*)::int AS total_count
        FROM blockchain.audit_events
        GROUP BY action_type;
      `),

      applicationPostgres.query(`
        SELECT
          COALESCE(hash_status, 'PENDING') AS status,
          COUNT(*)::int AS total_count
        FROM blockchain.audit_events
        GROUP BY COALESCE(hash_status, 'PENDING');
      `),

      applicationPostgres.query(`
        SELECT
          COALESCE(validation_status, 'PENDING') AS status,
          COUNT(*)::int AS total_count
        FROM blockchain.audit_events
        GROUP BY COALESCE(validation_status, 'PENDING');
      `),

      applicationPostgres.query(`
        SELECT
          COALESCE(blockchain_status, 'NOT_SUBMITTED') AS status,
          COUNT(*)::int AS total_count
        FROM blockchain.audit_events
        GROUP BY COALESCE(blockchain_status, 'NOT_SUBMITTED');
      `),

      applicationPostgres.query(`
        SELECT
          source_object,
          CASE source_object
            WHEN 'blockchain.v_aml_rules' THEN 'AML Rules'
            WHEN 'blockchain.v_aml_alert_by_customer' THEN 'AML Alerts'
            WHEN 'blockchain.v_customers' THEN 'Customers'
            WHEN 'blockchain.v_transactions' THEN 'Transactions'
            WHEN 'blockchain.v_queries' THEN 'Queries'
            ELSE source_object
          END AS object_label,
          COUNT(*)::int AS total_count
        FROM blockchain.audit_events
        GROUP BY source_object
        ORDER BY total_count DESC;
      `),
    ]);

    const daily = {
      INSERT: [],
      UPDATE: [],
      DELETE: [],
    };

    dailyResult.rows.forEach((row) => {
      daily[row.action_type].push({
        day: row.audit_day,
        count: row.total_count,
      });
    });

    const totals = {
      INSERT: 0,
      UPDATE: 0,
      DELETE: 0,
    };

    totalActionsResult.rows.forEach((row) => {
      totals[row.action_type] = row.total_count;
    });

    return res.json({
      daily,
      totals,
      hashStatus: hashStatusResult.rows,
      validationStatus: validationStatusResult.rows,
      blockchainStatus: blockchainStatusResult.rows,
      actionCounts: totalActionsResult.rows,
      objectCounts: objectResult.rows,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
