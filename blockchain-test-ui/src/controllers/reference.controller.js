'use strict';

const pool = require('../config/db');

/**
 * GET /api/v1/reference/next-customer-id
 */
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
      SELECT *
      FROM sdedba.ref_hr_activity_sector
      ORDER BY 1
    `);

    return res.status(200).json({
      success: true,
      message: 'Occupations retrieved successfully',
      data: result.rows,
      meta: {
        totalRecords: result.rowCount
      },
      requestId: getRequestId(req)
    });
  } catch (error) {
    console.error('[REFERENCE_OCCUPATIONS_ERROR]', {
      message: error.message,
      code: error.code,
      detail: error.detail
    });

    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve occupations',
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

exports.getEconomicSectors = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT *
      FROM sdedba.ref_com_economic_sector
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