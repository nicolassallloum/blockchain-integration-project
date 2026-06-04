const { Pool } = require('pg');
require('dotenv').config();

const dbPassword =
  process.env.DB_PASSWORD ||
  process.env.PGPASSWORD ||
  '';

if (!dbPassword) {
  console.error('[POSTGRES CONFIG ERROR] Missing DB_PASSWORD or PGPASSWORD in .env');
}

const pool = new Pool({
  host: process.env.DB_HOST || process.env.PGHOST || '172.31.13.133',
  port: Number(process.env.DB_PORT || process.env.PGPORT || 5444),
  database: process.env.DB_NAME || process.env.PGDATABASE || 'vfds_dev',
  user: process.env.DB_USER || process.env.PGUSER || 'pgdata',
  password: String(dbPassword),
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

pool.on('connect', () => {
  console.log('[POSTGRES] Connected to PostgreSQL');
});

pool.on('error', (error) => {
  console.error('[POSTGRES_POOL_ERROR]', error.message);
});

module.exports = pool;
