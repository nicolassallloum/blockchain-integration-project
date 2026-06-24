const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const pool = require('../config/postgres');

const router = express.Router();

function cleanText(value) {
  return String(value || '').trim();
}

function normalizeStatus(value) {
  return cleanText(value) || 'UNKNOWN';
}

function normalizeCurrency(value) {
  return cleanText(value) || 'GOV';
}

function normalizeBalance(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function removeSensitiveFields(row) {
  if (!row || typeof row !== 'object') return row;

  const copy = { ...row };

  delete copy.passwordHash;
  delete copy.password_hash;
  delete copy.passwordhash;
  delete copy.walletPasswordHash;
  delete copy.walletPasswordSalt;
  delete copy.wallet_password_hash;
  delete copy.wallet_password_salt;
  delete copy.passwordSalt;

  return copy;
}

function verifyPbkdf2Password(inputPassword, storedSalt, storedHash) {
  const password = cleanText(inputPassword);
  const salt = cleanText(storedSalt);
  const hash = cleanText(storedHash);

  if (!password || !salt || !hash) {
    return false;
  }

  try {
    const calculatedHash = crypto
      .pbkdf2Sync(password, salt, 120000, 64, 'sha512')
      .toString('hex');

    const expected = Buffer.from(hash, 'hex');
    const actual = Buffer.from(calculatedHash, 'hex');

    if (expected.length !== actual.length) {
      return false;
    }

    return crypto.timingSafeEqual(actual, expected);
  } catch (error) {
    console.error('[PBKDF2_PASSWORD_VERIFY_ERROR]', error.message);
    return false;
  }
}

async function verifyPassword(inputPassword, storedHash, storedSalt = null) {
  const password = cleanText(inputPassword);
  const hash = cleanText(storedHash);
  const salt = cleanText(storedSalt);

  if (!password || !hash) {
    return false;
  }

  if (salt) {
    return verifyPbkdf2Password(password, salt, hash);
  }

  return bcrypt.compare(password, hash);
}

async function findMinistryByWallet(walletAddress) {
  const result = await pool.query(
    `
    SELECT
      m.ministry_id::text AS "accountId",
      'MINISTRY' AS "accountType",
      COALESCE(m.ministry_name, m.ministry_code, m.wallet_address) AS "accountName",
      COALESCE(m.login_username, m.wallet_address) AS "username",
      m.ministry_code AS "accountCode",
      m.ministry_name AS "displayName",
      m.arabic_name AS "arabicName",
      m.contact_email AS "email",
      m.contact_mobile AS "mobile",
      m.wallet_address AS "walletAddress",
      0::numeric AS "walletBalance",
      COALESCE(m.wallet_currency, 'GOV') AS "currency",
      COALESCE(m.wallet_status, m.login_status, m.institution_status, 'UNKNOWN') AS "walletStatus",
      COALESCE(m.login_status, m.wallet_status, 'UNKNOWN') AS "status",
      m.blockchain_status AS "blockchainStatus",
      m.tx_id AS "blockchainTxId",
      m.ledger_reference AS "couchDbDocId",
      m.created_at AS "createdAt",
      m.last_login_at AS "lastLoginAt",
      m.password_hash AS "passwordHash"
    FROM blockchain.government_ministries m
    WHERE UPPER(m.wallet_address) = UPPER($1)
    ORDER BY m.created_at DESC NULLS LAST
    LIMIT 1
    `,
    [walletAddress]
  );

  return result.rows[0] || null;
}

async function findPublicAdministrationByWallet(walletAddress) {
  const result = await pool.query(
    `
    SELECT
      pa.administration_id::text AS "accountId",
      'PUBLIC_ADMINISTRATION' AS "accountType",
      COALESCE(pa.administration_name, pa.administration_code, pa.wallet_address) AS "accountName",
      COALESCE(pa.login_username, pa.wallet_address) AS "username",
      pa.administration_code AS "accountCode",
      pa.administration_name AS "displayName",
      pa.arabic_name AS "arabicName",
      pa.parent_ministry AS "parentMinistry",
      pa.administration_type AS "administrationType",
      pa.director_name AS "directorName",
      pa.contact_person AS "contactPerson",
      pa.contact_email AS "email",
      pa.contact_mobile AS "mobile",
      pa.wallet_address AS "walletAddress",
      COALESCE(pa.wallet_balance, 0)::numeric AS "walletBalance",
      COALESCE(pa.wallet_currency, 'GOV') AS "currency",
      COALESCE(pa.wallet_status, 'UNKNOWN') AS "walletStatus",
      COALESCE(pa.wallet_status, 'UNKNOWN') AS "status",
      pa.blockchain_status AS "blockchainStatus",
      pa.blockchain_tx_id AS "blockchainTxId",
      pa.ledger_reference AS "couchDbDocId",
      pa.created_at AS "createdAt",
      pa.last_login_at AS "lastLoginAt",
      pa.password_hash AS "passwordHash"
    FROM blockchain.public_administrations pa
    WHERE UPPER(pa.wallet_address) = UPPER($1)
    ORDER BY pa.created_at DESC NULLS LAST
    LIMIT 1
    `,
    [walletAddress]
  );

  return result.rows[0] || null;
}

async function findResidentByWallet(walletAddress) {
  const result = await pool.query(
    `
    SELECT
      r.resident_id::text AS "accountId",
      'RESIDENT' AS "accountType",
      COALESCE(r.full_name, CONCAT_WS(' ', r.first_name, r.last_name), r.wallet_address) AS "accountName",
      COALESCE(r.login_username, r.wallet_address) AS "username",
      r.resident_id AS "accountCode",
      COALESCE(r.full_name, CONCAT_WS(' ', r.first_name, r.last_name)) AS "displayName",
      r.arabic_full_name AS "arabicName",
      r.email AS "email",
      r.mobile_number AS "mobile",
      r.national_id_number AS "nationalId",
      r.wallet_address AS "walletAddress",
      0::numeric AS "walletBalance",
      COALESCE(r.wallet_currency, 'GOV') AS "currency",
      COALESCE(r.wallet_status, 'UNKNOWN') AS "walletStatus",
      COALESCE(r.wallet_status, r.record_status, 'UNKNOWN') AS "status",
      r.blockchain_status AS "blockchainStatus",
      NULL::text AS "blockchainTxId",
      NULL::text AS "couchDbDocId",
      r.created_at AS "createdAt",
      NULL::timestamp AS "lastLoginAt",
      COALESCE(r.password_hash, rw.wallet_password_hash) AS "passwordHash",
      rw.wallet_password_salt AS "walletPasswordSalt"
    FROM blockchain.residents r
    LEFT JOIN blockchain.resident_wallets rw
      ON rw.resident_id = r.resident_id
      OR UPPER(rw.wallet_address) = UPPER(r.wallet_address)
    WHERE UPPER(r.wallet_address) = UPPER($1)
       OR UPPER(rw.wallet_address) = UPPER($1)
    ORDER BY r.created_at DESC NULLS LAST
    LIMIT 1
    `,
    [walletAddress]
  );

  return result.rows[0] || null;
}

async function updateLastLogin(accountType, walletAddress) {
  if (accountType === 'MINISTRY') {
    await pool.query(
      `
      UPDATE blockchain.government_ministries
      SET last_login_at = NOW()
      WHERE UPPER(wallet_address) = UPPER($1)
      `,
      [walletAddress]
    );
  }

  if (accountType === 'PUBLIC_ADMINISTRATION') {
    await pool.query(
      `
      UPDATE blockchain.public_administrations
      SET last_login_at = NOW()
      WHERE UPPER(wallet_address) = UPPER($1)
      `,
      [walletAddress]
    );
  }

  if (accountType === 'RESIDENT') {
    await pool.query(
      `
      UPDATE blockchain.resident_wallets
      SET last_login_at = NOW()
      WHERE UPPER(wallet_address) = UPPER($1)
      `,
      [walletAddress]
    );
  }
}

router.post('/', async (req, res) => {
  try {
    const walletAddress = cleanText(
      req.body?.walletAddress ||
      req.body?.wallet_address ||
      req.body?.username
    );

    const password = cleanText(req.body?.password);
    const accountType = cleanText(req.body?.accountType || req.body?.account_type).toUpperCase();

    if (!walletAddress || !password) {
      return res.status(400).json({
        success: false,
        message: 'Wallet address and password are required.'
      });
    }

    const allowedAccountTypes = ['', 'MINISTRY', 'PUBLIC_ADMINISTRATION', 'RESIDENT'];

    if (!allowedAccountTypes.includes(accountType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid account type. Use MINISTRY, PUBLIC_ADMINISTRATION, or RESIDENT.'
      });
    }

    let searchResults = [];

    if (!accountType || accountType === 'MINISTRY') {
      searchResults.push(await findMinistryByWallet(walletAddress));
    }

    if (!accountType || accountType === 'PUBLIC_ADMINISTRATION') {
      searchResults.push(await findPublicAdministrationByWallet(walletAddress));
    }

    if (!accountType || accountType === 'RESIDENT') {
      searchResults.push(await findResidentByWallet(walletAddress));
    }

    searchResults = searchResults.filter(Boolean);

    if (searchResults.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Login failed. Wallet address was not found.'
      });
    }

    for (const account of searchResults) {
      const isPasswordValid = await verifyPassword(password, account.passwordHash, account.walletPasswordSalt);

      if (!isPasswordValid) {
        continue;
      }

      await updateLastLogin(account.accountType, walletAddress);

      const safeAccount = removeSensitiveFields(account);

      return res.json({
        success: true,
        message: 'Login successful.',
        data: {
          accountId: safeAccount.accountId,
          accountName: safeAccount.accountName || safeAccount.displayName || '-',
          accountType: safeAccount.accountType,
          username: safeAccount.username || safeAccount.walletAddress,
          displayName: safeAccount.displayName || safeAccount.accountName || '-',
          arabicName: safeAccount.arabicName || null,
          email: safeAccount.email || null,
          mobile: safeAccount.mobile || null,
          nationalId: safeAccount.nationalId || null,
          walletAddress: safeAccount.walletAddress,
          walletBalance: normalizeBalance(safeAccount.walletBalance),
          currency: normalizeCurrency(safeAccount.currency),
          walletStatus: normalizeStatus(safeAccount.walletStatus),
          status: normalizeStatus(safeAccount.status || safeAccount.walletStatus),
          blockchainStatus: safeAccount.blockchainStatus || null,
          blockchainTxId: safeAccount.blockchainTxId || null,
          couchDbDocId: safeAccount.couchDbDocId || null,
          createdAt: safeAccount.createdAt || null,
          lastLoginAt: new Date().toISOString()
        }
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Login failed. Invalid wallet address or password.'
    });
  } catch (error) {
    console.error('[GOVERNMENT ACCOUNT LOGIN ERROR]', error);

    return res.status(500).json({
      success: false,
      message: 'Internal server error during account login.'
    });
  }
});

module.exports = router;
