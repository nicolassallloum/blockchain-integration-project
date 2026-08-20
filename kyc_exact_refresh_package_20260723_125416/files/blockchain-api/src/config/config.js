logging: {
  level: process.env.LOG_LEVEL || "info",
  appLogPath: process.env.APP_LOG_PATH || "logs/app.log",
  errorLogPath: process.env.ERROR_LOG_PATH || "logs/error.log",
},
