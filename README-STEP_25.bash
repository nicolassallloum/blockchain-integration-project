🔹 STEP 25 — Wallet Query APIs
Objective
Implement production-ready wallet query APIs in the Node.js Blockchain API Middleware to retrieve:


Wallet details by wallet address


Wallet balance


Wallet transaction history


The APIs will first query Hyperledger Fabric using evaluateTransaction.
If Fabric is unavailable or returns no result, the API will fallback to PostgreSQL off-chain tables.

1. Required Endpoints
GET /api/v1/wallets/:walletAddressGET /api/v1/wallets/:walletAddress/balanceGET /api/v1/wallets/:walletAddress/history

2. Expected Folder Structure
Inside:
/home/nix/u01/blockchain-integration/blockchain-api
You should have or create:
src/├── controllers/│   └── wallet-query.controller.js├── routes/│   └── wallet-query.routes.js├── services/│   ├── wallet-query.service.js│   ├── fabric.service.js│   └── database.service.js├── utils/│   └── response.util.js└── server.js

3. Create Wallet Query Routes
File
nano src/routes/wallet-query.routes.js
Code
const express = require("express");const router = express.Router();const walletQueryController = require("../controllers/wallet-query.controller");/** * STEP 25 — Wallet Query APIs * * GET /api/v1/wallets/:walletAddress * GET /api/v1/wallets/:walletAddress/balance * GET /api/v1/wallets/:walletAddress/history */router.get("/:walletAddress", walletQueryController.getWalletByAddress);router.get("/:walletAddress/balance", walletQueryController.getWalletBalance);router.get("/:walletAddress/history", walletQueryController.getWalletHistory);module.exports = router;

4. Create Wallet Query Controller
File
nano src/controllers/wallet-query.controller.js
Code
const walletQueryService = require("../services/wallet-query.service");class WalletQueryController {  async getWalletByAddress(req, res) {    const requestId =      req.headers["x-request-id"] ||      `REQ_${Date.now()}_${Math.random().toString(16).slice(2).toUpperCase()}`;    try {      const { walletAddress } = req.params;      if (!walletAddress || walletAddress.trim() === "") {        return res.status(400).json({          success: false,          message: "walletAddress is required",          errorCode: "VALIDATION_ERROR",          data: null,          requestId,        });      }      const result = await walletQueryService.getWalletByAddress(        walletAddress,        requestId      );      return res.status(result.httpStatus || 200).json({        success: result.success,        message: result.message,        source: result.source,        data: result.data,        requestId,      });    } catch (error) {      console.error("Get wallet by address error:", error);      return res.status(500).json({        success: false,        message: "Failed to retrieve wallet details",        errorCode: "WALLET_QUERY_FAILED",        data: null,        requestId,      });    }  }  async getWalletBalance(req, res) {    const requestId =      req.headers["x-request-id"] ||      `REQ_${Date.now()}_${Math.random().toString(16).slice(2).toUpperCase()}`;    try {      const { walletAddress } = req.params;      if (!walletAddress || walletAddress.trim() === "") {        return res.status(400).json({          success: false,          message: "walletAddress is required",          errorCode: "VALIDATION_ERROR",          data: null,          requestId,        });      }      const result = await walletQueryService.getWalletBalance(        walletAddress,        requestId      );      return res.status(result.httpStatus || 200).json({        success: result.success,        message: result.message,        source: result.source,        data: result.data,        requestId,      });    } catch (error) {      console.error("Get wallet balance error:", error);      return res.status(500).json({        success: false,        message: "Failed to retrieve wallet balance",        errorCode: "WALLET_BALANCE_QUERY_FAILED",        data: null,        requestId,      });    }  }  async getWalletHistory(req, res) {    const requestId =      req.headers["x-request-id"] ||      `REQ_${Date.now()}_${Math.random().toString(16).slice(2).toUpperCase()}`;    try {      const { walletAddress } = req.params;      const limit = Number(req.query.limit || 50);      const offset = Number(req.query.offset || 0);      if (!walletAddress || walletAddress.trim() === "") {        return res.status(400).json({          success: false,          message: "walletAddress is required",          errorCode: "VALIDATION_ERROR",          data: null,          requestId,        });      }      const result = await walletQueryService.getWalletHistory(        walletAddress,        {          limit,          offset,        },        requestId      );      return res.status(result.httpStatus || 200).json({        success: result.success,        message: result.message,        source: result.source,        data: result.data,        requestId,      });    } catch (error) {      console.error("Get wallet history error:", error);      return res.status(500).json({        success: false,        message: "Failed to retrieve wallet transaction history",        errorCode: "WALLET_HISTORY_QUERY_FAILED",        data: null,        requestId,      });    }  }}module.exports = new WalletQueryController();

