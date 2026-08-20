BEGIN;

DROP INDEX IF EXISTS blockchain.idx_blockchain_kyc_wallet_requests_storage_status;
DROP INDEX IF EXISTS blockchain.idx_blockchain_kyc_wallet_requests_customer_id;

ALTER TABLE blockchain.blockchain_kyc_wallet_requests
  DROP CONSTRAINT IF EXISTS chk_blockchain_kyc_wallet_requests_storage_mode,
  DROP COLUMN IF EXISTS storage_mode,
  DROP COLUMN IF EXISTS full_name;

COMMIT;
