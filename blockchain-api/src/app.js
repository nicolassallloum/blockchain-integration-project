const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const rateLimit = require("express-rate-limit");

const appConfig = require("./config/app.config");
const requestLogger = require("./middlewares/requestLogger.middleware");
const notFoundMiddleware = require("./middlewares/notFound.middleware");
const errorHandlerMiddleware = require("./middlewares/errorHandler.middleware");
const routes = require("./routes");

const app = express();

app.disable("x-powered-by");

app.use(helmet());

app.use(
  cors({
    origin: appConfig.corsOrigin === "*" ? "*" : appConfig.corsOrigin.split(","),
    credentials: true
  })
);

app.use(compression());

app.use(
  rateLimit({
    windowMs: appConfig.rateLimit.windowMinutes * 60 * 1000,
    max: appConfig.rateLimit.maxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      message: "Too many requests. Please try again later."
    }
  })
);

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

app.use(requestLogger);

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Blockchain API Middleware is running",
    apiPrefix: appConfig.apiPrefix,
    health: `${appConfig.apiPrefix}/health`,
    blockchainStatus: `${appConfig.apiPrefix}/blockchain/status`,
    timestamp: new Date().toISOString()
  });
});

app.use(appConfig.apiPrefix, routes);

app.use(notFoundMiddleware);
app.use(errorHandlerMiddleware);

module.exports = app;
