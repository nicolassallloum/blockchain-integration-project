// src/db/applicationPostgres.js
// Application PostgreSQL pool for source/audit data.
// Credentials come only from environment variables.

const { Pool } = require('pg');

function requiredEnv(name, fallbacks = []) {
  const names = [name, ...fallbacks];
  for (const key of names) {
    const value = process.env[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return value;
    }
  }
  return undefined;
}

const applicationPostgres = new Pool({
  host: requiredEnv('POSTGRES_HOST'),
  port: Number(requiredEnv('POSTGRES_PORT') || 5432),
  database: requiredEnv('POSTGRES_DATABASE', ['POSTGRES_DB', 'DB']),
  user: requiredEnv('POSTGRES_USER'),
  password: requiredEnv('POSTGRES_PASSWORD'),
  application_name: 'blockchain-audit-validation-api',
  max: Number(process.env.POSTGRES_POOL_MAX || 10),
  idleTimeoutMillis: Number(process.env.POSTGRES_IDLE_TIMEOUT_MS || 30000),
  connectionTimeoutMillis: Number(process.env.POSTGRES_CONNECTION_TIMEOUT_MS || 10000),
});

module.exports = { applicationPostgres };
