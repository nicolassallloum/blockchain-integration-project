'use strict';

const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || process.env.PGHOST || process.env.POSTGRES_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || process.env.PGPORT || process.env.POSTGRES_PORT || 5432),
  database:
    process.env.DB_DATABASE ||
    process.env.DB_NAME ||
    process.env.PGDATABASE ||
    process.env.POSTGRES_DB,
  user:
    process.env.DB_USERNAME ||
    process.env.DB_USER ||
    process.env.PGUSER ||
    process.env.POSTGRES_USER,
  password:
    process.env.DB_PASSWORD ||
    process.env.PGPASSWORD ||
    process.env.POSTGRES_PASSWORD,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

module.exports = pool;
