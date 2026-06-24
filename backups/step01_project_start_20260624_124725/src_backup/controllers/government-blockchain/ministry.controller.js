const db = require('../../config/database');
const bcrypt = require('bcryptjs');
const fabricService = require('../../services/fabric.service');
const MINISTRY_WALLET_CURRENCY = 'GOV';

function forceMinistryGovCurrency(inputCurrency) {
  const normalized = String(inputCurrency || '').trim().toUpperCase();

  if (normalized && normalized !== MINISTRY_WALLET_CURRENCY) {
    console.warn(
      `[MINISTRY GOV CURRENCY ENFORCED] Received currency "${inputCurrency}", forced to GOV`
    );
  }

  return MINISTRY_WALLET_CURRENCY;
}
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
async function getNextMinistryId(req, res, next) {
  try {
    const result = await db.query(`
      SELECT nextval('ssdx_kyc.ministry_id') AS sequence_number;
    `);

    const sequenceNumber = Number(result.rows[0].sequence_number);
    const ministryId = `MIN-BLOCKCHAIN-${sequenceNumber}`;

    return res.status(200).json({
      success: true,
      message: 'Next ministry ID generated successfully.',
      data: {
        sequenceNumber,
        ministryId
      }
    });
  } catch (error) {
    console.error('Generate next ministry ID error:', {
      message: error.message,
      stack: error.stack
    });

    return next(error);
  }
}
function buildMinistryBlockchainDocument(savedMinistry, savedWallet) {
  const ledgerReference = `MINISTRY_${savedMinistry.ministry_reference_id}`;

  return {
    docType: 'MINISTRY',
    ledgerReference,
    ministryId: savedMinistry.ministry_id,
    ministryReferenceId: savedMinistry.ministry_reference_id,
    ministryCode: savedMinistry.ministry_code,
    ministryName: savedMinistry.ministry_name,
    arabicName: savedMinistry.arabic_name,
    ministryType: savedMinistry.ministry_type,
    parentMinistry: savedMinistry.parent_ministry,
    ministerName: savedMinistry.minister_name,
    contactPerson: savedMinistry.contact_person,
    contactEmail: savedMinistry.contact_email,
    contactMobile: savedMinistry.contact_mobile,
    countryCode: savedMinistry.country_code,
    countryName: savedMinistry.country_name,
    governorateCode: savedMinistry.governorate_code,
    governorateName: savedMinistry.governorate_name,
    address: savedMinistry.address,
    walletAddress: savedWallet ? savedWallet.wallet_address : null,
    walletCurrency: MINISTRY_WALLET_CURRENCY,
    walletStatus: savedWallet ? savedWallet.wallet_status : savedMinistry.wallet_status,
    institutionStatus: savedMinistry.institution_status,
    blockchainStatus: 'CONFIRMED',
    status: 'ACTIVE',
    createdAt: new Date().toISOString()
  };
}
async function createMinistryAccount(req, res, next) {
  try {
    const { ministry, wallet } = req.body || {};

    if (!ministry) {
      return res.status(400).json({
        success: false,
        message: 'Ministry payload is required.',
        data: null
      });
    }

    await db.query('BEGIN');

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
        ministry.ministryReferenceId || ministry.ministryId,
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
        'PENDING',
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
          MINISTRY_WALLET_CURRENCY,
          Number(wallet.walletInitialBalance || 0),
          Number(wallet.walletInitialBalance || 0),
          wallet.walletType || 'MINISTRY_WALLET',
          wallet.walletStatus || 'ACTIVE',
          'PENDING'
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

    const blockchainDocument = buildMinistryBlockchainDocument(
      savedMinistry,
      savedWallet
    );

    let fabricResult = null;
    let txId = null;
    let ledgerReference = blockchainDocument.ledgerReference;

    try {
      fabricResult = await fabricService.submitTransaction(
        'CreateMinistry',
        [JSON.stringify(blockchainDocument)],
        {
          requestId: req.requestId,
          correlationId: req.correlationId,
          sourceSystem: req.sourceSystem || 'BLOCKCHAIN_API',
          requestSource: req.requestSource || 'CREATE_MINISTRY_ACCOUNT',
          createdBy: 'system'
        }
      );

      txId =
        fabricResult?.transactionId ||
        fabricResult?.txId ||
        fabricResult?.data?.transactionId ||
        fabricResult?.data?.txId ||
        null;

      await db.query(
        `
        UPDATE blockchain.government_ministries
        SET blockchain_status = $1,
            ledger_reference = $2,
            tx_id = $3,
            updated_at = CURRENT_TIMESTAMP
        WHERE ministry_id = $4;
        `,
        [
          'CONFIRMED',
          ledgerReference,
          txId,
          savedMinistry.ministry_id
        ]
      );

      if (savedWallet) {
        await db.query(
          `
        UPDATE blockchain.government_ministry_wallets
        SET blockchain_status = $1,
            ledger_reference = $2,
            tx_id = $3,
            updated_at = CURRENT_TIMESTAMP
        WHERE wallet_id = $4;
        `,
        ['CONFIRMED', ledgerReference, txId, savedWallet.wallet_id]
        );

        savedWallet.blockchain_status = 'CONFIRMED';
        savedWallet.ledger_reference = ledgerReference;
        savedWallet.tx_id = txId;
      }

      savedMinistry.blockchain_status = 'CONFIRMED';
      savedMinistry.ledger_reference = ledgerReference;
      savedMinistry.tx_id = txId;
    } catch (fabricError) {
      console.error('Create ministry blockchain submit error:', {
        message: fabricError.message,
        stack: fabricError.stack
      });

      await db.query(
        `
        UPDATE blockchain.government_ministries
        SET blockchain_status = $1,
            ledger_reference = $2,
            updated_at = CURRENT_TIMESTAMP
        WHERE ministry_id = $3;
        `,
        [
          'FAILED',
          ledgerReference,
          savedMinistry.ministry_id
        ]
      );

      if (savedWallet) {
        await db.query(
          `
          UPDATE blockchain.government_ministry_wallets
          SET blockchain_status = $1,
              updated_at = CURRENT_TIMESTAMP
          WHERE wallet_id = $2;
          `,
          ['FAILED', savedWallet.wallet_id]
        );

        savedWallet.blockchain_status = 'FAILED';
      }

      await db.query('COMMIT');

      return res.status(502).json({
        success: false,
        message: 'Ministry saved in PostgreSQL, but blockchain submission failed.',
        errorCode: 'BLOCKCHAIN_SUBMIT_FAILED',
        error: fabricError.message,
        data: {
          ministry: {
            ...savedMinistry,
            blockchain_status: 'FAILED',
            ledger_reference: ledgerReference
          },
          wallet: savedWallet,
          blockchainPayload: blockchainDocument
        }
      });
    }

    await db.query('COMMIT');

    return res.status(201).json({
      success: true,
      message: 'Ministry account created and saved to blockchain successfully.',
      data: {
        ministry: savedMinistry,
        wallet: savedWallet,
        blockchain: {
          status: 'CONFIRMED',
          ledgerReference,
          txId,
          channelName: fabricResult?.channelName || process.env.FABRIC_CHANNEL_NAME || 'kycchannelnix1',
          chaincodeName:
            fabricResult?.chaincodeName ||
            process.env.CHAINCODE_NAME ||
            process.env.FABRIC_CHAINCODE_NAME ||
            'kyc-wallet-chaincode-js',
          functionName: fabricResult?.functionName || 'CreateMinistry',
          commitStatus: fabricResult?.commitStatus
            ? {
                successful: fabricResult.commitStatus.successful,
                code: fabricResult.commitStatus.code,
                transactionId: fabricResult.commitStatus.transactionId
              }
            : null,
          documentKey: ledgerReference,
          couchDbDatabase:
            process.env.CHAINCODE_NAME ||
            process.env.FABRIC_CHAINCODE_NAME ||
            'kyc-wallet-chaincode-js'
        },
        login: {
          username: loginUsername,
          temporaryPassword,
          note: 'Show this password once and ask the ministry user to change it later.'
        }
      }
    });
  } catch (error) {
    await db.query('ROLLBACK');

    console.error('Create ministry account error:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      constraint: error.constraint,
      table: error.table,
      column: error.column,
      stack: error.stack
    });

    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        message: 'Duplicate ministry code, ministry reference ID, login username, or wallet address.',
        errorCode: 'DUPLICATE_RECORD',
        error: error.detail || error.message,
        data: null
      });
    }

    return next(error);
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
          walletCurrency: MINISTRY_WALLET_CURRENCY,
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
        MINISTRY_WALLET_CURRENCY,
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


