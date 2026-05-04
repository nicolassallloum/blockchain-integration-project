require("dotenv").config();

const appConfig = {
  env: process.env.NODE_ENV || "development",
  name: process.env.APP_NAME || "Blockchain API Middleware",
  version: process.env.APP_VERSION || "1.0.0",

  host: process.env.HOST || "0.0.0.0",
  port: Number(process.env.PORT || 3001),

  apiPrefix: process.env.API_PREFIX || "/api/v1",

  corsOrigin: process.env.CORS_ORIGIN || "*",

  rateLimit: {
    windowMinutes: Number(process.env.RATE_LIMIT_WINDOW_MINUTES || 15),
    maxRequests: Number(process.env.RATE_LIMIT_MAX_REQUESTS || 200)
  }
};

module.exports = appConfig;
