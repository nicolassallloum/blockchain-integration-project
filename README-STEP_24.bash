🔹 STEP 24 — Organization Transaction API Implementation
Wallet-to-Organization Transfer API
This step implements:
POST /api/v1/transactions/organization-transfer
This API transfers money from a customer wallet to an organization wallet/account, for example:
Customer Wallet → Bank / Merchant / Government / Organization
It includes:


Route


Controller


Service


Organization validation


Wallet validation


Amount validation


Business rules


Fabric ledger update


PostgreSQL sync


Audit trail


Error handling


Example request/response


curl test command



1. Endpoint Design
API Endpoint
POST /api/v1/transactions/organization-transfer
Purpose
Used when a customer wallet sends funds to an organization.
Examples:
Wallet → BANK001Wallet → MERCHANT001Wallet → GOV001Wallet → TAX001Wallet → UTILITY001

2. Expected Request Body
{  "senderWalletAddress": "WALLET_PENDING_REQ_AEE7B53C59079B041CD63472",  "organizationCode": "BANK001",  "amount": "75",  "currency": "USD",  "transactionPurpose": "Organization payment test",  "transactionDescription": "STEP 24 wallet-to-organization transfer from curl",  "requestSource": "CURL",  "sourceSystem": "BLOCKCHAIN_API",  "createdBy": "nix"}

3. Expected Success Response
{  "success": true,  "message": "Wallet-to-organization transfer completed successfully",  "data": {    "transactionId": "3d1a0b85-f0e8-4b56-b50f-39d64e1c4e52",    "requestId": "REQ_ORG_TRANSFER_001",    "senderWalletAddress": "WALLET_PENDING_REQ_AEE7B53C59079B041CD63472",    "organizationCode": "BANK001",    "amount": "75",    "currency": "USD",    "fabricResult": {      "success": true,      "message": "Transfer to organization completed successfully"    }  }}

4. Update Routes File
File
nano src/routes/transactions.routes.js
Use this updated version.
const express = require("express");const router = express.Router();const transactionController = require("../controllers/transaction.controller");/** * @route   POST /api/v1/transactions/wallet-transfer * @desc    Wallet-to-wallet transfer * @access  Public / Protected depending on auth middleware */router.post(  "/wallet-transfer",  transactionController.walletToWalletTransfer);/** * @route   POST /api/v1/transactions/organization-transfer * @desc    Wallet-to-organization transfer * @access  Public / Protected depending on auth middleware */router.post(  "/organization-transfer",  transactionController.walletToOrganizationTransfer);module.exports = router;

5. Update Controller File
File
nano src/controllers/transaction.controller.js
Use this updated version.
const transactionService = require("../services/transaction.service");const logger = require("../utils/logger");/** * Wallet-to-wallet transfer controller */exports.walletToWalletTransfer = async (req, res) => {  const requestId =    req.headers["x-request-id"] ||    req.body.requestId ||    `REQ_${Date.now()}`;  try {    const result = await transactionService.walletToWalletTransfer({      ...req.body,      requestId,    });    return res.status(200).json({      success: true,      message: "Wallet-to-wallet transfer completed successfully",      data: result,      requestId,    });  } catch (error) {    logger.error("Wallet-to-wallet transfer failed", {      requestId,      error: error.message,      stack: error.stack,    });    return res.status(error.statusCode || 500).json({      success: false,      message: error.message || "Wallet-to-wallet transfer failed",      errorCode: error.errorCode || "WALLET_TRANSFER_FAILED",      data: null,      requestId,    });  }};/** * Wallet-to-organization transfer controller */exports.walletToOrganizationTransfer = async (req, res) => {  const requestId =    req.headers["x-request-id"] ||    req.body.requestId ||    `REQ_${Date.now()}`;  try {    const result = await transactionService.walletToOrganizationTransfer({      ...req.body,      requestId,    });    return res.status(200).json({      success: true,      message: "Wallet-to-organization transfer completed successfully",      data: result,      requestId,    });  } catch (error) {    logger.error("Wallet-to-organization transfer failed", {      requestId,      error: error.message,      stack: error.stack,    });    return res.status(error.statusCode || 500).json({      success: false,      message: error.message || "Wallet-to-organization transfer failed",      errorCode: error.errorCode || "ORGANIZATION_TRANSFER_FAILED",      data: null,      requestId,    });  }};

