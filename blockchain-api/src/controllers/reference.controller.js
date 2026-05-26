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

/**
 * GET /api/v1/government-blockchain/reference/ministry-dropdowns
 * Loads all dropdowns needed by Create Ministry Account screen.
 */
exports.getMinistryDropdowns = async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT json_build_object(
        'countries', (
          SELECT COALESCE(json_agg(row_to_json(x)), '[]'::json)
          FROM (
            SELECT
              country_id AS value,
              country_name AS label,
              country_code,
              country_name_ar
            FROM blockchain.ref_countries
            WHERE is_active = TRUE
            ORDER BY display_order, country_name
          ) x
        ),
        'parentMinistries', (
          SELECT COALESCE(json_agg(row_to_json(x)), '[]'::json)
          FROM (
            SELECT
              parent_ministry_id AS value,
              ministry_name AS label,
              ministry_code,
              ministry_name_ar
            FROM blockchain.ref_parent_ministries
            WHERE is_active = TRUE
            ORDER BY display_order, ministry_name
          ) x
        ),
        'ministryTypes', (
          SELECT COALESCE(json_agg(row_to_json(x)), '[]'::json)
          FROM (
            SELECT
              ministry_type_id AS value,
              ministry_type_name AS label,
              ministry_type_code,
              ministry_type_name_ar
            FROM blockchain.ref_ministry_types
            WHERE is_active = TRUE
            ORDER BY display_order, ministry_type_name
          ) x
        ),
        'walletStatuses', (
          SELECT COALESCE(json_agg(row_to_json(x)), '[]'::json)
          FROM (
            SELECT
              wallet_status_id AS value,
              wallet_status_code AS label,
              wallet_status_name,
              description
            FROM blockchain.ref_wallet_statuses
            WHERE is_active = TRUE
            ORDER BY display_order
          ) x
        ),
        'blockchainStatuses', (
          SELECT COALESCE(json_agg(row_to_json(x)), '[]'::json)
          FROM (
            SELECT
              blockchain_status_id AS value,
              blockchain_status_code AS label,
              blockchain_status_name,
              description
            FROM blockchain.ref_blockchain_statuses
            WHERE is_active = TRUE
            ORDER BY display_order
          ) x
        )
      ) AS dropdowns;
    `);

    return res.status(200).json({
      success: true,
      message: 'Ministry dropdowns loaded successfully.',
      data: result.rows[0]?.dropdowns || {
        countries: [],
        parentMinistries: [],
        ministryTypes: [],
        walletStatuses: [],
        blockchainStatuses: []
      },
      requestId: getRequestId(req)
    });
  } catch (error) {
    console.error('[REFERENCE_MINISTRY_DROPDOWNS_ERROR]', {
      message: error.message,
      code: error.code,
      detail: error.detail
    });

    return next(error);
  }
};

/**
 * GET /api/v1/government-blockchain/reference/governorates?countryId=9
 * Loads governorates by selected country_id.
 */
exports.getGovernoratesByCountry = async (req, res, next) => {
  try {
    const countryId = req.query.countryId || req.query.country_id;

    if (!countryId) {
      return res.status(400).json({
        success: false,
        message: 'countryId query parameter is required.',
        errorCode: 'COUNTRY_ID_REQUIRED',
        data: [],
        requestId: getRequestId(req)
      });
    }

    const result = await db.query(
      `
      SELECT
        g.governorate_id AS value,
        g.governorate_name AS label,
        g.governorate_code,
        g.governorate_name_ar,
        g.division_type,
        c.country_id,
        c.country_code,
        c.country_name
      FROM blockchain.ref_governorates g
      JOIN blockchain.ref_countries c
        ON c.country_id = g.country_id
      WHERE g.is_active = TRUE
        AND c.is_active = TRUE
        AND c.country_id = $1
      ORDER BY g.display_order, g.governorate_name;
      `,
      [countryId]
    );

    return res.status(200).json({
      success: true,
      message: 'Governorates loaded successfully.',
      data: result.rows,
      meta: {
        totalRecords: result.rowCount,
        countryId: Number(countryId)
      },
      requestId: getRequestId(req)
    });
  } catch (error) {
    console.error('[REFERENCE_GOVERNORATES_ERROR]', {
      message: error.message,
      code: error.code,
      detail: error.detail
    });

    return next(error);
  }
};

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