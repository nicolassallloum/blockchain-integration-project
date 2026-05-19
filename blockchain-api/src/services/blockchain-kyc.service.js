'use strict';

const db = require('../config/database');
const walletService = require('./wallet.service');

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

async function insertKycRequest(payload, files) {
  const proofOfAddressFile = files?.proofOfAddressFile?.[0] || null;
  const documentFile = files?.documentFile?.[0] || null;

  const sql = `
    INSERT INTO blockchain.blockchain_kyc_wallet_requests (
      customer_id,
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

      request_status,
      created_at,
      updated_at
    )
    VALUES (
      $1, $2, $3,
      $4, $5, $6,
      $7, $8, $9, $10,
      $11, $12, $13, $14, $15,
      $16, $17, $18, $19, $20, $21,
      $22, $23, $24, $25, $26, $27, $28,
      $29, $30, $31, $32, $33,
      'KYC_REQUEST_CREATED',
      NOW(),
      NOW()
    )
    RETURNING *
  `;

  const values = [
    payload.customerId,
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
    payload.expectedCashTransactions ? Number(payload.expectedCashTransactions) : null,

    normalizeWalletType(payload.walletType),
    payload.partyTypeCode ? Number(payload.partyTypeCode) : 7,
    payload.walletStatus || 'ACTIVE',
    payload.initialBalance ? Number(payload.initialBalance) : 0,
    payload.currencyCode || 'USD',
    payload.dailyTransferLimit ? Number(payload.dailyTransferLimit) : null,
    payload.monthlyTransferLimit ? Number(payload.monthlyTransferLimit) : null,

    payload.legalDocumentType || null,
    payload.legalIdNumberHash || null,
    documentFile?.originalname || null,
    documentFile?.path || null,
    payload.documentExpiryDate || null
  ];

  const result = await db.query(sql, values);
  return result.rows[0];
}

async function markKycRequestWalletCreated(requestId, walletResult) {
  const walletAddress = extractWalletAddress(walletResult);
  const fabricTxId = extractFabricTxId(walletResult);

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
    [walletAddress, fabricTxId, fabricTxId, requestId]
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

async function createBlockchainKycWallet(payload, files) {
  if (!payload.customerId) {
    throw new Error('customerId is required');
  }

  if (!payload.organizationId) {
    throw new Error('organizationId is required');
  }

  const walletType = normalizeWalletType(payload.walletType);

  const kycRequest = await insertKycRequest(payload, files);

  try {
    let walletResult;

    if (walletType === 'ORGANIZATION') {
      walletResult = await walletService.createOrganizationWallet({
        ...payload,
        organizationId: payload.organizationId,
        organizationCode: payload.organizationCode,
        organizationName: payload.organization || payload.organizationName,
        initialBalance: toNumber(payload.initialBalance, 0),
        currencyCode: payload.currencyCode || 'USD',
        requestSource: payload.requestSource || payload.request_source || 'BLOCKCHAIN_KYC_MODULE',
        sourceSystem: payload.sourceSystem || payload.source_system || 'BLOCKCHAIN_KYC_MODULE',
        createdBy: payload.createdBy || payload.created_by || 'blockchain-kyc-module'
      });
    } else {
      walletResult = await walletService.createWallet({
        ...payload,
        customerId: payload.customerId,
        organizationId: payload.organizationId,
        organizationCode: payload.organizationCode,
        organizationName: payload.organization || payload.organizationName,
        fullName: resolveFullName(payload),
        nationalIdHash: payload.nationalIdHash || payload.legalIdNumberHash || '',
        mobileHash: payload.mobileHash || '',
        emailHash: payload.emailHash || '',
        password: payload.password || payload.generatedPassword || payload.oneTimePassword || null,
        initialBalance: toNumber(payload.initialBalance, 0),
        currencyCode: payload.currencyCode || 'USD',
        requestSource: payload.requestSource || payload.request_source || 'BLOCKCHAIN_KYC_MODULE',
        sourceSystem: payload.sourceSystem || payload.source_system || 'BLOCKCHAIN_KYC_MODULE',
        createdBy: payload.createdBy || payload.created_by || 'blockchain-kyc-module'
      });
    }

    const updatedKycRequest = await markKycRequestWalletCreated(
      kycRequest.request_id,
      walletResult
    );

    return {
      success: true,
      message: 'Blockchain KYC wallet created successfully in enterprise tables, PostgreSQL wallet table, and Fabric ledger.',
      kycRequest: updatedKycRequest,
      walletCreationStatus: 'SUCCESS',
      walletResult
    };
  } catch (error) {
    const failedKycRequest = await markKycRequestWalletFailed(
      kycRequest.request_id,
      error
    );

    const finalError = new Error(
      `KYC request was saved, but wallet creation failed: ${error.message}`
    );

    finalError.kycRequest = failedKycRequest;
    finalError.originalError = error;
    throw finalError;
  }
}

module.exports = {
  createBlockchainKycWallet
};
