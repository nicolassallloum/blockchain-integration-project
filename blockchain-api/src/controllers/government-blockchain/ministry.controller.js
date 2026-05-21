const db = require('../../config/database');
const bcrypt = require('bcryptjs');

function generateWalletAddress(ministryCode) {
  const cleanCode = String(ministryCode || 'MIN')
    .replace(/[^A-Z0-9]/gi, '')
    .toUpperCase();

  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 10).toUpperCase();

  return `GOV-${cleanCode}-${timestamp}-${random}`;
}

function generateTemporaryPassword() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8);
  return `Gov@${timestamp}${random}`;
}

async function createMinistryAccount(req, res, next) {
  try {
    const { ministry, wallet } = req.body;

    if (!ministry) {
      return res.status(400).json({
        success: false,
        message: 'Ministry payload is required.',
        data: null
      });
    }

    const loginUsername = ministry.loginUsername || ministry.ministryCode;
    const temporaryPassword = ministry.password || generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);

    const ministryResult = await db.query(
      `
      INSERT INTO blockchain.government_ministries (
        ministry_reference_id,
        ministry_code,
        ministry_name,
        arabic_name,
        ministry_type,
        parent_ministry,
        minister_name,
        contact_person,
        contact_email,
        contact_mobile,
        address,
        country_id,
        country_code,
        country_name,
        governorate_id,
        governorate_code,
        governorate_name,
        governorate_name_ar,
        website,
        wallet_status,
        institution_status,
        blockchain_status,
        login_username,
        password_hash,
        password_set_at,
        login_status,
        created_by,
        updated_by
      )
      VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15,
        $16, $17, $18, $19, $20,
        $21, $22, $23, $24, CURRENT_TIMESTAMP,
        $25, $26, $27
      )
      RETURNING
        ministry_id,
        ministry_reference_id,
        ministry_code,
        ministry_name,
        arabic_name,
        ministry_type,
        parent_ministry,
        minister_name,
        contact_person,
        contact_email,
        contact_mobile,
        address,
        country_id,
        country_code,
        country_name,
        governorate_id,
        governorate_code,
        governorate_name,
        governorate_name_ar,
        website,
        wallet_status,
        institution_status,
        blockchain_status,
        login_username,
        login_status,
        ledger_reference,
        tx_id,
        created_by,
        updated_by,
        created_at,
        updated_at;
      `,
      [
        ministry.ministryId,
        ministry.ministryCode,
        ministry.ministryName,
        ministry.arabicName,
        ministry.ministryType,
        ministry.parentMinistry || null,
        ministry.ministerName,
        ministry.contactPerson,
        ministry.contactEmail,
        ministry.contactMobile,
        ministry.address,
        ministry.countryId || null,
        ministry.countryCode || null,
        ministry.countryName || null,
        ministry.governorateId || null,
        ministry.governorateCode || null,
        ministry.governorateName || null,
        ministry.governorateNameAr || null,
        ministry.website || null,
        ministry.walletStatus || 'PENDING',
        ministry.institutionStatus || 'PENDING_APPROVAL',
        'NOT_SUBMITTED',
        loginUsername,
        passwordHash,
        'ACTIVE',
        'system',
        'system'
      ]
    );

    const savedMinistry = ministryResult.rows[0];
    let savedWallet = null;

    if (wallet) {
      const walletAddress =
        wallet.walletAddress ||
        generateWalletAddress(ministry.ministryCode);

      const walletResult = await db.query(
        `
        INSERT INTO blockchain.government_ministry_wallets (
          ministry_id,
          wallet_address,
          wallet_currency,
          wallet_initial_balance,
          wallet_current_balance,
          wallet_type,
          wallet_status,
          blockchain_status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *;
        `,
        [
          savedMinistry.ministry_id,
          walletAddress,
          wallet.walletCurrency || 'LBP',
          Number(wallet.walletInitialBalance || 0),
          Number(wallet.walletInitialBalance || 0),
          wallet.walletType || 'MINISTRY_WALLET',
          wallet.walletStatus || 'PENDING',
          'NOT_SUBMITTED'
        ]
      );

      savedWallet = walletResult.rows[0];

      await db.query(
        `
        UPDATE blockchain.government_ministries
        SET wallet_status = $1,
            updated_at = CURRENT_TIMESTAMP
        WHERE ministry_id = $2;
        `,
        [savedWallet.wallet_status || 'ACTIVE', savedMinistry.ministry_id]
      );

      savedMinistry.wallet_status = savedWallet.wallet_status || 'ACTIVE';
    }

    return res.status(201).json({
      success: true,
      message: 'Ministry account created successfully.',
      data: {
        ministry: savedMinistry,
        wallet: savedWallet,
        login: {
          username: loginUsername,
          temporaryPassword,
          note: 'Show this password once and ask the ministry user to change it later.'
        }
      }
    });
  } catch (error) {
    console.error('Create ministry account error:', error);

    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        message: 'Duplicate ministry code, ministry reference ID, login username, or wallet address.',
        errorCode: 'DUPLICATE_RECORD',
        data: null
      });
    }

    next(error);
  }
}

