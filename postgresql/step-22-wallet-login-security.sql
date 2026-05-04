BEGIN;

-- =========================================================
-- STEP 22 — Wallet Login API Security Support
-- Blockchain Integration Project
-- =========================================================

-- CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================================================
-- Add login/security fields to wallets table if missing
-- =========================================================

ALTER TABLE blockchain.wallets
ADD COLUMN IF NOT EXISTS password_hash TEXT,
ADD COLUMN IF NOT EXISTS pin_hash TEXT,
ADD COLUMN IF NOT EXISTS login_failed_count INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS login_locked_until TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_failed_login_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_login_ip INET,
ADD COLUMN IF NOT EXISTS login_status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE';

COMMENT ON COLUMN blockchain.wallets.password_hash IS
'Secure bcrypt hash for wallet login password. Never store plain password.';

COMMENT ON COLUMN blockchain.wallets.pin_hash IS
'Optional secure bcrypt hash for wallet PIN. Never store plain PIN.';

COMMENT ON COLUMN blockchain.wallets.login_failed_count IS
'Number of consecutive failed login attempts. Reset to zero after successful login.';

COMMENT ON COLUMN blockchain.wallets.login_locked_until IS
'Wallet login lock expiration timestamp after repeated failed login attempts.';

COMMENT ON COLUMN blockchain.wallets.last_login_at IS
'Last successful wallet login timestamp.';

COMMENT ON COLUMN blockchain.wallets.last_failed_login_at IS
'Last failed wallet login timestamp.';

COMMENT ON COLUMN blockchain.wallets.last_login_ip IS
'Last successful login source IP address.';

COMMENT ON COLUMN blockchain.wallets.login_status IS
'Wallet login status. Values: ACTIVE, LOCKED, DISABLED, SUSPENDED.';

-- =========================================================
-- Add indexes for login lookup and security checks
-- =========================================================

CREATE INDEX IF NOT EXISTS idx_wallets_wallet_address_login
ON blockchain.wallets(wallet_address);

CREATE INDEX IF NOT EXISTS idx_wallets_customer_id_login
ON blockchain.wallets(customer_id);

CREATE INDEX IF NOT EXISTS idx_wallets_login_status
ON blockchain.wallets(login_status);

CREATE INDEX IF NOT EXISTS idx_wallets_login_locked_until
ON blockchain.wallets(login_locked_until);

-- =========================================================
-- Audit logs table fallback fields
-- =========================================================

ALTER TABLE blockchain.audit_logs
ADD COLUMN IF NOT EXISTS event_type VARCHAR(100),
ADD COLUMN IF NOT EXISTS event_status VARCHAR(30),
ADD COLUMN IF NOT EXISTS entity_type VARCHAR(100),
ADD COLUMN IF NOT EXISTS entity_id TEXT,
ADD COLUMN IF NOT EXISTS actor_id TEXT,
ADD COLUMN IF NOT EXISTS source_ip INET,
ADD COLUMN IF NOT EXISTS user_agent TEXT,
ADD COLUMN IF NOT EXISTS request_payload JSONB,
ADD COLUMN IF NOT EXISTS response_payload JSONB,
ADD COLUMN IF NOT EXISTS error_message TEXT,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type
ON blockchain.audit_logs(event_type);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_id
ON blockchain.audit_logs(entity_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
ON blockchain.audit_logs(created_at DESC);

COMMIT;
