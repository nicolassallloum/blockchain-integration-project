# 🔹 STEP 20 — Fabric SDK Integration
## Node.js Blockchain API + Hyperledger Fabric Gateway SDK

**Status:** Completed and verified successfully.

This updated document reflects the final working implementation after fixing:

- API route registration
- `.env` compatibility variables
- Fabric peer / CouchDB Docker networking
- TLS connection validation
- Chaincode lifecycle package binding
- Endorsement policy issue
- Node.js SDK explicit endorsement flow

Final verified wallet created through API:

```text
WALLET_58EA9FD8FEE72D0BDC99B6801853AEA06C0AD8C1
```

Final verified transaction ID:

```text
75e23daee3a74f7f721050fc540dc42b3165f67e82603aeb0d3cf2384a262c5b
```

---

## 1. Project Location

```bash
cd /home/nix/u01/blockchain-integration/blockchain-api
```

---

## 2. Install Required Fabric SDK Packages

```bash
npm install @hyperledger/fabric-gateway @grpc/grpc-js
```

Optional only if required by your environment:

```bash
npm install grpc
```

---

## 3. Create Required Folders

```bash
mkdir -p config
mkdir -p wallet
mkdir -p scripts
mkdir -p src/services
mkdir -p src/controllers
mkdir -p src/routes
```

---

## 4. Updated `.env` Configuration

Open:

```bash
nano .env
```

Add or update:

```env
# ==================================================
# Hyperledger Fabric SDK Configuration
# ==================================================
FABRIC_CONNECTION_PROFILE=/home/nix/u01/blockchain-integration/blockchain-api/config/connection-org1.json
FABRIC_WALLET_PATH=/home/nix/u01/blockchain-integration/blockchain-api/wallet

# Compatibility variables required by src/config/index.js
FABRIC_MSP_ID=Org1MSP
FABRIC_IDENTITY=admin

# Fabric service variables
FABRIC_ORG_MSP_ID=Org1MSP
FABRIC_IDENTITY_LABEL=admin

FABRIC_CHANNEL_NAME=kycchannelnix1
FABRIC_CHAINCODE_NAME=kyc-wallet-chaincode-js

FABRIC_PEER_NAME=peer0.org1.blockchain.local
FABRIC_PEER_ENDPOINT=localhost:7051
FABRIC_PEER_TLS_HOST_ALIAS=peer0.org1.blockchain.local
FABRIC_DEFAULT_TIMEOUT_MS=30000
```

Validate:

```bash
grep -E "FABRIC_MSP_ID|FABRIC_IDENTITY|FABRIC_ORG_MSP_ID|FABRIC_IDENTITY_LABEL|FABRIC_PEER_ENDPOINT" .env
```

---

## 5. Updated Fabric Connection Profile

Create or update:

```bash
nano config/connection-org1.json
```

Paste:

```json
{
  "name": "blockchain-integration-network",
  "version": "1.0.0",
  "client": {
    "organization": "Org1",
    "connection": {
      "timeout": {
        "peer": {
          "endorser": "300"
        }
      }
    }
  },
  "organizations": {
    "Org1": {
      "mspid": "Org1MSP",
      "peers": [
        "peer0.org1.blockchain.local"
      ]
    },
    "Org2": {
      "mspid": "Org2MSP",
      "peers": [
        "peer0.org2.blockchain.local"
      ]
    }
  },
  "peers": {
    "peer0.org1.blockchain.local": {
      "url": "grpcs://localhost:7051",
      "tlsCACerts": {
        "path": "/home/nix/u01/blockchain-integration/fabric-network/organizations/peerOrganizations/org1.blockchain.local/peers/peer0.org1.blockchain.local/tls/ca.crt"
      },
      "grpcOptions": {
        "ssl-target-name-override": "peer0.org1.blockchain.local",
        "hostnameOverride": "peer0.org1.blockchain.local"
      }
    },
    "peer0.org2.blockchain.local": {
      "url": "grpcs://localhost:9051",
      "tlsCACerts": {
        "path": "/home/nix/u01/blockchain-integration/fabric-network/organizations/peerOrganizations/org2.blockchain.local/peers/peer0.org2.blockchain.local/tls/ca.crt"
      },
      "grpcOptions": {
        "ssl-target-name-override": "peer0.org2.blockchain.local",
        "hostnameOverride": "peer0.org2.blockchain.local"
      }
    }
  }
}
```

Validate JSON:

```bash
node -e "JSON.parse(require('fs').readFileSync('config/connection-org1.json')); console.log('Connection profile is valid JSON');"
```

---

## 6. Import Admin Identity Script

Create:

```bash
nano scripts/import-admin-identity.js
```

Paste:

