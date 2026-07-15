# full_server_test_commands.sh
# Replace paths/host values to match your server.

set -euo pipefail

export API_BASE="${API_BASE:-http://172.31.13.90:3000/api/v1}"
export APP_DB_HOST="${POSTGRES_HOST:-127.0.0.1}"
export APP_DB_PORT="${POSTGRES_PORT:-5432}"
export APP_DB_NAME="${POSTGRES_DATABASE:-${POSTGRES_DB:-${DB:-application_db}}}"
export APP_DB_USER="${POSTGRES_USER:-postgres}"

echo "Test 1: Backend health"
curl -sS "$API_BASE/health" | jq . || true

echo "Test 1: Audit events API"
curl -sS "$API_BASE/audit-validation/events?limit=10&offset=0" | jq .

echo "Test 2: Database object inspection"
psql "host=$APP_DB_HOST port=$APP_DB_PORT dbname=$APP_DB_NAME user=$APP_DB_USER" -f sql/002_validate_blockchain_audit_validation_real_objects.sql

echo "Test 3: Trigger inspection"
psql "host=$APP_DB_HOST port=$APP_DB_PORT dbname=$APP_DB_NAME user=$APP_DB_USER" -c "
SELECT event_object_schema, event_object_table, trigger_name, event_manipulation
FROM information_schema.triggers
WHERE trigger_name = 'trg_blockchain_audit_capture'
ORDER BY 1,2,4;
"

echo "Test 4: Data change test"
echo "IMPORTANT: Use only controlled AUDIT_TEST_DO_NOT_USE rows."
echo "Because source/base table columns are project-specific, inspect columns first:"
psql "host=$APP_DB_HOST port=$APP_DB_PORT dbname=$APP_DB_NAME user=$APP_DB_USER" -c "
SELECT
  m.source_object,
  m.source_table_schema,
  m.source_table_name,
  c.column_name,
  c.data_type,
  c.is_nullable,
  c.column_default
FROM blockchain.audit_source_object_map m
JOIN information_schema.columns c
  ON c.table_schema = m.source_table_schema
 AND c.table_name = m.source_table_name
ORDER BY m.source_object, c.ordinal_position;
"

cat <<'SQL_NOTE'
For each base table, create a controlled test row with a marker like AUDIT_TEST_DO_NOT_USE
only after reviewing required columns. Example pattern:

BEGIN;
SET LOCAL app.changed_by = 'AUDIT_TEST_DO_NOT_USE';
SET LOCAL app.application_user = 'compliance_test';
SET LOCAL app.request_id = 'AUDIT_TEST_001';
SET LOCAL app.correlation_id = 'AUDIT_TEST_001';

-- Replace schema.table and columns after inspection:
-- INSERT INTO real_schema.real_base_table(required_col, name, created_at)
-- VALUES ('AUDIT_TEST_DO_NOT_USE', 'AUDIT_TEST_DO_NOT_USE', now());

-- UPDATE real_schema.real_base_table
-- SET name = 'AUDIT_TEST_DO_NOT_USE_UPDATED'
-- WHERE required_col = 'AUDIT_TEST_DO_NOT_USE';

-- DELETE FROM real_schema.real_base_table
-- WHERE required_col = 'AUDIT_TEST_DO_NOT_USE';

COMMIT;
SQL_NOTE

echo "Test 5: Audit event test"
psql "host=$APP_DB_HOST port=$APP_DB_PORT dbname=$APP_DB_NAME user=$APP_DB_USER" -c "
SELECT event_id, source_object, source_table, action_type, record_pk, hash_value, changed_at
FROM blockchain.audit_events
ORDER BY changed_at DESC
LIMIT 20;
"

echo "Pick latest event id"
EVENT_ID="$(psql "host=$APP_DB_HOST port=$APP_DB_PORT dbname=$APP_DB_NAME user=$APP_DB_USER" -Atc "SELECT event_id FROM blockchain.audit_events ORDER BY changed_at DESC LIMIT 1;")"
echo "EVENT_ID=$EVENT_ID"

echo "Test 6: Hash validation test"
curl -sS -X POST "$API_BASE/audit-validation/events/$EVENT_ID/validate" \
  -H 'Content-Type: application/json' \
  -d '{}' | jq .

echo "Test 7: Approval test"
curl -sS -X POST "$API_BASE/audit-validation/events/$EVENT_ID/approve" \
  -H 'Content-Type: application/json' \
  -d '{}' | jq .

echo "Test 8: Blockchain submit test"
curl -sS -X POST "$API_BASE/audit-validation/events/$EVENT_ID/submit-blockchain" \
  -H 'Content-Type: application/json' \
  -d '{}' | jq .

echo "Confirm PostgreSQL blockchain metadata"
psql "host=$APP_DB_HOST port=$APP_DB_PORT dbname=$APP_DB_NAME user=$APP_DB_USER" -c "
SELECT event_id, blockchain_status, blockchain_tx_id, ledger_key, couchdb_doc_id, submitted_at, submit_error
FROM blockchain.audit_events
WHERE event_id = '$EVENT_ID';
"

echo "Test 9: CouchDB verification"
cat <<'COUCH_NOTE'
If CouchDB is enabled:
export COUCHDB_URL="http://user:pass@host:5984"
export COUCHDB_CHAINCODE_DB="kycchannelnix1_kyc-wallet-chaincode-js"
export LEDGER_KEY="$(psql ... -Atc "SELECT ledger_key FROM blockchain.audit_events WHERE event_id = '$EVENT_ID';")"
curl -sS "$COUCHDB_URL/$COUCHDB_CHAINCODE_DB/$LEDGER_KEY" | jq .
COUCH_NOTE

echo "Test 10: UI test"
echo "Open http://172.31.13.90:4200/blockchain/audit-validation"

echo "Test 11: PuTTY monitoring loops"
cat <<'LOOPS'
# Backend API loop
while true; do date; curl -sS "$API_BASE/audit-validation/events?limit=5" | jq '.total, .events[]? | {event_id,source_object,action_type,hash_status,validation_status,blockchain_status}'; sleep 5; done

# PostgreSQL audit count loop
while true; do date; psql "host=$APP_DB_HOST port=$APP_DB_PORT dbname=$APP_DB_NAME user=$APP_DB_USER" -c "SELECT source_object, action_type, blockchain_status, count(*) FROM blockchain.audit_events GROUP BY 1,2,3 ORDER BY 1,2,3;"; sleep 5; done

# Failed submissions loop
while true; do date; psql "host=$APP_DB_HOST port=$APP_DB_PORT dbname=$APP_DB_NAME user=$APP_DB_USER" -c "SELECT event_id, submit_error, updated_at FROM blockchain.audit_events WHERE blockchain_status='FAILED' ORDER BY updated_at DESC LIMIT 10;"; sleep 10; done

# PM2 logs
pm2 logs --lines 100

# Docker logs, if backend runs in Docker
docker logs -f blockchain-backend
LOOPS
