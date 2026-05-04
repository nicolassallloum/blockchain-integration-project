"use strict";

const fs = require("fs");
const path = require("path");
const winston = require("winston");
const config = require("../config");

const logDirectory = path.dirname(config.logging.appLogPath);

if (!fs.existsSync(logDirectory)) {
  fs.mkdirSync(logDirectory, { recursive: true });
}

const logFormat =
  config.logging.format === "json"
    ? winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      )
    : winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const metaText = Object.keys(meta).length
            ? JSON.stringify(meta, null, 2)
            : "";

          return `${timestamp} [${level}]: ${message} ${metaText}`;
        })
      );

const transports = [
  new winston.transports.Console({
    level: config.logging.level,
  }),
];

if (config.logging.toFile) {
  transports.push(
    new winston.transports.File({
      filename: config.logging.appLogPath,
      level: config.logging.level,
    })
  );

  transports.push(
    new winston.transports.File({
      filename: config.logging.errorLogPath,
      level: "error",
    })
  );
}

const logger = winston.createLogger({
  level: config.logging.level,
  format: logFormat,
  defaultMeta: {
    service: config.app.name,
    environment: config.app.env,
  },
  transports,
  exitOnError: false,
});

module.exports = logger;
