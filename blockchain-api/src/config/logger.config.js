const path = require("path");
const winston = require("winston");

const logLevel = process.env.LOG_LEVEL || "info";
const logToFile = process.env.LOG_TO_FILE === "true";

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack }) => {
    return `${timestamp} [${level.toUpperCase()}]: ${stack || message}`;
  })
);

const transports = [
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      logFormat
    )
  })
];

if (logToFile) {
  transports.push(
    new winston.transports.File({
      filename: path.join(__dirname, "../logs/error.log"),
      level: "error"
    }),
    new winston.transports.File({
      filename: path.join(__dirname, "../logs/app.log")
    })
  );
}

const logger = winston.createLogger({
  level: logLevel,
  format: logFormat,
  transports,
  exitOnError: false
});

module.exports = logger;
