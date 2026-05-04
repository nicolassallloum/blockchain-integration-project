BEGIN;

ALTER TABLE blockchain.integration_requests
ADD COLUMN IF NOT EXISTS operation_name VARCHAR(150);

UPDATE blockchain.integration_requests
SET operation_name = COALESCE(operation_name, request_type, 'UNKNOWN_OPERATION')
WHERE operation_name IS NULL;

ALTER TABLE blockchain.integration_requests
ALTER COLUMN operation_name SET DEFAULT 'UNKNOWN_OPERATION';

CREATE INDEX IF NOT EXISTS idx_integration_requests_operation_name
ON blockchain.integration_requests(operation_name);

COMMIT;
