#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="${1:-$HOME/u01/blockchain-integration}"
RUNNER="$PROJECT_ROOT/benchmark_kyc.js"
SUITE="$PROJECT_ROOT/run_bkyc_benchmark_suite.js"
STAMP="$(date +%Y%m%d_%H%M%S)"

[[ -f "$RUNNER" ]] || { echo "Missing: $RUNNER" >&2; exit 1; }
[[ -f "$SUITE" ]] || { echo "Missing: $SUITE" >&2; exit 1; }

cp "$RUNNER" "$RUNNER.before_bigint_fix_$STAMP"
cp "$SUITE" "$SUITE.before_bigint_fix_$STAMP"

python3 - "$RUNNER" "$SUITE" <<'PY'
from pathlib import Path
import sys

runner = Path(sys.argv[1])
suite = Path(sys.argv[2])

text = runner.read_text()

old_writer = """function writeJsonLine(stream, value) {
  stream.write(`${JSON.stringify(value)}\\n`);
}
"""
new_writer = """function jsonReplacer(_key, value) {
  return typeof value === 'bigint' ? value.toString() : value;
}

function safeStringify(value, space) {
  return JSON.stringify(value, jsonReplacer, space);
}

function writeJsonLine(stream, value) {
  stream.write(`${safeStringify(value)}\\n`);
}
"""

if old_writer in text:
    text = text.replace(old_writer, new_writer, 1)
elif "function safeStringify(value, space)" not in text:
    raise SystemExit("Could not locate writeJsonLine() in benchmark_kyc.js")

text = text.replace(
    "throw new Error(`API health check failed: ${JSON.stringify(health.body)}`);",
    "throw new Error(`API health check failed: ${safeStringify(health.body)}`);"
)
text = text.replace("body: JSON.stringify(payload)", "body: safeStringify(payload)")
text = text.replace(
    "throw new Error(`Delete commit was not successful: ${JSON.stringify(commit)}`);",
    "throw new Error(`Delete commit was not successful: ${safeStringify(commit)}`);"
)
text = text.replace(
    "deleteBlockNumber: result?.commitStatus?.blockNumber || null",
    "deleteBlockNumber:\n            result?.commitStatus?.blockNumber == null\n              ? null\n              : String(result.commitStatus.blockNumber)"
)
text = text.replace(
    "fs.writeFileSync(reportFile, JSON.stringify(report, null, 2), 'utf8');",
    "fs.writeFileSync(reportFile, safeStringify(report, 2), 'utf8');"
)
runner.write_text(text)

suite_text = suite.read_text()
suite_text = suite_text.replace(
    "if (Math.max(...counts) > 10000 && extremeConfirmation !== EXTREME_CONFIRMATION) {",
    "if (!dryRun && Math.max(...counts) > 10000 && extremeConfirmation !== EXTREME_CONFIRMATION) {"
)
suite.write_text(suite_text)
PY

node --check "$RUNNER"
node --check "$SUITE"

echo "[PASS] BKYC BigInt and dry-run fixes applied."
echo "Runner backup: $RUNNER.before_bigint_fix_$STAMP"
echo "Suite backup : $SUITE.before_bigint_fix_$STAMP"