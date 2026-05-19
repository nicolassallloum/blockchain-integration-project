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
    SELECT lin_name AS "sourceOfFunds"
    FROM sdedba.ref_sysp68
    ORDER BY 1
  `;

  const result = await db.query(sql);
  return result.rows;
}

exports.getOccupations = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        activity_sector_desc AS occupation_name
      FROM sdedba.ref_hr_activity_sector
      WHERE activity_sector_desc IS NOT NULL
      ORDER BY activity_sector_desc ASC
    `);

    return res.status(200).json({
      success: true,
      message: 'Occupations retrieved successfully',
      data: result.rows.map((row) => ({
        code: row.occupation_code,
        name: row.occupation_name,
        occupationCode: row.occupation_code,
        occupationName: row.occupation_name
      })),
      meta: {
        totalRecords: result.rowCount
      },
      requestId: getRequestId(req)
    });
  } catch (error) {
    console.error('[REFERENCE_OCCUPATIONS_ERROR]', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      table: error.table,
      column: error.column
    });

    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve occupations',
      error: {
        message: error.message,
        code: error.code,
        detail: error.detail,
        table: error.table,
        column: error.column
      },
      data: [],
      requestId: getRequestId(req)
    });
  }
};

async function getEconomicSectors() {
  const sql = `
    SELECT economic_sector_desc AS "economicSector"
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