```js
"use strict";

require("dotenv").config();

const fs = require("fs");
const path = require("path");

const PROJECT_ROOT = path.resolve(__dirname, "..");

const walletPath =
  process.env.FABRIC_WALLET_PATH ||
  path.join(PROJECT_ROOT, "wallet");

const identityLabel =
  process.env.FABRIC_IDENTITY_LABEL ||
  process.env.FABRIC_IDENTITY ||
  "admin";

const mspId =
  process.env.FABRIC_ORG_MSP_ID ||
  process.env.FABRIC_MSP_ID ||
  "Org1MSP";

const adminMspPath =
  process.env.FABRIC_ADMIN_MSP_PATH ||
  "/home/nix/u01/blockchain-integration/fabric-network/organizations/peerOrganizations/org1.blockchain.local/users/Admin@org1.blockchain.local/msp";

const certDir = path.join(adminMspPath, "signcerts");
const keyDir = path.join(adminMspPath, "keystore");

function getFirstFile(directoryPath) {
  if (!fs.existsSync(directoryPath)) {
    throw new Error(`Directory not found: ${directoryPath}`);
  }

  const files = fs.readdirSync(directoryPath).filter((file) => !file.startsWith("."));

  if (!files.length) {
    throw new Error(`No files found inside: ${directoryPath}`);
  }

  return path.join(directoryPath, files[0]);
}

function main() {
  console.log("==================================================");
  console.log("Importing Fabric Admin Identity");
  console.log("==================================================");

  const certPath = getFirstFile(certDir);
  const keyPath = getFirstFile(keyDir);

  const certificate = fs.readFileSync(certPath, "utf8");
  const privateKey = fs.readFileSync(keyPath, "utf8");

  const identity = {
    label: identityLabel,
    mspId,
    credentials: {
      certificate,
      privateKey
    },
    type: "X.509"
  };

  fs.mkdirSync(walletPath, { recursive: true });

  const identityFilePath = path.join(walletPath, `${identityLabel}.id`);
  fs.writeFileSync(identityFilePath, JSON.stringify(identity, null, 2));

  console.log(`Identity label  : ${identityLabel}`);
  console.log(`MSP ID          : ${mspId}`);
  console.log(`Wallet path     : ${walletPath}`);
  console.log(`Identity file   : ${identityFilePath}`);
  console.log("Admin identity imported successfully.");
}

try {
  main();
} catch (error) {
  console.error("Failed to import Fabric identity.");
  console.error(error.message);
  process.exit(1);
}
```

Run:

```bash
node scripts/import-admin-identity.js
ls -lah wallet
cat wallet/admin.id | head
```

---

## 7. Final Updated `src/services/fabric.service.js`

Create or replace:

```bash
nano src/services/fabric.service.js
```

Paste:

