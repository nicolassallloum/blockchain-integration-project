'use strict';

const db = require('../config/database');

function getRequestId(req) {
  return req.requestId || req.headers['x-request-id'] || null;
}

async function tableExists(tableName) {
  const result = await db.query(
    `
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'blockchain'
        AND table_name = $1
    ) AS exists
    `,
    [tableName]
  );

  return result.rows[0]?.exists === true;
}

exports.getOrganizationTypes = async (req, res) => {
  try {
    const hasBlockchainOrganization = await tableExists('blockchain_organization');

    if (!hasBlockchainOrganization) {
      return res.status(200).json({
        success: true,
        message: 'Organization types retrieved successfully',
        data: [],
        requestId: getRequestId(req)
      });
    }

    const result = await db.query(
      `
      SELECT DISTINCT
        COALESCE(NULLIF(TRIM(organization_type), ''), 'OTHER') AS organization_type
      FROM blockchain.blockchain_organization
      WHERE COALESCE(status, 'ACTIVE') = 'ACTIVE'
      ORDER BY organization_type ASC
      `
    );

    return res.status(200).json({
      success: true,
      message: 'Organization types retrieved successfully',
      data: result.rows.map((row) => ({
        organizationType: row.organization_type,
        organization_type: row.organization_type
      })),
      meta: {
        totalRecords: result.rowCount
      },
      requestId: getRequestId(req)
    });
  } catch (error) {
    console.error('[REFERENCE_ORGANIZATION_TYPES_ERROR]', {
      message: error.message,
      code: error.code,
      detail: error.detail
    });

    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve organization types',
      error: {
        message: error.message,
        code: error.code,
        detail: error.detail
      },
      requestId: getRequestId(req)
    });
  }
};
exports.getNextCustomerId = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT nextval('sdedba.s_customer')::text AS customer_id
    `);

    return res.status(200).json({
      success: true,
      message: 'Next customer ID generated successfully',
      data: {
        customerId: result.rows[0].customer_id,
        customer_id: result.rows[0].customer_id
      },
      requestId: getRequestId(req)
    });
  } catch (error) {
    console.error('[REFERENCE_NEXT_CUSTOMER_ID_ERROR]', {
      message: error.message,
      code: error.code,
      detail: error.detail
    });

    return res.status(500).json({
      success: false,
      message: 'Failed to generate next customer ID',
      error: {
        message: error.message,
        code: error.code,
        detail: error.detail
      },
      data: null,
      requestId: getRequestId(req)
    });
  }
};
exports.getSourceOfFunds = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT *
      FROM sdedba.ref_sysp68
      ORDER BY 1
    `);

    return res.status(200).json({
      success: true,
      message: 'Source of funds retrieved successfully',
      data: result.rows,
      meta: {
        totalRecords: result.rowCount
      },
      requestId: getRequestId(req)
    });
  } catch (error) {
    console.error('[REFERENCE_SOURCE_OF_FUNDS_ERROR]', {
      message: error.message,
      code: error.code,
      detail: error.detail
    });

    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve source of funds',
      error: {
        message: error.message,
        code: error.code,
        detail: error.detail
      },
      data: [],
      requestId: getRequestId(req)
    });
  }
};
exports.getOccupations = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        activity_sector_id::text AS occupation_code,
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
exports.getEconomicSectors = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT *
      FROM ref_Com_economic_sector
      ORDER BY 1
    `);

    return res.status(200).json({
      success: true,
      message: 'Economic sectors retrieved successfully',
      data: result.rows,
      meta: {
        totalRecords: result.rowCount
      },
      requestId: getRequestId(req)
    });
  } catch (error) {
    console.error('[REFERENCE_ECONOMIC_SECTORS_ERROR]', {
      message: error.message,
      code: error.code,
      detail: error.detail
    });

    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve economic sectors',
      error: {
        message: error.message,
        code: error.code,
        detail: error.detail
      },
      data: [],
      requestId: getRequestId(req)
    });
  }
};
exports.getOrganizations = async (req, res) => {
  try {
    const organizationType =
      req.query.organizationType ||
      req.query.organization_type ||
      req.query.type ||
      '';

    const hasBlockchainOrganization = await tableExists('blockchain_organization');
    const hasOrganizations = await tableExists('organizations');

    let sql;
    const values = [];
    let whereClause = `WHERE COALESCE(status, 'ACTIVE') = 'ACTIVE'`;

    if (organizationType) {
      values.push(String(organizationType).trim());
      whereClause += ` AND UPPER(COALESCE(organization_type, 'OTHER')) = UPPER($${values.length})`;
    }

    if (hasBlockchainOrganization) {
      sql = `
        SELECT
          organization_id::text AS organization_id,
          organization_id::text AS "organizationId",

          organization_code AS organization_code,
          organization_code AS "organizationCode",

          organization_name AS organization_name,
          organization_name AS "organizationName",

          COALESCE(organization_type, 'OTHER') AS organization_type,
          COALESCE(organization_type, 'OTHER') AS "organizationType",

          registration_number,
          country_code,
          COALESCE(status, 'ACTIVE') AS status
        FROM blockchain.blockchain_organization
        ${whereClause}
        ORDER BY organization_name ASC
      `;
    } else if (hasOrganizations) {
      sql = `
        SELECT
          organization_id::text AS organization_id,
          organization_id::text AS "organizationId",
          organization_name,
          organization_name AS "organizationName",
          COALESCE(organization_type, 'OTHER') AS organization_type,
          COALESCE(organization_type, 'OTHER') AS "organizationType",
          registration_number,
          country_code,
          COALESCE(status, 'ACTIVE') AS status
        FROM blockchain.organizations
        ${whereClause}
        ORDER BY organization_name ASC
      `;
    } else {
      return res.status(200).json({
        success: true,
        message: 'Organizations table not found. Empty list returned.',
        data: [],
        meta: {
          totalRecords: 0
        },
        requestId: getRequestId(req)
      });
    }

    const result = await db.query(sql, values);

    return res.status(200).json({
      success: true,
      message: 'Organizations retrieved successfully',
      data: result.rows,
      meta: {
        totalRecords: result.rowCount,
        organizationType: organizationType || null
      },
      requestId: getRequestId(req)
    });
  } catch (error) {
    console.error('[REFERENCE_ORGANIZATIONS_ERROR]', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      table: error.table,
      column: error.column
    });

    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve organizations',
      error: {
        message: error.message,
        code: error.code,
        detail: error.detail
      },
      data: [],
      requestId: getRequestId(req)
    });
  }
};

exports.getCountries = async (req, res) => {
  try {
    const hasCountries = await tableExists('countries');

    if (!hasCountries) {
      return res.status(200).json({
        success: true,
        message: 'Countries table not found. Empty list returned.',
        data: [],
        meta: {
          totalRecords: 0
        },
        requestId: getRequestId(req)
      });
    }

    const result = await db.query(
      `
      SELECT
        cou_id,
        cou_name,
        iso_cou_code_alpha
      FROM blockchain.countries
      ORDER BY cou_name ASC
      `
    );

    return res.status(200).json({
      success: true,
      message: 'Countries retrieved successfully',
      data: result.rows,
      meta: {
        totalRecords: result.rowCount
      },
      requestId: getRequestId(req)
    });
  } catch (error) {
    console.error('[REFERENCE_COUNTRIES_ERROR]', {
      message: error.message,
      code: error.code,
      detail: error.detail
    });

    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve countries',
      error: {
        message: error.message,
        code: error.code,
        detail: error.detail
      },
      data: [],
      requestId: getRequestId(req)
    });
  }
};
