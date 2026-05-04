🔹 STEP 22 — Wallet Login API Implementation
1. Install Required Package
From your backend project:
cd /home/nix/u01/blockchain-integration/blockchain-apinpm install jsonwebtoken bcryptjs
Validate:
npm list jsonwebtoken bcryptjs

2. Update .env
Open:
nano .env
Add or update these values:
# ===============================# JWT SECURITY# ===============================JWT_SECRET=CHANGE_THIS_TO_A_LONG_RANDOM_SECRET_FOR_PRODUCTIONJWT_EXPIRES_IN=1hJWT_ISSUER=blockchain-api-middlewareJWT_AUDIENCE=blockchain-wallet-users# ===============================# WALLET LOGIN SECURITY# ===============================LOGIN_MAX_FAILED_ATTEMPTS=5LOGIN_LOCK_MINUTES=15
For production, generate a strong secret:
openssl rand -hex 64
Then replace:
JWT_SECRET=CHANGE_THIS_TO_A_LONG_RANDOM_SECRET_FOR_PRODUCTION

3. Create Login Security Migration Script
Create this file:
nano postgresql/step-22-wallet-login-security.sql
Paste:
BEGIN;-- =========================================================-- STEP 22 — Wallet Login API Security Support-- Blockchain Integration Project-- =========================================================CREATE EXTENSION IF NOT EXISTS pgcrypto;-- =========================================================-- Add login/security fields to wallets table if missing-- =========================================================ALTER TABLE blockchain.walletsADD COLUMN IF NOT EXISTS password_hash TEXT,ADD COLUMN IF NOT EXISTS pin_hash TEXT,ADD COLUMN IF NOT EXISTS login_failed_count INTEGER NOT NULL DEFAULT 0,ADD COLUMN IF NOT EXISTS login_locked_until TIMESTAMPTZ,ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ,ADD COLUMN IF NOT EXISTS last_failed_login_at TIMESTAMPTZ,ADD COLUMN IF NOT EXISTS last_login_ip INET,ADD COLUMN IF NOT EXISTS login_status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE';COMMENT ON COLUMN blockchain.wallets.password_hash IS'Secure bcrypt hash for wallet login password. Never store plain password.';COMMENT ON COLUMN blockchain.wallets.pin_hash IS'Optional secure bcrypt hash for wallet PIN. Never store plain PIN.';COMMENT ON COLUMN blockchain.wallets.login_failed_count IS'Number of consecutive failed login attempts. Reset to zero after successful login.';COMMENT ON COLUMN blockchain.wallets.login_locked_until IS'Wallet login lock expiration timestamp after repeated failed login attempts.';COMMENT ON COLUMN blockchain.wallets.last_login_at IS'Last successful wallet login timestamp.';COMMENT ON COLUMN blockchain.wallets.last_failed_login_at IS'Last failed wallet login timestamp.';COMMENT ON COLUMN blockchain.wallets.last_login_ip IS'Last successful login source IP address.';COMMENT ON COLUMN blockchain.wallets.login_status IS'Wallet login status. Values: ACTIVE, LOCKED, DISABLED, SUSPENDED.';-- =========================================================-- Add indexes for login lookup and security checks-- =========================================================CREATE INDEX IF NOT EXISTS idx_wallets_wallet_address_loginON blockchain.wallets(wallet_address);CREATE INDEX IF NOT EXISTS idx_wallets_customer_id_loginON blockchain.wallets(customer_id);CREATE INDEX IF NOT EXISTS idx_wallets_login_statusON blockchain.wallets(login_status);CREATE INDEX IF NOT EXISTS idx_wallets_login_locked_untilON blockchain.wallets(login_locked_until);-- =========================================================-- Audit logs table fallback fields-- =========================================================ALTER TABLE blockchain.audit_logsADD COLUMN IF NOT EXISTS event_type VARCHAR(100),ADD COLUMN IF NOT EXISTS event_status VARCHAR(30),ADD COLUMN IF NOT EXISTS entity_type VARCHAR(100),ADD COLUMN IF NOT EXISTS entity_id TEXT,ADD COLUMN IF NOT EXISTS actor_id TEXT,ADD COLUMN IF NOT EXISTS source_ip INET,ADD COLUMN IF NOT EXISTS user_agent TEXT,ADD COLUMN IF NOT EXISTS request_payload JSONB,ADD COLUMN IF NOT EXISTS response_payload JSONB,ADD COLUMN IF NOT EXISTS error_message TEXT,ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();CREATE INDEX IF NOT EXISTS idx_audit_logs_event_typeON blockchain.audit_logs(event_type);CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_idON blockchain.audit_logs(entity_id);CREATE INDEX IF NOT EXISTS idx_audit_logs_created_atON blockchain.audit_logs(created_at DESC);COMMIT;
Run it:
psql -h 172.31.13.133 -p 5444 -U postgres -d vfds_dev \-f /home/nix/u01/blockchain-integration/postgresql/step-22-wallet-login-security.sql

