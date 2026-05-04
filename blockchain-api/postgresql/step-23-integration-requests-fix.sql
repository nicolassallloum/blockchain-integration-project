BEGIN;

ALTER TABLE blockchain.integration_requests
ADD COLUMN IF NOT EXISTS request_type VARCHAR(100);

ALTER TABLE blockchain.integration_requests
ADD COLUMN IF NOT EXISTS request_source VARCHAR(100);

ALTER TABLE blockchain.integration_requests
ADD COLUMN IF NOT EXISTS source_system VARCHAR(100);

ALTER TABLE blockchain.integration_requests
ADD COLUMN IF NOT EXISTS reference_id VARCHAR(150);

ALTER TABLE blockchain.integration_requests
ADD COLUMN IF NOT EXISTS request_payload JSONB DEFAULT '{}'::jsonb;

ALTER TABLE blockchain.integration_requests
ADD COLUMN IF NOT EXISTS request_status VARCHAR(50) DEFAULT 'RECEIVED';

ALTER TABLE blockchain.integration_requests
ADD COLUMN IF NOT EXISTS response_payload JSONB DEFAULT '{}'::jsonb;

ALTER TABLE blockchain.integration_requests
ADD COLUMN IF NOT EXISTS error_code VARCHAR(100);

ALTER TABLE blockchain.integration_requests
ADD COLUMN IF NOT EXISTS error_message TEXT;

ALTER TABLE blockchain.integration_requests
ADD COLUMN IF NOT EXISTS created_by VARCHAR(100);

ALTER TABLE blockchain.integration_requests
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();

ALTER TABLE blockchain.integration_requests
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_integration_requests_request_id
ON blockchain.integration_requests(request_id);

CREATE INDEX IF NOT EXISTS idx_integration_requests_request_type
ON blockchain.integration_requests(request_type);

CREATE INDEX IF NOT EXISTS idx_integration_requests_status
ON blockchain.integration_requests(request_status);

CREATE INDEX IF NOT EXISTS idx_integration_requests_reference_id
ON blockchain.integration_requests(reference_id);

COMMIT;
