const express = require('express');
const { Pool } = require('pg');

const router = express.Router();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'blockchain_project_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

function requireUiSecret(req, res, next) {
  if (process.env.PGADMIN_UI_ENABLED !== 'true') {
    return res.status(403).json({ success: false, message: 'PostgreSQL browser UI is disabled' });
  }

  const secret = req.headers['x-pgadmin-ui-secret'] || req.query.secret;

  if (!secret || secret !== process.env.PGADMIN_UI_SECRET) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  next();
}

function safeIdentifier(value) {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value);
}

router.get('/health', requireUiSecret, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        current_database() AS database,
        current_user AS user_name,
        inet_server_addr() AS server_address,
        inet_server_port() AS server_port,
        now() AS server_time
    `);

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

router.get('/schemas', requireUiSecret, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT schema_name
      FROM information_schema.schemata
      WHERE schema_name NOT IN ('pg_catalog', 'information_schema')
      ORDER BY schema_name
    `);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

router.get('/tables', requireUiSecret, async (req, res) => {
  try {
    const schema = req.query.schema || 'blockchain';

    const result = await pool.query(`
      SELECT 
        table_schema,
        table_name,
        table_type
      FROM information_schema.tables
      WHERE table_schema = $1
      ORDER BY table_name
    `, [schema]);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

router.get('/columns', requireUiSecret, async (req, res) => {
  try {
    const { schema = 'blockchain', table } = req.query;

    if (!table) {
      return res.status(400).json({ success: false, message: 'table is required' });
    }

    const result = await pool.query(`
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = $1
        AND table_name = $2
      ORDER BY ordinal_position
    `, [schema, table]);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

router.get('/rows', requireUiSecret, async (req, res) => {
  try {
    const schema = req.query.schema || 'blockchain';
    const table = req.query.table;
    const limit = Math.min(Number(req.query.limit || 100), 500);
    const offset = Math.max(Number(req.query.offset || 0), 0);

    if (!table) {
      return res.status(400).json({ success: false, message: 'table is required' });
    }

    if (!safeIdentifier(schema) || !safeIdentifier(table)) {
      return res.status(400).json({ success: false, message: 'Invalid schema or table name' });
    }

    const countSql = `SELECT COUNT(*)::bigint AS total FROM "${schema}"."${table}"`;
    const rowsSql = `SELECT * FROM "${schema}"."${table}" LIMIT $1 OFFSET $2`;

    const countResult = await pool.query(countSql);
    const rowsResult = await pool.query(rowsSql, [limit, offset]);

    res.json({
      success: true,
      total: countResult.rows[0].total,
      limit,
      offset,
      data: rowsResult.rows,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

router.post('/query', requireUiSecret, async (req, res) => {
  try {
    const { query } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ success: false, message: 'query is required' });
    }

    const normalized = query.trim().toLowerCase();

    const allowed = normalized.startsWith('select') ||
      normalized.startsWith('with') ||
      normalized.startsWith('show') ||
      normalized.startsWith('explain');

    if (!allowed) {
      return res.status(403).json({
        success: false,
        message: 'Only SELECT, WITH, SHOW, and EXPLAIN queries are allowed from the UI',
      });
    }

    const result = await pool.query(query);

    res.json({
      success: true,
      rowCount: result.rowCount,
      fields: result.fields.map(field => field.name),
      data: result.rows,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

module.exports = router;
