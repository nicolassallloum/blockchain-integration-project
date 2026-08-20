BEGIN;

ALTER TABLE blockchain.blockchain_kyc_wallet_requests
  ADD COLUMN IF NOT EXISTS full_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS storage_mode VARCHAR(40);

UPDATE blockchain.blockchain_kyc_wallet_requests
SET storage_mode = 'POSTGRES_AND_BLOCKCHAIN'
WHERE storage_mode IS NULL;

ALTER TABLE blockchain.blockchain_kyc_wallet_requests
  ALTER COLUMN storage_mode SET DEFAULT 'POSTGRES_AND_BLOCKCHAIN',
  ALTER COLUMN storage_mode SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_blockchain_kyc_wallet_requests_storage_mode'
      AND conrelid = 'blockchain.blockchain_kyc_wallet_requests'::regclass
  ) THEN
    ALTER TABLE blockchain.blockchain_kyc_wallet_requests
      ADD CONSTRAINT chk_blockchain_kyc_wallet_requests_storage_mode
      CHECK (
        storage_mode IN (
          'POSTGRES_ONLY',
          'BLOCKCHAIN_ONLY',
          'POSTGRES_AND_BLOCKCHAIN'
        )
      );
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_blockchain_kyc_wallet_requests_customer_id
  ON blockchain.blockchain_kyc_wallet_requests (customer_id);

CREATE INDEX IF NOT EXISTS idx_blockchain_kyc_wallet_requests_storage_status
  ON blockchain.blockchain_kyc_wallet_requests (storage_mode, request_status);

COMMIT;
