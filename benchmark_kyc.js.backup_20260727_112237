'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { performance } = require('node:perf_hooks');

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      out[key] = true;
    } else {
      out[key] = next;
      i += 1;
    }
  }
  return out;
}

function positiveInt(value, fallback, max = Number.MAX_SAFE_INTEGER) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

function percentile(values, p) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)
  );
  return sorted[index];
}

async function fetchJson(url, options = {}, timeoutMs = 60000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    const text = await response.text();
    let body;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = { raw: text };
    }
    return { status: response.status, body };
  } finally {
    clearTimeout(timer);
  }
}

function loadFabricService(projectRoot) {
  const apiRoot = path.join(projectRoot, 'blockchain-api');
  try {
    require(path.join(apiRoot, 'node_modules', 'dotenv')).config({
      path: path.join(apiRoot, '.env')
    });
  } catch (error) {
    console.warn(`[WARN] dotenv was not loaded: ${error.message}`);
  }

  return require(path.join(
    apiRoot,
    'src',
    'services',
    'fabric.service.js'
  ));
}

async function runWorkers(total, concurrency, worker) {
  let next = 0;
  const runners = Array.from({ length: concurrency }, async () => {
    while (true) {
      const current = next;
      next += 1;
      if (current >= total) return;
      await worker(current);
    }
  });
  await Promise.all(runners);
}