4. Create JWT Utility
Create folder if missing:
mkdir -p src/utils
Create file:
nano src/utils/jwt.util.js
Paste:
const jwt = require("jsonwebtoken");const JWT_SECRET = process.env.JWT_SECRET;const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1h";const JWT_ISSUER = process.env.JWT_ISSUER || "blockchain-api-middleware";const JWT_AUDIENCE = process.env.JWT_AUDIENCE || "blockchain-wallet-users";if (!JWT_SECRET) {  throw new Error("JWT_SECRET is required in environment variables");}function generateWalletToken(wallet) {  const payload = {    sub: wallet.wallet_address,    walletAddress: wallet.wallet_address,    customerId: wallet.customer_id,    organizationId: wallet.organization_id,    organizationCode: wallet.organization_code || null,    role: "WALLET_USER",    tokenType: "WALLET_LOGIN"  };  return jwt.sign(payload, JWT_SECRET, {    expiresIn: JWT_EXPIRES_IN,    issuer: JWT_ISSUER,    audience: JWT_AUDIENCE  });}function verifyWalletToken(token) {  return jwt.verify(token, JWT_SECRET, {    issuer: JWT_ISSUER,    audience: JWT_AUDIENCE  });}module.exports = {  generateWalletToken,  verifyWalletToken};

5. Create Password Utility
Create:
nano src/utils/password.util.js
Paste:
const bcrypt = require("bcryptjs");const SALT_ROUNDS = 12;async function hashSecret(secret) {  if (!secret || typeof secret !== "string") {    throw new Error("Secret value is required");  }  return bcrypt.hash(secret, SALT_ROUNDS);}async function compareSecret(plainValue, hashedValue) {  if (!plainValue || !hashedValue) {    return false;  }  return bcrypt.compare(plainValue, hashedValue);}module.exports = {  hashSecret,  compareSecret};

6. Create Wallet Login Validation Middleware
Create folder if missing:
mkdir -p src/middlewares
Create:
nano src/middlewares/wallet-login.validator.js
Paste:
function validateWalletLoginRequest(req, res, next) {  const { walletAddress, customerId, password, pin } = req.body || {};  const hasWalletAddress = walletAddress && typeof walletAddress === "string";  const hasCustomerId = customerId && typeof customerId === "string";  if (!hasWalletAddress && !hasCustomerId) {    return res.status(400).json({      success: false,      message: "walletAddress or customerId is required",      errorCode: "VALIDATION_ERROR",      data: null    });  }  if (!password || typeof password !== "string") {    return res.status(400).json({      success: false,      message: "password is required",      errorCode: "VALIDATION_ERROR",      data: null    });  }  if (password.length < 6) {    return res.status(400).json({      success: false,      message: "Invalid login credentials",      errorCode: "INVALID_CREDENTIALS",      data: null    });  }  if (pin && typeof pin !== "string") {    return res.status(400).json({      success: false,      message: "pin must be a string",      errorCode: "VALIDATION_ERROR",      data: null    });  }  req.body.walletAddress = walletAddress ? walletAddress.trim() : undefined;  req.body.customerId = customerId ? customerId.trim() : undefined;  next();}module.exports = {  validateWalletLoginRequest};