async function loginMinistry(req, res, next) {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required.',
        errorCode: 'LOGIN_FIELDS_REQUIRED',
        data: null
      });
    }

    const result = await db.query(
      `
      SELECT
        m.ministry_id,
        m.ministry_reference_id,
        m.ministry_code,
        m.ministry_name,
        m.arabic_name,
        m.contact_email,
        m.country_code,
        m.country_name,
        m.governorate_code,
        m.governorate_name,
        m.wallet_status,
        m.institution_status,
        m.blockchain_status,
        m.login_username,
        m.password_hash,
        m.login_status,
        w.wallet_id,
        w.wallet_address,
        w.wallet_currency,
        w.wallet_current_balance,
        w.wallet_type,
        w.wallet_status AS ministry_wallet_status
      FROM blockchain.government_ministries m
      LEFT JOIN blockchain.government_ministry_wallets w
        ON w.ministry_id = m.ministry_id
      WHERE m.login_username = $1
         OR m.ministry_code = $1
         OR m.ministry_reference_id = $1
      ORDER BY w.created_at DESC NULLS LAST
      LIMIT 1;
      `,
      [username]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password.',
        errorCode: 'INVALID_LOGIN',
        data: null
      });
    }

    const ministry = result.rows[0];

    if (ministry.login_status !== 'ACTIVE') {
      return res.status(403).json({
        success: false,
        message: 'Ministry login account is not active.',
        errorCode: 'LOGIN_NOT_ACTIVE',
        data: null
      });
    }

    const passwordMatches = await bcrypt.compare(
      password,
      ministry.password_hash || ''
    );

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password.',
        errorCode: 'INVALID_LOGIN',
        data: null
      });
    }

    await db.query(
      `
      UPDATE blockchain.government_ministries
      SET last_login_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE ministry_id = $1;
      `,
      [ministry.ministry_id]
    );

    return res.status(200).json({
      success: true,
      message: 'Ministry login successful.',
      data: {
        ministryId: ministry.ministry_id,
        ministryReferenceId: ministry.ministry_reference_id,
        ministryCode: ministry.ministry_code,
        ministryName: ministry.ministry_name,
        arabicName: ministry.arabic_name,
        contactEmail: ministry.contact_email,
        countryCode: ministry.country_code,
        countryName: ministry.country_name,
        governorateCode: ministry.governorate_code,
        governorateName: ministry.governorate_name,
        institutionStatus: ministry.institution_status,
        blockchainStatus: ministry.blockchain_status,
        loginUsername: ministry.login_username,
        wallet: {
          walletId: ministry.wallet_id,
          walletAddress: ministry.wallet_address,
          walletCurrency: ministry.wallet_currency,
          walletCurrentBalance: ministry.wallet_current_balance,
          walletType: ministry.wallet_type,
          walletStatus: ministry.ministry_wallet_status
        }
      }
    });
  } catch (error) {
    console.error('Ministry login error:', error);
    next(error);
  }
}

