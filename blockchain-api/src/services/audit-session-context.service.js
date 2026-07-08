'use strict';

const os = require('os');
const { AsyncLocalStorage } = require('async_hooks');
const { randomUUID } = require('crypto');

const MAX_VALUE_LENGTH = 512;
const auditSessionStorage = new AsyncLocalStorage();

function cleanString(value, fallback = 'unknown') {
  if (value === undefined || value === null) return fallback;

  const text = String(value)
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!text) return fallback;

  return text.length > MAX_VALUE_LENGTH
    ? text.slice(0, MAX_VALUE_LENGTH)
    : text;
}

function firstHeader(req, name) {
  const value = req.headers?.[name.toLowerCase()];
  if (Array.isArray(value)) return value[0];
  return value;
}

function resolveClientIp(req) {
  const forwardedFor = firstHeader(req, 'x-forwarded-for');

  if (forwardedFor) {
    return cleanString(String(forwardedFor).split(',')[0], 'unknown');
  }

  return cleanString(
    req.ip ||
      req.socket?.remoteAddress ||
      req.connection?.remoteAddress ||
      'unknown',
    'unknown'
  );
}

function resolveClientHostname(req) {
  return cleanString(
    firstHeader(req, 'x-client-hostname') ||
      firstHeader(req, 'x-hostname') ||
      firstHeader(req, 'x-pc-name') ||
      firstHeader(req, 'host') ||
      os.hostname(),
    'unknown'
  );
}

function resolveUserId(req) {
  return cleanString(
    req.user?.userId ||
      req.user?.user_id ||
      req.user?.id ||
      req.user?.customerId ||
      req.user?.customer_id ||
      req.user?.walletAddress ||
      req.user?.wallet_address ||
      req.headers?.['x-user-id'] ||
      'anonymous',
    'anonymous'
  );
}

function resolveUsername(req) {
  return cleanString(
    req.user?.username ||
      req.user?.email ||
      req.user?.name ||
      req.user?.walletAddress ||
      req.user?.wallet_address ||
      req.headers?.['x-username'] ||
      resolveUserId(req),
    'anonymous'
  );
}

function resolveUserRole(req) {
  const role =
    req.user?.role ||
    req.user?.userRole ||
    req.user?.user_role ||
    req.user?.roles?.[0] ||
    req.headers?.['x-user-role'];

  return cleanString(role, 'UNKNOWN');
}

function resolveRequestId(req) {
  const requestId =
    req.requestId ||
    req.headers?.['x-request-id'] ||
    req.headers?.['x-correlation-id'] ||
    randomUUID();

  return cleanString(requestId, randomUUID());
}

function buildAuditSessionContext(req) {
  const requestId = resolveRequestId(req);

  return {
    username: resolveUsername(req),
    user_id: resolveUserId(req),
    user_role: resolveUserRole(req),
    client_ip: resolveClientIp(req),
    client_hostname: resolveClientHostname(req),
    user_agent: cleanString(req.headers?.['user-agent'], 'unknown'),
    request_id: requestId
  };
}

async function setAuditSessionContext(client, context = {}) {
  if (!client || typeof client.query !== 'function') {
    throw new Error('setAuditSessionContext requires a PostgreSQL client');
  }

  const safeContext = {
    username: cleanString(context.username, 'anonymous'),
    user_id: cleanString(context.user_id, 'anonymous'),
    user_role: cleanString(context.user_role, 'UNKNOWN'),
    client_ip: cleanString(context.client_ip, 'unknown'),
    client_hostname: cleanString(context.client_hostname, 'unknown'),
    user_agent: cleanString(context.user_agent, 'unknown'),
    request_id: cleanString(context.request_id, randomUUID())
  };

  await client.query(
    `
    SELECT
      set_config('app.username', $1, true),
      set_config('app.user_id', $2, true),
      set_config('app.user_role', $3, true),
      set_config('app.client_ip', $4, true),
      set_config('app.client_hostname', $5, true),
      set_config('app.user_agent', $6, true),
      set_config('app.request_id', $7, true)
    `,
    [
      safeContext.username,
      safeContext.user_id,
      safeContext.user_role,
      safeContext.client_ip,
      safeContext.client_hostname,
      safeContext.user_agent,
      safeContext.request_id
    ]
  );

  return safeContext;
}

function runWithAuditRequestContext(context, callback) {
  if (typeof callback !== 'function') {
    throw new Error('runWithAuditRequestContext requires a callback');
  }

  const safeContext = {
    username: cleanString(context?.username, 'anonymous'),
    user_id: cleanString(context?.user_id, 'anonymous'),
    user_role: cleanString(context?.user_role, 'UNKNOWN'),
    client_ip: cleanString(context?.client_ip, 'unknown'),
    client_hostname: cleanString(context?.client_hostname, 'unknown'),
    user_agent: cleanString(context?.user_agent, 'unknown'),
    request_id: cleanString(context?.request_id, randomUUID()),
    request: context?.request || null
  };

  return auditSessionStorage.run(safeContext, callback);
}

function getCurrentAuditSessionContext() {
  return auditSessionStorage.getStore() || null;
}

function refreshCurrentAuditSessionContext(req) {
  const store = auditSessionStorage.getStore();

  if (!store) {
    return null;
  }

  const request = req || store.request;

  if (!request) {
    return store;
  }

  const refreshed = buildAuditSessionContext(request);

  Object.assign(store, refreshed);

  if (!store.request) {
    store.request = request;
  }

  return store;
}

async function withAuditSessionContext(pool, context, callback) {
  if (!pool || typeof pool.connect !== 'function') {
    throw new Error('withAuditSessionContext requires a PostgreSQL pool');
  }

  if (typeof callback !== 'function') {
    throw new Error('withAuditSessionContext requires a callback');
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const safeContext = await setAuditSessionContext(client, context);
    const result = await callback(client, safeContext);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      error.rollbackError = rollbackError;
    }

    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  buildAuditSessionContext,
  runWithAuditRequestContext,
  getCurrentAuditSessionContext,
  refreshCurrentAuditSessionContext,
  setAuditSessionContext,
  withAuditSessionContext
};
