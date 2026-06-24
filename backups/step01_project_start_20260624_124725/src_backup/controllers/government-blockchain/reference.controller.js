const pool = require('../../config/database');

async function getCountries(req, res, next) {
  try {
    const result = await pool.query(`
      SELECT
        cou_id AS "countryId",
        iso_cou_code_alpha AS "countryCode",
        cou_name AS "countryName"
      FROM blockchain.countries
      WHERE iso_cou_code_alpha IS NOT NULL
      ORDER BY cou_name;
    `);

    res.status(200).json({
      success: true,
      count: result.rowCount,
      data: result.rows
    });
  } catch (error) {
    next(error);
  }
}

async function getGovernorates(req, res, next) {
  try {
    const { countryCode } = req.query;

    const params = [];
    let whereClause = '';

    if (countryCode) {
      params.push(countryCode);
      whereClause = `WHERE c.iso_cou_code_alpha = $1`;
    }

    const result = await pool.query(
      `
      SELECT
        g.governorate_id AS "governorateId",
        g.country_id AS "countryId",
        c.iso_cou_code_alpha AS "countryCode",
        g.governorate_code AS "governorateCode",
        g.governorate_name AS "governorateName",
        g.governorate_name_ar AS "governorateNameAr",
        g.is_active AS "isActive"
      FROM blockchain.governorates g
      JOIN blockchain.countries c
        ON c.cou_id = g.country_id
      ${whereClause}
        ${whereClause ? 'AND' : 'WHERE'} g.is_active = TRUE
      ORDER BY c.iso_cou_code_alpha, g.governorate_name;
      `,
      params
    );

    res.status(200).json({
      success: true,
      count: result.rowCount,
      data: result.rows
    });
  } catch (error) {
    next(error);
  }
}

async function getWalletTypes(req, res, next) {
  try {
    const result = await pool.query(`
      SELECT
        wallet_type_id AS "walletTypeId",
        wallet_type_code AS "walletTypeCode",
        wallet_type_name AS "walletTypeName",
        wallet_type_description AS "walletTypeDescription",
        is_active AS "isActive"
      FROM blockchain.wallet_types
      WHERE is_active = TRUE
      ORDER BY wallet_type_name;
    `);

    res.status(200).json({
      success: true,
      count: result.rowCount,
      data: result.rows
    });
  } catch (error) {
    next(error);
  }
}

async function getWalletStatuses(req, res, next) {
  try {
    const result = await pool.query(`
      SELECT
        wallet_status_id AS "walletStatusId",
        wallet_status_code AS "walletStatusCode",
        wallet_status_name AS "walletStatusName",
        wallet_status_description AS "walletStatusDescription",
        is_active AS "isActive"
      FROM blockchain.wallet_statuses
      WHERE is_active = TRUE
      ORDER BY wallet_status_name;
    `);

    res.status(200).json({
      success: true,
      count: result.rowCount,
      data: result.rows
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getCountries,
  getGovernorates,
  getWalletTypes,
  getWalletStatuses
};