6. Update Transaction Service
File
nano src/services/transaction.service.js
Use this full updated version.
const { v4: uuidv4 } = require("uuid");const db = require("../config/database");const fabricService = require("./fabric.service");const logger = require("../utils/logger");/** * Helper: Build application error */function buildError(message, statusCode = 400, errorCode = "VALIDATION_ERROR") {  const error = new Error(message);  error.statusCode = statusCode;  error.errorCode = errorCode;  return error;}/** * Helper: Validate positive decimal amount */function validateAmount(amount) {  if (amount === undefined || amount === null || amount === "") {    throw buildError("Amount is required", 400, "AMOUNT_REQUIRED");  }  const numericAmount = Number(amount);  if (Number.isNaN(numericAmount)) {    throw buildError("Amount must be numeric", 400, "INVALID_AMOUNT");  }  if (numericAmount <= 0) {    throw buildError("Amount must be greater than zero", 400, "INVALID_AMOUNT");  }  if (numericAmount > 100000) {    throw buildError(      "Amount exceeds maximum allowed transaction limit",      400,      "AMOUNT_LIMIT_EXCEEDED"    );  }  return numericAmount;}/** * Helper: Validate required string */function validateRequiredString(value, fieldName, errorCode) {  if (!value || typeof value !== "string" || value.trim() === "") {    throw buildError(`${fieldName} is required`, 400, errorCode);  }  return value.trim();}/** * Helper: Insert audit log */async function insertAuditLog(client, payload) {  await client.query(    `    INSERT INTO blockchain.audit_logs (      audit_id,      request_id,      event_type,      event_category,      entity_type,      entity_id,      event_status,      event_description,      request_payload,      response_payload,      source_system,      request_source,      created_by,      created_at    )    VALUES (      gen_random_uuid(),      $1, $2, $3, $4, $5, $6, $7,      $8::jsonb,      $9::jsonb,      $10, $11, $12, NOW()    )    `,    [      payload.requestId,      payload.eventType,      payload.eventCategory,      payload.entityType,      payload.entityId,      payload.eventStatus,      payload.eventDescription,      JSON.stringify(payload.requestPayload || {}),      JSON.stringify(payload.responsePayload || {}),      payload.sourceSystem || "BLOCKCHAIN_API",      payload.requestSource || "API",      payload.createdBy || "system",    ]  );}/** * Wallet-to-wallet transfer * Already implemented in Step 23. */exports.walletToWalletTransfer = async (payload) => {  const client = await db.connect();  const requestId = payload.requestId || `REQ_${Date.now()}`;  const transactionId = uuidv4();  try {    await client.query("BEGIN");    const senderWalletAddress = validateRequiredString(      payload.senderWalletAddress,      "Sender wallet address",      "SENDER_WALLET_REQUIRED"    );    const receiverWalletAddress = validateRequiredString(      payload.receiverWalletAddress,      "Receiver wallet address",      "RECEIVER_WALLET_REQUIRED"    );    const amount = validateAmount(payload.amount);    const currency = payload.currency || "USD";    if (senderWalletAddress === receiverWalletAddress) {      throw buildError(        "Sender and receiver wallet cannot be the same",        400,        "SAME_WALLET_TRANSFER_NOT_ALLOWED"      );    }    const senderWalletResult = await client.query(      `      SELECT wallet_id, wallet_address, customer_id, wallet_status, current_balance      FROM blockchain.wallets      WHERE wallet_address = $1      LIMIT 1      `,      [senderWalletAddress]    );    if (senderWalletResult.rowCount === 0) {      throw buildError("Sender wallet not found", 404, "SENDER_WALLET_NOT_FOUND");    }    const receiverWalletResult = await client.query(      `      SELECT wallet_id, wallet_address, customer_id, wallet_status, current_balance      FROM blockchain.wallets      WHERE wallet_address = $1      LIMIT 1      `,      [receiverWalletAddress]    );    if (receiverWalletResult.rowCount === 0) {      throw buildError(        "Receiver wallet not found",        404,        "RECEIVER_WALLET_NOT_FOUND"      );    }    const senderWallet = senderWalletResult.rows[0];    const receiverWallet = receiverWalletResult.rows[0];    if (senderWallet.wallet_status !== "ACTIVE") {      throw buildError(        "Sender wallet is not active",        400,        "SENDER_WALLET_NOT_ACTIVE"      );    }    if (receiverWallet.wallet_status !== "ACTIVE") {      throw buildError(        "Receiver wallet is not active",        400,        "RECEIVER_WALLET_NOT_ACTIVE"      );    }    if (Number(senderWallet.current_balance) < amount) {      throw buildError(        "Insufficient sender wallet balance",        400,        "INSUFFICIENT_BALANCE"      );    }    const fabricResult = await fabricService.submitTransaction(      "TransferBetweenWallets",      [        transactionId,        senderWalletAddress,        receiverWalletAddress,        amount.toString(),        currency,        payload.transactionPurpose || "Wallet-to-wallet transfer",        payload.transactionDescription || "",        requestId,      ]    );    await client.query(      `      INSERT INTO blockchain.transactions (        transaction_id,        request_id,        transaction_type,        transaction_status,        sender_wallet_address,        receiver_wallet_address,        amount,        currency,        transaction_purpose,        transaction_description,        fabric_transaction_id,        source_system,        request_source,        created_by,        created_at,        updated_at      )      VALUES (        $1, $2, 'WALLET_TO_WALLET', 'COMPLETED',        $3, $4, $5, $6, $7, $8,        $9, $10, $11, $12, NOW(), NOW()      )      `,      [        transactionId,        requestId,        senderWalletAddress,        receiverWalletAddress,        amount,        currency,        payload.transactionPurpose || "Wallet-to-wallet transfer",        payload.transactionDescription || "",        fabricResult.transactionId || null,        payload.sourceSystem || "BLOCKCHAIN_API",        payload.requestSource || "API",        payload.createdBy || "system",      ]    );    await client.query(      `      UPDATE blockchain.wallets      SET current_balance = current_balance - $1,          updated_at = NOW(),          updated_by = $2      WHERE wallet_address = $3      `,      [amount, payload.createdBy || "system", senderWalletAddress]    );    await client.query(      `      UPDATE blockchain.wallets      SET current_balance = current_balance + $1,          updated_at = NOW(),          updated_by = $2      WHERE wallet_address = $3      `,      [amount, payload.createdBy || "system", receiverWalletAddress]    );    await insertAuditLog(client, {      requestId,      eventType: "WALLET_TO_WALLET_TRANSFER",      eventCategory: "TRANSACTION",      entityType: "TRANSACTION",      entityId: transactionId,      eventStatus: "SUCCESS",      eventDescription: "Wallet-to-wallet transfer completed successfully",      requestPayload: payload,      responsePayload: fabricResult,      sourceSystem: payload.sourceSystem,      requestSource: payload.requestSource,      createdBy: payload.createdBy,    });    await client.query("COMMIT");    return {      transactionId,      requestId,      senderWalletAddress,      receiverWalletAddress,      amount: amount.toString(),      currency,      fabricResult,    };  } catch (error) {    await client.query("ROLLBACK");    logger.error("Wallet-to-wallet transfer service failed", {      requestId,      transactionId,      error: error.message,    });    throw error;  } finally {    client.release();  }};/** * Wallet-to-organization transfer */exports.walletToOrganizationTransfer = async (payload) => {  const client = await db.connect();  const requestId = payload.requestId || `REQ_${Date.now()}`;  const transactionId = uuidv4();  try {    await client.query("BEGIN");    /**     * 1. Validate request fields     */    const senderWalletAddress = validateRequiredString(      payload.senderWalletAddress,      "Sender wallet address",      "SENDER_WALLET_REQUIRED"    );    const organizationCode = validateRequiredString(      payload.organizationCode,      "Organization code",      "ORGANIZATION_CODE_REQUIRED"    );    const amount = validateAmount(payload.amount);    const currency = payload.currency || "USD";    const transactionPurpose =      payload.transactionPurpose || "Wallet-to-organization transfer";    const transactionDescription =      payload.transactionDescription || "Wallet-to-organization transaction";    /**     * 2. Validate sender wallet     */    const senderWalletResult = await client.query(      `      SELECT         wallet_id,        wallet_address,        customer_id,        organization_id,        wallet_status,        current_balance      FROM blockchain.wallets      WHERE wallet_address = $1      LIMIT 1      `,      [senderWalletAddress]    );    if (senderWalletResult.rowCount === 0) {      throw buildError("Sender wallet not found", 404, "SENDER_WALLET_NOT_FOUND");    }    const senderWallet = senderWalletResult.rows[0];    if (senderWallet.wallet_status !== "ACTIVE") {      throw buildError(        "Sender wallet is not active",        400,        "SENDER_WALLET_NOT_ACTIVE"      );    }    if (Number(senderWallet.current_balance) < amount) {      throw buildError(        "Insufficient wallet balance",        400,        "INSUFFICIENT_BALANCE"      );    }    /**     * 3. Validate organization     */    const organizationResult = await client.query(      `      SELECT         organization_id,        organization_code,        organization_name,        organization_type,        organization_status      FROM blockchain.organizations      WHERE organization_code = $1      LIMIT 1      `,      [organizationCode]    );    if (organizationResult.rowCount === 0) {      throw buildError(        "Organization not found",        404,        "ORGANIZATION_NOT_FOUND"      );    }    const organization = organizationResult.rows[0];    if (organization.organization_status !== "ACTIVE") {      throw buildError(        "Organization is not active",        400,        "ORGANIZATION_NOT_ACTIVE"      );    }    /**     * 4. Business rules     */    if (amount < 1) {      throw buildError(        "Minimum organization transfer amount is 1",        400,        "MIN_AMOUNT_NOT_ALLOWED"      );    }    if (amount > 50000) {      throw buildError(        "Organization transfer amount exceeds business limit",        400,        "ORGANIZATION_TRANSFER_LIMIT_EXCEEDED"      );    }    const allowedCurrencies = ["USD", "LBP", "EUR"];    if (!allowedCurrencies.includes(currency)) {      throw buildError(        "Currency is not supported for organization transfers",        400,        "UNSUPPORTED_CURRENCY"      );    }    /**     * 5. Create integration request record     */    await client.query(      `      INSERT INTO blockchain.integration_requests (        request_id,        request_type,        request_status,        source_system,        request_source,        request_payload,        created_by,        created_at,        updated_at      )      VALUES (        $1,        'ORGANIZATION_TRANSFER',        'PROCESSING',        $2,        $3,        $4::jsonb,        $5,        NOW(),        NOW()      )      ON CONFLICT (request_id)      DO UPDATE SET        request_status = 'PROCESSING',        request_payload = EXCLUDED.request_payload,        updated_at = NOW()      `,      [        requestId,        payload.sourceSystem || "BLOCKCHAIN_API",        payload.requestSource || "API",        JSON.stringify(payload),        payload.createdBy || "system",      ]    );    /**     * 6. Submit transaction to Hyperledger Fabric     *     * Chaincode function expected:     * TransferToOrganization(     *   transactionId,     *   senderWalletAddress,     *   organizationCode,     *   amount,     *   currency,     *   transactionPurpose,     *   transactionDescription,     *   requestId     * )     */    const fabricResult = await fabricService.submitTransaction(      "TransferToOrganization",      [        transactionId,        senderWalletAddress,        organizationCode,        amount.toString(),        currency,        transactionPurpose,        transactionDescription,        requestId,      ]    );    /**     * 7. Insert transaction into PostgreSQL     */    await client.query(      `      INSERT INTO blockchain.transactions (        transaction_id,        request_id,        transaction_type,        transaction_status,        sender_wallet_address,        receiver_wallet_address,        organization_id,        organization_code,        amount,        currency,        transaction_purpose,        transaction_description,        fabric_transaction_id,        fabric_response,        source_system,        request_source,        created_by,        created_at,        updated_at      )      VALUES (        $1,        $2,        'WALLET_TO_ORGANIZATION',        'COMPLETED',        $3,        NULL,        $4,        $5,        $6,        $7,        $8,        $9,        $10,        $11::jsonb,        $12,        $13,        $14,        NOW(),        NOW()      )      `,      [        transactionId,        requestId,        senderWalletAddress,        organization.organization_id,        organizationCode,        amount,        currency,        transactionPurpose,        transactionDescription,        fabricResult.transactionId || fabricResult.txId || null,        JSON.stringify(fabricResult || {}),        payload.sourceSystem || "BLOCKCHAIN_API",        payload.requestSource || "API",        payload.createdBy || "system",      ]    );    /**     * 8. Update wallet balance in PostgreSQL     */    await client.query(      `      UPDATE blockchain.wallets      SET         current_balance = current_balance - $1,        updated_by = $2,        updated_at = NOW()      WHERE wallet_address = $3      `,      [amount, payload.createdBy || "system", senderWalletAddress]    );    /**     * 9. Update integration request as completed     */    await client.query(      `      UPDATE blockchain.integration_requests      SET        request_status = 'COMPLETED',        response_payload = $1::jsonb,        updated_by = $2,        updated_at = NOW()      WHERE request_id = $3      `,      [        JSON.stringify({          transactionId,          fabricResult,        }),        payload.createdBy || "system",        requestId,      ]    );    /**     * 10. Audit trail     */    await insertAuditLog(client, {      requestId,      eventType: "WALLET_TO_ORGANIZATION_TRANSFER",      eventCategory: "TRANSACTION",      entityType: "TRANSACTION",      entityId: transactionId,      eventStatus: "SUCCESS",      eventDescription:        "Wallet-to-organization transfer completed successfully",      requestPayload: payload,      responsePayload: {        transactionId,        organizationCode,        amount,        currency,        fabricResult,      },      sourceSystem: payload.sourceSystem,      requestSource: payload.requestSource,      createdBy: payload.createdBy,    });    await client.query("COMMIT");    return {      transactionId,      requestId,      senderWalletAddress,      organizationId: organization.organization_id,      organizationCode: organization.organization_code,      organizationName: organization.organization_name,      amount: amount.toString(),      currency,      transactionPurpose,      fabricResult,    };  } catch (error) {    await client.query("ROLLBACK");    logger.error("Wallet-to-organization transfer service failed", {      requestId,      transactionId,      error: error.message,      stack: error.stack,    });    /**     * Best-effort failure audit outside rollback     */    try {      const failureClient = await db.connect();      try {        await failureClient.query("BEGIN");        await failureClient.query(          `          INSERT INTO blockchain.integration_requests (            request_id,            request_type,            request_status,            source_system,            request_source,            request_payload,            response_payload,            created_by,            created_at,            updated_at          )          VALUES (            $1,            'ORGANIZATION_TRANSFER',            'FAILED',            $2,            $3,            $4::jsonb,            $5::jsonb,            $6,            NOW(),            NOW()          )          ON CONFLICT (request_id)          DO UPDATE SET            request_status = 'FAILED',            response_payload = EXCLUDED.response_payload,            updated_at = NOW()          `,          [            requestId,            payload.sourceSystem || "BLOCKCHAIN_API",            payload.requestSource || "API",            JSON.stringify(payload || {}),            JSON.stringify({              error: error.message,              errorCode: error.errorCode || "ORGANIZATION_TRANSFER_FAILED",            }),            payload.createdBy || "system",          ]        );        await insertAuditLog(failureClient, {          requestId,          eventType: "WALLET_TO_ORGANIZATION_TRANSFER",          eventCategory: "TRANSACTION",          entityType: "TRANSACTION",          entityId: transactionId,          eventStatus: "FAILED",          eventDescription: error.message,          requestPayload: payload,          responsePayload: {            error: error.message,            errorCode: error.errorCode || "ORGANIZATION_TRANSFER_FAILED",          },          sourceSystem: payload.sourceSystem,          requestSource: payload.requestSource,          createdBy: payload.createdBy,        });        await failureClient.query("COMMIT");      } catch (auditError) {        await failureClient.query("ROLLBACK");        logger.error("Failed to write failure audit log", {          requestId,          error: auditError.message,        });      } finally {        failureClient.release();      }    } catch (auditConnectionError) {      logger.error("Could not connect for failure audit", {        requestId,        error: auditConnectionError.message,      });    }    throw error;  } finally {    client.release();  }};