async function saveMinistryDraft(req, res, next) {
  try {
    const payload = req.body || {};
    const data = payload.data || payload;

    const result = await db.query(
      `
      INSERT INTO blockchain.government_ministry_drafts (
        ministry_reference_id,
        ministry_code,
        draft_payload,
        draft_status,
        created_by,
        updated_by
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
      `,
      [
        data.ministryId || data?.ministry?.ministryId || null,
        data.ministryCode || data?.ministry?.ministryCode || null,
        JSON.stringify(payload),
        payload.draftStatus || 'DRAFT',
        'system',
        'system'
      ]
    );

    return res.status(201).json({
      success: true,
      message: 'Ministry draft saved successfully.',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Save ministry draft error:', error);
    next(error);
  }
}

async function createMinistryWallet(req, res, next) {
  try {
    const { ministryId } = req.params;
    const wallet = req.body || {};

    const ministryResult = await db.query(
      `
      SELECT ministry_id, ministry_code, ministry_name
      FROM blockchain.government_ministries
      WHERE ministry_reference_id = $1
         OR ministry_id::text = $1
      LIMIT 1;
      `,
      [ministryId]
    );

    if (ministryResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Ministry not found.',
        errorCode: 'MINISTRY_NOT_FOUND',
        data: null
      });
    }

    const ministry = ministryResult.rows[0];

    const walletAddress =
      wallet.walletAddress ||
      generateWalletAddress(ministry.ministry_code);

    const result = await db.query(
      `
      INSERT INTO blockchain.government_ministry_wallets (
        ministry_id,
        wallet_address,
        wallet_currency,
        wallet_initial_balance,
        wallet_current_balance,
        wallet_type,
        wallet_status,
        blockchain_status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *;
      `,
      [
        ministry.ministry_id,
        walletAddress,
        wallet.walletCurrency || 'LBP',
        Number(wallet.walletInitialBalance || 0),
        Number(wallet.walletInitialBalance || 0),
        wallet.walletType || 'MINISTRY_WALLET',
        wallet.walletStatus || 'ACTIVE',
        'NOT_SUBMITTED'
      ]
    );

    await db.query(
      `
      UPDATE blockchain.government_ministries
      SET wallet_status = $1,
          updated_at = CURRENT_TIMESTAMP
      WHERE ministry_id = $2;
      `,
      ['ACTIVE', ministry.ministry_id]
    );

    return res.status(201).json({
      success: true,
      message: 'Ministry wallet created successfully.',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Create ministry wallet error:', error);

    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        message: 'Wallet already exists or wallet address is duplicated.',
        errorCode: 'DUPLICATE_WALLET',
        data: null
      });
    }

    next(error);
  }
}

async function getMinistries(req, res, next) {
  try {
    const result = await db.query(
      `
      SELECT
        m.ministry_id AS "ministryId",
        m.ministry_reference_id AS "ministryReferenceId",
        m.ministry_code AS "ministryCode",
        m.ministry_name AS "ministryName",
        m.arabic_name AS "arabicName",
        m.ministry_type AS "ministryType",
        m.country_code AS "countryCode",
        m.country_name AS "countryName",
        m.governorate_code AS "governorateCode",
        m.governorate_name AS "governorateName",
        m.wallet_status AS "walletStatus",
        m.institution_status AS "institutionStatus",
        m.blockchain_status AS "blockchainStatus",
        m.login_username AS "loginUsername",
        w.wallet_address AS "walletAddress",
        w.wallet_currency AS "walletCurrency",
        w.wallet_current_balance AS "walletCurrentBalance",
        w.wallet_status AS "ministryWalletStatus",
        m.created_at AS "createdAt"
      FROM blockchain.government_ministries m
      LEFT JOIN blockchain.government_ministry_wallets w
        ON w.ministry_id = m.ministry_id
      ORDER BY m.created_at DESC
      LIMIT 100;
      `
    );

    return res.status(200).json({
      success: true,
      count: result.rowCount,
      data: result.rows
    });
  } catch (error) {
    console.error('Get ministries error:', error);
    next(error);
  }
}

async function getMinistryById(req, res, next) {
  try {
    const { ministryId } = req.params;

    const result = await db.query(
      `
      SELECT
        m.ministry_id,
        m.ministry_reference_id,
        m.ministry_code,
        m.ministry_name,
        m.arabic_name,
        m.ministry_type,
        m.parent_ministry,
        m.minister_name,
        m.contact_person,
        m.contact_email,
        m.contact_mobile,
        m.address,
        m.country_id,
        m.country_code,
        m.country_name,
        m.governorate_id,
        m.governorate_code,
        m.governorate_name,
        m.governorate_name_ar,
        m.website,
        m.wallet_status,
        m.institution_status,
        m.blockchain_status,
        m.login_username,
        m.login_status,
        m.last_login_at,
        m.ledger_reference,
        m.tx_id,
        m.created_by,
        m.updated_by,
        m.created_at,
        m.updated_at,
        COALESCE(
          json_agg(w.*) FILTER (WHERE w.wallet_id IS NOT NULL),
          '[]'
        ) AS wallets
      FROM blockchain.government_ministries m
      LEFT JOIN blockchain.government_ministry_wallets w
        ON w.ministry_id = m.ministry_id
      WHERE m.ministry_reference_id = $1
         OR m.ministry_id::text = $1
         OR m.ministry_code = $1
      GROUP BY m.ministry_id
      LIMIT 1;
      `,
      [ministryId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Ministry not found.',
        errorCode: 'MINISTRY_NOT_FOUND',
        data: null
      });
    }

    return res.status(200).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Get ministry by ID error:', error);
    next(error);
  }
}

module.exports = {
  createMinistryAccount,
  loginMinistry,
  saveMinistryDraft,
  createMinistryWallet,
  getMinistries,
  getMinistryById
};