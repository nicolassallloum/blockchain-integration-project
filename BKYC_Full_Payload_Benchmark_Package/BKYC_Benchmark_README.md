# BKYC Benchmark — Full VALOORES Payload

This package submits `BLOCKCHAIN_ONLY` KYC customers through:

`POST /api/v1/valoores-blockchain/customers`

Each generated request uses the complete VALOORES `formData` structure supplied for the test. The top-level `customer_id` and `formData.CUSTOMER_ID` are always identical. After each run, only customer IDs recorded in that run's creation manifest are deleted through the Fabric `DeleteResident` transaction and verified absent from current world state.

## Files

- `benchmark_kyc_full_payload.js`: one benchmark stage.
- `run_bkyc_benchmark_suite.js`: sequential suite runner.

On the server, install them as:

```bash
cd ~/u01/blockchain-integration
cp benchmark_kyc.js "benchmark_kyc.js.backup_$(date +%Y%m%d_%H%M%S)"
mv benchmark_kyc_full_payload.js benchmark_kyc.js
chmod 750 benchmark_kyc.js run_bkyc_benchmark_suite.js
node --check benchmark_kyc.js
node --check run_bkyc_benchmark_suite.js
```

## Inspect the full generated request without running a large test

Run one record first:

```bash
export API_BASE_URL="http://127.0.0.1:3001"
export BENCHMARK_RUN_ID="BKYC_$(date +%Y%m%d_%H%M%S)"

node benchmark_kyc.js \
  --count 1 \
  --concurrency 1 \
  --run-id "$BENCHMARK_RUN_ID"
```

The exact request is saved to:

```text
benchmark-results/${BENCHMARK_RUN_ID}_payload_sample.json
```

## Safe staged suite

Preview the plan only:

```bash
node run_bkyc_benchmark_suite.js \
  --max-count 1000 \
  --dry-run
```

Run through 1,000:

```bash
node run_bkyc_benchmark_suite.js \
  --max-count 1000 \
  --pause-seconds 10
```

Run 5,000 and 10,000 after reviewing the first suite:

```bash
node run_bkyc_benchmark_suite.js \
  --counts 5000,10000 \
  --pause-seconds 30
```

The extreme stages create and later delete many current-world-state records, but all create/delete transactions remain permanently in blockchain history. Run them only on a dedicated benchmark channel or approved performance environment:

```bash
node run_bkyc_benchmark_suite.js \
  --counts 20000,50000,100000 \
  --pause-seconds 60 \
  --confirm-extreme I_UNDERSTAND_BLOCKCHAIN_HISTORY_IS_PERMANENT
```

## Requested count plan

`1, 5, 10, 20, 50, 100, 200, 500, 1000, 5000, 10000, 20000, 50000, 100000`

The suite stops automatically when a stage has create failures, delete failures, or remaining current-world-state records. Use `--continue-on-failure` only for controlled troubleshooting.
