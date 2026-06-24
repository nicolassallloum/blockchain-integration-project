'use strict';

const pool = require('../db/postgres');

function sendSuccess(res, message, data, statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    timestamp: new Date().toISOString(),
  });
}

function sendError(res, error) {
  console.error('[REFERENCE_CONTROLLER_ERROR]', error);

  return res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || 'Internal server error',
    timestamp: new Date().toISOString(),
  });
}

/**
 * GET /api/v1/government-blockchain/reference/next-resident-id
 */
async function getNextResidentId(req, res) {
  try {
    const result = await pool.query(`
      SELECT
        'RES-BLOCKCHAIN-' || LPAD(nextval('blockchain.resident_seq')::TEXT, 6, '0') AS resident_id
    `);

    return sendSuccess(
      res,
      'Next resident ID generated successfully.',
      {
        residentId: result.rows[0].resident_id,
      }
    );
  } catch (error) {
    return sendError(res, error);
  }
}

/**
 * GET /api/v1/government-blockchain/reference/governorates
 */
async function getGovernorates(req, res) {
  try {
    const result = await pool.query(`
      SELECT
          governorate_id AS id,
          governorate_code AS code,
          governorate_name AS name,
          arabic_name AS "arabicName"
      FROM blockchain.governorates
      WHERE is_active = TRUE
      ORDER BY sort_order, governorate_name
    `);

    return sendSuccess(
      res,
      'Governorates retrieved successfully.',
      result.rows
    );
  } catch (error) {
    return sendError(res, error);
  }
}

/**
 * GET /api/v1/government-blockchain/reference/districts?governorateId=1
 */
async function getDistricts(req, res) {
  try {
    const { governorateId } = req.query;

    if (!governorateId) {
      return res.status(400).json({
        success: false,
        message: 'governorateId is required.',
        timestamp: new Date().toISOString(),
      });
    }

    const result = await pool.query(
      `
      SELECT
          district_id AS id,
          district_code AS code,
          district_name AS name,
          arabic_name AS "arabicName",
          governorate_id AS "governorateId"
      FROM blockchain.districts
      WHERE is_active = TRUE
        AND governorate_id = $1
      ORDER BY sort_order, district_name
      `,
      [governorateId]
    );

    return sendSuccess(
      res,
      'Districts retrieved successfully.',
      result.rows
    );
  } catch (error) {
    return sendError(res, error);
  }
}

/**
 * GET /api/v1/government-blockchain/reference/municipalities?districtId=1
 */
async function getMunicipalities(req, res) {
  try {
    const { districtId } = req.query;

    if (!districtId) {
      return res.status(400).json({
        success: false,
        message: 'districtId is required.',
        timestamp: new Date().toISOString(),
      });
    }

    const result = await pool.query(
      `
      SELECT
          municipality_id AS id,
          municipality_code AS code,
          municipality_name AS name,
          arabic_name AS "arabicName",
          district_id AS "districtId",
          governorate_id AS "governorateId"
      FROM blockchain.municipalities
      WHERE is_active = TRUE
        AND district_id = $1
      ORDER BY sort_order, municipality_name
      `,
      [districtId]
    );

    return sendSuccess(
      res,
      'Municipalities retrieved successfully.',
      result.rows
    );
  } catch (error) {
    return sendError(res, error);
  }
}

/**
 * GET /api/v1/government-blockchain/reference/kyc-statuses
 */
async function getKycStatuses(req, res) {
  try {
    const result = await pool.query(`
      SELECT
          status_code AS id,
          status_code AS code,
          status_name AS name,
          arabic_name AS "arabicName",
          description
      FROM blockchain.kyc_statuses
      WHERE is_active = TRUE
      ORDER BY sort_order, status_name
    `);

    return sendSuccess(
      res,
      'KYC statuses retrieved successfully.',
      result.rows
    );
  } catch (error) {
    return sendError(res, error);
  }
}

/**
 * GET /api/v1/government-blockchain/reference/risk-categories
 */
async function getRiskCategories(req, res) {
  try {
    const result = await pool.query(`
      SELECT
          risk_code AS id,
          risk_code AS code,
          risk_name AS name,
          arabic_name AS "arabicName",
          risk_score_min AS "riskScoreMin",
          risk_score_max AS "riskScoreMax",
          description
      FROM blockchain.risk_categories
      WHERE is_active = TRUE
      ORDER BY sort_order, risk_name
    `);

    return sendSuccess(
      res,
      'Risk categories retrieved successfully.',
      result.rows
    );
  } catch (error) {
    return sendError(res, error);
  }
}

/**
 * GET /api/v1/government-blockchain/reference/employment-statuses
 */
async function getEmploymentStatuses(req, res) {
  try {
    const result = await pool.query(`
      SELECT
          status_code AS id,
          status_code AS code,
          status_name AS name,
          arabic_name AS "arabicName",
          description
      FROM blockchain.employment_statuses
      WHERE is_active = TRUE
      ORDER BY sort_order, status_name
    `);

    return sendSuccess(
      res,
      'Employment statuses retrieved successfully.',
      result.rows
    );
  } catch (error) {
    return sendError(res, error);
  }
}

module.exports = {
  getNextResidentId,
  getGovernorates,
  getDistricts,
  getMunicipalities,
  getKycStatuses,
  getRiskCategories,
  getEmploymentStatuses,
};
