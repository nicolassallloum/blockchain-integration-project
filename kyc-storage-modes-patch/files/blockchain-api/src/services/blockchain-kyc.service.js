'use strict';

const fs = require('fs/promises');
const db = require('../config/database');
const walletService = require('./wallet.service');

const STORAGE_MODES = Object.freeze({
  POSTGRES_ONLY: 'POSTGRES_ONLY',
  BLOCKCHAIN_ONLY: 'BLOCKCHAIN_ONLY',
  POSTGRES_AND_BLOCKCHAIN: 'POSTGRES_AND_BLOCKCHAIN'
});

function createHttpError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeStorageMode(value) {
  const storageMode = String(
    value || STORAGE_MODES.POSTGRES_AND_BLOCKCHAIN
  )
    .trim()
    .toUpperCase();

  if (!Object.values(STORAGE_MODES).includes(storageMode)) {
    throw createHttpError(
      `storageMode must be one of: ${Object.values(STORAGE_MODES).join(', ')}`,
      400
    );
  }

  return storageMode;
}

function toNumber(value, defaultValue = 0) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : defaultValue;
}

function normalizeWalletType(value) {
  const normalized = String(value || 'CUSTOMER').trim().toUpperCase();
  return normalized === 'ORGANIZATION' ? 'ORGANIZATION' : 'CUSTOMER';
}

function resolveFullName(payload) {
  const fullName =
    payload.fullName ||
    payload.customerName ||
    payload.customer_name ||
    payload.full_name ||
    payload.name ||
    payload.emailHash ||
    payload.email ||
    `KYC CUSTOMER ${payload.customerId}`;

  return String(fullName).trim();
}

function extractWalletAddress(walletResult) {
  return (
    walletResult?.wallet?.walletAddress ||
    walletResult?.wallet?.wallet_address ||
    walletResult?.walletAddress ||
    walletResult?.wallet_address ||
    walletResult?.blockchain?.walletAddress ||
    walletResult?.data?.walletAddress ||
    walletResult?.data?.wallet_address ||
    null
  );
}

function extractFabricTxId(walletResult) {
  return (
    walletResult?.blockchain?.fabricTransactionId ||
    walletResult?.fabricTransactionId ||
    walletResult?.fabric_tx_id ||
    walletResult?.wallet?.fabricTxId ||
    walletResult?.wallet?.fabric_tx_id ||
    walletResult?.data?.fabricTransactionId ||
    walletResult?.data?.fabric_tx_id ||
    null
  );
}

function extractLedgerReference(walletResult) {
  return (
    walletResult?.blockchain?.ledgerReference ||
    walletResult?.blockchain?.ledgerKey ||
    walletResult?.wallet?.ledgerKey ||
    walletResult?.wallet?.ledger_key ||
    extractWalletAddress(walletResult) ||
    null
  );
}

function buildWalletPayload(payload) {
  return {
    ...payload,

    customerId: payload.customerId,

    organizationId: payload.organizationId,
    organizationCode: payload.organizationCode,
    organizationName: payload.organization || payload.organizationName,

    fullName: resolveFullName(payload),

    nationalIdHash: payload.nationalIdHash || payload.legalIdNumberHash || '',
    mobileHash: payload.mobileHash || '',
    emailHash: payload.emailHash || '',

    password:
      payload.password ||
      payload.generatedPassword ||
      payload.oneTimePassword ||
      null,

    initialBalance: toNumber(payload.initialBalance, 0),
    currencyCode: payload.currencyCode || 'USD',

    /**
     * Blockchain KYC creates a CUSTOMER wallet linked to an organization.
     * Do not call createOrganizationWallet here because it generates ORG_* IDs,
     * while enterprise tables require numeric customer_id.
     */
    walletType: 'CUSTOMER',
    partyTypeCode: 7,

    requestSource:
      payload.requestSource ||
      payload.request_source ||
      'BLOCKCHAIN_KYC_MODULE',

    sourceSystem:
      payload.sourceSystem ||
      payload.source_system ||
      'BLOCKCHAIN_KYC_MODULE',

    createdBy:
      payload.createdBy ||
      payload.created_by ||
      'blockchain-kyc-module'
  };
}

async function removeUploadedFiles(files) {
  const uploadedFiles = Object.values(files || {})
    .flatMap((value) => (Array.isArray(value) ? value : []))
    .filter((file) => file?.path);

  await Promise.all(
    uploadedFiles.map(async (file) => {
      try {
        await fs.unlink(file.path);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          console.warn('[BLOCKCHAIN_KYC_FILE_CLEANUP_WARNING]', {
            path: file.path,
            message: error.message
          });
        }
      }
    })
  );
}

