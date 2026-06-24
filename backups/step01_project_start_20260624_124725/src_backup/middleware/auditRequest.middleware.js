'use strict';

const auditService = require('../services/audit.service');

const {
  AUDIT_EVENT_TYPES,
  AUDIT_EVENT_STATUS,
  AUDIT_EVENT_CATEGORY
} = require('../constants/audit.constants');

async function auditRequestMiddleware(req, res, next) {
  const requestContext = auditService.buildRequestContext(req);

  try {
    await auditService.log({
      ...requestContext,
      eventType: AUDIT_EVENT_TYPES.API_REQUEST,
      eventCategory: AUDIT_EVENT_CATEGORY.API,
      eventStatus: AUDIT_EVENT_STATUS.PENDING,
      requestPayload: req.body || null,
      metadata: {
        query: req.query || null,
        params: req.params || null,
        headers: {
          'x-request-id': req.headers['x-request-id'] || null,
          'x-correlation-id': req.headers['x-correlation-id'] || null,
          'x-source-system': req.headers['x-source-system'] || null,
          'x-request-source': req.headers['x-request-source'] || null
        }
      }
    });
  } catch (error) {
    console.error('API request audit failed:', {
      message: error.message,
      requestId: req.requestId,
      correlationId: req.correlationId
    });
  }

  const originalJson = res.json;

  res.json = function patchedJson(body) {
    const durationMs = Date.now() - (req.requestStartTime || Date.now());

    auditService
      .log({
        ...requestContext,
        eventType: AUDIT_EVENT_TYPES.API_RESPONSE,
        eventCategory: AUDIT_EVENT_CATEGORY.API,
        eventStatus:
          res.statusCode >= 400
            ? AUDIT_EVENT_STATUS.FAILED
            : AUDIT_EVENT_STATUS.SUCCESS,
        responsePayload: body,
        durationMs,
        metadata: {
          statusCode: res.statusCode
        }
      })
      .catch((error) => {
        console.error('API response audit failed:', {
          message: error.message,
          requestId: req.requestId,
          correlationId: req.correlationId
        });
      });

    return originalJson.call(this, body);
  };

  next();
}

module.exports = auditRequestMiddleware;