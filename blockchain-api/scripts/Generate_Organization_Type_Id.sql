-- =====================================================
-- UPDATE organization_type_id FOR ALL ORGANIZATION TYPES
-- Same organization_type = Same organization_type_id
-- =====================================================

BEGIN;

-- 1. Add column if not exists
ALTER TABLE blockchain.blockchain_organization
ADD COLUMN IF NOT EXISTS organization_type_id BIGINT;

-- 2. Fill organization_type_id based on each distinct organization_type
WITH type_mapping AS (
    SELECT
        organization_type,
        DENSE_RANK() OVER (ORDER BY organization_type) AS organization_type_id
    FROM (
        SELECT DISTINCT organization_type
        FROM blockchain.blockchain_organization
        WHERE organization_type IS NOT NULL
    ) t
)
UPDATE blockchain.blockchain_organization bo
SET organization_type_id = tm.organization_type_id
FROM type_mapping tm
WHERE bo.organization_type = tm.organization_type
  AND bo.organization_type_id IS NULL;

COMMIT;