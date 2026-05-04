🔹 STEP 18 — Backend Project Initialization — Node.js API
18.1 Purpose
This step initializes the Blockchain API Middleware using Node.js + Express.
This middleware will sit between:
Angular / Frontend        ↓Spring Boot / Enterprise Systems        ↓Node.js Blockchain API Middleware        ↓Hyperledger Fabric Chaincode        ↓CouchDB / PostgreSQL
Express is still a lightweight routing framework commonly used for APIs, and the npm package requires Node.js 18 or higher. The Express team also released security updates in 2026 for dependency vulnerabilities, so this setup includes npm audit, helmet, structured logging, and clean middleware separation. 

18.2 Final Project Folder Structure
Create this structure:
blockchain-api/│├── package.json├── package-lock.json├── .env├── .env.example├── .gitignore├── README.md│├── src/│   ├── server.js│   ├── app.js│   ││   ├── config/│   │   ├── app.config.js│   │   ├── logger.config.js│   │   └── blockchain.config.js│   ││   ├── routes/│   │   ├── index.js│   │   ├── health.routes.js│   │   └── blockchain.routes.js│   ││   ├── controllers/│   │   ├── health.controller.js│   │   └── blockchain.controller.js│   ││   ├── services/│   │   └── blockchain.service.js│   ││   ├── repositories/│   │   └── blockchain.repository.js│   ││   ├── middlewares/│   │   ├── requestLogger.middleware.js│   │   ├── errorHandler.middleware.js│   │   └── notFound.middleware.js│   ││   ├── utils/│   │   ├── apiResponse.js│   │   └── asyncHandler.js│   ││   └── logs/│       └── .gitkeep

18.3 Exact Commands
Run these commands from your project root:
cd /home/nix/u01/blockchain-integrationmkdir -p blockchain-apicd blockchain-apinpm init -ynpm install express dotenv cors helmet morgan winston compression express-rate-limit uuidnpm install --save-dev nodemon eslint prettiermkdir -p src/configmkdir -p src/routesmkdir -p src/controllersmkdir -p src/servicesmkdir -p src/repositoriesmkdir -p src/middlewaresmkdir -p src/utilsmkdir -p src/logstouch src/server.jstouch src/app.jstouch src/config/app.config.jstouch src/config/logger.config.jstouch src/config/blockchain.config.jstouch src/routes/index.jstouch src/routes/health.routes.jstouch src/routes/blockchain.routes.jstouch src/controllers/health.controller.jstouch src/controllers/blockchain.controller.jstouch src/services/blockchain.service.jstouch src/repositories/blockchain.repository.jstouch src/middlewares/requestLogger.middleware.jstouch src/middlewares/errorHandler.middleware.jstouch src/middlewares/notFound.middleware.jstouch src/utils/apiResponse.jstouch src/utils/asyncHandler.jstouch src/logs/.gitkeeptouch .envtouch .env.exampletouch .gitignoretouch README.md

18.4 Update package.json
Open:
nano package.json
Replace everything with:
{  "name": "blockchain-api",  "version": "1.0.0",  "description": "Blockchain API Middleware for Hyperledger Fabric integration",  "main": "src/server.js",  "type": "commonjs",  "scripts": {    "start": "node src/server.js",    "dev": "nodemon src/server.js",    "audit": "npm audit",    "audit:fix": "npm audit fix",    "lint": "eslint src",    "format": "prettier --write src"  },  "keywords": [    "blockchain",    "hyperledger-fabric",    "express",    "nodejs",    "api-middleware"  ],  "author": "Nix",  "license": "MIT",  "dependencies": {    "compression": "^1.8.1",    "cors": "^2.8.5",    "dotenv": "^17.2.3",    "express": "^5.1.0",    "express-rate-limit": "^8.2.1",    "helmet": "^8.1.0",    "morgan": "^1.10.1",    "uuid": "^13.0.0",    "winston": "^3.19.0"  },  "devDependencies": {    "eslint": "^9.39.1",    "nodemon": "^3.1.11",    "prettier": "^3.7.3"  },  "engines": {    "node": ">=18"  }}
Then run:
npm install

