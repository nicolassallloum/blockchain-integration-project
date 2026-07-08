'use strict';

const {
  buildAuditSessionContext,
  runWithAuditRequestContext,
  refreshCurrentAuditSessionContext,
  setAuditSessionContext,
  withAuditSessionContext
} = require('../services/audit-session-context.service');

function auditSessionContextMiddleware(req, res, next) {
  try {
    const context = buildAuditSessionContext(req);

    req.auditSessionContext = context;

    if (!req.requestId) {
      req.requestId = context.request_id;
    }

    if (!req.correlationId) {
      req.correlationId = context.request_id;
    }

    res.setHeader('x-request-id', req.requestId);

    req.getAuditSessionContext = function getAuditSessionContext() {
      req.auditSessionContext =
        refreshCurrentAuditSessionContext(req) || buildAuditSessionContext(req);
      return req.auditSessionContext;
    };

    req.setAuditSessionContext = async function setAuditContextOnClient(client) {
      return setAuditSessionContext(client, req.getAuditSessionContext());
    };

    req.withAuditSessionContext = async function runWithAuditContext(pool, callback) {
      return withAuditSessionContext(pool, req.getAuditSessionContext(), callback);
    };

    return runWithAuditRequestContext({ ...context, request: req }, next);
  } catch (error) {
    next(error);
  }
}

module.exports = auditSessionContextMiddleware;
