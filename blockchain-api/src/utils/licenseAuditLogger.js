const fs = require('fs');
const path = require('path');

const LOG_DIR = path.resolve(
  __dirname,
  '../../logs'
);

fs.mkdirSync(
  LOG_DIR,
  { recursive: true }
);

function getLebanonDate() {
  const parts = new Intl.DateTimeFormat(
    'en-CA',
    {
      timeZone: 'Asia/Beirut',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }
  ).formatToParts(new Date());

  const values = {};

  for (const part of parts) {
    values[part.type] = part.value;
  }

  return `${values.year}-${values.month}-${values.day}`;
}

function getLebanonTimestamp() {
  return new Intl.DateTimeFormat(
    'sv-SE',
    {
      timeZone: 'Asia/Beirut',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }
  )
    .format(new Date())
    .replace(' ', 'T');
}

function sanitize(value) {
  if (!value || typeof value !== 'object') {
    return value;
  }

  const blockedKeys = [
    'password',
    'walletPassword',
    'newWalletPassword',
    'recoveryWords',
    'mnemonic',
    'phrase',
    'privateKey',
    'resetToken',
    'encryptedWalletJson',
    'wordDigest1',
    'wordDigest2',
    'signature',
    'signedJwt',
    'licenseHash'
  ];

  const output = {};

  for (const [key, item] of Object.entries(value)) {
    if (
      blockedKeys.some(
        blocked =>
          key.toLowerCase() === blocked.toLowerCase()
      )
    ) {
      output[key] = '[REDACTED]';
      continue;
    }

    if (
      item &&
      typeof item === 'object'
    ) {
      output[key] = sanitize(item);
    } else {
      output[key] = item;
    }
  }

  return output;
}

function licenseAudit(
  event,
  status,
  details = {}
) {
  try {
    const date = getLebanonDate();

    const file =
      path.join(
        LOG_DIR,
        `blockchain-license-${date}.log`
      );

    const record = {
      timestamp: getLebanonTimestamp(),
      event,
      status,
      ...sanitize(details)
    };

    const line =
      JSON.stringify(record);

    fs.appendFileSync(
      file,
      `${line}\n`,
      'utf8'
    );

    /*
     * Also display it in PuTTY /
     * blockchain-api.log.
     */
    console.log(
      `[LICENSE-AUDIT] ${line}`
    );

  } catch (error) {
    console.error(
      '[LICENSE-AUDIT-LOGGER-ERROR]',
      error.message
    );
  }
}

module.exports = {
  licenseAudit
};
