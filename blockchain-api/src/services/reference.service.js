const db = require('../config/database');

/**
 * Reference Service
 * Reads enterprise reference data from PostgreSQL.
 */

async function getNextCustomerId() {
  const sql = `
    SELECT nextval('sdedba.s_customer')::text AS customer_id
  `;

  const result = await db.query(sql);
  return result.rows[0];
}

async function getCountries() {
  const sql = `
    SELECT 
      cou_name AS "couName"
    FROM sdedba.ref_com_country
    WHERE cou_name IS NOT NULL
    ORDER BY cou_name
  `;

  const result = await db.query(sql);
  return result.rows;
}

async function getBlockchainOrganizationTypes() {
  const sql = `
    SELECT DISTINCT 
      organization_type AS "organizationType"
    FROM blockchain.blockchain_organization
    WHERE organization_type IS NOT NULL
    ORDER BY organization_type
  `;

  const result = await db.query(sql);
  return result.rows;
}

async function getBlockchainOrganizations() {
  const sql = `
    SELECT
      organization_id::text AS "organizationId",
      organization_code AS "organizationCode",
      organization_name AS "organizationName",
      organization_type AS "organizationType"
    FROM blockchain.blockchain_organization
    ORDER BY organization_name
  `;

  const result = await db.query(sql);
  return result.rows;
}

async function getSourceOfFunds() {
  const sql = `
    SELECT *
    FROM sdedba.ref_sysp68
    ORDER BY 1
  `;

  const result = await db.query(sql);
  return result.rows;
}

async function getOccupations() {
  const sql = `
    SELECT *
    FROM sdedba.ref_hr_activity_sector
    ORDER BY 1
  `;

  const result = await db.query(sql);
  return result.rows;
}

async function getEconomicSectors() {
  const sql = `
    SELECT *
    FROM sdedba.ref_com_economic_sector
    ORDER BY 1
  `;

  const result = await db.query(sql);
  return result.rows;
}

module.exports = {
  getNextCustomerId,
  getCountries,
  getBlockchainOrganizationTypes,
  getBlockchainOrganizations,
  getSourceOfFunds,
  getOccupations,
  getEconomicSectors
};