5. Create Wallet Query Service
File
nano src/services/wallet-query.service.js
Code
const fabricService = require("./fabric.service");const databaseService = require("./database.service");class WalletQueryService {  async getWalletByAddress(walletAddress, requestId) {    const cleanWalletAddress = walletAddress.trim();    /**     * 1. Try Fabric first     */    try {      const fabricResult = await fabricService.evaluateTransaction(        "GetWalletByAddress",        [cleanWalletAddress]      );      const parsedWallet = this.safeParseFabricResult(fabricResult);      if (parsedWallet) {        return {          success: true,          httpStatus: 200,          message: "Wallet details retrieved successfully from blockchain",          source: "FABRIC",          data: this.normalizeWallet(parsedWallet),        };      }    } catch (error) {      console.warn(        `[${requestId}] Fabric wallet query failed. Falling back to PostgreSQL.`,        error.message      );    }    /**     * 2. PostgreSQL fallback     */    const dbWallet = await this.getWalletByAddressFromDatabase(cleanWalletAddress);    if (!dbWallet) {      return {        success: false,        httpStatus: 404,        message: `Wallet not found for walletAddress: ${cleanWalletAddress}`,        source: "POSTGRESQL",        data: null,      };    }    return {      success: true,      httpStatus: 200,      message: "Wallet details retrieved successfully from PostgreSQL fallback",      source: "POSTGRESQL",      data: this.normalizeWallet(dbWallet),    };  }  async getWalletBalance(walletAddress, requestId) {    const cleanWalletAddress = walletAddress.trim();    /**     * 1. Try Fabric first     */    try {      const fabricResult = await fabricService.evaluateTransaction(        "GetWalletBalance",        [cleanWalletAddress]      );      const parsedBalance = this.safeParseFabricResult(fabricResult);      if (parsedBalance !== null && parsedBalance !== undefined) {        return {          success: true,          httpStatus: 200,          message: "Wallet balance retrieved successfully from blockchain",          source: "FABRIC",          data: this.normalizeBalance(cleanWalletAddress, parsedBalance),        };      }    } catch (error) {      console.warn(        `[${requestId}] Fabric balance query failed. Falling back to PostgreSQL.`,        error.message      );    }    /**     * 2. PostgreSQL fallback     */    const dbBalance = await this.getWalletBalanceFromDatabase(cleanWalletAddress);    if (!dbBalance) {      return {        success: false,        httpStatus: 404,        message: `Wallet balance not found for walletAddress: ${cleanWalletAddress}`,        source: "POSTGRESQL",        data: null,      };    }    return {      success: true,      httpStatus: 200,      message: "Wallet balance retrieved successfully from PostgreSQL fallback",      source: "POSTGRESQL",      data: this.normalizeBalance(cleanWalletAddress, dbBalance),    };  }  async getWalletHistory(walletAddress, options = {}, requestId) {    const cleanWalletAddress = walletAddress.trim();    const limit = Number(options.limit || 50);    const offset = Number(options.offset || 0);    /**     * 1. Try Fabric first     */    try {      const fabricResult = await fabricService.evaluateTransaction(        "GetTransactionHistoryByWallet",        [cleanWalletAddress]      );      const parsedHistory = this.safeParseFabricResult(fabricResult);      if (Array.isArray(parsedHistory)) {        return {          success: true,          httpStatus: 200,          message: "Wallet transaction history retrieved successfully from blockchain",          source: "FABRIC",          data: {            walletAddress: cleanWalletAddress,            limit,            offset,            total: parsedHistory.length,            transactions: parsedHistory              .slice(offset, offset + limit)              .map((transaction) => this.normalizeTransaction(transaction)),          },        };      }    } catch (error) {      console.warn(        `[${requestId}] Fabric wallet history query failed. Falling back to PostgreSQL.`,        error.message      );    }    /**     * 2. PostgreSQL fallback     */    const dbHistory = await this.getWalletHistoryFromDatabase(      cleanWalletAddress,      limit,      offset    );    return {      success: true,      httpStatus: 200,      message: "Wallet transaction history retrieved successfully from PostgreSQL fallback",      source: "POSTGRESQL",      data: {        walletAddress: cleanWalletAddress,        limit,        offset,        total: dbHistory.total,        transactions: dbHistory.transactions.map((transaction) =>          this.normalizeTransaction(transaction)        ),      },    };  }  safeParseFabricResult(result) {    if (!result) return null;    if (Buffer.isBuffer(result)) {      const text = result.toString("utf8");      if (!text || text.trim() === "") {        return null;      }      try {        return JSON.parse(text);      } catch {        return text;      }    }    if (typeof result === "string") {      if (result.trim() === "") return null;      try {        return JSON.parse(result);      } catch {        return result;      }    }    return result;  }  normalizeWallet(wallet) {    return {      walletAddress:        wallet.walletAddress ||        wallet.wallet_address ||        wallet.address ||        null,      customerId:        wallet.customerId ||        wallet.customer_id ||        null,      organizationId:        wallet.organizationId ||        wallet.organization_id ||        null,      organizationCode:        wallet.organizationCode ||        wallet.organization_code ||        null,      fullName:        wallet.fullName ||        wallet.full_name ||        null,      status:        wallet.status ||        wallet.wallet_status ||        "UNKNOWN",      currency:        wallet.currency ||        "USD",      balance:        wallet.balance !== undefined          ? String(wallet.balance)          : wallet.current_balance !== undefined          ? String(wallet.current_balance)          : "0",      createdAt:        wallet.createdAt ||        wallet.created_at ||        null,      updatedAt:        wallet.updatedAt ||        wallet.updated_at ||        null,    };  }  normalizeBalance(walletAddress, balancePayload) {    if (      typeof balancePayload === "string" ||      typeof balancePayload === "number"    ) {      return {        walletAddress,        balance: String(balancePayload),        currency: "USD",      };    }    return {      walletAddress:        balancePayload.walletAddress ||        balancePayload.wallet_address ||        walletAddress,      balance:        balancePayload.balance !== undefined          ? String(balancePayload.balance)          : balancePayload.current_balance !== undefined          ? String(balancePayload.current_balance)          : "0",      currency:        balancePayload.currency ||        "USD",      status:        balancePayload.status ||        balancePayload.wallet_status ||        "ACTIVE",      lastUpdatedAt:        balancePayload.updatedAt ||        balancePayload.updated_at ||        balancePayload.lastUpdatedAt ||        null,    };  }  normalizeTransaction(transaction) {    return {      transactionId:        transaction.transactionId ||        transaction.transaction_id ||        transaction.id ||        null,      requestId:        transaction.requestId ||        transaction.request_id ||        null,      fromWalletAddress:        transaction.fromWalletAddress ||        transaction.from_wallet_address ||        transaction.senderWalletAddress ||        transaction.sender_wallet_address ||        null,      toWalletAddress:        transaction.toWalletAddress ||        transaction.to_wallet_address ||        transaction.receiverWalletAddress ||        transaction.receiver_wallet_address ||        null,      amount:        transaction.amount !== undefined          ? String(transaction.amount)          : "0",      currency:        transaction.currency ||        "USD",      transactionType:        transaction.transactionType ||        transaction.transaction_type ||        "WALLET_TRANSFER",      transactionPurpose:        transaction.transactionPurpose ||        transaction.transaction_purpose ||        null,      transactionDescription:        transaction.transactionDescription ||        transaction.transaction_description ||        null,      status:        transaction.status ||        transaction.transaction_status ||        "UNKNOWN",      riskLevel:        transaction.riskLevel ||        transaction.risk_level ||        null,      createdAt:        transaction.createdAt ||        transaction.created_at ||        null,    };  }  async getWalletByAddressFromDatabase(walletAddress) {    const pool = databaseService.getPool();    const query = `      SELECT        wallet_address,        customer_id,        organization_id,        organization_code,        full_name,        wallet_status,        current_balance,        currency,        created_at,        updated_at      FROM blockchain.wallets      WHERE wallet_address = $1      LIMIT 1;    `;    const result = await pool.query(query, [walletAddress]);    return result.rows[0] || null;  }  async getWalletBalanceFromDatabase(walletAddress) {    const pool = databaseService.getPool();    const query = `      SELECT        wallet_address,        current_balance,        currency,        wallet_status,        updated_at      FROM blockchain.wallets      WHERE wallet_address = $1      LIMIT 1;    `;    const result = await pool.query(query, [walletAddress]);    return result.rows[0] || null;  }  async getWalletHistoryFromDatabase(walletAddress, limit, offset) {    const pool = databaseService.getPool();    const countQuery = `      SELECT COUNT(*)::INT AS total      FROM blockchain.transactions      WHERE from_wallet_address = $1         OR to_wallet_address = $1;    `;    const dataQuery = `      SELECT        transaction_id,        request_id,        from_wallet_address,        to_wallet_address,        amount,        currency,        transaction_type,        transaction_purpose,        transaction_description,        transaction_status,        risk_level,        created_at      FROM blockchain.transactions      WHERE from_wallet_address = $1         OR to_wallet_address = $1      ORDER BY created_at DESC      LIMIT $2 OFFSET $3;    `;    const countResult = await pool.query(countQuery, [walletAddress]);    const dataResult = await pool.query(dataQuery, [      walletAddress,      limit,      offset,    ]);    return {      total: countResult.rows[0]?.total || 0,      transactions: dataResult.rows,    };  }}module.exports = new WalletQueryService();

