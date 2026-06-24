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
  console.error('[RESIDENT_REFERENCE_CONTROLLER_ERROR]', error);

  return res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || 'Internal server error',
    error: error.code || error.detail || null,
    timestamp: new Date().toISOString(),
  });
}

function normalizeGovernorateCodeSql(alias = 'g') {
  return `
    CASE ${alias}.governorate_code
      WHEN 'LB_BA' THEN 'BEIRUT'
      WHEN 'LB_JL' THEN 'MOUNT_LEBANON'
      WHEN 'LB_AS' THEN 'NORTH_LEBANON'
      WHEN 'LB_JA' THEN 'SOUTH_LEBANON'
      WHEN 'LB_BI' THEN 'BEKAA'
      WHEN 'LB_NA' THEN 'NABATIEH'
      WHEN 'LB_BH' THEN 'BAALBEK_HERMEL'
      WHEN 'LB_AK' THEN 'AKKAR'
      ELSE ${alias}.governorate_code
    END
  `;
}

async function getNextResidentId(req, res) {
  try {
    const result = await pool.query(`
      SELECT
        'RES-BLOCKCHAIN-' || LPAD(nextval('blockchain.resident_seq')::TEXT, 6, '0') AS resident_id
    `);

    return sendSuccess(res, 'Next resident ID generated successfully.', {
      residentId: result.rows[0].resident_id,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

async function getGovernorates(req, res) {
  try {
    const normalizedCode = normalizeGovernorateCodeSql('g');

    const result = await pool.query(`
      SELECT
          g.governorate_id::TEXT AS id,
          ${normalizedCode} AS code,
          REPLACE(REPLACE(g.governorate_name, ' (Governorate)', ''), ' (Province)', '') AS name,
          g.governorate_name_ar AS "arabicName"
      FROM blockchain.governorates g
      JOIN blockchain.countries c
        ON c.cou_id = g.country_id
      WHERE g.is_active = TRUE
        AND c.iso_cou_code_alpha = 'LB'
      ORDER BY name
    `);

    return sendSuccess(res, 'Governorates retrieved successfully.', result.rows);
  } catch (error) {
    return sendError(res, error);
  }
}

async function getDistricts(req, res) {
  try {
    const { governorateId } = req.query;

    if (!governorateId) {
      return res.status(400).json({
        success: false,
        message: 'governorateId is required.',
        timestamp: new Date().toISOString()
      });
    }

    const result = await pool.query(
      `
      WITH selected_governorate AS (
        SELECT
          g.governorate_id,
          g.governorate_code
        FROM blockchain.governorates g
        WHERE g.governorate_id::TEXT = $1::TEXT
           OR UPPER(g.governorate_code::TEXT) = UPPER($1::TEXT)
        LIMIT 1
      )
      SELECT
        d.district_id::TEXT AS id,
        d.district_code AS code,
        d.district_name AS name,
        COALESCE(d.district_name_ar, d.arabic_name) AS "arabicName",
        d.governorate_id::TEXT AS "governorateId",
        d.governorate_code AS "governorateCode"
      FROM blockchain.districts d
      LEFT JOIN selected_governorate sg ON TRUE
      WHERE COALESCE(d.is_active, true) = true
        AND (
          UPPER(d.governorate_code::TEXT) = UPPER($1::TEXT)
          OR d.governorate_id::TEXT = $1::TEXT
          OR UPPER(d.governorate_code::TEXT) = UPPER(sg.governorate_code::TEXT)
        )
      ORDER BY COALESCE(d.display_order, d.sort_order, d.district_id), d.district_name
      `,
      [governorateId]
    );

    return sendSuccess(res, 'Districts retrieved successfully.', result.rows);
  } catch (error) {
    return sendError(res, error);
  }
}

async function getMunicipalities(req, res) {
  try {
    const { districtId } = req.query;

    if (!districtId) {
      return res.status(400).json({
        success: false,
        message: 'districtId is required.',
        timestamp: new Date().toISOString()
      });
    }

    const result = await pool.query(
      `
      SELECT
        m.municipality_id::TEXT AS id,
        m.municipality_code AS code,
        m.municipality_name AS name,
        m.arabic_name AS "arabicName",
        m.district_id::TEXT AS "districtId",
        m.district_code AS "districtCode",
        m.governorate_id::TEXT AS "governorateId",
        m.governorate_code AS "governorateCode"
      FROM blockchain.municipalities m
      WHERE COALESCE(m.is_active, true) = true
        AND (
          m.district_id::TEXT = $1::TEXT
          OR UPPER(m.district_code::TEXT) = UPPER($1::TEXT)
        )
      ORDER BY COALESCE(m.display_order, m.sort_order, m.municipality_id), m.municipality_name
      `,
      [districtId]
    );

    return sendSuccess(res, 'Municipalities retrieved successfully.', result.rows);
  } catch (error) {
    return sendError(res, error);
  }
}

async function getKycStatuses(req, res) {
  try {
    const result = await pool.query(`
      SELECT
          status_code AS id,
          status_code AS code,
          status_name AS name,
          arabic_name AS "arabicName"
      FROM blockchain.kyc_statuses
      WHERE is_active = TRUE
      ORDER BY sort_order, status_name
    `);

    return sendSuccess(res, 'KYC statuses retrieved successfully.', result.rows);
  } catch (error) {
    return sendError(res, error);
  }
}

async function getRiskCategories(req, res) {
  try {
    const result = await pool.query(`
      SELECT
          risk_code AS id,
          risk_code AS code,
          risk_name AS name,
          arabic_name AS "arabicName",
          risk_score_min AS "riskScoreMin",
          risk_score_max AS "riskScoreMax"
      FROM blockchain.risk_categories
      WHERE is_active = TRUE
      ORDER BY sort_order, risk_name
    `);

    return sendSuccess(res, 'Risk categories retrieved successfully.', result.rows);
  } catch (error) {
    return sendError(res, error);
  }
}

async function getEmploymentStatuses(req, res) {
  try {
    const result = await pool.query(`
      SELECT
          status_code AS id,
          status_code AS code,
          status_name AS name,
          arabic_name AS "arabicName"
      FROM blockchain.employment_statuses
      WHERE is_active = TRUE
      ORDER BY sort_order, status_name
    `);

    return sendSuccess(res, 'Employment statuses retrieved successfully.', result.rows);
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
