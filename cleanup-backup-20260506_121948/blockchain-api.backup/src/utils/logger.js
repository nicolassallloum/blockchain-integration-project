const fs = require("fs");
const path = require("path");
const winston = require("winston");

let config = {};

try {
  config = require("../config/config");
} catch (error) {
  config = {};
}

const loggingConfig = config.logging || {};

const appLogPath =
  loggingConfig.appLogPath ||
  process.env.APP_LOG_PATH ||
  "logs/app.log";

const errorLogPath =
  loggingConfig.errorLogPath ||
  process.env.ERROR_LOG_PATH ||
  "logs/error.log";

const logLevel =
  loggingConfig.level ||
  process.env.LOG_LEVEL ||
  "info";

const appLogDirectory = path.dirname(appLogPath);
const errorLogDirectory = path.dirname(errorLogPath);

if (!fs.existsSync(appLogDirectory)) {
  fs.mkdirSync(appLogDirectory, { recursive: true });
}

if (!fs.existsSync(errorLogDirectory)) {
  fs.mkdirSync(errorLogDirectory, { recursive: true });
}

const logger = winston.createLogger({
  level: logLevel,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: {
    service: process.env.APP_NAME || "Blockchain API Middleware",
  },
  transports: [
    new winston.transports.File({
      filename: errorLogPath,
      level: "error",
    }),
    new winston.transports.File({
      filename: appLogPath,
    }),
  ],
});

if (process.env.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    })
  );
}

module.exports = logger;