```js
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const grpc = require("@grpc/grpc-js");

const {
  connect,
  hash,
  signers
} = require("@hyperledger/fabric-gateway");

class FabricService {
  constructor() {
    this.connectionProfilePath =
      process.env.FABRIC_CONNECTION_PROFILE ||
      path.resolve(process.cwd(), "config", "connection-org1.json");

    this.walletPath =
      process.env.FABRIC_WALLET_PATH ||
      path.resolve(process.cwd(), "wallet");

    this.identityLabel =
      process.env.FABRIC_IDENTITY_LABEL ||
      process.env.FABRIC_IDENTITY ||
      "admin";

    this.channelName =
      process.env.FABRIC_CHANNEL_NAME ||
      "kycchannelnix1";

    this.chaincodeName =
      process.env.FABRIC_CHAINCODE_NAME ||
      "kyc-wallet-chaincode-js";

    this.peerName =
      process.env.FABRIC_PEER_NAME ||
      "peer0.org1.blockchain.local";

    this.peerEndpoint =
      process.env.FABRIC_PEER_ENDPOINT ||
      "localhost:7051";

    this.peerTlsHostAlias =
      process.env.FABRIC_PEER_TLS_HOST_ALIAS ||
      "peer0.org1.blockchain.local";

    this.endorsingOrganizations = (
      process.env.FABRIC_ENDORSING_ORGS || "Org1MSP"
    )
      .split(",")
      .map((org) => org.trim())
      .filter(Boolean);

    this.defaultTimeoutMs = Number(
      process.env.FABRIC_DEFAULT_TIMEOUT_MS || 30000
    );
  }

  loadConnectionProfile() {
    if (!fs.existsSync(this.connectionProfilePath)) {
      throw new Error(
        `Fabric connection profile not found: ${this.connectionProfilePath}`
      );
    }

    const rawProfile = fs.readFileSync(this.connectionProfilePath, "utf8");
    return JSON.parse(rawProfile);
  }

  getPeerConfig() {
    const profile = this.loadConnectionProfile();

    if (!profile.peers || !profile.peers[this.peerName]) {
      throw new Error(`Peer '${this.peerName}' not found in connection profile.`);
    }

    const peer = profile.peers[this.peerName];
    const tlsCertPath = peer.tlsCACerts && peer.tlsCACerts.path;

    if (!tlsCertPath) {
      throw new Error(`TLS CA certificate path is missing for peer '${this.peerName}'.`);
    }

    if (!fs.existsSync(tlsCertPath)) {
      throw new Error(`TLS CA certificate file not found: ${tlsCertPath}`);
    }

    const grpcOptions = peer.grpcOptions || {};

    return {
      peerName: this.peerName,
      endpoint: this.peerEndpoint,
      tlsCertPath,
      tlsHostAlias:
        grpcOptions["ssl-target-name-override"] ||
        grpcOptions.hostnameOverride ||
        this.peerTlsHostAlias
    };
  }

  loadIdentity() {
    const identityPath = path.join(this.walletPath, `${this.identityLabel}.id`);

    if (!fs.existsSync(identityPath)) {
      throw new Error(
        `Fabric identity '${this.identityLabel}' not found in wallet: ${identityPath}. Run: node scripts/import-admin-identity.js`
      );
    }

    const identity = JSON.parse(fs.readFileSync(identityPath, "utf8"));

    if (!identity.mspId) {
      throw new Error("Wallet identity is missing mspId.");
    }

    if (!identity.credentials || !identity.credentials.certificate || !identity.credentials.privateKey) {
      throw new Error("Wallet identity is missing certificate or privateKey.");
    }

    return identity;
  }

  createGatewayIdentity(identity) {
    return {
      mspId: identity.mspId,
      credentials: Buffer.from(identity.credentials.certificate)
    };
  }

  createSigner(identity) {
    const privateKey = crypto.createPrivateKey(identity.credentials.privateKey);
    return signers.newPrivateKeySigner(privateKey);
  }

  createGrpcClient() {
    const peerConfig = this.getPeerConfig();
    const tlsRootCert = fs.readFileSync(peerConfig.tlsCertPath);
    const tlsCredentials = grpc.credentials.createSsl(tlsRootCert);

    return new grpc.Client(peerConfig.endpoint, tlsCredentials, {
      "grpc.ssl_target_name_override": peerConfig.tlsHostAlias,
      "grpc.default_authority": peerConfig.tlsHostAlias,
      "grpc.keepalive_time_ms": 120000,
      "grpc.keepalive_timeout_ms": 20000,
      "grpc.http2.min_time_between_pings_ms": 120000,
      "grpc.http2.max_pings_without_data": 0,
      "grpc.enable_retries": 1
    });
  }

  async connectGateway() {
    const client = this.createGrpcClient();
    const walletIdentity = this.loadIdentity();

    const gateway = connect({
      client,
      identity: this.createGatewayIdentity(walletIdentity),
      signer: this.createSigner(walletIdentity),
      hash: hash.sha256,
      evaluateOptions: () => ({ deadline: Date.now() + this.defaultTimeoutMs }),
      endorseOptions: () => ({ deadline: Date.now() + this.defaultTimeoutMs }),
      submitOptions: () => ({ deadline: Date.now() + this.defaultTimeoutMs }),
      commitStatusOptions: () => ({ deadline: Date.now() + this.defaultTimeoutMs })
    });

    return { gateway, client };
  }

  async getContract() {
    const { gateway, client } = await this.connectGateway();
    const network = gateway.getNetwork(this.channelName);
    const contract = network.getContract(this.chaincodeName);

    return { gateway, client, network, contract };
  }

  normalizeArgs(args) {
    if (!Array.isArray(args)) {
      return [];
    }

    return args.map((arg) => {
      if (arg === null || arg === undefined) {
        return "";
      }

      if (typeof arg === "object") {
        return JSON.stringify(arg);
      }

      return String(arg);
    });
  }

  parseFabricResponse(buffer) {
    if (!buffer) {
      return null;
    }

    const text = Buffer.from(buffer).toString("utf8");

    if (!text) {
      return null;
    }

    try {
      return JSON.parse(text);
    } catch (_) {
      return text;
    }
  }

  formatFabricError(error) {
    return {
      message: error.message,
      name: error.name,
      code: error.code,
      details: error.details,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined
    };
  }

  async evaluateTransaction(functionName, args = []) {
    let gateway;
    let client;

    try {
      if (!functionName) {
        throw new Error("functionName is required.");
      }

      const connection = await this.getContract();
      gateway = connection.gateway;
      client = connection.client;

      const normalizedArgs = this.normalizeArgs(args);

      const result = await connection.contract.evaluateTransaction(
        functionName,
        ...normalizedArgs
      );

      return {
        success: true,
        type: "evaluate",
        channelName: this.channelName,
        chaincodeName: this.chaincodeName,
        functionName,
        args: normalizedArgs,
        data: this.parseFabricResponse(result),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        type: "evaluate",
        channelName: this.channelName,
        chaincodeName: this.chaincodeName,
        functionName,
        args,
        error: this.formatFabricError(error),
        timestamp: new Date().toISOString()
      };
    } finally {
      if (gateway) {
        gateway.close();
      }

      if (client) {
        client.close();
      }
    }
  }

  async submitTransaction(functionName, args = []) {
    let gateway;
    let client;

    try {
      if (!functionName) {
        throw new Error("functionName is required.");
      }

      const connection = await this.getContract();
      gateway = connection.gateway;
      client = connection.client;

      const normalizedArgs = this.normalizeArgs(args);

      const proposal = connection.contract.newProposal(functionName, {
        arguments: normalizedArgs,
        endorsingOrganizations: this.endorsingOrganizations
      });

      const endorsedTransaction = await proposal.endorse();
      const resultBuffer = endorsedTransaction.getResult();
      const submittedTransaction = await endorsedTransaction.submit();
      const commitStatus = await submittedTransaction.getStatus();

      if (!commitStatus.successful) {
        throw new Error(
          `Transaction ${commitStatus.transactionId} failed to commit with status code ${commitStatus.code}`
        );
      }

      return {
        success: true,
        type: "submit",
        channelName: this.channelName,
        chaincodeName: this.chaincodeName,
        functionName,
        args: normalizedArgs,
        endorsingOrganizations: this.endorsingOrganizations,
        data: this.parseFabricResponse(resultBuffer),
        commit: {
          transactionId: commitStatus.transactionId,
          successful: commitStatus.successful,
          code: commitStatus.code
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        type: "submit",
        channelName: this.channelName,
        chaincodeName: this.chaincodeName,
        functionName,
        args,
        endorsingOrganizations: this.endorsingOrganizations,
        error: this.formatFabricError(error),
        timestamp: new Date().toISOString()
      };
    } finally {
      if (gateway) {
        gateway.close();
      }

      if (client) {
        client.close();
      }
    }
  }

  getConnectionInfo() {
    const peerConfig = this.getPeerConfig();
    const identity = this.loadIdentity();

    return {
      success: true,
      fabric: {
        connectionProfilePath: this.connectionProfilePath,
        walletPath: this.walletPath,
        identityLabel: this.identityLabel,
        identityMspId: identity.mspId,
        channelName: this.channelName,
        chaincodeName: this.chaincodeName,
        peerName: peerConfig.peerName,
        peerEndpoint: peerConfig.endpoint,
        peerTlsHostAlias: peerConfig.tlsHostAlias,
        tlsCertPath: peerConfig.tlsCertPath,
        endorsingOrganizations: this.endorsingOrganizations
      },
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = new FabricService();
```