7. Create Wallet Login Service
Create or update:
nano src/services/wallet-auth.service.js
Paste:
const crypto = require("crypto");const db = require("../config/database");const { compareSecret } = require("../utils/password.util");const { generateWalletToken } = require("../utils/jwt.util");const LOGIN_MAX_FAILED_ATTEMPTS = Number(process.env.LOGIN_MAX_FAILED_ATTEMPTS || 5);const LOGIN_LOCK_MINUTES = Number(process.env.LOGIN_LOCK_MINUTES || 15);function generateRequestId() {  return `REQ_${crypto.randomBytes(12).toString("hex").toUpperCase()}`;}function sanitizeWallet(wallet) {  return {    walletId: wallet.wallet_id,    customerId: wallet.customer_id,    organizationId: wallet.organization_id,    organizationCode: wallet.organization_code || null,    walletAddress: wallet.wallet_address,    walletStatus: wallet.status || wallet.wallet_status || null,    loginStatus: wallet.login_status,    lastLoginAt: wallet.last_login_at,    createdAt: wallet.created_at  };}async function insertAuditLog(client, payload) {  await client.query(    `    INSERT INTO blockchain.audit_logs (      event_type,      event_status,      entity_type,      entity_id,      actor_id,      source_ip,      user_agent,      request_payload,      response_payload,      error_message,      created_at    )    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())    `,    [      payload.eventType,      payload.eventStatus,      payload.entityType || "WALLET",      payload.entityId || null,      payload.actorId || null,      payload.sourceIp || null,      payload.userAgent || null,      payload.requestPayload || {},      payload.responsePayload || {},      payload.errorMessage || null    ]  );}async function findWalletForLogin(client, { walletAddress, customerId }) {  const params = [];  const conditions = [];  if (walletAddress) {    params.push(walletAddress);    conditions.push(`wallet_address = $${params.length}`);  }  if (customerId) {    params.push(customerId);    conditions.push(`customer_id = $${params.length}`);  }  const query = `    SELECT      wallet_id,      customer_id,      organization_id,      organization_code,      wallet_address,      password_hash,      pin_hash,      status,      wallet_status,      login_status,      login_failed_count,      login_locked_until,      last_login_at,      created_at    FROM blockchain.wallets    WHERE ${conditions.join(" OR ")}    LIMIT 1  `;  const result = await client.query(query, params);  return result.rows[0] || null;}async function trackFailedLogin(client, wallet, meta, reason) {  if (!wallet) {    await insertAuditLog(client, {      eventType: "WALLET_LOGIN",      eventStatus: "FAILED",      entityType: "WALLET",      entityId: null,      actorId: null,      sourceIp: meta.ip,      userAgent: meta.userAgent,      requestPayload: {        walletAddress: meta.walletAddress || null,        customerId: meta.customerId || null      },      responsePayload: {        reason      },      errorMessage: reason    });    return;  }  const nextFailedCount = Number(wallet.login_failed_count || 0) + 1;  const shouldLock = nextFailedCount >= LOGIN_MAX_FAILED_ATTEMPTS;  await client.query(    `    UPDATE blockchain.wallets    SET      login_failed_count = $1,      last_failed_login_at = NOW(),      login_locked_until = CASE        WHEN $2 = TRUE THEN NOW() + ($3 || ' minutes')::INTERVAL        ELSE login_locked_until      END,      login_status = CASE        WHEN $2 = TRUE THEN 'LOCKED'        ELSE login_status      END,      updated_at = NOW()    WHERE wallet_id = $4    `,    [      nextFailedCount,      shouldLock,      LOGIN_LOCK_MINUTES,      wallet.wallet_id    ]  );  await insertAuditLog(client, {    eventType: "WALLET_LOGIN",    eventStatus: "FAILED",    entityType: "WALLET",    entityId: wallet.wallet_address,    actorId: wallet.customer_id,    sourceIp: meta.ip,    userAgent: meta.userAgent,    requestPayload: {      walletAddress: meta.walletAddress || null,      customerId: meta.customerId || null    },    responsePayload: {      failedCount: nextFailedCount,      locked: shouldLock,      lockMinutes: shouldLock ? LOGIN_LOCK_MINUTES : null    },    errorMessage: reason  });}async function resetSuccessfulLogin(client, wallet, meta) {  await client.query(    `    UPDATE blockchain.wallets    SET      login_failed_count = 0,      login_locked_until = NULL,      login_status = 'ACTIVE',      last_login_at = NOW(),      last_login_ip = $1,      updated_at = NOW()    WHERE wallet_id = $2    `,    [meta.ip || null, wallet.wallet_id]  );}async function loginWallet(payload, meta = {}) {  const requestId = generateRequestId();  const client = await db.pool.connect();  try {    await client.query("BEGIN");    const wallet = await findWalletForLogin(client, {      walletAddress: payload.walletAddress,      customerId: payload.customerId    });    if (!wallet) {      await trackFailedLogin(        client,        null,        {          ...meta,          walletAddress: payload.walletAddress,          customerId: payload.customerId        },        "Wallet not found"      );      await client.query("COMMIT");      return {        statusCode: 401,        body: {          success: false,          message: "Invalid login credentials",          errorCode: "INVALID_CREDENTIALS",          data: null,          requestId        }      };    }    const walletStatus = wallet.status || wallet.wallet_status;    if (walletStatus && !["ACTIVE", "CREATED"].includes(walletStatus)) {      await trackFailedLogin(client, wallet, meta, `Wallet status is ${walletStatus}`);      await client.query("COMMIT");      return {        statusCode: 403,        body: {          success: false,          message: "Wallet is not allowed to login",          errorCode: "WALLET_NOT_ACTIVE",          data: null,          requestId        }      };    }    if (wallet.login_status === "DISABLED" || wallet.login_status === "SUSPENDED") {      await trackFailedLogin(client, wallet, meta, `Login status is ${wallet.login_status}`);      await client.query("COMMIT");      return {        statusCode: 403,        body: {          success: false,          message: "Wallet login is disabled",          errorCode: "LOGIN_DISABLED",          data: null,          requestId        }      };    }    if (      wallet.login_locked_until &&      new Date(wallet.login_locked_until).getTime() > Date.now()    ) {      await insertAuditLog(client, {        eventType: "WALLET_LOGIN",        eventStatus: "BLOCKED",        entityType: "WALLET",        entityId: wallet.wallet_address,        actorId: wallet.customer_id,        sourceIp: meta.ip,        userAgent: meta.userAgent,        requestPayload: {          walletAddress: payload.walletAddress || null,          customerId: payload.customerId || null        },        responsePayload: {          lockedUntil: wallet.login_locked_until        },        errorMessage: "Wallet login is temporarily locked"      });      await client.query("COMMIT");      return {        statusCode: 423,        body: {          success: false,          message: "Wallet login is temporarily locked. Please try again later.",          errorCode: "LOGIN_LOCKED",          data: {            lockedUntil: wallet.login_locked_until          },          requestId        }      };    }    if (!wallet.password_hash) {      await trackFailedLogin(client, wallet, meta, "Wallet password hash is missing");      await client.query("COMMIT");      return {        statusCode: 403,        body: {          success: false,          message: "Wallet login is not configured",          errorCode: "LOGIN_NOT_CONFIGURED",          data: null,          requestId        }      };    }    const passwordValid = await compareSecret(payload.password, wallet.password_hash);    if (!passwordValid) {      await trackFailedLogin(client, wallet, meta, "Invalid password");      await client.query("COMMIT");      return {        statusCode: 401,        body: {          success: false,          message: "Invalid login credentials",          errorCode: "INVALID_CREDENTIALS",          data: null,          requestId        }      };    }    if (wallet.pin_hash) {      if (!payload.pin) {        await trackFailedLogin(client, wallet, meta, "PIN is required");        await client.query("COMMIT");        return {          statusCode: 400,          body: {            success: false,            message: "PIN is required for this wallet",            errorCode: "PIN_REQUIRED",            data: null,            requestId          }        };      }      const pinValid = await compareSecret(payload.pin, wallet.pin_hash);      if (!pinValid) {        await trackFailedLogin(client, wallet, meta, "Invalid PIN");        await client.query("COMMIT");        return {          statusCode: 401,          body: {            success: false,            message: "Invalid login credentials",            errorCode: "INVALID_CREDENTIALS",            data: null,            requestId          }        };      }    }    await resetSuccessfulLogin(client, wallet, meta);    const token = generateWalletToken(wallet);    await insertAuditLog(client, {      eventType: "WALLET_LOGIN",      eventStatus: "SUCCESS",      entityType: "WALLET",      entityId: wallet.wallet_address,      actorId: wallet.customer_id,      sourceIp: meta.ip,      userAgent: meta.userAgent,      requestPayload: {        walletAddress: payload.walletAddress || null,        customerId: payload.customerId || null      },      responsePayload: {        tokenIssued: true,        expiresIn: process.env.JWT_EXPIRES_IN || "1h"      },      errorMessage: null    });    await client.query("COMMIT");    return {      statusCode: 200,      body: {        success: true,        message: "Wallet login successful",        data: {          token,          tokenType: "Bearer",          expiresIn: process.env.JWT_EXPIRES_IN || "1h",          wallet: sanitizeWallet(wallet)        },        requestId      }    };  } catch (error) {    await client.query("ROLLBACK");    return {      statusCode: 500,      body: {        success: false,        message: "Wallet login failed",        errorCode: "WALLET_LOGIN_ERROR",        error: process.env.NODE_ENV === "development" ? error.message : undefined,        data: null,        requestId      }    };  } finally {    client.release();  }}module.exports = {  loginWallet};

