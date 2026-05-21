"use strict";

const { Pool } = require("pg");
const config = require("../../config");

const pool = new Pool({
  host: config.postgres.host,
  port: config.postgres.port,
  database: config.postgres.database,
  user: config.postgres.user,
  password: config.postgres.password,
  ssl: config.postgres.ssl ? { rejectUnauthorized: false } : false,
  min: config.postgres.pool.min,
  max: config.postgres.pool.max,
  idleTimeoutMillis: config.postgres.pool.idleTimeoutMillis,
  connectionTimeoutMillis: config.postgres.pool.connectionTimeoutMillis,
});

async function testPostgresConnection() {
  const client = await pool.connect();

  try {
    const result = await client.query("SELECT NOW() AS current_time");
    return {
      success: true,
      currentTime: result.rows[0].current_time,
      database: config.postgres.database,
      schema: config.postgres.schema,
    };
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  testPostgresConnection,
};