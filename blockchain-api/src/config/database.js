const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.POSTGRES_HOST || process.env.DB_HOST || "172.31.13.133",
  port: Number(process.env.POSTGRES_PORT || process.env.DB_PORT || 5444),
  database: process.env.POSTGRES_DB || process.env.DB_NAME || "vfds_dev",
  user: process.env.POSTGRES_USER || process.env.DB_USER || "postgres",
  password: process.env.POSTGRES_PASSWORD || process.env.DB_PASSWORD,
  max: Number(process.env.POSTGRES_POOL_MAX || 20),
  idleTimeoutMillis: Number(process.env.POSTGRES_IDLE_TIMEOUT_MS || 30000),
  connectionTimeoutMillis: Number(process.env.POSTGRES_CONNECTION_TIMEOUT_MS || 10000)
});

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL pool error:", error.message);
});

module.exports = {
  pool
};
