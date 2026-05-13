'use strict';

const CREATED_BY = -1995;
const OBJECT_ID = null;
const TRANSACTION_TYPE_ID = 77777;

function toNumberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;

  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) return null;

  return numberValue;
}

function safeJson(value) {
  if (value === undefined || value === null) {
    return {};
  }

  try {
    return JSON.parse(JSON.stringify(value));
  } catch (error) {
    return {
      warning: 'JSON serialization failed',
      message: error.message
    };
  }
}

function normalizeStatusForEnterprise(status) {
  const normalized = String(status || 'ACTIVE').trim().toUpperCase();

  if (normalized === 'ACTIVE') return 'Activated';
  if (normalized === 'PENDING') return 'Pending';
  if (normalized === 'FAILED') return 'FAILED';
  if (normalized === 'COMPLETED') return 'Approved';
  if (normalized === 'CONFIRMED') return 'Approved';
  if (normalized === 'SUSPENDED') return 'Suspended';
  if (normalized === 'DEACTIVATED') return 'Deactivated';

  return status;
}

async function getNextCustomerId(client) {
  const result = await client.query(`
    SELECT nextval('sdedba.s_customer')::numeric AS customer_id
  `);

  return result.rows[0].customer_id;
}

async function getNextFinTransactionId(client) {
  const result = await client.query(`
    SELECT nextval('findba.s_fin_transaction')::numeric AS transaction_id
  `);

  return result.rows[0].transaction_id;
}

async function getCurrencyId(client, currencyCode = 'USD') {
  let normalizedCurrency = String(currencyCode || 'USD').trim().toUpperCase();

  /**
   * Fabric chaincode may return TOKEN as the ledger currency.
   * Enterprise SDEDBA.REF_COM_CURRENCY contains ISO currencies like USD, LBP, EUR.
   * For enterprise persistence, map TOKEN to USD unless a real ISO currency is provided.
   */
  if (
    normalizedCurrency === 'TOKEN' ||
    normalizedCurrency === 'TOKENS' ||
    normalizedCurrency === 'COIN' ||
    normalizedCurrency === 'POINT'
  ) {
    normalizedCurrency = 'USD';
  }

  const result = await client.query(
    `
    SELECT cur_id
    FROM sdedba.ref_com_currency
    WHERE UPPER(iso_cur_code) = UPPER($1)
    LIMIT 1
    `,
    [normalizedCurrency]
  );

  if (!result.rows[0]) {
    throw new Error(
      `Currency not found in sdedba.ref_com_currency: ${currencyCode}. Normalized currency: ${normalizedCurrency}`
    );
  }

  return result.rows[0].cur_id;
}

async function getStatusId(client, status = 'ACTIVE') {
  const enterpriseStatus = normalizeStatusForEnterprise(status);

  const result = await client.query(
    `
    SELECT status_id
    FROM sdedba.sts_status
    WHERE UPPER(status_name) = UPPER($1)
       OR UPPER(status_name) = UPPER($2)
    ORDER BY
      CASE
        WHEN UPPER(status_name) = UPPER($1) THEN 1
        ELSE 2
      END
    LIMIT 1
    `,
    [enterpriseStatus, status]
  );

  if (!result.rows[0]) {
    return null;
  }

  return result.rows[0].status_id;
}

async function getWalletByAddress(client, walletAddress) {
  const result = await client.query(
    `
    SELECT
      wallet_id,
      wallet_address,
      customer_id,
      organization_id,
      organization_code,
      wallet_type,
      full_name,
      current_balance,
      currency_code,
      status
    FROM blockchain.wallets
    WHERE wallet_address = $1
    LIMIT 1
    `,
    [walletAddress]
  );

  return result.rows[0] || null;
}

async function getWalletByCustomerId(client, customerId) {
  const result = await client.query(
    `
    SELECT
      wallet_id,
      wallet_address,
      customer_id,
      organization_id,
      organization_code,
      wallet_type,
      full_name,
      current_balance,
      currency_code,
      status
    FROM blockchain.wallets
    WHERE customer_id = $1
    LIMIT 1
    `,
    [String(customerId)]
  );

  return result.rows[0] || null;
}

