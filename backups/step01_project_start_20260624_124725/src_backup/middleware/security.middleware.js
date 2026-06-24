"use strict";

/**
 * STEP 28 — Central API Security Middleware
 */

const helmet = require("helmet");
const cors = require("cors");
const hpp = require("hpp");

const securityConfig = require("../config/security.config");
const suspiciousRequestLogger = require("./suspiciousRequest.middleware");
const sqlInjectionProtection = require("./sqlInjectionProtection.middleware");
const { standardRateLimiter } = require("./rateLimit.middleware");

function originValidator(origin, callback) {
  const allowedOrigins = securityConfig.cors.allowedOrigins || [];

  /**
   * Allow curl, Postman, server-to-server requests.
   */
  if (!origin) {
    return callback(null, true);
  }

  /**
   * In development, allow all origins if none are configured.
   */
  if (
    allowedOrigins.length === 0 &&
    (process.env.NODE_ENV || "development") !== "production"
  ) {
    return callback(null, true);
  }

  if (allowedOrigins.includes(origin)) {
    return callback(null, true);
  }

  console.warn(
    JSON.stringify({
      level: "warn",
      event: "CORS_ORIGIN_BLOCKED",
      origin,
      timestamp: new Date().toISOString()
    })
  );

  return callback(null, false);
}

function buildCorsOptions() {
  return {
    origin: originValidator,
    methods: securityConfig.cors.allowedMethods,
    allowedHeaders: securityConfig.cors.allowedHeaders,
    exposedHeaders: securityConfig.cors.exposedHeaders,
    credentials: securityConfig.cors.credentials,
    optionsSuccessStatus: 204
  };
}

function applySecurityMiddleware(app) {
  /**
   * Trust proxy is useful if API is behind Nginx / load balancer.
   */
  app.set("trust proxy", 1);

  /**
   * Secure HTTP headers.
   */
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      referrerPolicy: {
        policy: "no-referrer"
      },
      frameguard: {
        action: "deny"
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      }
    })
  );

  /**
   * CORS restrictions.
   */
  app.use(cors(buildCorsOptions()));

  /**
   * Express 5 / newer router does not accept app.options("*").
   * Use regex instead.
   */
  app.options(/.*/, cors(buildCorsOptions()));

  /**
   * Prevent HTTP Parameter Pollution.
   */
  app.use(hpp());

  /**
   * Suspicious request logging.
   */
  app.use(suspiciousRequestLogger);

  /**
   * SQL injection blocking layer.
   */
  app.use(sqlInjectionProtection);

  /**
   * Global rate limit.
   */
  app.use(standardRateLimiter);
}

module.exports = {
  applySecurityMiddleware
};