7. Important Database Column Check
Before testing, make sure your blockchain.transactions table has these columns.
Run:
psql -h 172.31.13.133 -p 5444 -U postgres -d vfds_dev
Then:
\d blockchain.transactions
If some columns are missing, run this patch.
ALTER TABLE blockchain.transactionsADD COLUMN IF NOT EXISTS organization_id UUID,ADD COLUMN IF NOT EXISTS organization_code VARCHAR(100),ADD COLUMN IF NOT EXISTS fabric_response JSONB;
If your integration_requests table does not have response_payload, run:
ALTER TABLE blockchain.integration_requestsADD COLUMN IF NOT EXISTS response_payload JSONB,ADD COLUMN IF NOT EXISTS updated_by VARCHAR(100);

8. Make Sure BANK001 Organization Exists
Run this check:
SELECT     organization_id,    organization_code,    organization_name,    organization_type,    organization_statusFROM blockchain.organizationsWHERE organization_code = 'BANK001';
If it does not exist, insert it:
INSERT INTO blockchain.organizations (    organization_id,    organization_code,    organization_name,    organization_type,    organization_status,    created_by,    created_at,    updated_at)VALUES (    gen_random_uuid(),    'BANK001',    'Bank Organization 001',    'BANK',    'ACTIVE',    'nix',    NOW(),    NOW())ON CONFLICT (organization_code) DO NOTHING;

