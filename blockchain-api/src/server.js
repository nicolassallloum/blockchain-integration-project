const app = require("./app");
const appConfig = require("./config/app.config");
const logger = require("./config/logger.config");

const server = app.listen(appConfig.port, appConfig.host, () => {
  logger.info("==================================================");
  logger.info(`${appConfig.name} started successfully`);
  logger.info(`Environment: ${appConfig.env}`);
  logger.info(`Version: ${appConfig.version}`);
  logger.info(`URL: http://${appConfig.host}:${appConfig.port}`);
  logger.info(`Health Check: http://${appConfig.host}:${appConfig.port}${appConfig.apiPrefix}/health`);
  logger.info("==================================================");
});

const gracefulShutdown = (signal) => {
  logger.info(`${signal} received. Shutting down gracefully...`);

  server.close(() => {
    logger.info("HTTP server closed.");
    process.exit(0);
  });

  setTimeout(() => {
    logger.error("Force shutdown after timeout.");
    process.exit(1);
  }, 10000);
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
  logger.error(`Unhandled Rejection: ${reason}`);
});

process.on("uncaughtException", (error) => {
  logger.error(`Uncaught Exception: ${error.message}`);
  process.exit(1);
});