function parseCsvMinistriesFromBuffer(fileBuffer) {
  const content = fileBuffer.toString('utf8').replace(/^\uFEFF/, '').trim();

  if (!content) {
    return [];
  }

  const lines = content.split(/\r?\n/).filter(Boolean);

  if (lines.length < 2) {
    return [];
  }

  const parseLine = (line) => {
    const values = [];
    let current = '';
    let insideQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const next = line[i + 1];

      if (char === '"' && insideQuotes && next === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        insideQuotes = !insideQuotes;
      } else if (char === ',' && !insideQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    values.push(current.trim());
    return values;
  };

  const headers = parseLine(lines[0]).map((h) => h.trim());
  const rows = [];

  for (const line of lines.slice(1)) {
    const values = parseLine(line);
    const row = {};

    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });

    rows.push(row);
  }

  return rows;
}

function normalizeMinistryBulkRow(row) {
  const ministryCode =
    row.ministryCode ||
    row.ministry_code ||
    null;

  return {
    ministryReferenceId:
      row.ministryReferenceId ||
      row.ministry_reference_id ||
      row.ministryId ||
      row.ministry_id ||
      null,

    ministryCode,

    ministryName:
      row.ministryName ||
      row.ministry_name ||
      null,

    arabicName:
      row.arabicName ||
      row.arabic_name ||
      row.ministryName ||
      row.ministry_name ||
      'غير محدد',

    ministryType:
      row.ministryType ||
      row.ministry_type ||
      'CENTRAL_MINISTRY',

    parentMinistry:
      row.parentMinistry ||
      row.parent_ministry ||
      null,

    ministerName:
      row.ministerName ||
      row.minister_name ||
      'Not Provided',

    contactPerson:
      row.contactPerson ||
      row.contact_person ||
      'Not Provided',

    contactEmail:
      row.contactEmail ||
      row.contact_email ||
      row.email ||
      `${ministryCode || 'ministry'}@example.gov`,

    contactMobile:
      row.contactMobile ||
      row.contact_mobile ||
      row.phone ||
      '+96100000000',

    address:
      row.address ||
      'Not Provided',

    countryId:
      row.countryId ||
      row.country_id ||
      null,

    countryCode:
      row.countryCode ||
      row.country_code ||
      'LB',

    countryName:
      row.countryName ||
      row.country_name ||
      row.country ||
      'Lebanon',

    governorateId:
      row.governorateId ||
      row.governorate_id ||
      null,

    governorateCode:
      row.governorateCode ||
      row.governorate_code ||
      null,

    governorateName:
      row.governorateName ||
      row.governorate_name ||
      row.governorate ||
      null,

    governorateNameAr:
      row.governorateNameAr ||
      row.governorate_name_ar ||
      null,

    website:
      row.website ||
      null,

    walletAddress:
      row.walletAddress ||
      row.wallet_address ||
      null,

    walletCurrency: MINISTRY_WALLET_CURRENCY,
    walletInitialBalance: row.walletInitialBalance || row.wallet_initial_balance || 0,
    walletType: row.walletType || row.wallet_type || 'MINISTRY_WALLET',
    walletStatus: row.walletStatus || row.wallet_status || 'ACTIVE',
    blockchainStatus: row.blockchainStatus || row.blockchain_status || 'NOT_SUBMITTED',
    loginUsername: row.loginUsername || row.login_username || ministryCode || null,
    password: row.password || null
  };
}