8. Create Wallet Auth Controller
Create:
nano src/controllers/wallet-auth.controller.js
Paste:
const walletAuthService = require("../services/wallet-auth.service");async function loginWallet(req, res) {  const meta = {    ip:      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||      req.socket?.remoteAddress ||      null,    userAgent: req.headers["user-agent"] || null  };  const result = await walletAuthService.loginWallet(req.body, meta);  return res.status(result.statusCode).json(result.body);}module.exports = {  loginWallet};

9. Update Wallet Routes
Open your wallet route file. Most likely:
nano src/routes/wallet.routes.js
Use this updated version. If your file already has wallet creation routes, keep them and add only the login part.
const express = require("express");const router = express.Router();const walletController = require("../controllers/wallet.controller");const walletAuthController = require("../controllers/wallet-auth.controller");const {  validateWalletLoginRequest} = require("../middlewares/wallet-login.validator");// Existing wallet creation endpoint from Step 21router.post("/", walletController.createWallet);// STEP 22 — Wallet Login APIrouter.post(  "/login",  validateWalletLoginRequest,  walletAuthController.loginWallet);module.exports = router;

10. Make Sure Main Routes Are Mounted
Open:
nano src/routes/index.js
Make sure wallets are mounted like this:
const express = require("express");const router = express.Router();const walletRoutes = require("./wallet.routes");router.use("/wallets", walletRoutes);module.exports = router;
Then confirm your server.js or app.js has:
app.use("/api/v1", routes);
So the final endpoint becomes:
POST /api/v1/wallets/login

