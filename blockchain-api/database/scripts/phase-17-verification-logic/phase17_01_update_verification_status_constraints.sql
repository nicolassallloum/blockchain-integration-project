BEGIN;

ALTER TABLE blockchain.blockchain_verification_logs
DROP CONSTRAINT IF EXISTS chk_blockchain_verification_logs_status;

ALTER TABLE blockchain.blockchain_verification_logs
ADD CONSTRAINT chk_blockchain_verification_logs_status
CHECK (
  verification_status IN (
    'VERIFIED',
    'MISMATCH',
    'MISMATCHED',
    'NOT_FOUND',
    'TAMPERED',
    'FAILED'
  )
);

ALTER TABLE blockchain.blockchain_sync_history
DROP CONSTRAINT IF EXISTS chk_blockchain_sync_history_verification_status;

ALTER TABLE blockchain.blockchain_sync_history
ADD CONSTRAINT chk_blockchain_sync_history_verification_status
CHECK (
  verification_status IN (
    'NOT_VERIFIED',
    'VERIFIED',
    'MISMATCH',
    'MISMATCHED',
    'NOT_FOUND',
    'TAMPERED',
    'FAILED'
  )
);

ALTER TABLE blockchain.blockchain_history
DROP CONSTRAINT IF EXISTS chk_blockchain_history_verification_status;

ALTER TABLE blockchain.blockchain_history
ADD CONSTRAINT chk_blockchain_history_verification_status
CHECK (
  verification_status IN (
    'NOT_VERIFIED',
    'VERIFIED',
    'MISMATCH',
    'MISMATCHED',
    'NOT_FOUND',
    'TAMPERED',
    'FAILED'
  )
);

COMMIT;
