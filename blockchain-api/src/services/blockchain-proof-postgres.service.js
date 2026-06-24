const { Pool } = require('pg');

require('dotenv').config();

const pool = new Pool({
  host: process.env.POSTGRES_HOST || process.env.DB_HOST,
  port: Number(process.env.POSTGRES_PORT || process.env.DB_PORT || 5432),
  database:
    process.env.POSTGRES_DATABASE ||
    process.env.POSTGRES_DB ||
    process.env.DB_DATABASE ||
    process.env.DB_NAME ||
    process.env.DB,
  user: process.env.POSTGRES_USER || process.env.DB_USER,
  password: process.env.POSTGRES_PASSWORD || process.env.DB_PASSWORD,
  max: Number(process.env.POSTGRES_POOL_MAX || 10),
  idleTimeoutMillis: Number(process.env.POSTGRES_IDLE_TIMEOUT_MS || 30000),
  connectionTimeoutMillis: Number(process.env.POSTGRES_CONNECTION_TIMEOUT_MS || 10000),
  application_name: 'postgres-blockchain-proof-sync-service'
});

async function query(sql, params = []) {
  return pool.query(sql, params);
}

async function healthCheck() {
  const result = await query(`
    SELECT
      current_database() AS database_name,
      current_user AS connected_user,
      current_schema() AS current_schema,
      inet_server_addr() AS server_address,
      inet_server_port() AS server_port,
      NOW() AS checked_at
  `);

  return result.rows[0];
}

async function closePool() {
  await pool.end();
}

module.exports = {
  pool,
  query,
  healthCheck,
  closePool
};