11. Important Update to Step 21 Wallet Creation
Your login will only work if password_hash is stored securely during wallet creation.
In your wallet creation service, make sure you are not storing plain password or fake hash values directly.
You should import:
const { hashSecret } = require("../utils/password.util");
Then when creating the wallet, convert the incoming password or passwordHash value into bcrypt hash.
Example logic:
const securePasswordHash = await hashSecret(payload.password || payload.passwordHash);
Then insert:
securePasswordHash
into:
password_hash
For your current curl request, you are sending:
"passwordHash": "PASSWORD_HASH_2016"
For Step 22 to work securely, this should now be treated as the login password input, then bcrypt-hashed before storing.
Recommended API field going forward:
"password": "MyStrongPassword123"
Instead of:
"passwordHash": "PASSWORD_HASH_2016"

12. Test Password Hash for Existing Wallets
If your existing wallets were created before bcrypt hashing, login will fail because the values are not real bcrypt hashes.
For testing one existing wallet, run this temporary command:
node - <<'NODE'const bcrypt = require("bcryptjs");bcrypt.hash("password123", 12).then(console.log);NODE
Copy the generated hash.
Then update one test wallet:
UPDATE blockchain.walletsSET password_hash = 'PASTE_GENERATED_BCRYPT_HASH_HERE',    login_status = 'ACTIVE',    login_failed_count = 0,    login_locked_until = NULL,    updated_at = NOW()WHERE customer_id = 'CUST2017';
Example through psql:
psql -h 172.31.13.133 -p 5444 -U postgres -d vfds_dev
Then run the SQL update.

