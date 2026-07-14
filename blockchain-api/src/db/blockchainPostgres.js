// src/db/blockchainPostgres.js
// Blockchain application metadata PostgreSQL pool.
// Credentials come only from environment variables.

const { Pool } = require('pg');

const blockchainPostgres = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  application_name: 'blockchain-app-metadata-api',
  max: Number(process.env.DB_POOL_MAX || 10),
  idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS || 30000),
  connectionTimeoutMillis: Number(process.env.DB_CONNECTION_TIMEOUT_MS || 10000),
});

module.exports = { blockchainPostgres };
