'use strict';

const db = require('../config/database');

/**
 * GET /api/v1/reference/next-customer-id
 */
exports.getNextCustomerId = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT nextval('blockchain.customer_id_seq')::varchar AS customer_id
    `);

    return res.status(200).json({
      success: true,
      message: 'Next customer ID retrieved successfully',
      data: result.rows[0],
      meta: null,
      timestamp: new Date().toISOString(),
      requestId: req.requestId || req.headers['x-request-id'] || null,
      correlationId: req.correlationId || req.headers['x-request-id'] || null
    });
  } catch (error) {
    console.error('getNextCustomerId error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve next customer ID',
      errorCode: 'REFERENCE_NEXT_CUSTOMER_ID_FAILED',
      data: null,
      error: error.message,
      timestamp: new Date().toISOString(),
      requestId: req.requestId || req.headers['x-request-id'] || null,
      correlationId: req.correlationId || req.headers['x-request-id'] || null
    });
  }
};

/**
 * GET /api/v1/reference/organizations
 */
exports.getOrganizations = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        organization_id,
        organization_name,
        organization_type,
        registration_number,
        country_code,
        status
      FROM blockchain.blockchain_organization
      WHERE status = 'ACTIVE'
      ORDER BY organization_name ASC
    `);

    return res.status(200).json({
      success: true,
      message: 'Organizations retrieved successfully',
      data: result.rows,
      meta: {
        totalRecords: result.rowCount
      },
      timestamp: new Date().toISOString(),
      requestId: req.requestId || req.headers['x-request-id'] || null,
      correlationId: req.correlationId || req.headers['x-request-id'] || null
    });
  } catch (error) {
    console.error('getOrganizations error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve organizations',
      errorCode: 'REFERENCE_ORGANIZATIONS_FAILED',
      data: null,
      error: error.message,
      timestamp: new Date().toISOString(),
      requestId: req.requestId || req.headers['x-request-id'] || null,
      correlationId: req.correlationId || req.headers['x-request-id'] || null
    });
  }
};

/**
 * GET /api/v1/reference/countries
 */
exports.getCountries = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        cou_id,
        cou_name,
        iso_cou_code_alpha
      FROM blockchain.countries
      WHERE cou_name IS NOT NULL
      ORDER BY cou_name ASC
    `);

    return res.status(200).json({
      success: true,
      message: 'Countries retrieved successfully',
      data: result.rows,
      meta: {
        totalRecords: result.rowCount
      },
      timestamp: new Date().toISOString(),
      requestId: req.requestId || req.headers['x-request-id'] || null,
      correlationId: req.correlationId || req.headers['x-request-id'] || null
    });
  } catch (error) {
    console.error('getCountries error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve countries',
      errorCode: 'REFERENCE_COUNTRIES_FAILED',
      data: null,
      error: error.message,
      timestamp: new Date().toISOString(),
      requestId: req.requestId || req.headers['x-request-id'] || null,
      correlationId: req.correlationId || req.headers['x-request-id'] || null
    });
  }
};
