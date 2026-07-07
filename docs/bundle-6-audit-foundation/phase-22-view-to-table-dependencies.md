# Phase 22 — Discover View-to-Table Dependencies

## Status

Completed inspection only. No database changes were applied in this phase.

## Database inspected

- Host: 172.31.13.133
- Port: 5444
- Database: vfds_dev
- User: pgdata
- Schema focus: blockchain

## Key finding

The inspected blockchain-facing VALOORES objects are mostly views or materialized views.

Views must not be audited directly. Audit triggers must be attached only to the physical source tables behind those views.

## Target object types

| Schema | Object | Type |
|---|---|---|
| blockchain | aml_case_closure_sync | view |
| blockchain | mv_aml_alerts_customers | materialized view |
| blockchain | mw_audit_logs | materialized view |
| blockchain | valoores_aml_alerts | view |
| blockchain | valoores_aml_rules | view |
| blockchain | valoores_aml_rules_sync | view |
| blockchain | valoores_audit_logs | view |
| blockchain | valoores_customer_kyc | view |
| blockchain | valoores_customer_kyc_legacy_20260703 | view |
| blockchain | valoores_sanction_list | view |
| blockchain | valoores_screening_activities | view |
| blockchain | valoores_transactions | view |
| blockchain | vw_audit_logs | view |
| blockchain | vw_blockchain_history_latest | view |
| blockchain | vw_blockchain_history_retry_queue | view |
| blockchain | vw_blockchain_history_summary | view |
| blockchain | vw_existing_customer_mapping | view |
| blockchain | vw_screening_activities_customers | view |

## View-to-physical-table mapping

| View / Materialized View | Physical source table | Depth |
|---|---|---|
| blockchain.aml_case_closure_sync | blockchain.aml_cases | 1 |
| blockchain.mv_aml_alerts_customers | mdmdba.mdm_bsn_unit_group | 1 |
| blockchain.mv_aml_alerts_customers | sdedba.ref_com_risk_score_interval | 1 |
| blockchain.mv_aml_alerts_customers | sdedba.ref_customer | 1 |
| blockchain.mv_aml_alerts_customers | sdedba.ref_customer_misc_info | 1 |
| blockchain.mv_aml_alerts_customers | suitedba.br_business_rule_definition | 1 |
| blockchain.mv_aml_alerts_customers | suitedba.br_business_rule_message | 1 |
| blockchain.mv_aml_alerts_customers | suitedba.br_business_rule_message_info | 1 |
| blockchain.mv_aml_alerts_customers | suitedba.br_business_rule_msg_info_dstat | 1 |
| blockchain.mw_audit_logs | ssdx_eng.v21_indisplay_logs | 1 |
| blockchain.valoores_aml_alerts | mdmdba.mdm_bsn_unit_group | 2 |
| blockchain.valoores_aml_alerts | sdedba.ref_com_risk_score_interval | 2 |
| blockchain.valoores_aml_alerts | sdedba.ref_customer | 2 |
| blockchain.valoores_aml_alerts | sdedba.ref_customer_misc_info | 2 |
| blockchain.valoores_aml_alerts | suitedba.br_business_rule_definition | 2 |
| blockchain.valoores_aml_alerts | suitedba.br_business_rule_message | 2 |
| blockchain.valoores_aml_alerts | suitedba.br_business_rule_message_info | 2 |
| blockchain.valoores_aml_alerts | suitedba.br_business_rule_msg_info_dstat | 2 |
| blockchain.valoores_aml_rules | suitedba.br_business_rule_definition | 1 |
| blockchain.valoores_aml_rules | suitedba.br_business_rule_message | 1 |
| blockchain.valoores_aml_rules | suitedba.br_business_rule_query | 1 |
| blockchain.valoores_aml_rules_sync | suitedba.br_business_rule_definition | 2 |
| blockchain.valoores_aml_rules_sync | suitedba.br_business_rule_message | 2 |
| blockchain.valoores_aml_rules_sync | suitedba.br_business_rule_query | 2 |
| blockchain.valoores_audit_logs | ssdx_eng.v21_indisplay_logs | 2 |
| blockchain.valoores_customer_kyc | sdedba.cfg_customer_def | 2 |
| blockchain.valoores_customer_kyc | sdedba.ref_customer | 2 |
| blockchain.valoores_customer_kyc_legacy_20260703 | sdedba.cfg_customer_def | 1 |
| blockchain.valoores_customer_kyc_legacy_20260703 | sdedba.ref_customer | 1 |
| blockchain.valoores_sanction_list | sdedba.ref_com_sanction_list | 1 |
| blockchain.valoores_screening_activities | sdedba.ref_com_snction_lst_cust_mtch | 2 |
| blockchain.valoores_transactions | findba.fin_transaction | 1 |
| blockchain.valoores_transactions | suitedba.cfg_object_api_def | 1 |
| blockchain.vw_audit_logs | ssdx_eng.v21_indisplay_logs | 1 |
| blockchain.vw_blockchain_history_latest | blockchain.blockchain_history | 1 |
| blockchain.vw_blockchain_history_latest | blockchain.blockchain_history_attempts | 1 |
| blockchain.vw_blockchain_history_retry_queue | blockchain.blockchain_history | 1 |
| blockchain.vw_blockchain_history_retry_queue | blockchain.blockchain_history_attempts | 1 |
| blockchain.vw_blockchain_history_summary | blockchain.blockchain_history | 1 |
| blockchain.vw_existing_customer_mapping | blockchain.blockchain_customer_mapping | 1 |
| blockchain.vw_existing_customer_mapping | sdedba.ref_customer | 1 |
| blockchain.vw_screening_activities_customers | sdedba.ref_com_snction_lst_cust_mtch | 1 |