18.5 Create .env
cat > .env <<'EOF'# ==================================================# Blockchain API Middleware Environment# ==================================================NODE_ENV=developmentAPP_NAME=Blockchain API MiddlewareAPP_VERSION=1.0.0HOST=0.0.0.0PORT=3001API_PREFIX=/api/v1# SecurityCORS_ORIGIN=*RATE_LIMIT_WINDOW_MINUTES=15RATE_LIMIT_MAX_REQUESTS=200# Hyperledger Fabric Placeholder ConfigFABRIC_CHANNEL_NAME=kycchannelnix1FABRIC_CHAINCODE_NAME=kyc-wallet-chaincode-jsFABRIC_MSP_ID=Org1MSPFABRIC_WALLET_PATH=/home/nix/u01/blockchain-integration/fabric-network/walletFABRIC_CONNECTION_PROFILE=/home/nix/u01/blockchain-integration/fabric-network/connection-org1.json# LoggingLOG_LEVEL=infoLOG_TO_FILE=trueEOF

18.6 Create .env.example
cat > .env.example <<'EOF'NODE_ENV=developmentAPP_NAME=Blockchain API MiddlewareAPP_VERSION=1.0.0HOST=0.0.0.0PORT=3001API_PREFIX=/api/v1CORS_ORIGIN=*RATE_LIMIT_WINDOW_MINUTES=15RATE_LIMIT_MAX_REQUESTS=200FABRIC_CHANNEL_NAME=kycchannelnix1FABRIC_CHAINCODE_NAME=kyc-wallet-chaincode-jsFABRIC_MSP_ID=Org1MSPFABRIC_WALLET_PATH=/path/to/fabric/walletFABRIC_CONNECTION_PROFILE=/path/to/connection-profile.jsonLOG_LEVEL=infoLOG_TO_FILE=trueEOF

