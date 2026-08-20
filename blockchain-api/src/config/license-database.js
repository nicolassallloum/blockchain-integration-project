'use strict';

require('dotenv').config();

const { Pool } = require('pg');

const licensePool = new Pool({
  host:
    process.env.LICENSE_DB_HOST ||
    '172.31.13.133',

  port: Number(
    process.env.LICENSE_DB_PORT ||
    5444
  ),

  database:
    process.env.LICENSE_DB_NAME ||
    'vfortress_licensing',

  user:
    process.env.LICENSE_DB_USER ||
    'pgdata',

  password: String(
    process.env.LICENSE_DB_PASSWORD ||
    ''
  ),

  max: Number(
    process.env.LICENSE_DB_POOL_MAX ||
    10
  ),

  idleTimeoutMillis: Number(
    process.env.LICENSE_DB_IDLE_TIMEOUT ||
    30000
  ),

  connectionTimeoutMillis: Number(
    process.env.LICENSE_DB_CONNECTION_TIMEOUT ||
    10000
  ),
  statement_timeout: 30000,
  query_timeout: 30000
});

licensePool.on('error', (error) => {
  console.error(
    '[LICENSE DATABASE POOL ERROR]',
    {
      message: error.message,
      code: error.code,
      stack: error.stack
    }
  );
});

async function testLicenseDatabaseConnection() {
  const result = await licensePool.query(`
    SELECT
      current_database() AS "databaseName",
      current_user AS "databaseUser",
      CURRENT_TIMESTAMP AS "serverTime"
  `);

  return result.rows[0];
}

module.exports = {
  licensePool,
  testLicenseDatabaseConnection
};
