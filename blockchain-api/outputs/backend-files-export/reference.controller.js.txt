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
          organization_name,
          COALESCE(organization_type, 'OTHER') AS organization_type,
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
          organization_name,
          COALESCE(organization_type, 'OTHER') AS organization_type,
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