async function insertBlockchainWallet(client, walletData) {
  const result = await client.query(
    `
    INSERT INTO blockchain.wallets (
      wallet_address,
      customer_id,
      organization_id,
      organization_code,
      wallet_type,
      full_name,
      national_id_hash,
      mobile_hash,
      email_hash,
      password_hash,
      ledger_doc_type,
      ledger_key,
      fabric_tx_id,
      fabric_channel_name,
      chaincode_name,
      current_balance,
      currency_code,
      status,
      kyc_status,
      risk_level,
      wallet_metadata,
      kyc_payload,
      blockchain_payload,
      fabric_response,
      fabric_transaction_id,
      request_id,
      request_source,
      source_system,
      created_by,
      updated_by,
      created_at,
      updated_at
    )
    VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, $8, $9, $10,
      $11, $12, $13, $14, $15,
      $16, $17, $18, $19, $20,
      $21, $22, $23, $24, $25,
      $26, $27, $28, $29, $30,
      NOW(), NOW()
    )
    RETURNING *
    `,
    [
      walletData.walletAddress,
      String(walletData.customerId),
      walletData.organizationId || null,
      walletData.organizationCode || null,
      walletData.walletType || 'CUSTOMER',
      walletData.fullName,
      walletData.nationalIdHash || null,
      walletData.mobileHash || null,
      walletData.emailHash || null,
      walletData.passwordHash || null,
      walletData.ledgerDocType || 'wallet',
      walletData.walletAddress,
      walletData.fabricTxId || null,
      walletData.fabricChannelName || null,
      walletData.chaincodeName || null,
      walletData.currentBalance || 0,
      walletData.currencyCode || 'USD',
      walletData.status || 'ACTIVE',
      walletData.kycStatus || 'PENDING',
      walletData.riskLevel || 'LOW',
      safeJson(walletData.walletMetadata),
      safeJson(walletData.kycPayload),
      safeJson(walletData.blockchainPayload),
      safeJson(walletData.fabricResponse),
      walletData.fabricTxId || null,
      walletData.requestId || null,
      walletData.requestSource || 'API',
      walletData.sourceSystem || 'BLOCKCHAIN_API',
      walletData.createdBy || 'api-user',
      walletData.updatedBy || walletData.createdBy || 'api-user'
    ]
  );

  return result.rows[0];
}

async function insertRefCustomer(client, walletRow, walletData) {
  const curId = await getCurrencyId(client, walletData.currencyCode || walletRow.currency_code || 'USD');
  const statusId = await getStatusId(client, walletData.status || walletRow.status || 'ACTIVE');

  const numericCustomerId = toNumberOrNull(walletRow.customer_id);

  if (!numericCustomerId) {
    throw new Error(
      `sdedba.ref_customer requires numeric customer_id, but received: ${walletRow.customer_id}`
    );
  }

  const result = await client.query(
    `
    INSERT INTO sdedba.ref_customer (
      customer_id,
      customer_name,
      customer_sname,
      customer_internal_code,
      registration_cou_id,
      cur_id,
      status_code,
      creation_date,
      created_by,
      tech_account_no,
      comments
    )
    VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, CURRENT_DATE, $8, $9, $10
    )
    ON CONFLICT (customer_id)
    DO UPDATE SET
      customer_name = EXCLUDED.customer_name,
      customer_sname = EXCLUDED.customer_sname,
      customer_internal_code = EXCLUDED.customer_internal_code,
      registration_cou_id = EXCLUDED.registration_cou_id,
      cur_id = EXCLUDED.cur_id,
      status_code = EXCLUDED.status_code,
      update_date = CURRENT_DATE,
      updated_by = $8,
      tech_account_no = EXCLUDED.tech_account_no,
      comments = EXCLUDED.comments
    RETURNING *
    `,
    [
      numericCustomerId,
      walletData.fullName || walletRow.full_name,
      walletData.walletType || walletRow.wallet_type || 'CUSTOMER',
      walletRow.wallet_address,
      toNumberOrNull(walletData.nationalIdHash || walletRow.national_id_hash),
      curId,
      statusId,
      CREATED_BY,
      String(walletRow.wallet_id),
      `Blockchain wallet created. Wallet Address: ${walletRow.wallet_address}`
    ]
  );

  return result.rows[0];
}

async function insertCustomerDef(client, walletRow, walletData) {
  const numericCustomerId = toNumberOrNull(walletRow.customer_id);

  if (!numericCustomerId) {
    throw new Error(
      `sdedba.cfg_customer_def requires numeric customer_id, but received: ${walletRow.customer_id}`
    );
  }

  const objectContent = {
    source: 'BLOCKCHAIN_WALLET',
    customerId: numericCustomerId,
    walletId: walletRow.wallet_id,
    walletAddress: walletRow.wallet_address,
    organizationId: walletRow.organization_id,
    organizationCode: walletRow.organization_code,
    walletType: walletRow.wallet_type,
    fullName: walletRow.full_name,
    nationalIdHash: walletRow.national_id_hash,
    mobileHash: walletRow.mobile_hash,
    emailHash: walletRow.email_hash,
    currentBalance: walletRow.current_balance,
    currencyCode: walletRow.currency_code,
    status: walletRow.status,
    fabricTxId: walletRow.fabric_tx_id,
    fabricChannelName: walletRow.fabric_channel_name,
    chaincodeName: walletRow.chaincode_name,
    createdAt: walletRow.created_at,
    originalPayload: safeJson(walletData.originalPayload || walletData)
  };

  const result = await client.query(
    `
    INSERT INTO sdedba.cfg_customer_def (
      object_id,
      object_content,
      object_pk_value,
      creation_date,
      created_by,
      customer_id
    )
    VALUES (
      $1, $2, $3, CURRENT_DATE, $4, $5
    )
    RETURNING *
    `,
    [
      OBJECT_ID,
      objectContent,
      numericCustomerId,
      CREATED_BY,
      numericCustomerId
    ]
  );

  return result.rows[0];
}