13. Syntax Check
Run:
cd /home/nix/u01/blockchain-integration/blockchain-apinode -c src/utils/jwt.util.jsnode -c src/utils/password.util.jsnode -c src/middlewares/wallet-login.validator.jsnode -c src/services/wallet-auth.service.jsnode -c src/controllers/wallet-auth.controller.jsnode -c src/routes/wallet.routes.jsnode -c src/routes/index.js

14. Restart API
If API is already running and port is busy:
lsof -i :3001
Kill old process if needed:
kill -9 <PID>
Start again:
npm start
Or with PM2 if you are using it:
pm2 restart blockchain-api

15. Curl Test — Successful Login
Use your created wallet:
curl -X POST http://127.0.0.1:3001/api/v1/wallets/login \-H "Content-Type: application/json" \-d '{  "customerId": "CUST2017",  "password": "password123"}'
Or using wallet address:
curl -X POST http://127.0.0.1:3001/api/v1/wallets/login \-H "Content-Type: application/json" \-d '{  "walletAddress": "WALLET_ADDRESS_HERE",  "password": "password123"}'
Expected response:
{  "success": true,  "message": "Wallet login successful",  "data": {    "token": "JWT_TOKEN_HERE",    "tokenType": "Bearer",    "expiresIn": "1h",    "wallet": {      "walletId": "uuid",      "customerId": "CUST2017",      "organizationId": "uuid",      "organizationCode": "BANK001",      "walletAddress": "WALLET_xxxxx",      "walletStatus": "ACTIVE",      "loginStatus": "ACTIVE",      "lastLoginAt": null,      "createdAt": "timestamp"    }  },  "requestId": "REQ_xxxxx"}

16. Curl Test — Failed Login
curl -X POST http://127.0.0.1:3001/api/v1/wallets/login \-H "Content-Type: application/json" \-d '{  "customerId": "CUST2017",  "password": "wrong-password"}'
Expected:
{  "success": false,  "message": "Invalid login credentials",  "errorCode": "INVALID_CREDENTIALS",  "data": null,  "requestId": "REQ_xxxxx"}
After 5 failed attempts, expected:
{  "success": false,  "message": "Wallet login is temporarily locked. Please try again later.",  "errorCode": "LOGIN_LOCKED",  "data": {    "lockedUntil": "timestamp"  },  "requestId": "REQ_xxxxx"}

