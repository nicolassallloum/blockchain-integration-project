'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const DEFAULT_COUNTS = [
  1, 5, 10, 20, 50, 100, 200, 500, 1000,
  5000, 10000, 20000, 50000, 100000
];

const CONCURRENCY_BY_COUNT = new Map([
  [1, 1],
  [5, 1],
  [10, 2],
  [20, 2],
  [50, 5],
  [100, 5],
  [200, 10],
  [500, 10],
  [1000, 20],
  [5000, 25],
  [10000, 50],
  [20000, 50],
  [50000, 75],
  [100000, 100]
]);

const EXTREME_CONFIRMATION = 'I_UNDERSTAND_BLOCKCHAIN_HISTORY_IS_PERMANENT';


function jsonReplacer(_key, value) {
  return typeof value === 'bigint' ? value.toString() : value;
}

function safeStringify(value, space) {
  return JSON.stringify(value, jsonReplacer, space);
}

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

function dateToken() {
  return new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
}

function parseCounts(value) {
  if (!value) return [...DEFAULT_COUNTS];
  const counts = String(value)
    .split(',')
    .map((item) => Number.parseInt(item.trim(), 10))
    .filter((item) => Number.isInteger(item) && item > 0 && item <= 100000);

  if (counts.length === 0) {
    throw new Error('No valid counts were supplied.');
  }

  return [...new Set(counts)];
}

function runCommand(command, args, cwd, logFile) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(logFile, { flags: 'w' });
    const child = spawn(command, args, {
      cwd,
      stdio: ['inherit', 'pipe', 'pipe'],
      env: process.env
    });

    child.stdout.on('data', (chunk) => {
      process.stdout.write(chunk);
      output.write(chunk);
    });

    child.stderr.on('data', (chunk) => {
      process.stderr.write(chunk);
      output.write(chunk);
    });

    child.once('error', (error) => {
      output.end();
      reject(error);
    });

    child.once('close', (code, signal) => {
      output.end(() => resolve({ code, signal }));
    });
  });
}

