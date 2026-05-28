const express = require('express');
const router = express.Router();
const pool = require('../config/postgres');
const bcrypt = require('bcryptjs');
// const generatedPassword = generatePassword();
// const passwordHash = await bcrypt.hash(generatedPassword, 10);
// const loginUsername = administration.contactEmail;
router.post('/login', async (req, res) => {
  try {
    const { username, password, accountType } = req.body;
    // const isPasswordValid = await bcrypt.compare(password, storedPasswordHash);
    if (!username || !password || !accountType) {
      return res.status(400).json({
        success: false,
        message: 'Username, password, and account type are required'
      });
    }

    let query = '';

    if (accountType === 'MINISTRY') {
      query = `
        SELECT
          m.ministry_id AS "accountId",
          'MINISTRY' AS "accountType",
          m.login_username AS "username",
          m.ministry_code AS "ministryCode",
          m.ministry_name AS "displayName",
          m.arabic_name AS "arabicName",
          m.contact_email AS "email",
          m.contact_mobile AS "mobile",
          m.wallet_status AS "status",
          m.created_at AS "createdAt",
          m.tx_id AS "blockchainTxId",
          m.ledger_reference AS "couchDbDocId",
          m.password_hash AS "passwordHash",
          m.wallet_address AS "walletAddress"
        FROM blockchain.government_ministries m
        WHERE UPPER(m.login_username) = UPPER($1)
        LIMIT 1
      `;
    }

    if (accountType === 'PUBLIC_ADMINISTRATION') {
      query = `
        SELECT
          pa.administration_id AS "accountId",
          'PUBLIC_ADMINISTRATION' AS "accountType",
          COALESCE(pa.login_username, pa.contact_email, pa.administration_code) AS "username",
          pa.administration_code AS "administrationCode",
          pa.administration_name AS "displayName",
          pa.arabic_name AS "arabicName",
          pa.parent_ministry AS "parentMinistry",
          pa.administration_type AS "administrationType",
          pa.director_name AS "directorName",
          pa.contact_person AS "contactPerson",
          pa.contact_email AS "email",
          pa.contact_mobile AS "mobile",
          pa.country AS "country",
          pa.governorate AS "governorate",
          pa.municipality AS "municipality",
          pa.address AS "address",
          pa.wallet_status AS "status",
          pa.created_at AS "createdAt",
          pa.blockchain_tx_id AS "blockchainTxId",
          pa.ledger_reference AS "couchDbDocId",
          pa.password_hash AS "passwordHash",
          pa.wallet_address AS "walletAddress",
          COALESCE(pa.wallet_balance, 0) AS "walletBalance",
          COALESCE(pa.wallet_currency, 'LBP') AS "currency"
        FROM blockchain.public_administrations pa
        WHERE UPPER(COALESCE(pa.login_username, pa.contact_email, pa.administration_code)) = UPPER($1)
        ORDER BY
          CASE WHEN pa.password_hash IS NOT NULL THEN 0 ELSE 1 END,
          pa.created_at DESC
        LIMIT 1
      `;
    }

    if (accountType === 'RESIDENT') {
      query = `
        SELECT
          r.resident_id AS "accountId",
          'RESIDENT' AS "accountType",
          COALESCE(r.login_username, r.wallet_address, r.email) AS "username",
          CONCAT_WS(' ', r.first_name, r.last_name) AS "displayName",
          r.arabic_full_name AS "arabicName",
          r.email AS "email",
          r.mobile_number AS "mobile",
          r.wallet_status AS "status",
          r.created_at AS "createdAt",
          r.tax_number AS "blockchainTxId",
          r.password_hash AS "passwordHash",
          r.wallet_address AS "walletAddress",
          COALESCE(r.monthly_income, 0) AS "walletBalance",
          COALESCE(r.wallet_currency, 'LBP') AS "currency"
        FROM blockchain.residents r
        WHERE UPPER(COALESCE(r.login_username, r.wallet_address, r.email)) = UPPER($1)
          OR UPPER(r.wallet_address) = UPPER($1)
          OR UPPER(r.email) = UPPER($1)
        ORDER BY
          CASE WHEN r.password_hash IS NOT NULL THEN 0 ELSE 1 END,
          r.created_at DESC
        LIMIT 1
      `;
    }

    if (!query) {
      return res.status(400).json({
        success: false,
        message: 'Invalid account type'
      });
    }

    const result = await pool.query(query, [username]);

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Login failed. Username not found for selected account type.'
      });
    }

    const account = result.rows[0];

    console.log('[LOGIN ACCOUNT ROW]', account);
    console.log('[LOGIN ACCOUNT COLUMNS]', Object.keys(account));
    console.log('[LOGIN PASSWORD HASH VALUE]', account.passwordHash);

    const storedPasswordHash = String(
      account.passwordHash ||
      account.passwordhash ||
      account.password_hash ||
      ''
    ).trim();

    if (!storedPasswordHash) {
      return res.status(500).json({
        success: false,
        message:
          'Password hash value is empty. The column exists but the value returned is null or empty.',
        debugColumns: Object.keys(account),
        debugAccount: account
      });
    }

    const isPasswordValid = await bcrypt.compare(password, storedPasswordHash);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Login failed. Invalid password.'
      });
    }

    delete account.passwordHash;
    delete account.passwordhash;
    delete account.password_hash;

    return res.json({
      success: true,
      message: 'Login successful',
      data: account
    });
  } catch (error) {
    console.error('[GOVERNMENT ACCOUNT LOGIN ERROR]', error);

    return res.status(500).json({
      success: false,
      message: 'Internal server error during login',
      error: error.message
    });
  }
});


module.exports = router;