18.7 Create .gitignore
cat > .gitignore <<'EOF'node_modules/.envnpm-debug.log*yarn-debug.log*yarn-error.log*logs/src/logs/*.log.DS_Storecoverage/dist/build/EOF

18.8 Create src/config/app.config.js
cat > src/config/app.config.js <<'EOF'require("dotenv").config();const appConfig = {  env: process.env.NODE_ENV || "development",  name: process.env.APP_NAME || "Blockchain API Middleware",  version: process.env.APP_VERSION || "1.0.0",  host: process.env.HOST || "0.0.0.0",  port: Number(process.env.PORT || 3001),  apiPrefix: process.env.API_PREFIX || "/api/v1",  corsOrigin: process.env.CORS_ORIGIN || "*",  rateLimit: {    windowMinutes: Number(process.env.RATE_LIMIT_WINDOW_MINUTES || 15),    maxRequests: Number(process.env.RATE_LIMIT_MAX_REQUESTS || 200)  }};module.exports = appConfig;EOF

18.9 Create src/config/blockchain.config.js
cat > src/config/blockchain.config.js <<'EOF'require("dotenv").config();const blockchainConfig = {  fabric: {    channelName: process.env.FABRIC_CHANNEL_NAME || "kycchannelnix1",    chaincodeName: process.env.FABRIC_CHAINCODE_NAME || "kyc-wallet-chaincode-js",    mspId: process.env.FABRIC_MSP_ID || "Org1MSP",    walletPath: process.env.FABRIC_WALLET_PATH,    connectionProfile: process.env.FABRIC_CONNECTION_PROFILE  }};module.exports = blockchainConfig;EOF

18.10 Create src/config/logger.config.js
cat > src/config/logger.config.js <<'EOF'const path = require("path");const winston = require("winston");const logLevel = process.env.LOG_LEVEL || "info";const logToFile = process.env.LOG_TO_FILE === "true";const logFormat = winston.format.combine(  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),  winston.format.errors({ stack: true }),  winston.format.printf(({ timestamp, level, message, stack }) => {    return `${timestamp} [${level.toUpperCase()}]: ${stack || message}`;  }));const transports = [  new winston.transports.Console({    format: winston.format.combine(      winston.format.colorize(),      logFormat    )  })];if (logToFile) {  transports.push(    new winston.transports.File({      filename: path.join(__dirname, "../logs/error.log"),      level: "error"    }),    new winston.transports.File({      filename: path.join(__dirname, "../logs/app.log")    })  );}const logger = winston.createLogger({  level: logLevel,  format: logFormat,  transports,  exitOnError: false});module.exports = logger;EOF

18.11 Create src/utils/apiResponse.js
cat > src/utils/apiResponse.js <<'EOF'const successResponse = ({  res,  statusCode = 200,  message = "Success",  data = null,  meta = null}) => {  return res.status(statusCode).json({    success: true,    message,    data,    meta,    timestamp: new Date().toISOString()  });};const errorResponse = ({  res,  statusCode = 500,  message = "Internal Server Error",  errors = null}) => {  return res.status(statusCode).json({    success: false,    message,    errors,    timestamp: new Date().toISOString()  });};module.exports = {  successResponse,  errorResponse};EOF

18.12 Create src/utils/asyncHandler.js
cat > src/utils/asyncHandler.js <<'EOF'const asyncHandler = (fn) => {  return (req, res, next) => {    Promise.resolve(fn(req, res, next)).catch(next);  };};module.exports = asyncHandler;EOF

18.13 Create src/middlewares/requestLogger.middleware.js
cat > src/middlewares/requestLogger.middleware.js <<'EOF'const morgan = require("morgan");const logger = require("../config/logger.config");const stream = {  write: (message) => logger.info(message.trim())};const requestLogger = morgan(  ":method :url :status :res[content-length] - :response-time ms",  { stream });module.exports = requestLogger;EOF

18.14 Create src/middlewares/notFound.middleware.js
cat > src/middlewares/notFound.middleware.js <<'EOF'const { errorResponse } = require("../utils/apiResponse");const notFoundMiddleware = (req, res) => {  return errorResponse({    res,    statusCode: 404,    message: `Route not found: ${req.method} ${req.originalUrl}`  });};module.exports = notFoundMiddleware;EOF

18.15 Create src/middlewares/errorHandler.middleware.js
cat > src/middlewares/errorHandler.middleware.js <<'EOF'const logger = require("../config/logger.config");const { errorResponse } = require("../utils/apiResponse");const errorHandlerMiddleware = (err, req, res, next) => {  const statusCode = err.statusCode || err.status || 500;  logger.error({    message: err.message,    stack: err.stack,    method: req.method,    url: req.originalUrl  });  return errorResponse({    res,    statusCode,    message: statusCode === 500 ? "Internal Server Error" : err.message,    errors: process.env.NODE_ENV === "development" ? err.stack : null  });};module.exports = errorHandlerMiddleware;EOF

18.16 Create src/controllers/health.controller.js
cat > src/controllers/health.controller.js <<'EOF'const os = require("os");const appConfig = require("../config/app.config");const blockchainConfig = require("../config/blockchain.config");const { successResponse } = require("../utils/apiResponse");const getHealthStatus = (req, res) => {  return successResponse({    res,    message: "Blockchain API Middleware is healthy",    data: {      service: appConfig.name,      version: appConfig.version,      environment: appConfig.env,      uptimeSeconds: process.uptime(),      timestamp: new Date().toISOString(),      system: {        hostname: os.hostname(),        platform: os.platform(),        memoryFree: os.freemem(),        memoryTotal: os.totalmem()      },      blockchain: {        channelName: blockchainConfig.fabric.channelName,        chaincodeName: blockchainConfig.fabric.chaincodeName,        mspId: blockchainConfig.fabric.mspId      }    }  });};module.exports = {  getHealthStatus};EOF

18.17 Create src/repositories/blockchain.repository.js
cat > src/repositories/blockchain.repository.js <<'EOF'const blockchainConfig = require("../config/blockchain.config");/** * This repository will later connect to Hyperledger Fabric Gateway SDK. * For STEP 18, it provides a clean placeholder foundation. */class BlockchainRepository {  async getNetworkInfo() {    return {      channelName: blockchainConfig.fabric.channelName,      chaincodeName: blockchainConfig.fabric.chaincodeName,      mspId: blockchainConfig.fabric.mspId,      walletPath: blockchainConfig.fabric.walletPath,      connectionProfile: blockchainConfig.fabric.connectionProfile,      status: "CONFIGURED_PLACEHOLDER"    };  }  async pingLedger() {    return {      ledgerReachable: false,      status: "FABRIC_SDK_NOT_CONNECTED_YET",      message: "Fabric SDK integration will be implemented in the next steps."    };  }}module.exports = new BlockchainRepository();EOF

