-- Run these commands manually if needed:

SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_schema = 'blockchain'
ORDER BY table_name;

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'blockchain'
  AND table_name = 'wallets'
ORDER BY ordinal_position;

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'blockchain'
  AND table_name = 'transactions'
ORDER BY ordinal_position;

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'blockchain'
  AND table_name IN ('organizations', 'blockchain_organizations')
ORDER BY table_name, ordinal_position;