async function saveWalletEnterprise(client, walletData) {
  const walletRow = await insertBlockchainWallet(client, walletData);
  const refCustomerRow = await insertRefCustomer(client, walletRow, walletData);
  const customerDefRow = await insertCustomerDef(client, walletRow, walletData);

  return {
    wallet: walletRow,
    enterpriseCustomer: refCustomerRow,
    customerDef: customerDefRow
  };
}

async function insertBlockchainTransaction(client, transactionData) {
  const result = await client.query(
    `
    INSERT INTO blockchain.transactions (
      business_transaction_id,
      ledger_transaction_id,
      fabric_tx_id,
      ledger_key,
      transaction_type,
      transaction_direction,
      from_wallet_id,
      to_wallet_id,
      from_wallet_address,
      to_wallet_address,
      sender_wallet_id,
      sender_wallet_address,
      sender_customer_id,
      receiver_wallet_id,
      receiver_wallet_address,
      receiver_customer_id,
      organization_id,
      organization_code,
      amount,
      currency_code,
      currency,
      transaction_fee,
      status,
      transaction_status,
      fabric_status,
      risk_level,
      aml_status,
      request_reference,
      external_reference,
      idempotency_key,
      fabric_channel_name,
      chaincode_name,
      transaction_payload,
      blockchain_response,
      fabric_response,
      metadata,
      transaction_purpose,
      transaction_description,
      request_id,
      source_system,
      request_source,
      submitted_at,
      confirmed_at,
      created_by,
      updated_by,
      created_at,
      updated_at
    )
    VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, $8, $9, $10,
      $11, $12, $13, $14, $15,
      $16, $17, $18, $19, $20,
      $21, $22, $23, $24, $25,
      $26, $27, $28, $29, $30,
      $31, $32, $33, $34, $35,
      $36, $37, $38, $39, $40,
      $41, NOW(), NOW(), $42, $43,
      NOW(), NOW()
    )
    RETURNING *
    `,
    [
      transactionData.businessTransactionId || transactionData.transactionId || null,
      transactionData.ledgerTransactionId || transactionData.fabricTxId || null,
      transactionData.fabricTxId || null,
      transactionData.ledgerKey || transactionData.fabricTxId || transactionData.transactionId || null,
      transactionData.transactionType || 'TRANSFER',

      transactionData.transactionDirection || null,
      transactionData.fromWalletId || null,
      transactionData.toWalletId || null,
      transactionData.fromWalletAddress || transactionData.senderWalletAddress || null,
      transactionData.toWalletAddress || transactionData.receiverWalletAddress || null,

      transactionData.senderWalletId || transactionData.fromWalletId || null,
      transactionData.senderWalletAddress || transactionData.fromWalletAddress || null,
      transactionData.senderCustomerId || null,
      transactionData.receiverWalletId || transactionData.toWalletId || null,
      transactionData.receiverWalletAddress || transactionData.toWalletAddress || null,

      transactionData.receiverCustomerId || null,
      transactionData.organizationId || null,
      transactionData.organizationCode || null,
      transactionData.amount,
      transactionData.currencyCode || transactionData.currency || 'USD',

      transactionData.currency || transactionData.currencyCode || 'USD',
      transactionData.transactionFee || 0,
      transactionData.status || 'CONFIRMED',
      transactionData.transactionStatus || transactionData.status || 'CONFIRMED',
      transactionData.fabricStatus || 'CONFIRMED',

      transactionData.riskLevel || 'LOW',
      transactionData.amlStatus || 'NOT_CHECKED',
      transactionData.requestReference || transactionData.requestId || null,
      transactionData.externalReference || null,
      transactionData.idempotencyKey || null,

      transactionData.fabricChannelName || null,
      transactionData.chaincodeName || null,
      safeJson(transactionData.transactionPayload || transactionData.originalPayload),
      safeJson(transactionData.blockchainResponse || transactionData.fabricResponse),
      safeJson(transactionData.fabricResponse),

      safeJson(transactionData.metadata),
      transactionData.transactionPurpose || null,
      transactionData.transactionDescription || null,
      transactionData.requestId || null,
      transactionData.sourceSystem || 'BLOCKCHAIN_API',

      transactionData.requestSource || 'API',
      transactionData.createdBy || 'api-user',
      transactionData.updatedBy || transactionData.createdBy || 'api-user'
    ]
  );

  return result.rows[0];
}