6. Ensure Fabric Service Has evaluateTransaction
Open:
nano src/services/fabric.service.js
Make sure this function exists:
async evaluateTransaction(functionName, args = []) {  try {    const connection = await this.getContract();    const result = await connection.contract.evaluateTransaction(      functionName,      ...args    );    return result;  } catch (error) {    console.error("Fabric evaluate transaction failed:", {      functionName,      args,      message: error.message,    });    throw error;  }}
If your existing fabric.service.js already has this method, do not duplicate it.

7. Ensure Database Service Exists
Open:
nano src/services/database.service.js
If not already available, use this:
const { Pool } = require("pg");class DatabaseService {  constructor() {    this.pool = new Pool({      host: process.env.POSTGRES_HOST,      port: Number(process.env.POSTGRES_PORT || 5432),      database: process.env.POSTGRES_DB,      user: process.env.POSTGRES_USER,      password: process.env.POSTGRES_PASSWORD,      max: Number(process.env.POSTGRES_POOL_MAX || 10),      idleTimeoutMillis: 30000,      connectionTimeoutMillis: 5000,    });  }  getPool() {    return this.pool;  }  async testConnection() {    const client = await this.pool.connect();    try {      const result = await client.query("SELECT NOW() AS current_time");      return {        success: true,        currentTime: result.rows[0].current_time,      };    } finally {      client.release();    }  }}module.exports = new DatabaseService();

