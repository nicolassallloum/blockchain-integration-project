/*
STEP 3C — Create Normalized AML Source View

Purpose:
Create a clean backend-friendly wrapper view over blockchain.valoores_aml_rules.

Important:
- This does not modify the original source view.
- This creates a normalized view for backend sync logic.
- PostgreSQL remains the source of truth.
*/

CREATE OR REPLACE VIEW blockchain.valoores_aml_rules_sync AS
SELECT
    "RULE ID"::TEXT AS rule_id,
    "RULE QUERY ID"::TEXT AS rule_query_id,
    "RULE DESC"::TEXT AS rule_desc,
    "RULE STATUS"::TEXT AS rule_status,
    "RULE START DATE" AS rule_start_date,
    "RULE EXPIRY DATE" AS rule_expiry_date,
    "RULE CREATION DATE" AS rule_creation_date,
    "RULE CREATOR"::TEXT AS rule_creator,
    "RULE UPDATE DATE" AS rule_update_date,
    "RULE UPDATOR"::TEXT AS rule_updator,
    "RULE MESSAGE"::TEXT AS rule_message,
    "RULE SQL QUERY"::TEXT AS rule_sql_query,
    "RULE QUERY CREATION DATE" AS rule_query_creation_date,
    "RULE QUERY CREATED BY"::TEXT AS rule_query_created_by,
    "RULE APPLCIATION QUERY ID"::TEXT AS rule_application_query_id,
    "RULE QUERY UPDATE DATE" AS rule_query_update_date,
    "RULE QUERY UPDATE BY"::TEXT AS rule_query_update_by
FROM blockchain.valoores_aml_rules;

-- Validate normalized view
SELECT COUNT(*) AS normalized_aml_count
FROM blockchain.valoores_aml_rules_sync;

-- Validate primary key columns
SELECT
    rule_id,
    rule_query_id,
    rule_desc,
    rule_status
FROM blockchain.valoores_aml_rules_sync
LIMIT 5;