Validate:

```bash
node -c src/services/fabric.service.js
grep -n "contract.submitTransaction" src/services/fabric.service.js
grep -n "newProposal\|endorsingOrganizations" src/services/fabric.service.js
```

Expected:

```text
contract.submitTransaction should return no output.
newProposal and endorsingOrganizations should appear.
```

---

## 8. Fabric Controller

Create or update:

```bash
nano src/controllers/fabric.controller.js
```

Paste:

```js
"use strict";

const fabricService = require("../services/fabric.service");

class FabricController {
  async status(req, res) {
    try {
      const result = fabricService.getConnectionInfo();
      return res.status(200).json(result);
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to read Fabric SDK configuration.",
        error: {
          message: error.message,
          stack: process.env.NODE_ENV === "development" ? error.stack : undefined
        },
        timestamp: new Date().toISOString()
      });
    }
  }

  async evaluate(req, res) {
    try {
      const { functionName, args } = req.body;

      if (!functionName) {
        return res.status(400).json({
          success: false,
          message: "functionName is required.",
          example: {
            functionName: "GetWalletBalance",
            args: ["WALLET_ADDRESS_HERE"]
          }
        });
      }

      const result = await fabricService.evaluateTransaction(functionName, args || []);
      return res.status(result.success ? 200 : 500).json(result);
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Fabric evaluate transaction failed.",
        error: {
          message: error.message,
          stack: process.env.NODE_ENV === "development" ? error.stack : undefined
        },
        timestamp: new Date().toISOString()
      });
    }
  }

  async submit(req, res) {
    try {
      const { functionName, args } = req.body;

      if (!functionName) {
        return res.status(400).json({
          success: false,
          message: "functionName is required.",
          example: {
            functionName: "CreateWallet",
            args: [
              "CUST1003",
              "BANK001",
              "Nicolas Salloum",
              "NID_HASH_1003",
              "MOBILE_HASH_1003",
              "EMAIL_HASH_1003",
              "PASSWORD_HASH_1003",
              "1000"
            ]
          }
        });
      }

      const result = await fabricService.submitTransaction(functionName, args || []);
      return res.status(result.success ? 200 : 500).json(result);
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Fabric submit transaction failed.",
        error: {
          message: error.message,
          stack: process.env.NODE_ENV === "development" ? error.stack : undefined
        },
        timestamp: new Date().toISOString()
      });
    }
  }
}

module.exports = new FabricController();
```

