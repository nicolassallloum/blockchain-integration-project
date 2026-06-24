'use strict';

const auditService = require('../services/audit.service');

const {
  AUDIT_EVENT_TYPES,
  AUDIT_EVENT_STATUS,
  AUDIT_EVENT_CATEGORY
} = require('../constants/audit.constants');

function getStatusCode(error) {
  if (error.statusCode) return error.statusCode;
  if (error.status) return error.status;

  if (error.name === 'ValidationError') return 400;
  if (error.name === 'UnauthorizedError') return 401;
  if (error.name === 'ForbiddenError') return 403;
  if (error.name === 'NotFoundError') return 404;

  return 500;
}

function getErrorCode(error, statusCode) {
  if (error.code) return error.code;
  if (error.errorCode) return error.errorCode;

  switch (statusCode) {
    case 400:
      return 'BAD_REQUEST';
    case 401:
      return 'UNAUTHORIZED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 409:
      return 'CONFLICT';
    case 422:
      return 'VALIDATION_ERROR';
    default:
      return 'SYSTEM_ERROR';
  }
}

async function errorMiddleware(error, req, res, next) {
  const statusCode = getStatusCode(error);
  const errorCode = getErrorCode(error, statusCode);

  try {
    await auditService.log({
      ...auditService.buildRequestContext(req),
      eventType: AUDIT_EVENT_TYPES.SYSTEM_ERROR,
      eventCategory: AUDIT_EVENT_CATEGORY.SYSTEM,
      eventStatus:
        statusCode >= 500
          ? AUDIT_EVENT_STATUS.ERROR
          : AUDIT_EVENT_STATUS.FAILED,
      errorCode,
      errorMessage: error.message,
      errorStack: error.stack,
      requestPayload: req.body || null,
      metadata: {
        params: req.params || null,
        query: req.query || null,
        statusCode
      },
      controllerName: 'global.error.middleware',
      serviceName: 'express'
    });
  } catch (auditError) {
    console.error('Failed to write system error audit log:', auditError.message);
  }

  const response = {
    success: false,
    message:
      statusCode >= 500
        ? 'Internal server error'
        : error.message || 'Request failed',
    errorCode,
    data: null,
    requestId: req.requestId || null,
    correlationId: req.correlationId || null
  };

  if (process.env.NODE_ENV !== 'production') {
    response.debug = {
      originalMessage: error.message,
      stack: error.stack
    };
  }

  return res.status(statusCode).json({
    success: false,
    message,
    errorCode: error.code || 'SYSTEM_ERROR',
    data: null,
    requestId: req.requestId,
    correlationId: req.correlationId || req.requestId,
    debug: {
      message: error.message,
      code: error.code,
      detail: error.detail,
      constraint: error.constraint,
      table: error.table,
      column: error.column,
      schema: error.schema
    }
  });
}

module.exports = errorMiddleware;