async function insertKycRequest(
  payload,
  files,
  storageMode = STORAGE_MODES.POSTGRES_AND_BLOCKCHAIN,
  requestStatus = 'KYC_REQUEST_CREATED'
) {
  const proofOfAddressFile = files?.proofOfAddressFile?.[0] || null;
  const documentFile = files?.documentFile?.[0] || null;
  const createsWallet = storageMode !== STORAGE_MODES.POSTGRES_ONLY;

  const sql = `
    INSERT INTO blockchain.blockchain_kyc_wallet_requests (
      customer_id,
      full_name,
      nationality,
      country_of_residence,

      mobile_hash,
      email_hash,
      national_id_hash,

      organization_type,
      organization_id,
      organization_code,
      organization_name,

      city,
      area,
      address_hash,
      proof_of_address_file_name,
      proof_of_address_file_path,

      source_of_funds,
      occupation,
      employment_sector,
      monthly_income,
      expected_monthly_transaction_volume,
      expected_cash_transactions,

      wallet_type,
      party_type_code,
      wallet_status,
      initial_balance,
      currency_code,
      daily_transfer_limit,
      monthly_transfer_limit,

      legal_document_type,
      legal_id_number_hash,
      document_file_name,
      document_file_path,
      document_expiry_date,

      storage_mode,
      request_status,
      created_at,
      updated_at
    )
    VALUES (
      $1, $2, $3, $4,
      $5, $6, $7,
      $8, $9, $10, $11,
      $12, $13, $14, $15, $16,
      $17, $18, $19, $20, $21, $22,
      $23, $24, $25, $26, $27, $28, $29,
      $30, $31, $32, $33, $34,
      $35, $36,
      NOW(),
      NOW()
    )
    RETURNING *
  `;

  const values = [
    payload.customerId,
    resolveFullName(payload),
    payload.nationality || null,
    payload.countryOfResidence || null,

    payload.mobileHash || null,
    payload.emailHash || null,
    payload.nationalIdHash || null,

    payload.organizationType || null,
    payload.organizationId || null,
    payload.organizationCode || null,
    payload.organization || payload.organizationName || null,

    payload.city || null,
    payload.area || null,
    payload.addressHash || null,
    proofOfAddressFile?.originalname || null,
    proofOfAddressFile?.path || null,

    payload.sourceOfFunds || null,
    payload.occupation || null,
    payload.employmentSector || null,
    payload.monthlyIncome ? Number(payload.monthlyIncome) : null,
    payload.expectedMonthlyTransactionVolume
      ? Number(payload.expectedMonthlyTransactionVolume)
      : null,
    payload.expectedCashTransactions
      ? Number(payload.expectedCashTransactions)
      : null,

    createsWallet ? normalizeWalletType(payload.walletType) : null,
    createsWallet
      ? (payload.partyTypeCode ? Number(payload.partyTypeCode) : 7)
      : null,
    createsWallet ? (payload.walletStatus || 'ACTIVE') : null,
    createsWallet
      ? (payload.initialBalance ? Number(payload.initialBalance) : 0)
      : null,
    createsWallet ? (payload.currencyCode || 'USD') : null,
    createsWallet && payload.dailyTransferLimit
      ? Number(payload.dailyTransferLimit)
      : null,
    createsWallet && payload.monthlyTransferLimit
      ? Number(payload.monthlyTransferLimit)
      : null,

    payload.legalDocumentType || null,
    payload.legalIdNumberHash || null,
    documentFile?.originalname || null,
    documentFile?.path || null,
    payload.documentExpiryDate || null,

    storageMode,
    requestStatus
  ];

  const result = await db.query(sql, values);
  return result.rows[0];
}

async function markKycRequestWalletCreated(requestId, walletResult) {
  const walletAddress = extractWalletAddress(walletResult);
  const fabricTxId = extractFabricTxId(walletResult);
  const ledgerReference = extractLedgerReference(walletResult);

  const result = await db.query(
    `
    UPDATE blockchain.blockchain_kyc_wallet_requests
    SET
      wallet_address = $1,
      ledger_reference = $2,
      blockchain_tx_id = $3,
      request_status = 'WALLET_CREATED',
      error_message = NULL,
      updated_at = NOW()
    WHERE request_id = $4
    RETURNING *
    `,
    [walletAddress, ledgerReference, fabricTxId, requestId]
  );

  return result.rows[0];
}

async function markKycRequestWalletFailed(requestId, error) {
  const errorMessage = error?.message || String(error);

  const result = await db.query(
    `
    UPDATE blockchain.blockchain_kyc_wallet_requests
    SET
      request_status = 'WALLET_CREATION_FAILED',
      error_message = $1,
      updated_at = NOW()
    WHERE request_id = $2
    RETURNING *
    `,
    [errorMessage, requestId]
  );

  return result.rows[0];
}