9. Make Sure Wallet Has Balance
Check wallet:
SELECT     wallet_id,    wallet_address,    customer_id,    wallet_status,    current_balanceFROM blockchain.walletsWHERE wallet_address = 'WALLET_PENDING_REQ_AEE7B53C59079B041CD63472';
Expected:
wallet_status = ACTIVEcurrent_balance >= transfer amount

10. Verify Main Server Route Registration
Make sure your src/server.js or src/app.js has this:
const transactionRoutes = require("./routes/transactions.routes");app.use("/api/v1/transactions", transactionRoutes);
Example:
app.use("/api/v1/wallets", walletRoutes);app.use("/api/v1/fabric", fabricRoutes);app.use("/api/v1/transactions", transactionRoutes);

11. Syntax Check
Run:
cd /home/nix/u01/blockchain-integration/blockchain-apinode -c src/routes/transactions.routes.jsnode -c src/controllers/transaction.controller.jsnode -c src/services/transaction.service.js
Expected: no output.

12. Restart API
If API is already running on port 3001, stop the old process first.
lsof -i :3001
Then kill the process:
kill -9 <PID>
Start again:
cd /home/nix/u01/blockchain-integration/blockchain-apinpm start

13. curl Test Command
Use this:
curl -X POST http://127.0.0.1:3001/api/v1/transactions/organization-transfer \-H "Content-Type: application/json" \-H "x-request-id: REQ_ORG_TRANSFER_TEST_001" \-d '{  "senderWalletAddress": "WALLET_PENDING_REQ_AEE7B53C59079B041CD63472",  "organizationCode": "BANK001",  "amount": "75",  "currency": "USD",  "transactionPurpose": "Organization payment test",  "transactionDescription": "STEP 24 wallet-to-organization transfer from curl",  "requestSource": "CURL",  "sourceSystem": "BLOCKCHAIN_API",  "createdBy": "nix"}'