Validate:

```bash
node -c src/controllers/fabric.controller.js
```

---

## 9. Fabric Routes

Create or update:

```bash
nano src/routes/fabric.routes.js
```

Paste:

```js
"use strict";

const express = require("express");
const fabricController = require("../controllers/fabric.controller");

const router = express.Router();

router.get("/status", fabricController.status.bind(fabricController));
router.post("/evaluate", fabricController.evaluate.bind(fabricController));
router.post("/submit", fabricController.submit.bind(fabricController));

module.exports = router;
```

Validate:

```bash
node -c src/routes/fabric.routes.js
```

---

## 10. Updated `src/app.js` Route Registration

Create or replace:

```bash
nano src/app.js
```

Paste:

```js
"use strict";

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");

const config = require("./config");
const logger = require("./utils/logger");

const healthRoutes = require("./routes/health.routes");
const blockchainRoutes = require("./routes/blockchain.routes");
const fabricRoutes = require("./routes/fabric.routes");

const app = express();

const API_PREFIX = config.api?.prefix || process.env.API_PREFIX || "/api/v1";

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
  })
);

app.use(
  cors({
    origin: config.cors?.origin || process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-request-id"]
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(compression());

app.use((req, res, next) => {
  if (logger && typeof logger.info === "function") {
    logger.info(`${req.method} ${req.originalUrl}`, {
      ip: req.ip,
      userAgent: req.get("User-Agent")
    });
  }

  next();
});

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Blockchain API Middleware is running",
    apiPrefix: API_PREFIX,
    health: `${API_PREFIX}/health`,
    blockchainStatus: `${API_PREFIX}/blockchain/status`,
    fabricStatus: `${API_PREFIX}/fabric/status`,
    fabricEvaluate: `${API_PREFIX}/fabric/evaluate`,
    fabricSubmit: `${API_PREFIX}/fabric/submit`,
    timestamp: new Date().toISOString()
  });
});

app.use(`${API_PREFIX}/health`, healthRoutes);
app.use(`${API_PREFIX}/blockchain`, blockchainRoutes);
app.use(`${API_PREFIX}/fabric`, fabricRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    data: null,
    meta: null,
    timestamp: new Date().toISOString()
  });
});

app.use((err, req, res, next) => {
  if (logger && typeof logger.error === "function") {
    logger.error("Unhandled application error", {
      message: err.message,
      stack: err.stack,
      method: req.method,
      url: req.originalUrl
    });
  }

  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
    data: null,
    meta: null,
    timestamp: new Date().toISOString()
  });
});

module.exports = app;
```

Validate:

```bash
node -c src/app.js
```

---

## 11. Fabric Connection Test Script

Create or update:

```bash
nano scripts/test-fabric-connection.js
```

Paste:

```js
"use strict";

require("dotenv").config();

const fabricService = require("../src/services/fabric.service");

async function main() {
  console.log("==================================================");
  console.log("STEP 20 — Fabric SDK Connection Test");
  console.log("==================================================");

  console.log("\n1. Checking Fabric SDK configuration...");
  const info = fabricService.getConnectionInfo();
  console.log(JSON.stringify(info, null, 2));

  console.log("\n2. Testing chaincode evaluate transaction...");

  const functionName = process.env.FABRIC_TEST_FUNCTION || "GetWalletBalance";
  const args = process.env.FABRIC_TEST_ARGS
    ? JSON.parse(process.env.FABRIC_TEST_ARGS)
    : ["WALLET_58EA9FD8FEE72D0BDC99B6801853AEA06C0AD8C1"];

  const result = await fabricService.evaluateTransaction(functionName, args);

  console.log("\n3. Fabric evaluate result:");
  console.log(JSON.stringify(result, null, 2));

  if (!result.success) {
    console.log("\nFabric SDK connection worked, but chaincode returned an error.");
    process.exit(1);
  }

  console.log("\nFabric SDK connection test completed successfully.");
}

main().catch((error) => {
  console.error("Fabric SDK connection test failed.");
  console.error(error);
  process.exit(1);
});
```

