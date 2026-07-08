const auditProofService = require('./audit-blockchain-proof.service');

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;
const DEFAULT_DELAY_MS = 0;
const DEFAULT_INTERVAL_MS = 30000;

function normalizeInteger(value, fallback, min = 1, max = MAX_LIMIT) {
  const numberValue = Number(value);

  if (!Number.isInteger(numberValue) || numberValue < min) {
    return fallback;
  }

  return Math.min(numberValue, max);
}

function normalizeBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  return ['1', 'true', 'yes', 'y', 'on'].includes(String(value).toLowerCase());
}

function sleep(ms) {
  const delayMs = Number(ms || 0);

  if (!Number.isFinite(delayMs) || delayMs <= 0) {
    return Promise.resolve();
  }

  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

function mapSuccessResult(result) {
  return {
    ok: true,
    submitted: Boolean(result.submitted),
    dryRun: Boolean(result.dryRun),
    outboxId: result.outboxId || result.outbox?.outboxId || null,
    auditId: result.auditId || result.proofPayload?.auditId || null,
    blockchainKey: result.blockchainKey || result.proofPayload?.blockchainKey || null,
    auditEventHash: result.auditEventHash || result.proofPayload?.auditEventHash || null,
    transactionId: result.transactionId || null,
    message: result.message || null
  };
}

function mapErrorResult(error) {
  return {
    ok: false,
    submitted: false,
    dryRun: false,
    errorName: error.name || 'Error',
    errorCode: error.code || 'AUDIT_OUTBOX_WORKER_ERROR',
    message: error.message
  };
}

function normalizeWorkerOptions(options = {}) {
  const limit = normalizeInteger(
    options.limit ?? process.env.AUDIT_OUTBOX_WORKER_LIMIT,
    DEFAULT_LIMIT,
    1,
    MAX_LIMIT
  );

  const delayMs = normalizeInteger(
    options.delayMs ?? process.env.AUDIT_OUTBOX_WORKER_DELAY_MS,
    DEFAULT_DELAY_MS,
    0,
    60000
  );

  const intervalMs = normalizeInteger(
    options.intervalMs ?? process.env.AUDIT_OUTBOX_WORKER_INTERVAL_MS,
    DEFAULT_INTERVAL_MS,
    1000,
    3600000
  );

  const dryRun = normalizeBoolean(
    options.dryRun ?? process.env.AUDIT_OUTBOX_WORKER_DRY_RUN,
    false
  );

  const stopOnError = normalizeBoolean(
    options.stopOnError ?? process.env.AUDIT_OUTBOX_WORKER_STOP_ON_ERROR,
    false
  );

  const workerName = String(
    options.workerName ||
      process.env.AUDIT_OUTBOX_WORKER_NAME ||
      'audit-outbox-worker'
  ).trim();

  return {
    limit,
    delayMs,
    intervalMs,
    dryRun,
    stopOnError,
    workerName
  };
}

async function runDryRunBatch(config) {
  const candidates = await auditProofService.listOutbox({
    status: 'PENDING',
    limit: config.limit
  });

  const results = [];

  for (const candidate of candidates) {
    try {
      const result = await auditProofService.submitOutboxById(candidate.outboxId, {
        dryRun: true,
        workerName: config.workerName
      });

      results.push(mapSuccessResult(result));
    } catch (error) {
      results.push(mapErrorResult(error));

      if (config.stopOnError) {
        break;
      }
    }

    await sleep(config.delayMs);
  }

  return results;
}

async function runSubmitBatch(config) {
  const results = [];

  for (let index = 0; index < config.limit; index += 1) {
    try {
      const result = await auditProofService.submitNext({
        dryRun: false,
        workerName: config.workerName
      });

      if (!result.submitted) {
        results.push(mapSuccessResult(result));
        break;
      }

      results.push(mapSuccessResult(result));
    } catch (error) {
      results.push(mapErrorResult(error));

      if (config.stopOnError) {
        break;
      }
    }

    await sleep(config.delayMs);
  }

  return results;
}

async function runBatch(options = {}) {
  const config = normalizeWorkerOptions(options);
  const beforeSummary = await auditProofService.getSummary();

  const results = config.dryRun
    ? await runDryRunBatch(config)
    : await runSubmitBatch(config);

  const afterSummary = await auditProofService.getSummary();

  const submittedCount = results.filter((item) => item.ok && item.submitted).length;
  const dryRunCount = results.filter((item) => item.ok && item.dryRun).length;
  const failedCount = results.filter((item) => !item.ok).length;

  return {
    workerName: config.workerName,
    dryRun: config.dryRun,
    limit: config.limit,
    delayMs: config.delayMs,
    stopOnError: config.stopOnError,
    beforeSummary,
    afterSummary,
    resultSummary: {
      attempted: results.length,
      submittedCount,
      dryRunCount,
      failedCount
    },
    results
  };
}

async function runLoop(options = {}, onBatchComplete = null) {
  const config = normalizeWorkerOptions(options);
  let shouldStop = false;

  const stop = () => {
    shouldStop = true;
  };

  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);

  while (!shouldStop) {
    const batch = await runBatch(config);

    if (typeof onBatchComplete === 'function') {
      await onBatchComplete(batch);
    }

    await sleep(config.intervalMs);
  }

  return {
    stopped: true,
    workerName: config.workerName
  };
}

module.exports = {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  DEFAULT_DELAY_MS,
  DEFAULT_INTERVAL_MS,
  normalizeWorkerOptions,
  runBatch,
  runLoop
};