18.18 Create src/services/blockchain.service.js
cat > src/services/blockchain.service.js <<'EOF'const blockchainRepository = require("../repositories/blockchain.repository");class BlockchainService {  async getMiddlewareStatus() {    const networkInfo = await blockchainRepository.getNetworkInfo();    const ledgerPing = await blockchainRepository.pingLedger();    return {      middleware: {        status: "RUNNING",        component: "Node.js Blockchain API Middleware"      },      fabric: networkInfo,      ledger: ledgerPing    };  }}module.exports = new BlockchainService();EOF

18.19 Create src/controllers/blockchain.controller.js
cat > src/controllers/blockchain.controller.js <<'EOF'const blockchainService = require("../services/blockchain.service");const { successResponse } = require("../utils/apiResponse");const getBlockchainStatus = async (req, res) => {  const status = await blockchainService.getMiddlewareStatus();  return successResponse({    res,    message: "Blockchain middleware status retrieved successfully",    data: status  });};module.exports = {  getBlockchainStatus};EOF

18.20 Create src/routes/health.routes.js
cat > src/routes/health.routes.js <<'EOF'const express = require("express");const healthController = require("../controllers/health.controller");const router = express.Router();router.get("/", healthController.getHealthStatus);module.exports = router;EOF

18.21 Create src/routes/blockchain.routes.js
cat > src/routes/blockchain.routes.js <<'EOF'const express = require("express");const asyncHandler = require("../utils/asyncHandler");const blockchainController = require("../controllers/blockchain.controller");const router = express.Router();router.get("/status", asyncHandler(blockchainController.getBlockchainStatus));/** * Future route placeholders: * * POST   /wallets/create * POST   /wallets/login * POST   /transactions/wallet-transfer * POST   /transactions/organization-transfer * GET    /wallets/:walletAddress/balance * GET    /wallets/:walletAddress/transactions */module.exports = router;EOF

18.22 Create src/routes/index.js
cat > src/routes/index.js <<'EOF'const express = require("express");const healthRoutes = require("./health.routes");const blockchainRoutes = require("./blockchain.routes");const router = express.Router();router.use("/health", healthRoutes);router.use("/blockchain", blockchainRoutes);module.exports = router;EOF

18.23 Create src/app.js
cat > src/app.js <<'EOF'const express = require("express");const cors = require("cors");const helmet = require("helmet");const compression = require("compression");const rateLimit = require("express-rate-limit");const appConfig = require("./config/app.config");const requestLogger = require("./middlewares/requestLogger.middleware");const notFoundMiddleware = require("./middlewares/notFound.middleware");const errorHandlerMiddleware = require("./middlewares/errorHandler.middleware");const routes = require("./routes");const app = express();app.disable("x-powered-by");app.use(helmet());app.use(  cors({    origin: appConfig.corsOrigin === "*" ? "*" : appConfig.corsOrigin.split(","),    credentials: true  }));app.use(compression());app.use(  rateLimit({    windowMs: appConfig.rateLimit.windowMinutes * 60 * 1000,    max: appConfig.rateLimit.maxRequests,    standardHeaders: true,    legacyHeaders: false,    message: {      success: false,      message: "Too many requests. Please try again later."    }  }));app.use(express.json({ limit: "2mb" }));app.use(express.urlencoded({ extended: true, limit: "2mb" }));app.use(requestLogger);app.get("/", (req, res) => {  res.status(200).json({    success: true,    message: "Blockchain API Middleware is running",    apiPrefix: appConfig.apiPrefix,    health: `${appConfig.apiPrefix}/health`,    blockchainStatus: `${appConfig.apiPrefix}/blockchain/status`,    timestamp: new Date().toISOString()  });});app.use(appConfig.apiPrefix, routes);app.use(notFoundMiddleware);app.use(errorHandlerMiddleware);module.exports = app;EOF

18.24 Create src/server.js
cat > src/server.js <<'EOF'const app = require("./app");const appConfig = require("./config/app.config");const logger = require("./config/logger.config");const server = app.listen(appConfig.port, appConfig.host, () => {  logger.info("==================================================");  logger.info(`${appConfig.name} started successfully`);  logger.info(`Environment: ${appConfig.env}`);  logger.info(`Version: ${appConfig.version}`);  logger.info(`URL: http://${appConfig.host}:${appConfig.port}`);  logger.info(`Health Check: http://${appConfig.host}:${appConfig.port}${appConfig.apiPrefix}/health`);  logger.info("==================================================");});const gracefulShutdown = (signal) => {  logger.info(`${signal} received. Shutting down gracefully...`);  server.close(() => {    logger.info("HTTP server closed.");    process.exit(0);  });  setTimeout(() => {    logger.error("Force shutdown after timeout.");    process.exit(1);  }, 10000);};process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));process.on("SIGINT", () => gracefulShutdown("SIGINT"));process.on("unhandledRejection", (reason) => {  logger.error(`Unhandled Rejection: ${reason}`);});process.on("uncaughtException", (error) => {  logger.error(`Uncaught Exception: ${error.message}`);  process.exit(1);});EOF