async function main() {
  const args = parseArgs(process.argv);
  const projectRoot = __dirname;
  const apiBaseUrl = String(
    args['api-base-url'] || process.env.API_BASE_URL || 'http://127.0.0.1:3001'
  ).replace(/\/$/, '');
  const count = positiveInt(args.count, 1, 10000);
  const concurrency = positiveInt(args.concurrency, 1, 100);
  const cleanupConcurrency = positiveInt(
    args['cleanup-concurrency'],
    Math.min(concurrency, 10),
    20
  );
  const timeoutMs = positiveInt(args['timeout-ms'], 60000, 300000);
  const runId = String(
    args['run-id'] ||
      process.env.BENCHMARK_RUN_ID ||
      `BKYC_${new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)}`
  );
  const keepRecords = args.keep === true;
  const confirmLarge = args['confirm-large'] === true;

  if (count > 1000 && !confirmLarge) {
    throw new Error(
      'Count above 1000 requires --confirm-large. Start with --count 1.'
    );
  }

  const idPrefix = String(
    args['id-prefix'] || `99${Math.floor(Date.now() / 1000)}`
  );

  if (!/^99\d+$/.test(idPrefix)) {
    throw new Error('The benchmark ID prefix must contain digits and start with 99.');
  }

  const outputDir = path.join(projectRoot, 'benchmark-results');
  fs.mkdirSync(outputDir, { recursive: true });
  const safeRunId = runId.replace(/[^A-Za-z0-9_-]/g, '_');
  const createdFile = path.join(outputDir, `${safeRunId}_created.jsonl`);
  const cleanupFile = path.join(outputDir, `${safeRunId}_cleanup.jsonl`);
  const reportFile = path.join(outputDir, `${safeRunId}_report.json`);

  fs.writeFileSync(createdFile, '', 'utf8');
  fs.writeFileSync(cleanupFile, '', 'utf8');

  console.log('============================================================');
  console.log('BKYC FABRIC BENCHMARK');
  console.log('============================================================');
  console.log(`Run ID              : ${runId}`);
  console.log(`API                  : ${apiBaseUrl}`);
  console.log(`Count                : ${count}`);
  console.log(`Concurrency          : ${concurrency}`);
  console.log(`Cleanup              : ${keepRecords ? 'DISABLED' : 'ENABLED'}`);
  console.log(`Benchmark ID prefix  : ${idPrefix}`);
  console.log(`Created manifest     : ${createdFile}`);
  console.log('============================================================');

  const health = await fetchJson(
    `${apiBaseUrl}/api/v1/health`,
    { method: 'GET' },
    timeoutMs
  );

  if (health.status !== 200 || health.body?.success !== true) {
    throw new Error(`API health check failed: ${JSON.stringify(health.body)}`);
  }

  console.log('[PASS] API health check succeeded.');

  const created = [];
  const failures = [];
  const latencies = [];
  let stopRequested = false;

  process.on('SIGINT', () => {
    if (!stopRequested) {
      stopRequested = true;
      console.log('\n[STOP] Ctrl+C received. No new creates will start; cleanup will follow.');
    }
  });

  const creationStarted = performance.now();
  let nextSequence = 0;

  async function createOne() {
    if (stopRequested) return;

    nextSequence += 1;
    const sequence = nextSequence;
    const customerId = `${idPrefix}${String(sequence).padStart(6, '0')}`;
    const residentId = `VALOORES-${customerId}`;

    const payload = {
      storageMode: 'BLOCKCHAIN_ONLY',
      customer_id: customerId,
      session_id: runId,
      formData: {
        CUSTOMER_NAME: `BENCHMARK ${runId} ${String(sequence).padStart(6, '0')}`,
        CUSTOMER_TYPE: 'BENCHMARK',
        BRANCH: 'BENCHMARK',
        COMMENTS:
          `BENCHMARK_RUN_ID=${runId};` +
          `SEQUENCE=${sequence};DELETE_AFTER_TEST=true`,
        IS_RESIDENT: 'N'
      }
    };

    const started = performance.now();
    try {
      const response = await fetchJson(
        `${apiBaseUrl}/api/v1/valoores-blockchain/customers`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        },
        timeoutMs
      );

      const latencyMs = Math.round(performance.now() - started);
      const data = response.body?.data || {};
      const commitSuccessful = data.fabricResult?.commitStatus?.successful;
      const success =
        response.status === 201 &&
        response.body?.success === true &&
        data.blockchainSaved === true &&
        data.postgresSaved === false &&
        commitSuccessful !== false;

      if (!success) {
        failures.push({
          sequence,
          customerId,
          residentId,
          latencyMs,
          httpStatus: response.status,
          response: response.body
        });
        console.error(`[CREATE FAILED] ${customerId} HTTP ${response.status}`);
        return;
      }

      latencies.push(latencyMs);
      const record = {
        sequence,
        customerId,
        residentId: data.fabricResidentId || residentId,
        ledgerKey: data.ledgerKey || `KYC_${residentId}`,
        transactionId: data.blockchainTransactionId || null,
        blockNumber: data.fabricResult?.commitStatus?.blockNumber || null,
        latencyMs
      };
      created.push(record);
      fs.appendFileSync(createdFile, `${JSON.stringify(record)}\n`, 'utf8');

      if (count <= 20 || created.length % 10 === 0 || created.length === count) {
        console.log(
          `[CREATED] ${created.length}/${count} ${customerId} ${latencyMs} ms`
        );
      }
    } catch (error) {
      const latencyMs = Math.round(performance.now() - started);
      failures.push({
        sequence,
        customerId,
        residentId,
        latencyMs,
        error: error.message
      });
      console.error(`[CREATE ERROR] ${customerId}: ${error.message}`);
    }
  }

  await runWorkers(count, concurrency, createOne);
  const creationDurationMs = Math.round(performance.now() - creationStarted);

  const creationSummary = {
    attempted: nextSequence,
    created: created.length,
    failed: failures.length,
    durationMs: creationDurationMs,
    throughputTps:
      creationDurationMs > 0
        ? Number((created.length / (creationDurationMs / 1000)).toFixed(3))
        : 0,
    minLatencyMs: latencies.length ? Math.min(...latencies) : 0,
    averageLatencyMs: latencies.length
      ? Number((latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(2))
      : 0,
    p50LatencyMs: percentile(latencies, 50),
    p95LatencyMs: percentile(latencies, 95),
    p99LatencyMs: percentile(latencies, 99),
    maxLatencyMs: latencies.length ? Math.max(...latencies) : 0
  };

  console.log('\n[CREATION SUMMARY]');
  console.table(creationSummary);

  const cleanup = {
    attempted: 0,
    deleted: 0,
    failed: 0,
    verifiedAbsent: 0,
    remaining: 0,
    failures: []
  };

  let fabricService = null;

  if (!keepRecords && created.length > 0) {
    fabricService = loadFabricService(projectRoot);
    console.log('\n[CLEANUP] Deleting only records created in this run...');

    await runWorkers(created.length, cleanupConcurrency, async (index) => {
      const record = created[index];
      cleanup.attempted += 1;

      if (!record.customerId.startsWith(idPrefix)) {
        const message = 'Safety check rejected a customer ID outside this run prefix.';
        cleanup.failed += 1;
        cleanup.failures.push({ ...record, error: message });
        return;
      }

      try {
        const result = await fabricService.submitTransaction(
          'DeleteResident',
          [record.residentId, `Benchmark cleanup for ${runId}`],
          {
            requestId: `BENCHMARK-DELETE-${runId}-${record.customerId}`,
            correlationId: runId,
            sourceSystem: 'BENCHMARK',
            requestSource: 'LOCAL_SCRIPT',
            createdBy: 'BENCHMARK_SERVICE'
          }
        );

        const commit = result?.commitStatus;
        const committed =
          !commit || commit.successful === true || Number(commit.code) === 0;

        if (!committed) {
          throw new Error(`Delete commit was not successful: ${JSON.stringify(commit)}`);
        }

        cleanup.deleted += 1;
        fs.appendFileSync(
          cleanupFile,
          `${JSON.stringify({
            ...record,
            deleted: true,
            deleteTransactionId:
              result?.transactionId ||
              result?.txId ||
              result?.commitStatus?.transactionId ||
              null
          })}\n`,
          'utf8'
        );
      } catch (error) {
        cleanup.failed += 1;
        cleanup.failures.push({ ...record, error: error.message });
        fs.appendFileSync(
          cleanupFile,
          `${JSON.stringify({ ...record, deleted: false, error: error.message })}\n`,
          'utf8'
        );
        console.error(`[DELETE ERROR] ${record.customerId}: ${error.message}`);
      }
    });

    console.log('[CLEANUP] Verifying current Fabric world state...');

    await runWorkers(created.length, cleanupConcurrency, async (index) => {
      const record = created[index];
      try {
        await fabricService.evaluateTransaction(
          'GetResident',
          [record.residentId],
          {
            requestId: `BENCHMARK-VERIFY-DELETE-${runId}-${record.customerId}`,
            correlationId: runId,
            sourceSystem: 'BENCHMARK',
            requestSource: 'LOCAL_SCRIPT'
          }
        );
        cleanup.remaining += 1;
      } catch (error) {
        if (/not found|does not exist/i.test(error.message)) {
          cleanup.verifiedAbsent += 1;
        } else {
          cleanup.remaining += 1;
          cleanup.failures.push({
            ...record,
            error: `Delete verification failed: ${error.message}`
          });
        }
      }
    });
  }

  const report = {
    runId,
    generatedAt: new Date().toISOString(),
    apiBaseUrl,
    configuration: {
      count,
      concurrency,
      cleanupConcurrency,
      timeoutMs,
      idPrefix,
      cleanupEnabled: !keepRecords
    },
    creation: creationSummary,
    creationFailures: failures,
    cleanup,
    files: {
      createdManifest: createdFile,
      cleanupManifest: cleanupFile,
      report: reportFile
    }
  };

  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2), 'utf8');

  console.log('\n[FINAL RESULT]');
  console.log(`Created             : ${created.length}`);
  console.log(`Creation failures   : ${failures.length}`);
  console.log(`Deleted             : ${cleanup.deleted}`);
  console.log(`Verified absent     : ${cleanup.verifiedAbsent}`);
  console.log(`Remaining           : ${cleanup.remaining}`);
  console.log(`Report              : ${reportFile}`);

  if (fabricService && typeof fabricService.disconnect === 'function') {
    try {
      await fabricService.disconnect();
    } catch (error) {
      console.warn(`[WARN] Fabric disconnect failed: ${error.message}`);
    }
  }

  if (failures.length > 0 || cleanup.failed > 0 || cleanup.remaining > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`[FATAL] ${error.stack || error.message}`);
  process.exitCode = 1;
});