Validate:

```bash
node -c scripts/test-fabric-connection.js
```

---

## 12. Add NPM Scripts

Open:

```bash
nano package.json
```

Add under `scripts`:

```json
"fabric:import-admin": "node scripts/import-admin-identity.js",
"fabric:test": "node scripts/test-fabric-connection.js"
```

Validate:

```bash
node -e "JSON.parse(require('fs').readFileSync('package.json')); console.log('package.json is valid');"
```

---

## 13. Required Fabric Network Fixes Applied During Step 20

### 13.1 CouchDB Docker network alias fix

The peers must resolve:

```text
couchdb0.org1
couchdb0.org2
```

Temporary fix used:

```bash
PEER_NET=$(docker inspect -f '{{range $name, $net := .NetworkSettings.Networks}}{{println $name}}{{end}}' orderer.blockchain.local | head -n 1)

docker network connect --alias couchdb0.org1 $PEER_NET couchdb0.org1 2>/dev/null || true
docker network connect --alias couchdb0.org2 $PEER_NET couchdb0.org2 2>/dev/null || true

docker restart peer0.org1.blockchain.local
docker restart peer0.org2.blockchain.local
```

Verify:

```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | egrep "peer|couch|orderer"
```

---

### 13.2 TLS validation

```bash
openssl s_client \
-connect 127.0.0.1:7051 \
-servername peer0.org1.blockchain.local \
-CAfile /home/nix/u01/blockchain-integration/fabric-network/organizations/peerOrganizations/org1.blockchain.local/peers/peer0.org1.blockchain.local/tls/ca.crt \
-brief
```

Expected:

```text
CONNECTION ESTABLISHED
Verification: OK
```

---

### 13.3 Chaincode lifecycle final fix

The final working committed chaincode definition is:

```text
Version: 2.3
Sequence: 5
Policy: OR('Org1MSP.peer','Org2MSP.peer')
Package ID: kyc-wallet-chaincode-js_2.0:6e8c84bd5b4452a10783e6988a6e07d2bcdc392f7a44d269ffa9f76776a4e708
```

Commands used:

```bash
cd /home/nix/u01/blockchain-integration/fabric-network

export FABRIC_CFG_PATH=/home/nix/u01/blockchain-integration/fabric/fabric-samples/config
export CORE_PEER_TLS_ENABLED=true

export CHANNEL_NAME=kycchannelnix1
export CC_NAME=kyc-wallet-chaincode-js
export CC_VERSION=2.3
export CC_SEQUENCE=5
export CC_PACKAGE_ID="kyc-wallet-chaincode-js_2.0:6e8c84bd5b4452a10783e6988a6e07d2bcdc392f7a44d269ffa9f76776a4e708"

export ORDERER_ADDRESS=localhost:7050
export ORDERER_HOSTNAME=orderer.blockchain.local
export ORDERER_CA=/home/nix/u01/blockchain-integration/fabric-network/organizations/ordererOrganizations/blockchain.local/orderers/orderer.blockchain.local/msp/tlscacerts/tlsca.blockchain.local-cert.pem

export ORG1_TLS_ROOTCERT=/home/nix/u01/blockchain-integration/fabric-network/organizations/peerOrganizations/org1.blockchain.local/peers/peer0.org1.blockchain.local/tls/ca.crt
export ORG2_TLS_ROOTCERT=/home/nix/u01/blockchain-integration/fabric-network/organizations/peerOrganizations/org2.blockchain.local/peers/peer0.org2.blockchain.local/tls/ca.crt
```

Approve Org1:

```bash
export CORE_PEER_LOCALMSPID=Org1MSP
export CORE_PEER_ADDRESS=localhost:7051
export CORE_PEER_TLS_ROOTCERT_FILE=$ORG1_TLS_ROOTCERT
export CORE_PEER_MSPCONFIGPATH=/home/nix/u01/blockchain-integration/fabric-network/organizations/peerOrganizations/org1.blockchain.local/users/Admin@org1.blockchain.local/msp

peer lifecycle chaincode approveformyorg \
  -o $ORDERER_ADDRESS \
  --ordererTLSHostnameOverride $ORDERER_HOSTNAME \
  --tls \
  --cafile $ORDERER_CA \
  --channelID $CHANNEL_NAME \
  --name $CC_NAME \
  --version $CC_VERSION \
  --package-id $CC_PACKAGE_ID \
  --sequence $CC_SEQUENCE \
  --signature-policy "OR('Org1MSP.peer','Org2MSP.peer')"
```

Approve Org2:

```bash
export CORE_PEER_LOCALMSPID=Org2MSP
export CORE_PEER_ADDRESS=localhost:9051
export CORE_PEER_TLS_ROOTCERT_FILE=$ORG2_TLS_ROOTCERT
export CORE_PEER_MSPCONFIGPATH=/home/nix/u01/blockchain-integration/fabric-network/organizations/peerOrganizations/org2.blockchain.local/users/Admin@org2.blockchain.local/msp

peer lifecycle chaincode approveformyorg \
  -o $ORDERER_ADDRESS \
  --ordererTLSHostnameOverride $ORDERER_HOSTNAME \
  --tls \
  --cafile $ORDERER_CA \
  --channelID $CHANNEL_NAME \
  --name $CC_NAME \
  --version $CC_VERSION \
  --package-id $CC_PACKAGE_ID \
  --sequence $CC_SEQUENCE \
  --signature-policy "OR('Org1MSP.peer','Org2MSP.peer')"
```

Check readiness:

```bash
peer lifecycle chaincode checkcommitreadiness \
  --channelID $CHANNEL_NAME \
  --name $CC_NAME \
  --version $CC_VERSION \
  --sequence $CC_SEQUENCE \
  --signature-policy "OR('Org1MSP.peer','Org2MSP.peer')" \
  --output json
```

Commit:

```bash
peer lifecycle chaincode commit \
  -o $ORDERER_ADDRESS \
  --ordererTLSHostnameOverride $ORDERER_HOSTNAME \
  --tls \
  --cafile $ORDERER_CA \
  -C $CHANNEL_NAME \
  -n $CC_NAME \
  --version $CC_VERSION \
  --sequence $CC_SEQUENCE \
  --signature-policy "OR('Org1MSP.peer','Org2MSP.peer')" \
  --peerAddresses localhost:7051 \
  --tlsRootCertFiles $ORG1_TLS_ROOTCERT \
  --peerAddresses localhost:9051 \
  --tlsRootCertFiles $ORG2_TLS_ROOTCERT
```

Confirm:

```bash
peer lifecycle chaincode querycommitted \
  -C $CHANNEL_NAME \
  -n $CC_NAME
```

Expected:

```text
Version: 2.3, Sequence: 5, Approvals: [Org1MSP: true, Org2MSP: true]
```

---

## 14. Start API

```bash
cd /home/nix/u01/blockchain-integration/blockchain-api
pkill -f "node src/server.js" || true
npm start
```

---

## 15. Test API Health and Fabric Status

```bash
curl http://127.0.0.1:3001/
curl http://127.0.0.1:3001/api/v1/health
curl http://127.0.0.1:3001/api/v1/fabric/status
```

---

## 16. Test Submit Transaction — Create Wallet

```bash
curl -X POST http://127.0.0.1:3001/api/v1/fabric/submit \
-H "Content-Type: application/json" \
-d '{
  "functionName": "CreateWallet",
  "args": [
    "CUST_API_2008",
    "BANK001",
    "Nicolas Salloum",
    "NID_HASH_API_2008",
    "MOBILE_HASH_API_2008",
    "EMAIL_HASH_API_2008",
    "PASSWORD_HASH_API_2008",
    "1000"
  ]
}'
```

Successful verified response:

```json
{
  "success": true,
  "type": "submit",
  "channelName": "kycchannelnix1",
  "chaincodeName": "kyc-wallet-chaincode-js",
  "functionName": "CreateWallet",
  "data": {
    "success": true,
    "message": "Wallet created successfully",
    "data": {
      "wallet": {
        "walletAddress": "WALLET_58EA9FD8FEE72D0BDC99B6801853AEA06C0AD8C1",
        "customerId": "CUST_API_2008",
        "organizationId": "BANK001",
        "balance": 1000,
        "currency": "TOKEN",
        "status": "ACTIVE"
      }
    }
  },
  "commit": {
    "transactionId": "75e23daee3a74f7f721050fc540dc42b3165f67e82603aeb0d3cf2384a262c5b",
    "successful": true,
    "code": 0
  }
}
```

---

## 17. Test Evaluate Transaction — Balance

```bash
curl -X POST http://127.0.0.1:3001/api/v1/fabric/evaluate \
-H "Content-Type: application/json" \
-d '{
  "functionName": "GetWalletBalance",
  "args": ["WALLET_58EA9FD8FEE72D0BDC99B6801853AEA06C0AD8C1"]
}'
```

---

## 18. Full Validation Commands

```bash
node -c src/services/fabric.service.js
node -c src/controllers/fabric.controller.js
node -c src/routes/fabric.routes.js
node -c src/app.js
node -c src/server.js
node -c scripts/import-admin-identity.js
node -c scripts/test-fabric-connection.js

node -e "JSON.parse(require('fs').readFileSync('config/connection-org1.json')); console.log('Connection profile valid')"
node -e "JSON.parse(require('fs').readFileSync('package.json')); console.log('package.json valid')"

grep -n "contract.submitTransaction" src/services/fabric.service.js
grep -n "newProposal\|endorsingOrganizations" src/services/fabric.service.js
```