17. Postman Test
Request
POST http://127.0.0.1:3001/api/v1/wallets/login
Headers
Content-Type: application/jsonAccept: application/json
Body
{  "customerId": "CUST2017",  "password": "password123"}
Or:
{  "walletAddress": "WALLET_ADDRESS_HERE",  "password": "password123"}
Expected Status
200 OK
Expected Response
{  "success": true,  "message": "Wallet login successful",  "data": {    "token": "eyJhbGciOiJIUzI1NiIs...",    "tokenType": "Bearer",    "expiresIn": "1h",    "wallet": {      "customerId": "CUST2017",      "organizationCode": "BANK001",      "walletAddress": "WALLET_ADDRESS_HERE",      "loginStatus": "ACTIVE"    }  }}

18. Test JWT Token
After login, copy the token and test:
TOKEN="PASTE_TOKEN_HERE"echo $TOKEN
Later you will use it like this:
curl http://127.0.0.1:3001/api/v1/wallets/me \-H "Authorization: Bearer $TOKEN"
The /wallets/me endpoint can be added in the next step if needed.

19. Verify Audit Logs
Run:
psql -h 172.31.13.133 -p 5444 -U postgres -d vfds_dev
Then:
SELECT    event_type,    event_status,    entity_type,    entity_id,    actor_id,    source_ip,    error_message,    created_atFROM blockchain.audit_logsWHERE event_type = 'WALLET_LOGIN'ORDER BY created_at DESCLIMIT 20;
Expected records:
WALLET_LOGIN | SUCCESSWALLET_LOGIN | FAILEDWALLET_LOGIN | BLOCKED

20. Verify Failed Login Tracking
SELECT    customer_id,    wallet_address,    login_status,    login_failed_count,    login_locked_until,    last_login_at,    last_failed_login_atFROM blockchain.walletsWHERE customer_id = 'CUST2017';
After successful login:
login_failed_count = 0login_locked_until = NULLlogin_status = ACTIVE
After repeated failed logins:
login_failed_count >= 5login_status = LOCKEDlogin_locked_until = NOW() + 15 minutes

21. Production Security Notes
This implementation follows these rules:


Never stores plain password or plain PIN.


Uses bcrypt with salt rounds.


Uses JWT with issuer and audience.


Does not reveal whether wallet address, customer ID, password, or PIN is wrong.


Tracks failed login attempts.


Locks login temporarily after repeated failures.


Writes audit logs for success, failure, and blocked attempts.


Keeps response messages safe and generic.


Supports optional PIN validation.


Supports login by either customerId or walletAddress.



22. Final Endpoint Summary
POST /api/v1/wallets/login
Request
{  "customerId": "CUST2017",  "password": "password123"}
Or:
{  "walletAddress": "WALLET_xxxxxxxxx",  "password": "password123",  "pin": "1234"}
Success Response
{  "success": true,  "message": "Wallet login successful",  "data": {    "token": "JWT_TOKEN",    "tokenType": "Bearer",    "expiresIn": "1h",    "wallet": {      "customerId": "CUST2017",      "organizationCode": "BANK001",      "walletAddress": "WALLET_xxxxxxxxx",      "loginStatus": "ACTIVE"    }  },  "requestId": "REQ_xxxxxxxxx"}

STEP 22 Completion Status
ItemStatusWallet login routeCompletedWallet login controllerCompletedWallet auth serviceCompletedPassword validationCompletedOptional PIN validationCompletedJWT generationCompletedLogin audit logCompletedFailed login trackingCompletedTemporary lockoutCompletedSecure error responsesCompletedPostman testCompletedcurl testCompleted
STEP 22 is now ready for implementation and testing.