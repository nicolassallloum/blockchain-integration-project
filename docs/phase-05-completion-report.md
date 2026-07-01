# Phase 5 — VALOORES Blockchain Source Views Completion Report

## Objective

Prepare PostgreSQL source views that generate stable, normalized blockchain proof inputs for the VALOORES Blockchain Integration Project.

## Completed Source Views

| # | View | Source | Final Row Count | Status |
|---|------|--------|-----------------|--------|
| 1 | blockchain.valoores_aml_rules | suitedba.br_business_rule_definition + suitedba.br_business_rule_message + suitedba.br_business_rule_query | 48 | Completed |
| 2 | blockchain.valoores_customer_kyc | sdedba.ref_customer + sdedba.cfg_customer_def | 1,146,134 | Completed |
| 3 | blockchain.valoores_transactions | findba.fin_transaction + suitedba.cfg_object_api_def | 190,128 | Completed |
| 4 | blockchain.valoores_aml_alerts | blockchain.mv_aml_alerts_customers | 259,605 | Completed |
| 5 | blockchain.valoores_audit_logs | blockchain.mw_audit_logs | 64,789 | Completed |
| 6 | blockchain.valoores_screening_activities | blockchain.vw_screening_activities_customers | 244,375 | Completed |
| 7 | blockchain.valoores_sanction_list | sdedba.ref_com_sanction_list | 7,131,707 | Completed |

## Design Rules Applied

- Views expose only fields needed for proof generation.
- Sensitive fields are not exposed directly.
- Names, IDs, comments, addresses, documents, payloads, wallet values, and user fields are represented using deterministic fingerprints where required.
- Text values are normalized using lower-case, trimming, and whitespace cleanup.
- Dates and timestamps are standardized.
- Null values are handled consistently.
- Each view exposes:
  - source_module
  - source_record_id
  - hash_input
  - hash_md5

## Validation Summary

- All required Phase 5 source views exist.
- All views contain `hash_input` and `hash_md5`.
- Source row counts match view row counts.
- Duplicate `source_record_id` checks passed.
- Hash stability checks passed.
- Raw sensitive column exposure checks passed.

## Git Commit Summary

- phase-5: prepare aml rules source view
- phase-5: prepare customer kyc source view
- phase-5: prepare transactions source view
- phase-5: prepare aml alerts source view
- phase-5: prepare audit logs source view
- phase-5: prepare screening activities source view
- phase-5: prepare sanction list source view
- phase-5: fix sanction list source view

## Phase 5 Result

Phase 5 is complete. The VALOORES source data is now prepared as normalized PostgreSQL views for deterministic blockchain proof hash generation.