8. Register Routes in Server
Open:
nano src/server.js
Add this import near your other routes:
const walletQueryRoutes = require("./routes/wallet-query.routes");
Then register it before your 404 handler:
app.use("/api/v1/wallets", walletQueryRoutes);
Example:
app.use("/api/v1/wallets", walletQueryRoutes);

9. Environment Variables
Check your .env:
nano .env
Make sure PostgreSQL values exist:
POSTGRES_HOST=172.31.13.133POSTGRES_PORT=5444POSTGRES_DB=vfds_devPOSTGRES_USER=postgresPOSTGRES_PASSWORD=YOUR_PASSWORD_HEREPOSTGRES_POOL_MAX=10
Also confirm Fabric values:
FABRIC_CHANNEL_NAME=kycchannelnix1FABRIC_CHAINCODE_NAME=kyc-wallet-chaincode-jsFABRIC_MSP_ID=Org1MSPFABRIC_PEER_ENDPOINT=localhost:7051
Do not expose passwords in logs or screenshots.

10. PostgreSQL Indexes for Fast Query
Run this in PostgreSQL:
CREATE INDEX IF NOT EXISTS idx_wallets_wallet_addressON blockchain.wallets(wallet_address);CREATE INDEX IF NOT EXISTS idx_transactions_from_wallet_addressON blockchain.transactions(from_wallet_address);CREATE INDEX IF NOT EXISTS idx_transactions_to_wallet_addressON blockchain.transactions(to_wallet_address);CREATE INDEX IF NOT EXISTS idx_transactions_wallet_created_atON blockchain.transactions(created_at DESC);
Command:
psql -h 172.31.13.133 -p 5444 -U postgres -d vfds_dev
Then paste the SQL above.

