'use strict';

require('dotenv').config();

const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.POSTGRES_HOST || process.env.DB_HOST || process.env.PGHOST || '172.31.13.133',
  port: Number(process.env.POSTGRES_PORT || process.env.DB_PORT || process.env.PGPORT || 5444),
  database: process.env.POSTGRES_DB || process.env.DB_NAME || process.env.PGDATABASE || 'vfds_dev',
  user: process.env.POSTGRES_USER || process.env.DB_USER || process.env.PGUSER || 'postgres',
  password: String(process.env.POSTGRES_PASSWORD || process.env.DB_PASSWORD || process.env.PGPASSWORD || ''),
  max: Number(process.env.POSTGRES_POOL_MAX || process.env.DB_POOL_MAX || 20),
  idleTimeoutMillis: Number(process.env.POSTGRES_IDLE_TIMEOUT || 30000),
  connectionTimeoutMillis: Number(process.env.POSTGRES_CONNECTION_TIMEOUT || 10000)
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect(),
  pool
};
