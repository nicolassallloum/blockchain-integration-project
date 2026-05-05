'use strict';

const crypto = require('crypto');

function generateRequestId() {
  return `REQ_${crypto.randomBytes(12).toString('hex').toUpperCase()}`;
}

function requestIdMiddleware(req, res, next) {
  const incomingRequestId =
    req.headers['x-request-id'] ||
    req.headers['x-correlation-id'] ||
    null;

  const incomingCorrelationId =
    req.headers['x-correlation-id'] ||
    incomingRequestId ||
    null;

  const requestId = incomingRequestId || generateRequestId();
  const correlationId = incomingCorrelationId || requestId;

  req.requestId = requestId;
  req.correlationId = correlationId;

  req.sourceSystem =
    req.headers['x-source-system'] ||
    req.body?.sourceSystem ||
    req.query?.sourceSystem ||
    'BLOCKCHAIN_API';

  req.requestSource =
    req.headers['x-request-source'] ||
    req.body?.requestSource ||
    req.query?.requestSource ||
    'API';

  req.requestStartTime = Date.now();

  res.setHeader('x-request-id', requestId);
  res.setHeader('x-correlation-id', correlationId);

  next();
}

module.exports = requestIdMiddleware;