11. Syntax Validation
Run:
cd /home/nix/u01/blockchain-integration/blockchain-apinode -c src/routes/wallet-query.routes.jsnode -c src/controllers/wallet-query.controller.jsnode -c src/services/wallet-query.service.jsnode -c src/services/database.service.jsnode -c src/server.js
Expected result:
# No output means syntax is OK

12. Restart API
If the API is already running on port 3001, first check:
lsof -i :3001
Kill old process if needed:
kill -9 <PID>
Start again:
cd /home/nix/u01/blockchain-integration/blockchain-apinpm start
Or with PM2:
pm2 restart blockchain-api

13. Test Commands
Replace the wallet address with a real one from your previous wallet creation response.
Example wallet:
WALLET_PENDING_REQ_AEE7B53C59079B041CD63472

Test 1 — Get Wallet Details
curl -X GET "http://127.0.0.1:3001/api/v1/wallets/WALLET_PENDING_REQ_AEE7B53C59079B041CD63472" \-H "Accept: application/json" \-H "x-request-id: REQ_WALLET_QUERY_TEST_001"
Expected response:
{  "success": true,  "message": "Wallet details retrieved successfully from blockchain",  "source": "FABRIC",  "data": {    "walletAddress": "WALLET_PENDING_REQ_AEE7B53C59079B041CD63472",    "customerId": "CUST2017",    "organizationId": "26af0fd4-80c4-4da6-9240-b66ff88a7023",    "organizationCode": "BANK001",    "fullName": "Nicolas Salloum",    "status": "ACTIVE",    "currency": "USD",    "balance": "1000",    "createdAt": "2026-05-04T...",    "updatedAt": "2026-05-04T..."  },  "requestId": "REQ_WALLET_QUERY_TEST_001"}

Test 2 — Get Wallet Balance
curl -X GET "http://127.0.0.1:3001/api/v1/wallets/WALLET_PENDING_REQ_AEE7B53C59079B041CD63472/balance" \-H "Accept: application/json" \-H "x-request-id: REQ_WALLET_BALANCE_TEST_001"
Expected response:
{  "success": true,  "message": "Wallet balance retrieved successfully from blockchain",  "source": "FABRIC",  "data": {    "walletAddress": "WALLET_PENDING_REQ_AEE7B53C59079B041CD63472",    "balance": "950",    "currency": "USD",    "status": "ACTIVE",    "lastUpdatedAt": "2026-05-04T..."  },  "requestId": "REQ_WALLET_BALANCE_TEST_001"}

