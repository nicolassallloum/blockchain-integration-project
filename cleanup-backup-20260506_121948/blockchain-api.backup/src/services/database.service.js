const path = require("path");
const dotenv = require("dotenv");
const { Pool } = require("pg");

/**
 * Load .env here also.
 *
 * This protects every standalone service/script from using undefined env values
 * when database.service.js is required before server.js loads dotenv.
 */
dotenv.config({
  path: path.resolve(process.cwd(), ".env"),
});

class DatabaseService {
  constructor() {
    const host = process.env.POSTGRES_HOST;
    const port = Number(process.env.POSTGRES_PORT || 5444);
    const database =
      process.env.POSTGRES_DB ||
      process.env.POSTGRES_DATABASE;

    const user = process.env.POSTGRES_USER;
    const password = process.env.POSTGRES_PASSWORD;

    if (!host) {
      throw new Error("POSTGRES_HOST is missing from .env");
    }

    if (!database) {
      throw new Error("POSTGRES_DB or POSTGRES_DATABASE is missing from .env");
    }

    if (!user) {
      throw new Error("POSTGRES_USER is missing from .env");
    }

    this.pool = new Pool({
      host,
      port,
      database,
      user,
      password,
      max: Number(process.env.POSTGRES_POOL_MAX || 10),
      idleTimeoutMillis: Number(process.env.POSTGRES_IDLE_TIMEOUT_MS || 30000),
      connectionTimeoutMillis: Number(
        process.env.POSTGRES_CONNECTION_TIMEOUT_MS || 5000
      ),
      ssl:
        String(process.env.POSTGRES_SSL || "false").toLowerCase() === "true"
          ? { rejectUnauthorized: false }
          : false,
    });

    console.log("[DB] PostgreSQL pool initialized", {
      host,
      port,
      database,
      user,
      ssl: String(process.env.POSTGRES_SSL || "false"),
    });
  }

  getPool() {
    return this.pool;
  }

  async testConnection() {
    const client = await this.pool.connect();

    try {
      const result = await client.query(`
        SELECT
          current_database() AS database_name,
          current_schema() AS schema_name,
          NOW() AS current_time;
      `);

      return {
        success: true,
        database: result.rows[0].database_name,
        schema: result.rows[0].schema_name,
        currentTime: result.rows[0].current_time,
      };
    } finally {
      client.release();
    }
  }
}

module.exports = new DatabaseService();