## Final audited physical table list

| Schema | Table | Include in Phase 26 | Notes |
|---|---|---|---|
| blockchain | aml_cases | yes | physical source table discovered behind blockchain-facing views |
| blockchain | blockchain_customer_mapping | no | blockchain mapping platform table; exclude from source-data audit triggers |
| blockchain | blockchain_history | no | blockchain proof/history platform table; exclude from source-data audit triggers |
| blockchain | blockchain_history_attempts | no | blockchain proof attempt platform table; exclude from source-data audit triggers |
| findba | fin_transaction | yes | physical source table discovered behind blockchain-facing views |
| mdmdba | mdm_bsn_unit_group | yes | physical source table discovered behind blockchain-facing views |
| sdedba | cfg_customer_def | yes | physical source table discovered behind blockchain-facing views |
| sdedba | ref_com_risk_score_interval | yes | physical source table discovered behind blockchain-facing views |
| sdedba | ref_com_sanction_list | yes | physical source table discovered behind blockchain-facing views |
| sdedba | ref_com_snction_lst_cust_mtch | yes | physical source table discovered behind blockchain-facing views |
| sdedba | ref_customer | yes | physical source table discovered behind blockchain-facing views |
| sdedba | ref_customer_misc_info | yes | physical source table discovered behind blockchain-facing views |
| ssdx_eng | v21_indisplay_logs | conditional | no primary key found; log_id is not unique and has nulls |
| suitedba | br_business_rule_definition | yes | physical source table discovered behind blockchain-facing views |
| suitedba | br_business_rule_message | yes | physical source table discovered behind blockchain-facing views |
| suitedba | br_business_rule_message_info | yes | physical source table discovered behind blockchain-facing views |
| suitedba | br_business_rule_msg_info_dstat | yes | physical source table discovered behind blockchain-facing views |
| suitedba | br_business_rule_query | yes | physical source table discovered behind blockchain-facing views |
| suitedba | cfg_object_api_def | yes | physical source table discovered behind blockchain-facing views |

## Primary key inspection

All discovered source table candidates have primary keys except:

```text
ssdx_eng.v21_indisplay_logs
```

## Special note for ssdx_eng.v21_indisplay_logs

This table has no primary key. The inspected log_id column is not safe as a unique key because it contains nulls and duplicate values.

```text
total_rows,rows_with_log_id,rows_without_log_id,distinct_log_id_count,duplicate_or_null_gap
65195,65166,29,64711,484
```

## Phase 22 conclusion

Phase 22 confirms that the correct audit targets are the physical source tables behind the views, not the views themselves.

Phase 23 can now create the generic audit foundation tables in schema blockchain.
