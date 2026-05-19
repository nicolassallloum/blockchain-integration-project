'use strict';

const db = require('../config/database');
const axios = require('axios');

async function createBlockchainKycWallet(payload, files) {
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

      created_at
    )
    VALUES (
      $1, $2, $3,
      $4, $5, $6,
      $7, $8, $9, $10,
      $11, $12, $13, $14, $15,
      $16, $17, $18, $19, $20, $21,
      $22, $23, $24, $25, $26, $27, $28,
      $29, $30, $31, $32, $33,
      NOW()
    )
    RETURNING *
  `;

  const values = [
    payload.customerId,
    payload.nationality,
    payload.countryOfResidence,

    payload.mobileHash,
    payload.emailHash,
    payload.nationalIdHash,

    payload.organizationType,
    payload.organizationId || null,
    payload.organizationCode,
    payload.organization,

    payload.city || null,
    payload.area || null,
    payload.addressHash || null,
    proofOfAddressFile?.originalname || null,
    proofOfAddressFile?.path || null,

    payload.sourceOfFunds || null,
    payload.occupation || null,
    payload.employmentSector || null,
    payload.monthlyIncome ? Number(payload.monthlyIncome) : null,
    payload.expectedMonthlyTransactionVolume ? Number(payload.expectedMonthlyTransactionVolume) : null,
    payload.expectedCashTransactions ? Number(payload.expectedCashTransactions) : null,

    payload.walletType,
    payload.partyTypeCode ? Number(payload.partyTypeCode) : null,
    payload.walletStatus,
    payload.initialBalance ? Number(payload.initialBalance) : 0,
    payload.currencyCode,
    payload.dailyTransferLimit ? Number(payload.dailyTransferLimit) : null,
    payload.monthlyTransferLimit ? Number(payload.monthlyTransferLimit) : null,

    payload.legalDocumentType,
    payload.legalIdNumberHash || null,
    documentFile?.originalname || null,
    documentFile?.path || null,
    payload.documentExpiryDate || null
  ];

  const result = await db.query(sql, values);

  const kycRequest = result.rows[0];

  let walletResponse = null;

  try {
    const walletPayload = {
      customerId: payload.customerId,
      organizationType: payload.organizationType,
      organizationId: payload.organizationId,
      organizationCode: payload.organizationCode,
      organizationName: payload.organization,
      fullName: payload.fullName || payload.customerName || `KYC CUSTOMER ${payload.customerId}`,
      initialBalance: payload.initialBalance ? Number(payload.initialBalance) : 0,
      currencyCode: payload.currencyCode || 'USD',
      walletStatus: payload.walletStatus || 'ACTIVE',
      walletType: payload.walletType || 'CUSTOMER',
      partyTypeCode: payload.partyTypeCode ? Number(payload.partyTypeCode) : 7,
      nationalIdHash: payload.nationalIdHash,
      mobileHash: payload.mobileHash,
      emailHash: payload.emailHash,
      countryOfResidence: payload.countryOfResidence,
      nationality: payload.nationality
    };

    walletResponse = await axios.post(
      'http://127.0.0.1:3001/api/v1/wallets',
      walletPayload,
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.API_KEY || process.env.BLOCKCHAIN_API_KEY || '',
          'x-request-source': 'BLOCKCHAIN_KYC_MODULE',
          'x-source-system': 'BLOCKCHAIN_KYC_MODULE'
        }
      }
    );

    const walletData = walletResponse.data?.data || walletResponse.data;

    await db.query(
      `
      UPDATE blockchain.blockchain_kyc_wallet_requests
      SET
        wallet_address = $1,
        ledger_reference = $2,
        blockchain_tx_id = $3,
        request_status = 'WALLET_CREATED',
        updated_at = NOW()
      WHERE request_id = $4
      `,
      [
        walletData.walletAddress || walletData.wallet_address || null,
        walletData.ledgerReference || walletData.ledger_reference || null,
        walletData.transactionId || walletData.txId || null,
        kycRequest.request_id
      ]
    );

    return {
      ...kycRequest,
      walletCreationStatus: 'SUCCESS',
      wallet: walletData
    };
  } catch (walletError) {
    await db.query(
      `
      UPDATE blockchain.blockchain_kyc_wallet_requests
      SET
        request_status = 'WALLET_CREATION_FAILED',
        error_message = $1,
        updated_at = NOW()
      WHERE request_id = $2
      `,
      [
        walletError.response?.data?.message || walletError.message,
        kycRequest.request_id
      ]
    );

    return {
      ...kycRequest,
      walletCreationStatus: 'FAILED',
      walletError: walletError.response?.data || walletError.message
    };
  }
}

module.exports = {
  createBlockchainKycWallet
};