14. Expected Success Response
{  "success": true,  "message": "Wallet-to-organization transfer completed successfully",  "data": {    "transactionId": "3d1a0b85-f0e8-4b56-b50f-39d64e1c4e52",    "requestId": "REQ_ORG_TRANSFER_TEST_001",    "senderWalletAddress": "WALLET_PENDING_REQ_AEE7B53C59079B041CD63472",    "organizationId": "26af0fd4-80c4-4da6-9240-b66ff88a7023",    "organizationCode": "BANK001",    "organizationName": "Bank Organization 001",    "amount": "75",    "currency": "USD",    "transactionPurpose": "Organization payment test",    "fabricResult": {      "success": true,      "message": "Transfer to organization completed successfully"    }  },  "requestId": "REQ_ORG_TRANSFER_TEST_001"}

15. Validation Test — Missing Organization
curl -X POST http://127.0.0.1:3001/api/v1/transactions/organization-transfer \-H "Content-Type: application/json" \-H "x-request-id: REQ_ORG_TRANSFER_TEST_002" \-d '{  "senderWalletAddress": "WALLET_PENDING_REQ_AEE7B53C59079B041CD63472",  "organizationCode": "UNKNOWN_ORG",  "amount": "75",  "currency": "USD",  "transactionPurpose": "Invalid organization test",  "requestSource": "CURL",  "sourceSystem": "BLOCKCHAIN_API",  "createdBy": "nix"}'
Expected response:
{  "success": false,  "message": "Organization not found",  "errorCode": "ORGANIZATION_NOT_FOUND",  "data": null,  "requestId": "REQ_ORG_TRANSFER_TEST_002"}

