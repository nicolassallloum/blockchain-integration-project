#!/usr/bin/env node

const workerService = require('../src/services/audit-blockchain-proof-worker.service');
const db = require('../src/config/database');

function parseArgs(argv) {
  const options = {};

  for (const arg of argv) {
    if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--loop') {
      options.loop = true;
    } else if (arg === '--stop-on-error') {
      options.stopOnError = true;
    } else if (arg.startsWith('--limit=')) {
      options.limit = Number(arg.split('=')[1]);
    } else if (arg.startsWith('--delay-ms=')) {
      options.delayMs = Number(arg.split('=')[1]);
    } else if (arg.startsWith('--interval-ms=')) {
      options.intervalMs = Number(arg.split('=')[1]);
    } else if (arg.startsWith('--worker-name=')) {
      options.workerName = arg.split('=').slice(1).join('=');
    }
  }

  return options;
}

async function closeDbPool() {
  if (db.pool && typeof db.pool.end === 'function') {
    await db.pool.end().catch(() => {});
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.loop) {
    console.log('[AUDIT_OUTBOX_WORKER] Starting loop mode');
    console.log(workerService.normalizeWorkerOptions(options));

    await workerService.runLoop(options, async (batch) => {
      console.log('[AUDIT_OUTBOX_WORKER] Batch complete');
      console.log(JSON.stringify(batch, null, 2));
    });

    await closeDbPool();
    return;
  }

  const result = await workerService.runBatch(options);
  console.log(JSON.stringify(result, null, 2));
  await closeDbPool();
}

main().catch(async (error) => {
  console.error('[AUDIT_OUTBOX_WORKER_ERROR]');
  console.error(error);
  await closeDbPool();
  process.exit(1);
});
