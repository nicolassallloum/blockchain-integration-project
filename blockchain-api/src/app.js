"use strict";

const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const compression = require("compression");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");

const config = require("./config");
const logger = require("./utils/logger");

const routes = require("./routes");

const notFoundHandler = require("./middleware/notFoundHandler");
const errorHandler = require("./middleware/errorHandler");

const app = express();

if (config.security.helmetEnabled) {
  app.use(helmet());
}

app.use(
  cors({
    origin(origin, callback) {
      const allowedOrigins = config.security.corsAllowedOrigins;

      if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

if (config.security.compressionEnabled) {
  app.use(compression());
}

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

app.use(
  morgan("combined", {
    stream: {
      write: (message) => logger.info(message.trim()),
    },
  })
);

if (config.rateLimit.enabled) {
  app.use(
    rateLimit({
      windowMs: config.rateLimit.windowMs,
      max: config.rateLimit.maxRequests,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        success: false,
        message: "Too many requests. Please try again later.",
        data: null,
        meta: null,
      },
    })
  );
}

app.get("/", (req, res) => {
  return res.status(200).json({
    success: true,
    message: `${config.app.name} is running`,
    apiPrefix: config.app.apiPrefix,
    health: `${config.app.apiPrefix}/health`,
    blockchainStatus: `${config.app.apiPrefix}/blockchain/status`,
    timestamp: new Date().toISOString(),
  });
});

app.use(config.app.apiPrefix, routes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;