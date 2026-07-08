'use strict';

require('dotenv').config();

const { Pool } = require('pg');
const {
  getCurrentAuditSessionContext,
  refreshCurrentAuditSessionContext,
  setAuditSessionContext,
  withAuditSessionContext
} = require('../services/audit-session-context.service');

const pool = new Pool({
  host: process.env.POSTGRES_HOST || process.env.DB_HOST || process.env.PGHOST || '172.31.13.133',
  port: Number(process.env.POSTGRES_PORT || process.env.DB_PORT || process.env.PGPORT || 5444),
  database:
    process.env.POSTGRES_DB ||
    process.env.DB_NAME ||
    process.env.PGDATABASE ||
    'vfds_dev',
  user: process.env.POSTGRES_USER || process.env.DB_USER || process.env.PGUSER || 'pgdata',
  password: String(
    process.env.POSTGRES_PASSWORD ||
      process.env.DB_PASSWORD ||
      process.env.PGPASSWORD ||
      ''
  ),
  max: Number(process.env.POSTGRES_POOL_MAX || process.env.DB_POOL_MAX || 20),
  idleTimeoutMillis: Number(process.env.POSTGRES_IDLE_TIMEOUT || 30000),
  connectionTimeoutMillis: Number(process.env.POSTGRES_CONNECTION_TIMEOUT || 10000)
});

function isTransactionControlStatement(text) {
  return /^\s*(BEGIN|COMMIT|ROLLBACK|SAVEPOINT|RELEASE|SET\s+LOCAL|SET\s+TRANSACTION)\b/i.test(
    String(text || '')
  );
}

async function query(text, params) {
  const context =
    refreshCurrentAuditSessionContext() || getCurrentAuditSessionContext();

  if (!context || isTransactionControlStatement(text)) {
    return pool.query(text, params);
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await setAuditSessionContext(client, context);
    const result = await client.query(text, params);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      error.rollbackError = rollbackError;
    }

    throw error;
  } finally {
    client.release();
  }
}

async function getClient() {
  return pool.connect();
}

function getPool() {
  return pool;
}

async function getClientWithAuditContext(context = {}) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await setAuditSessionContext(client, context);
    return client;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      error.rollbackError = rollbackError;
    }

    client.release();
    throw error;
  }
}

async function commitAndReleaseClient(client) {
  if (!client) return;

  try {
    await client.query('COMMIT');
  } finally {
    client.release();
  }
}

async function rollbackAndReleaseClient(client) {
  if (!client) return;

  try {
    await client.query('ROLLBACK');
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  query,
  getClient,
  getPool,
  setAuditSessionContext,
  withAuditSessionContext: (context, callback) =>
    withAuditSessionContext(pool, context, callback),
  getClientWithAuditContext,
  commitAndReleaseClient,
  rollbackAndReleaseClient
};