async function bulkCreateMinistries(req, res, next) {
  try {
    console.log('[BULK_CREATE_MINISTRIES_INPUT]', {
      body: req.body,
      file: req.file
        ? {
            originalname: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size
          }
        : null,
      files: req.files
    });

    let ministries = [];

    if (req.file && req.file.buffer) {
      ministries = parseCsvMinistriesFromBuffer(req.file.buffer).map(normalizeMinistryBulkRow);
    } else if (req.body && Array.isArray(req.body.ministries)) {
      ministries = req.body.ministries.map(normalizeMinistryBulkRow);
    } else if (req.body && typeof req.body.ministries === 'string') {
      ministries = JSON.parse(req.body.ministries).map(normalizeMinistryBulkRow);
    }

    if (!Array.isArray(ministries) || ministries.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'ministries array or CSV file is required.',
        errorCode: 'MINISTRIES_ARRAY_OR_CSV_REQUIRED',
        data: null
      });
    }

    await db.query('BEGIN');

    let insertedCount = 0;
    let walletInsertedCount = 0;
    const skipped = [];
    const inserted = [];

    for (const ministry of ministries) {
      const ministryReferenceId =
        ministry.ministryReferenceId ||
        ministry.ministryId ||
        null;

      const ministryCode = ministry.ministryCode || null;

      if (!ministryReferenceId || !ministryCode || !ministry.ministryName) {
        skipped.push({
          ministryReferenceId,
          ministryCode,
          reason: 'Missing ministryReferenceId, ministryCode, or ministryName'
        });
        continue;
      }

      const existing = await db.query(
        `
        SELECT ministry_id
        FROM blockchain.government_ministries
        WHERE ministry_reference_id = $1
           OR ministry_code = $2
        LIMIT 1;
        `,
        [ministryReferenceId, ministryCode]
      );

      if (existing.rowCount > 0) {
        skipped.push({
          ministryReferenceId,
          ministryCode,
          reason: 'Already exists'
        });
        continue;
      }

      const loginUsername = ministry.loginUsername || ministryCode;
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
          country_code,
          country_name,
          governorate_code,
          governorate_name,
          wallet_status,
          institution_status,
          blockchain_status,
          login_username,
          created_at;
        `,
        [
          ministryReferenceId,
          ministryCode,
          ministry.ministryName,
          ministry.arabicName || 'غير محدد',
          ministry.ministryType || 'CENTRAL_MINISTRY',
          ministry.parentMinistry || null,
          ministry.ministerName || 'Not Provided',
          ministry.contactPerson || 'Not Provided',
          ministry.contactEmail || 'not-provided@example.gov',
          ministry.contactMobile || '+96100000000',
          ministry.address || 'Not Provided',
          ministry.countryId || null,
          ministry.countryCode || null,
          ministry.countryName || ministry.country || null,
          ministry.governorateId || null,
          ministry.governorateCode || null,
          ministry.governorateName || ministry.governorate || null,
          ministry.governorateNameAr || null,
          ministry.website || null,
          ministry.walletStatus || 'PENDING',
          ministry.institutionStatus || 'PENDING_APPROVAL',
          ministry.blockchainStatus || 'NOT_SUBMITTED',
          loginUsername,
          passwordHash,
          'ACTIVE',
          'system',
          'system'
        ]
      );

      const savedMinistry = ministryResult.rows[0];

      const walletAddress =
        ministry.walletAddress ||
        generateWalletAddress(ministryCode);

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
        RETURNING
          wallet_id,
          wallet_address,
          wallet_currency,
          wallet_current_balance,
          wallet_type,
          wallet_status,
          blockchain_status;
        `,
        [
          savedMinistry.ministry_id,
          walletAddress,
          MINISTRY_WALLET_CURRENCY,
          Number(ministry.walletInitialBalance || 0),
          Number(ministry.walletInitialBalance || 0),
          ministry.walletType || 'MINISTRY_WALLET',
          ministry.walletStatus || 'ACTIVE',
          ministry.blockchainStatus || 'NOT_SUBMITTED'
        ]
      );

      const savedWallet = walletResult.rows[0];

      await db.query(
        `
        UPDATE blockchain.government_ministries
        SET wallet_status = $1,
            updated_at = CURRENT_TIMESTAMP
        WHERE ministry_id = $2;
        `,
        [savedWallet.wallet_status || 'ACTIVE', savedMinistry.ministry_id]
      );

      insertedCount++;
      walletInsertedCount++;

      inserted.push({
        ministryId: savedMinistry.ministry_id,
        ministryReferenceId: savedMinistry.ministry_reference_id,
        ministryCode: savedMinistry.ministry_code,
        ministryName: savedMinistry.ministry_name,
        walletAddress: savedWallet.wallet_address,
        loginUsername,
        temporaryPassword
      });
    }

    await db.query('COMMIT');

    return res.status(201).json({
      success: true,
      message: 'Bulk ministries uploaded successfully.',
      insertedCount,
      walletInsertedCount,
      skippedCount: skipped.length,
      skipped,
      data: inserted
    });
  } catch (error) {
    await db.query('ROLLBACK');

    console.error('[BULK_CREATE_MINISTRIES_ERROR]', {
      message: error.message,
      stack: error.stack,
      requestId: req.requestId,
      body: req.body,
      file: req.file
    });

    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        message: 'Duplicate ministry code, ministry reference ID, login username, or wallet address.',
        errorCode: 'DUPLICATE_RECORD',
        error: error.message,
        data: null
      });
    }

    return next(error);
  }
}

module.exports = {
  createMinistryAccount,
  loginMinistry,
  saveMinistryDraft,
  createMinistryWallet,
  getMinistries,
  getMinistryById,
  bulkCreateMinistries,
  getNextMinistryId
};