16. Validation Test — Insufficient Balance
curl -X POST http://127.0.0.1:3001/api/v1/transactions/organization-transfer \-H "Content-Type: application/json" \-H "x-request-id: REQ_ORG_TRANSFER_TEST_003" \-d '{  "senderWalletAddress": "WALLET_PENDING_REQ_AEE7B53C59079B041CD63472",  "organizationCode": "BANK001",  "amount": "999999",  "currency": "USD",  "transactionPurpose": "Insufficient balance test",  "requestSource": "CURL",  "sourceSystem": "BLOCKCHAIN_API",  "createdBy": "nix"}'
Expected response:
{  "success": false,  "message": "Amount exceeds maximum allowed transaction limit",  "errorCode": "AMOUNT_LIMIT_EXCEEDED",  "data": null,  "requestId": "REQ_ORG_TRANSFER_TEST_003"}

17. Validate PostgreSQL Sync
After successful test, run:
SELECT     transaction_id,    request_id,    transaction_type,    transaction_status,    sender_wallet_address,    organization_code,    amount,    currency,    created_atFROM blockchain.transactionsWHERE request_id = 'REQ_ORG_TRANSFER_TEST_001';
Expected:
transaction_type   = WALLET_TO_ORGANIZATIONtransaction_status = COMPLETEDorganization_code  = BANK001amount             = 75currency           = USD

