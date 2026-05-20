const db = require('../../config/database');

function generateWalletAddress(ministryCode) {
  const cleanCode = String(ministryCode || 'MIN')
    .replace(/[^A-Z0-9]/gi, '')
    .toUpperCase();

  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 10).toUpperCase();

  return `GOV-${cleanCode}-${timestamp}-${random}`;
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
        created_by,
        updated_by
      )
      VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15,
        $16, $17, $18, $19, $20,
        $21, $22, $23, $24
      )
      RETURNING *;
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
    }

    return res.status(201).json({
      success: true,
      message: 'Ministry account created successfully.',
      data: {
        ministry: savedMinistry,
        wallet: savedWallet
      }
    });
  } catch (error) {
    console.error('Create ministry account error:', error);

    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        message: 'Duplicate ministry code, ministry reference ID, or wallet address.',
        errorCode: 'DUPLICATE_RECORD',
        data: null
      });
    }

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
        ministry_id AS "ministryId",
        ministry_reference_id AS "ministryReferenceId",
        ministry_code AS "ministryCode",
        ministry_name AS "ministryName",
        arabic_name AS "arabicName",
        ministry_type AS "ministryType",
        country_code AS "countryCode",
        country_name AS "countryName",
        governorate_code AS "governorateCode",
        governorate_name AS "governorateName",
        wallet_status AS "walletStatus",
        institution_status AS "institutionStatus",
        blockchain_status AS "blockchainStatus",
        created_at AS "createdAt"
      FROM blockchain.government_ministries
      ORDER BY created_at DESC
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
        m.*,
        COALESCE(
          json_agg(w.*) FILTER (WHERE w.wallet_id IS NOT NULL),
          '[]'
        ) AS wallets
      FROM blockchain.government_ministries m
      LEFT JOIN blockchain.government_ministry_wallets w
        ON w.ministry_id = m.ministry_id
      WHERE m.ministry_reference_id = $1
         OR m.ministry_id::text = $1
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
  saveMinistryDraft,
  createMinistryWallet,
  getMinistries,
  getMinistryById
};