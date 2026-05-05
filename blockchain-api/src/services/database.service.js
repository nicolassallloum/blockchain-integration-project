const { Pool } = require("pg");

class DatabaseService {
  constructor() {
    this.pool = new Pool({
      host: process.env.POSTGRES_HOST,
      port: Number(process.env.POSTGRES_PORT || 5444),
      database: process.env.POSTGRES_DB,
      user: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      max: Number(process.env.POSTGRES_POOL_MAX || 10),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }

  getPool() {
    return this.pool;
  }

  async testConnection() {
    const client = await this.pool.connect();

    try {
      const result = await client.query("SELECT NOW() AS current_time");
      return {
        success: true,
        currentTime: result.rows[0].current_time,
      };
    } finally {
      client.release();
    }
  }
}

module.exports = new DatabaseService();