Test 3 — Get Wallet History
curl -X GET "http://127.0.0.1:3001/api/v1/wallets/WALLET_PENDING_REQ_AEE7B53C59079B041CD63472/history?limit=10&offset=0" \-H "Accept: application/json" \-H "x-request-id: REQ_WALLET_HISTORY_TEST_001"
Expected response:
{  "success": true,  "message": "Wallet transaction history retrieved successfully from blockchain",  "source": "FABRIC",  "data": {    "walletAddress": "WALLET_PENDING_REQ_AEE7B53C59079B041CD63472",    "limit": 10,    "offset": 0,    "total": 1,    "transactions": [      {        "transactionId": "d7bbbbca-e75c-4c1a-bb4a-cbf0b6dd8292",        "requestId": "REQ_WALLET_TRANSFER_TEST_007",        "fromWalletAddress": "WALLET_PENDING_REQ_AEE7B53C59079B041CD63472",        "toWalletAddress": "WALLET_380901774428773E96E8EBCA4B4D8C9FB920FB6A",        "amount": "50",        "currency": "USD",        "transactionType": "WALLET_TRANSFER",        "transactionPurpose": "Test wallet-to-wallet transfer",        "transactionDescription": "STEP 23 API test from curl",        "status": "COMPLETED",        "riskLevel": "LOW",        "createdAt": "2026-05-04T..."      }    ]  },  "requestId": "REQ_WALLET_HISTORY_TEST_001"}

14. Postman Examples
Request 1 — Wallet Details
GET http://127.0.0.1:3001/api/v1/wallets/WALLET_PENDING_REQ_AEE7B53C59079B041CD63472
Headers:
Accept: application/jsonx-request-id: REQ_POSTMAN_WALLET_QUERY_001

Request 2 — Wallet Balance
GET http://127.0.0.1:3001/api/v1/wallets/WALLET_PENDING_REQ_AEE7B53C59079B041CD63472/balance
Headers:
Accept: application/jsonx-request-id: REQ_POSTMAN_WALLET_BALANCE_001

Request 3 — Wallet History
GET http://127.0.0.1:3001/api/v1/wallets/WALLET_PENDING_REQ_AEE7B53C59079B041CD63472/history?limit=10&offset=0
Headers:
Accept: application/jsonx-request-id: REQ_POSTMAN_WALLET_HISTORY_001

15. Important Chaincode Function Names
This implementation expects your chaincode to expose:
GetWalletByAddressGetWalletBalanceGetTransactionHistoryByWallet
If your current chaincode uses different names, update these lines in:
src/services/wallet-query.service.js
Current lines:
"GetWalletByAddress""GetWalletBalance""GetTransactionHistoryByWallet"
For example, if your chaincode uses:
GetWalletGetBalanceGetWalletTransactions
Then replace them accordingly.

16. Recommended Fallback Behavior
The flow is:
API Request   ↓Controller validation   ↓Service   ↓Try Fabric evaluateTransaction   ↓If Fabric success → return blockchain response   ↓If Fabric fails → query PostgreSQL fallback   ↓Return normalized response
This is important because your API remains usable even if:
Fabric peer is temporarily unavailableChaincode container is downEndorsement failsGateway connection failsBlockchain query returns empty result

17. Final Verification Checklist
Run these checks:
curl http://127.0.0.1:3001/curl http://127.0.0.1:3001/api/v1/health
Then:
curl -X GET "http://127.0.0.1:3001/api/v1/wallets/WALLET_PENDING_REQ_AEE7B53C59079B041CD63472" \-H "Accept: application/json"curl -X GET "http://127.0.0.1:3001/api/v1/wallets/WALLET_PENDING_REQ_AEE7B53C59079B041CD63472/balance" \-H "Accept: application/json"curl -X GET "http://127.0.0.1:3001/api/v1/wallets/WALLET_PENDING_REQ_AEE7B53C59079B041CD63472/history?limit=10&offset=0" \-H "Accept: application/json"

18. STEP 25 Completion Summary
After this step, your Blockchain API Middleware supports:
Wallet detail queryWallet balance queryWallet transaction history queryFabric evaluate transaction integrationPostgreSQL fallbackNormalized API responseCentralized error handlingPostman and curl testing
Status:
STEP 25 — Wallet Query APIs: READY FOR IMPLEMENTATION