Expected:

```text
contract.submitTransaction returns no output.
newProposal and endorsingOrganizations appear.
```

---

## 19. Troubleshooting Summary

### Error: `FABRIC_MSP_ID is required` / `FABRIC_IDENTITY is required`

Fix `.env`:

```env
FABRIC_MSP_ID=Org1MSP
FABRIC_IDENTITY=admin
FABRIC_ORG_MSP_ID=Org1MSP
FABRIC_IDENTITY_LABEL=admin
```

---

### Error: route not found `/api/v1/fabric/submit`

Fix `src/app.js`:

```js
const fabricRoutes = require("./routes/fabric.routes");
app.use(`${API_PREFIX}/fabric`, fabricRoutes);
```

Make sure route registration is before the 404 handler.

---

### Error: `Cannot read properties of undefined (reading 'prefix')`

Fix `src/app.js`:

```js
const API_PREFIX = config.api?.prefix || process.env.API_PREFIX || "/api/v1";
```

---

### Error: `ECONNREFUSED 127.0.0.1:7051`

Check:

```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep peer0.org1
ss -tulpn | grep 7051
nc -vz 127.0.0.1 7051
```

---

### Error: TLS handshake failed

Check:

```bash
openssl s_client \
-connect 127.0.0.1:7051 \
-servername peer0.org1.blockchain.local \
-CAfile /home/nix/u01/blockchain-integration/fabric-network/organizations/peerOrganizations/org1.blockchain.local/peers/peer0.org1.blockchain.local/tls/ca.crt \
-brief
```

---

### Error: peer panic with `couchdb0.org1 no such host`

Fix Docker network aliases:

```bash
PEER_NET=$(docker inspect -f '{{range $name, $net := .NetworkSettings.Networks}}{{println $name}}{{end}}' orderer.blockchain.local | head -n 1)

docker network connect --alias couchdb0.org1 $PEER_NET couchdb0.org1 2>/dev/null || true
docker network connect --alias couchdb0.org2 $PEER_NET couchdb0.org2 2>/dev/null || true

docker restart peer0.org1.blockchain.local peer0.org2.blockchain.local
```

---

### Error: `no combination of peers can be derived which satisfy the endorsement policy`

Fixes applied:

1. Recommit chaincode with:

```text
OR('Org1MSP.peer','Org2MSP.peer')
```

2. Use explicit SDK endorsement:

```js
const proposal = connection.contract.newProposal(functionName, {
  arguments: normalizedArgs,
  endorsingOrganizations: ["Org1MSP"]
});
```

3. Make sure old code is removed:

```bash
grep -n "contract.submitTransaction" src/services/fabric.service.js
```

Expected: no output.

---

### Error: `chaincode definition exists, but chaincode is not installed`

Fix: approve and commit lifecycle definition using `--package-id`.

Final working definition:

```text
Version: 2.3
Sequence: 5
Package ID: kyc-wallet-chaincode-js_2.0:6e8c84bd5b4452a10783e6988a6e07d2bcdc392f7a44d269ffa9f76776a4e708
```

---

## 20. Step 20 Completion Checklist

| Item | Status |
|---|---:|
| Fabric Gateway SDK installed | ✅ |
| Connection profile created | ✅ |
| Wallet identity import script created | ✅ |
| Admin identity loaded | ✅ |
| Fabric service created | ✅ |
| Evaluate transaction method created | ✅ |
| Submit transaction method created with explicit endorsement | ✅ |
| Fabric API controller created | ✅ |
| Fabric API routes created | ✅ |
| App route registration fixed | ✅ |
| CouchDB peer network fixed | ✅ |
| Peer TLS verified | ✅ |
| Chaincode package binding fixed | ✅ |
| Endorsement policy fixed | ✅ |
| API CreateWallet submit verified | ✅ |
| API ready for Step 21 | ✅ |

---

## Final Result

After Step 20, the Node.js Blockchain API can connect directly to Hyperledger Fabric and call chaincode through:

```text
GET  /api/v1/fabric/status
POST /api/v1/fabric/evaluate
POST /api/v1/fabric/submit
```

Final verified integration path:

```text
Node.js Blockchain API
        ↓
Fabric Gateway SDK
        ↓
Org1 Peer: peer0.org1.blockchain.local:7051
        ↓
Channel: kycchannelnix1
        ↓
Chaincode: kyc-wallet-chaincode-js
        ↓
CouchDB World State
```

Step 20 is complete and ready for:

```text
STEP 21 — API Business Endpoints Integration
```
