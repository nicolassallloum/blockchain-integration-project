"use strict";

const config = require("../config");

function apiKeyMiddleware(req, res, next) {
  const incomingApiKey = req.headers[config.apiKey.header];

  if (!incomingApiKey) {
    return res.status(401).json({
      success: false,
      message: "Missing API key.",
      data: null,
      meta: null,
      timestamp: new Date().toISOString(),
    });
  }

  if (incomingApiKey !== config.apiKey.key) {
    return res.status(403).json({
      success: false,
      message: "Invalid API key.",
      data: null,
      meta: null,
      timestamp: new Date().toISOString(),
    });
  }

  return next();
}

module.exports = apiKeyMiddleware;