async function createPostgresOnlyKyc(payload, files) {
  const kycRequest = await insertKycRequest(
    payload,
    files,
    STORAGE_MODES.POSTGRES_ONLY,
    'POSTGRES_SAVED'
  );

  return {
    success: true,
    storageMode: STORAGE_MODES.POSTGRES_ONLY,
    message:
      'KYC information saved successfully in PostgreSQL. No blockchain wallet was created.',
    kycRequest,
    walletCreationStatus: 'NOT_REQUESTED',
    walletResult: null,
    postgres: {
      saved: true,
      requestId: kycRequest.request_id
    },
    blockchain: {
      saved: false,
      submitted: false
    },
    walletLoginEnabled: false
  };
}

async function createBlockchainOnlyKyc(payload, files) {
  /*
   * Multer writes uploaded files before the service is called. Blockchain-only
   * must not retain KYC documents in PostgreSQL or the upload folder, so remove
   * any files sent by non-UI clients.
   */
  await removeUploadedFiles(files);

  const walletResult = await walletService.createWalletOnFabricOnly(
    buildWalletPayload(payload)
  );

  return {
    success: true,
    storageMode: STORAGE_MODES.BLOCKCHAIN_ONLY,
    message:
      'Blockchain wallet created successfully on Hyperledger Fabric. No KYC request or wallet login record was saved in PostgreSQL.',
    kycRequest: null,
    walletCreationStatus: 'SUCCESS',
    walletResult,
    postgres: {
      saved: false,
      requestId: null,
      walletId: null
    },
    blockchain: {
      saved: true,
      submitted: true,
      walletAddress: extractWalletAddress(walletResult),
      fabricTransactionId: extractFabricTxId(walletResult),
      ledgerReference: extractLedgerReference(walletResult)
    },
    walletLoginEnabled: false,
    walletLoginMessage:
      'The current wallet login service reads blockchain.wallets.password_hash. Blockchain-only wallets are not available to that login flow.'
  };
}

async function createPostgresAndBlockchainKyc(payload, files) {
  const kycRequest = await insertKycRequest(
    payload,
    files,
    STORAGE_MODES.POSTGRES_AND_BLOCKCHAIN,
    'KYC_REQUEST_CREATED'
  );

  try {
    const walletResult = await walletService.createWallet(
      buildWalletPayload(payload)
    );

    const updatedKycRequest = await markKycRequestWalletCreated(
      kycRequest.request_id,
      walletResult
    );

    return {
      success: true,
      storageMode: STORAGE_MODES.POSTGRES_AND_BLOCKCHAIN,
      message:
        'Blockchain KYC customer wallet created successfully in enterprise tables, PostgreSQL wallet table, and Fabric ledger.',
      kycRequest: updatedKycRequest,
      walletCreationStatus: 'SUCCESS',
      walletResult,
      postgres: {
        saved: true,
        requestId: updatedKycRequest.request_id,
        walletId: walletResult?.postgres?.walletId || null
      },
      blockchain: {
        saved: true,
        submitted: true,
        walletAddress: extractWalletAddress(walletResult),
        fabricTransactionId: extractFabricTxId(walletResult),
        ledgerReference: extractLedgerReference(walletResult)
      },
      walletLoginEnabled: true
    };
  } catch (error) {
    const failedKycRequest = await markKycRequestWalletFailed(
      kycRequest.request_id,
      error
    );

    const finalError = new Error(
      `KYC request was saved, but wallet creation failed: ${error.message}`
    );

    finalError.statusCode = 500;
    finalError.storageMode = STORAGE_MODES.POSTGRES_AND_BLOCKCHAIN;
    finalError.kycRequest = failedKycRequest;
    finalError.originalError = error;
    throw finalError;
  }
}

async function createBlockchainKycWallet(payload, files) {
  if (!payload.customerId) {
    throw createHttpError('customerId is required', 400);
  }

  if (!payload.organizationId) {
    throw createHttpError('organizationId is required', 400);
  }

  const storageMode = normalizeStorageMode(payload.storageMode);

  switch (storageMode) {
    case STORAGE_MODES.POSTGRES_ONLY:
      return createPostgresOnlyKyc(payload, files);

    case STORAGE_MODES.BLOCKCHAIN_ONLY:
      return createBlockchainOnlyKyc(payload, files);

    case STORAGE_MODES.POSTGRES_AND_BLOCKCHAIN:
      return createPostgresAndBlockchainKyc(payload, files);

    default:
      throw createHttpError(`Unsupported storageMode: ${storageMode}`, 400);
  }
}

module.exports = {
  STORAGE_MODES,
  createBlockchainKycWallet
};
