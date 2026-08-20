# BKYC Benchmark Fix

This patch fixes two issues:

1. Fabric commit metadata may contain JavaScript `BigInt` values (especially `blockNumber`). The runner now serializes BigInt values as strings instead of treating a successful delete as a cleanup failure.
2. `--dry-run` now previews all stages without requiring the extreme-run confirmation token. The confirmation is still required before actually executing stages above 10,000.

## Install

```bash
cd ~/u01/blockchain-integration

cp benchmark_kyc.js \
  "benchmark_kyc.js.before_bigint_fix_$(date +%Y%m%d_%H%M%S)"

cp run_bkyc_benchmark_suite.js \
  "run_bkyc_benchmark_suite.js.before_bigint_fix_$(date +%Y%m%d_%H%M%S)"

mv benchmark_kyc_full_payload_fixed.js benchmark_kyc.js
mv run_bkyc_benchmark_suite_fixed.js run_bkyc_benchmark_suite.js

chmod 750 benchmark_kyc.js run_bkyc_benchmark_suite.js
node --check benchmark_kyc.js
node --check run_bkyc_benchmark_suite.js
```

## Verify one record

```bash
export API_BASE_URL="http://127.0.0.1:3001"
export BENCHMARK_RUN_ID="BKYC_$(date +%Y%m%d_%H%M%S)"

node benchmark_kyc.js \
  --count 1 \
  --concurrency 1 \
  --run-id "$BENCHMARK_RUN_ID" \
  | tee "benchmark_${BENCHMARK_RUN_ID}.log"
```

Expected final cleanup values:

```text
Deleted             : 1
Delete failures     : 0
Verified absent     : 1
Remaining           : 0
```

## Preview all stages

```bash
node run_bkyc_benchmark_suite.js --dry-run
```

## Run through 1,000

```bash
node run_bkyc_benchmark_suite.js \
  --max-count 1000 \
  --pause-seconds 10 \
  | tee "bkyc_suite_to_1000_$(date +%Y%m%d_%H%M%S).log"
```

The previous 5,000-customer execution did remove all 5,000 records from current world state. The reported 5,000 delete failures were false reporting caused by BigInt serialization after each successful Fabric commit.
