'use strict';

const db = require('../config/database');

function getPool() {
  if (db.pool) return db.pool;
  if (typeof db.getPool === 'function') return db.getPool();
  if (typeof db.connect === 'function' && typeof db.query === 'function') return db;

  throw new Error('PostgreSQL pool not found in src/config/database.js');
}

async function tableExists(client, schemaName, tableName) {
  const result = await client.query(
    `
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = $1
        AND table_name = $2
    ) AS exists
    `,
    [schemaName, tableName]
  );

  return result.rows[0]?.exists === true;
}

async function resolveOrganizationTable(client) {
  if (await tableExists(client, 'blockchain', 'organizations')) {
    return 'organizations';
  }

  if (await tableExists(client, 'blockchain', 'blockchain_organization')) {
    return 'blockchain_organization';
  }

  throw new Error(
    'No organization table found. Expected blockchain.organizations or blockchain.blockchain_organization'
  );
}

function normalizeOrganization(row) {
  return {
    organizationId: row.organization_id || row.id || null,
    organizationName: row.organization_name || row.name || null,
    organizationCode: row.organization_code || row.code || null,
    bankName: row.organization_name || row.name || null,
    status: row.status || 'ACTIVE',
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null
  };
}

async function getOrganizations(filters = {}) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const tableName = await resolveOrganizationTable(client);

    const result = await client.query(
      `
      SELECT *
      FROM blockchain.${tableName}
      WHERE COALESCE(status, 'ACTIVE') = 'ACTIVE'
      ORDER BY organization_name ASC
      `
    );

    const organizations = result.rows.map(normalizeOrganization);

    return {
      success: true,
      message: 'Organizations retrieved successfully',
      data: organizations,
      totalRecords: organizations.length,
      source: 'postgres',
      table: `blockchain.${tableName}`
    };
  } finally {
    client.release();
  }
}

module.exports = {
  getOrganizations
};