18.25 Create README.md
cat > README.md <<'EOF'# Blockchain API MiddlewareNode.js + Express API middleware for the Blockchain Integration Project.## PurposeThis service acts as the middleware layer between enterprise applications and Hyperledger Fabric.## Current StepSTEP 18 — Backend Project Initialization — Node.js API## Features Included- Express server setup- Health check endpoint- Blockchain status placeholder endpoint- Route/controller/service/repository structure- Centralized config- Winston logging- Morgan request logging- Error handler- 404 handler- Helmet security headers- CORS- Compression- Rate limiting- Environment variables## Run Development Server```bashnpm run dev
Run Production Server
npm start
Test Endpoints
curl http://127.0.0.1:3001/curl http://127.0.0.1:3001/api/v1/healthcurl http://127.0.0.1:3001/api/v1/blockchain/status
Future Endpoints


POST /api/v1/wallets/create


POST /api/v1/wallets/login


POST /api/v1/transactions/wallet-transfer


POST /api/v1/transactions/organization-transfer


GET /api/v1/wallets/:walletAddress/balance


GET /api/v1/wallets/:walletAddress/transactions
EOF


---# 18.26 Run the API```bashnpm run dev
Expected output:
Blockchain API Middleware started successfullyEnvironment: developmentVersion: 1.0.0URL: http://0.0.0.0:3001Health Check: http://0.0.0.0:3001/api/v1/health

18.27 Test the API
Open another terminal and run:
curl http://127.0.0.1:3001/
Expected response:
{  "success": true,  "message": "Blockchain API Middleware is running",  "apiPrefix": "/api/v1",  "health": "/api/v1/health",  "blockchainStatus": "/api/v1/blockchain/status",  "timestamp": "..."}
Test health endpoint:
curl http://127.0.0.1:3001/api/v1/health
Test blockchain middleware status:
curl http://127.0.0.1:3001/api/v1/blockchain/status
Expected response:
{  "success": true,  "message": "Blockchain middleware status retrieved successfully",  "data": {    "middleware": {      "status": "RUNNING",      "component": "Node.js Blockchain API Middleware"    },    "fabric": {      "channelName": "kycchannelnix1",      "chaincodeName": "kyc-wallet-chaincode-js",      "mspId": "Org1MSP",      "walletPath": "/home/nix/u01/blockchain-integration/fabric-network/wallet",      "connectionProfile": "/home/nix/u01/blockchain-integration/fabric-network/connection-org1.json",      "status": "CONFIGURED_PLACEHOLDER"    },    "ledger": {      "ledgerReachable": false,      "status": "FABRIC_SDK_NOT_CONNECTED_YET",      "message": "Fabric SDK integration will be implemented in the next steps."    }  },  "timestamp": "..."}

18.28 Optional: Run Security Audit
npm audit
If issues appear:
npm audit fix
Because Express had security patch activity in 2026 around path-to-regexp, keep this project updated regularly with:
npm updatenpm audit
The Express team specifically recommended updating affected dependencies when package lock files are present. 

18.29 Optional: Run in Background with PM2 Later
Do not apply this yet unless you are preparing production deployment, but keep it for later:
npm install -g pm2pm2 start src/server.js --name blockchain-apipm2 statuspm2 logs blockchain-apipm2 save

18.30 Final Verification Checklist
[✓] Node.js API project initialized[✓] npm initialized[✓] Express installed[✓] Security middleware added[✓] Logging foundation added[✓] Error handler added[✓] Health endpoint added[✓] Blockchain status placeholder endpoint added[✓] Controller/service/repository structure created[✓] Config structure created[✓] API ready for Fabric SDK integration in next step

18.31 STEP 18 Completion Status
STEP 18 — Backend Project Initialization — Node.js APIStatus: COMPLETEDOutput: Blockchain API Middleware foundation created successfullyNext Step: STEP 19 — Hyperledger Fabric SDK Integration