18. Validate Wallet Balance Deduction
SELECT     wallet_address,    current_balance,    updated_atFROM blockchain.walletsWHERE wallet_address = 'WALLET_PENDING_REQ_AEE7B53C59079B041CD63472';
The balance should be reduced by:
75

19. Validate Integration Request
SELECT     request_id,    request_type,    request_status,    source_system,    request_source,    created_at,    updated_atFROM blockchain.integration_requestsWHERE request_id = 'REQ_ORG_TRANSFER_TEST_001';
Expected:
request_type   = ORGANIZATION_TRANSFERrequest_status = COMPLETED

20. Validate Audit Trail
SELECT     request_id,    event_type,    event_category,    entity_type,    event_status,    event_description,    created_atFROM blockchain.audit_logsWHERE request_id = 'REQ_ORG_TRANSFER_TEST_001';
Expected:
event_type     = WALLET_TO_ORGANIZATION_TRANSFERevent_category = TRANSACTIONevent_status   = SUCCESS

21. Important Chaincode Requirement
Your Fabric chaincode must contain this function:
TransferToOrganization
Expected arguments:
[  transactionId,  senderWalletAddress,  organizationCode,  amount,  currency,  transactionPurpose,  transactionDescription,  requestId]
If your current chaincode does not include TransferToOrganization, the API will reach Fabric but fail with an error similar to:
Function TransferToOrganization does not exist
or:
No valid responses from any peers
In that case, Step 25 should be:
STEP 25 — Chaincode Organization Transfer Function Update

22. Step 24 Completion Checklist
[ ] Route added: POST /api/v1/transactions/organization-transfer[ ] Controller method added: walletToOrganizationTransfer[ ] Service method added: walletToOrganizationTransfer[ ] Sender wallet validation added[ ] Organization validation added[ ] Amount validation added[ ] Currency validation added[ ] Business rules added[ ] Fabric submitTransaction added[ ] PostgreSQL transaction insert added[ ] Wallet balance update added[ ] Integration request sync added[ ] Audit trail added[ ] Error handling added[ ] curl test completed[ ] PostgreSQL validation completed

23. Recommended Next Step
After Step 24, continue with:
🔹 STEP 25 — Chaincode Organization Transfer Function Update
Because the API now calls:
TransferToOrganization
So we need to make sure the Fabric chaincode fully supports the wallet-to-organization transfer business logic.