async function insertFinTransaction(client, blockchainTransactionRow, transactionData) {
  const curId = await getCurrencyId(
    client,
    transactionData.currencyCode || transactionData.currency || blockchainTransactionRow.currency_code || 'USD'
  );

  const statusId = await getStatusId(
    client,
    transactionData.status || blockchainTransactionRow.status || 'CONFIRMED'
  );

  const srcCustomerId = toNumberOrNull(
    transactionData.senderCustomerId ||
    transactionData.srcCustomerId ||
    null
  );

  const dstCustomerId = toNumberOrNull(
    transactionData.receiverCustomerId ||
    transactionData.dstCustomerId ||
    null
  );

  const result = await client.query(
    `
    INSERT INTO findba.fin_transaction (
      transaction_desc,
      transaction_internal_code,
      status_code,
      status_bdate,
      transaction_date,
      transaction_amnt,
      src_customer_id,
      dst_customer_id,
      comments,
      creation_date,
      created_by,
      cur_id,
      transaction_reference,
      transaction_type_id
    )
    VALUES (
      $1, $2, $3, CURRENT_DATE,
      CURRENT_DATE, $4, $5, $6, $7,
      NOW(), $8, $9, $10, $11
    )
    RETURNING *
    `,
    [
      transactionData.transactionDescription ||
        transactionData.transactionPurpose ||
        'Blockchain transaction',

      String(blockchainTransactionRow.transaction_id),

      statusId,

      transactionData.amount,

      srcCustomerId,

      dstCustomerId,

      `Blockchain Fabric TX: ${transactionData.fabricTxId || ''}`,

      CREATED_BY,

      curId,

      transactionData.fabricTxId ||
        String(blockchainTransactionRow.transaction_id),

      TRANSACTION_TYPE_ID
    ]
  );

  return result.rows[0];
}

async function insertObjectApiDef(client, finTransactionRow, blockchainTransactionRow, transactionData) {
  const apiContent = {
    source: 'BLOCKCHAIN_TRANSACTION',
    blockchainTransactionId: blockchainTransactionRow.transaction_id,
    finTransactionId: finTransactionRow.transaction_id,
    businessTransactionId: blockchainTransactionRow.business_transaction_id,
    fabricTxId: blockchainTransactionRow.fabric_tx_id,
    transactionType: blockchainTransactionRow.transaction_type,
    fromWalletAddress: blockchainTransactionRow.from_wallet_address,
    toWalletAddress: blockchainTransactionRow.to_wallet_address,
    senderCustomerId: transactionData.senderCustomerId || null,
    receiverCustomerId: transactionData.receiverCustomerId || null,
    amount: blockchainTransactionRow.amount,
    currencyCode: blockchainTransactionRow.currency_code,
    status: blockchainTransactionRow.status,
    fabricChannelName: blockchainTransactionRow.fabric_channel_name,
    chaincodeName: blockchainTransactionRow.chaincode_name,
    originalPayload: safeJson(transactionData.originalPayload || transactionData)
  };

  const result = await client.query(
    `
    INSERT INTO suitedba.cfg_object_api_def (
      object_id,
      primary_key_value,
      api_content,
      creation_date,
      created_by,
      status_code
    )
    VALUES (
      $1, $2, $3, CURRENT_DATE, $4, $5
    )
    RETURNING *
    `,
    [
      OBJECT_ID,
      Number(finTransactionRow.transaction_id),
      apiContent,
      CREATED_BY,
      String(blockchainTransactionRow.status || 'CONFIRMED')
    ]
  );

  return result.rows[0];
}

async function saveTransactionEnterprise(client, transactionData) {
  const blockchainTransactionRow = await insertBlockchainTransaction(client, transactionData);
  const finTransactionRow = await insertFinTransaction(client, blockchainTransactionRow, transactionData);
  const objectApiDefRow = await insertObjectApiDef(
    client,
    finTransactionRow,
    blockchainTransactionRow,
    transactionData
  );

  return {
    blockchainTransaction: blockchainTransactionRow,
    finTransaction: finTransactionRow,
    objectApiDef: objectApiDefRow
  };
}

module.exports = {
  CREATED_BY,
  OBJECT_ID,
  TRANSACTION_TYPE_ID,
  getNextCustomerId,
  getNextFinTransactionId,
  getCurrencyId,
  getStatusId,
  getWalletByAddress,
  getWalletByCustomerId,
  saveWalletEnterprise,
  saveTransactionEnterprise
};
