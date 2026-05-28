const express = require('express');
const router = express.Router();
const pool = require('../config/postgres');
const bcrypt = require('bcryptjs');

router.post('/login', async (req, res) => {
  try {
    const { username, password, accountType } = req.body;

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
          pa.contact_email AS "username",
          pa.administration_code AS "administrationCode",
          pa.administration_name AS "displayName",
          pa.arabic_name AS "arabicName",
          pa.contact_email AS "email",
          pa.contact_mobile AS "mobile",
          pa.wallet_status AS "status",
          pa.created_at AS "createdAt",
          pa.blockchain_tx_id AS "blockchainTxId",
          pa.wallet_address AS "walletAddress",
          COALESCE(pa.wallet_currency, 'LBP') AS "currency"
        FROM blockchain.public_administrations pa
        WHERE UPPER(pa.contact_email) = UPPER($1)
        LIMIT 1
      `;
    }

    if (accountType === 'RESIDENT') {
      query = `
        SELECT
          r.resident_id AS "accountId",
          'RESIDENT' AS "accountType",
          r.login_username AS "username",
          CONCAT_WS(' ', r.first_name, r.last_name) AS "displayName",
          r.arabic_full_name AS "arabicName",
          r.email AS "email",
          r.mobile AS "mobile",
          r.wallet_status AS "status",
          r.created_at AS "createdAt",
          r.tx_id AS "blockchainTxId",
          r.ledger_reference AS "couchDbDocId",
          r.password_hash AS "passwordHash",
          r.wallet_address AS "walletAddress",
          COALESCE(r.wallet_balance, 0) AS "walletBalance",
          COALESCE(r.wallet_currency, 'LBP') AS "currency"
        FROM blockchain.residents r
        WHERE UPPER(r.login_username) = UPPER($1)
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

    const storedPasswordHash =
      account.passwordHash ||
      account.passwordhash ||
      account.password_hash;

    if (!storedPasswordHash) {
      return res.status(500).json({
        success: false,
        message: 'Password hash was not returned from database query. Check SQL alias passwordHash.',
        debugColumns: Object.keys(account)
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
