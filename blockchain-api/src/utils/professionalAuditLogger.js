const fs = require('fs');
const path = require('path');

const LOG_DIR = path.resolve(
  __dirname,
  '../../logs/license-audit'
);

fs.mkdirSync(LOG_DIR, {
  recursive: true
});

function pad(value, size = 2) {
  return String(value).padStart(size, '0');
}

function getLocalDateKey() {
  const d = new Date();

  return [
    d.getFullYear(),
    pad(d.getMonth() + 1),
    pad(d.getDate())
  ].join('-');
}

function getLocalTimestamp() {
  const d = new Date();

  return (
    `${d.getFullYear()}-` +
    `${pad(d.getMonth() + 1)}-` +
    `${pad(d.getDate())}T` +
    `${pad(d.getHours())}:` +
    `${pad(d.getMinutes())}:` +
    `${pad(d.getSeconds())}.` +
    `${pad(d.getMilliseconds(), 3)}`
  );
}

/*
 * NEVER allow these values into audit logs.
 */
const BLOCKED_KEYS = new Set([
  'password',
  'walletpassword',
  'newwalletpassword',

  'recoverywords',
  'recoveryphrase',
  'mnemonic',
  'phrase',

  'privatekey',

  'resettoken',

  'encryptedwalletjson',

  'signature',

  'signedjwt',
  'licensehash',

  'worddigest1',
  'worddigest2',

  'authorization',
  'cookie',
  'set-cookie'
]);

function sanitize(value) {
  if (value === null || value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(sanitize);
  }

  if (typeof value !== 'object') {
    return value;
  }

  const result = {};

  for (const [key, item] of Object.entries(value)) {

    if (
      BLOCKED_KEYS.has(
        String(key).toLowerCase()
      )
    ) {
      result[key] = '[REDACTED]';
      continue;
    }

    result[key] = sanitize(item);
  }

  return result;
}

function requestSnapshot(request) {
  if (!request) {
    return {};
  }

  return sanitize({
    method:
      request.method,

    url:
      request.originalUrl ||
      request.url,

    ip:
      request.headers?.['x-forwarded-for'] ||
      request.socket?.remoteAddress ||
      null,

    origin:
      request.headers?.origin ||
      null,

    userAgent:
      request.headers?.['user-agent'] ||
      null,

    contentType:
      request.headers?.['content-type'] ||
      null,

    requestId:
      request.requestId ||
      request.headers?.['x-request-id'] ||
      null,

    correlationId:
      request.correlationId ||
      request.headers?.['x-correlation-id'] ||
      null,

    params:
      request.params || {},

    query:
      request.query || {},

    body:
      request.body || {}
  });
}

function audit(
  event,
  status,
  details = {}
) {
  try {
    const date =
      getLocalDateKey();

    const filename =
      path.join(
        LOG_DIR,
        `blockchain-license-${date}.log`
      );

    const normalizedStatus =
      String(status || 'INFO')
        .toUpperCase();

    let level = 'INFO';

    if (
      normalizedStatus === 'SUCCESS'
    ) {
      level = 'SUCCESS';
    }

    if (
      normalizedStatus === 'FAILED' ||
      normalizedStatus === 'WARNING'
    ) {
      level = 'WARN';
    }

    if (
      normalizedStatus === 'ERROR'
    ) {
      level = 'ERROR';
    }

    const record = sanitize({
      timestamp:
        getLocalTimestamp(),

      level,

      event,

      status:
        normalizedStatus,

      ...details
    });

    const line =
      JSON.stringify(record);

    fs.appendFileSync(
      filename,
      `${line}\n`,
      'utf8'
    );

    /*
     * Optional raw audit output in backend log.
     *
     * Enable with:
     * AUDIT_STDOUT=1
     */
    if (
      process.env.AUDIT_STDOUT === '1'
    ) {
      console.log(
        `[BLOCKCHAIN_AUDIT] ${line}`
      );
    }

  } catch (error) {
    console.error(
      '[AUDIT_LOGGER_ERROR]',
      error.message
    );
  }
}

function httpAuditMiddleware(
  request,
  response,
  next
) {
  const startedAt =
    process.hrtime.bigint();

  response.on(
    'finish',
    () => {

      const finishedAt =
        process.hrtime.bigint();

      const durationMs =
        Number(
          finishedAt - startedAt
        ) / 1_000_000;

      let status = 'SUCCESS';

      if (
        response.statusCode >= 400 &&
        response.statusCode < 500
      ) {
        status = 'FAILED';
      }

      if (
        response.statusCode >= 500
      ) {
        status = 'ERROR';
      }

      audit(
        'HTTP_REQUEST',
        status,
        {
          request:
            requestSnapshot(request),

          response: {
            statusCode:
              response.statusCode,

            statusMessage:
              response.statusMessage,

            durationMs:
              Number(
                durationMs.toFixed(2)
              )
          }
        }
      );
    }
  );

  next();
}

module.exports = {
  audit,
  sanitize,
  requestSnapshot,
  httpAuditMiddleware
};