function csvEscape(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

async function main() {
  const args = parseArgs(process.argv);
  const projectRoot = __dirname;
  const runner = path.join(projectRoot, 'benchmark_kyc.js');
  const apiBaseUrl = String(
    args['api-base-url'] || process.env.API_BASE_URL || 'http://127.0.0.1:3001'
  ).replace(/\/$/, '');

  if (!fs.existsSync(runner)) {
    throw new Error(`Runner not found: ${runner}`);
  }

  let counts = parseCounts(args.counts);
  const maxCount = Number.parseInt(args['max-count'] || '100000', 10);
  counts = counts.filter((count) => count <= maxCount);

  if (counts.length === 0) {
    throw new Error('No stages remain after applying --max-count.');
  }

  const fixedConcurrency = args.concurrency
    ? Number.parseInt(args.concurrency, 10)
    : null;
  const pauseSeconds = Number.parseInt(args['pause-seconds'] || '10', 10);
  const dryRun = args['dry-run'] === true;
  const continueOnFailure = args['continue-on-failure'] === true;
  const extremeConfirmation = String(args['confirm-extreme'] || '');

  if (!dryRun && Math.max(...counts) > 10000 && extremeConfirmation !== EXTREME_CONFIRMATION) {
    throw new Error(
      `A suite above 10000 requires --confirm-extreme ${EXTREME_CONFIRMATION}`
    );
  }

  const suiteId = String(args['suite-id'] || `BKYC_SUITE_${dateToken()}`);
  const outputDir = path.join(projectRoot, 'benchmark-results', suiteId);
  fs.mkdirSync(outputDir, { recursive: true });

  const plan = counts.map((count) => {
    const concurrency = fixedConcurrency || CONCURRENCY_BY_COUNT.get(count) || 10;
    return {
      count,
      concurrency,
      cleanupConcurrency: Math.min(concurrency, 50),
      runId: `${suiteId}_N${count}`
    };
  });

  console.log('============================================================');
  console.log('BKYC BENCHMARK SUITE PLAN');
  console.log('============================================================');
  console.log(`Suite ID : ${suiteId}`);
  console.log(`API      : ${apiBaseUrl}`);
  console.table(plan);
  console.log('Each stage creates, commits, deletes, and verifies zero remaining.');
  console.log('============================================================');

  fs.writeFileSync(
    path.join(outputDir, 'suite-plan.json'),
    safeStringify({ suiteId, apiBaseUrl, plan }, 2),
    'utf8'
  );

  if (dryRun) {
    console.log('[DRY RUN] No benchmark transactions were submitted.');
    return;
  }

  const results = [];

  for (let index = 0; index < plan.length; index += 1) {
    const stage = plan[index];
    const logFile = path.join(outputDir, `${stage.runId}.log`);

    console.log(`\n[SUITE] Starting stage ${index + 1}/${plan.length}: ${stage.count}`);

    const childArgs = [
      runner,
      '--api-base-url', apiBaseUrl,
      '--count', String(stage.count),
      '--concurrency', String(stage.concurrency),
      '--cleanup-concurrency', String(stage.cleanupConcurrency),
      '--run-id', stage.runId
    ];

    if (stage.count > 1000) childArgs.push('--confirm-large');
    if (stage.count > 10000) {
      childArgs.push('--confirm-extreme', EXTREME_CONFIRMATION);
    }

    const startedAt = new Date().toISOString();
    const execution = await runCommand(process.execPath, childArgs, projectRoot, logFile);
    const finishedAt = new Date().toISOString();

    const reportFile = path.join(
      projectRoot,
      'benchmark-results',
      `${stage.runId}_report.json`
    );

    let report = null;
    if (fs.existsSync(reportFile)) {
      report = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
    }

    const stageResult = {
      ...stage,
      startedAt,
      finishedAt,
      exitCode: execution.code,
      signal: execution.signal,
      logFile,
      reportFile,
      created: report?.creation?.created ?? null,
      failed: report?.creation?.failed ?? null,
      throughputTps: report?.creation?.throughputTps ?? null,
      averageLatencyMs: report?.creation?.averageLatencyMs ?? null,
      p95LatencyMs: report?.creation?.p95LatencyMs ?? null,
      p99LatencyMs: report?.creation?.p99LatencyMs ?? null,
      deleted: report?.cleanup?.deleted ?? null,
      deleteFailures: report?.cleanup?.failed ?? null,
      remaining: report?.cleanup?.remaining ?? null,
      passed:
        execution.code === 0 &&
        report?.creation?.failed === 0 &&
        report?.cleanup?.failed === 0 &&
        report?.cleanup?.remaining === 0
    };

    results.push(stageResult);
    fs.writeFileSync(
      path.join(outputDir, 'suite-results.json'),
      safeStringify({ suiteId, apiBaseUrl, results }, 2),
      'utf8'
    );

    console.log('[SUITE STAGE RESULT]');
    console.table(stageResult);

    if (!stageResult.passed && !continueOnFailure) {
      console.error('[SUITE] Stopping because the stage failed or cleanup was incomplete.');
      break;
    }

    if (index < plan.length - 1 && pauseSeconds > 0) {
      console.log(`[SUITE] Cooling down for ${pauseSeconds} seconds...`);
      await new Promise((resolve) => setTimeout(resolve, pauseSeconds * 1000));
    }
  }

  const csvHeaders = [
    'count',
    'concurrency',
    'created',
    'failed',
    'throughputTps',
    'averageLatencyMs',
    'p95LatencyMs',
    'p99LatencyMs',
    'deleted',
    'deleteFailures',
    'remaining',
    'passed',
    'runId',
    'startedAt',
    'finishedAt'
  ];

  const csvRows = [csvHeaders.map(csvEscape).join(',')];
  for (const result of results) {
    csvRows.push(csvHeaders.map((header) => csvEscape(result[header])).join(','));
  }

  const csvFile = path.join(outputDir, 'suite-results.csv');
  fs.writeFileSync(csvFile, `${csvRows.join('\n')}\n`, 'utf8');

  console.log('\n[SUITE FINAL SUMMARY]');
  console.table(
    results.map((result) => ({
      count: result.count,
      concurrency: result.concurrency,
      created: result.created,
      failed: result.failed,
      tps: result.throughputTps,
      p95Ms: result.p95LatencyMs,
      deleted: result.deleted,
      remaining: result.remaining,
      passed: result.passed
    }))
  );
  console.log(`Suite results: ${path.join(outputDir, 'suite-results.json')}`);
  console.log(`Suite CSV    : ${csvFile}`);

  if (results.some((result) => !result.passed)) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`[FATAL] ${error.stack || error.message}`);
  process.exitCode = 1;
});
