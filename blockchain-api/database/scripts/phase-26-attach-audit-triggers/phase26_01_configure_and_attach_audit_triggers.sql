\set ON_ERROR_STOP on

BEGIN;

CREATE SCHEMA IF NOT EXISTS blockchain;

INSERT INTO blockchain.data_change_audit_config (
  schema_name,
  table_name,
  module_name,
  primary_key_columns,
  source_view_name,
  audit_enabled,
  capture_insert,
  capture_update,
  capture_delete,
  capture_old_row,
  capture_new_row,
  blockchain_enabled,
  sensitive_fields,
  excluded_fields,
  notes
)
VALUES
  ('blockchain','aml_cases','AML_CASE_CLOSURE',ARRAY['case_id'],'blockchain.aml_case_closure_sync',true,true,true,true,true,true,true,ARRAY[]::TEXT[],ARRAY[]::TEXT[],'Phase 26 source table audit configuration'),
  ('findba','fin_transaction','TRANSACTIONS',ARRAY['transaction_id'],'blockchain.valoores_transactions',true,true,true,true,true,true,true,ARRAY[]::TEXT[],ARRAY[]::TEXT[],'Phase 26 source table audit configuration'),
  ('mdmdba','mdm_bsn_unit_group','AML_ALERTS',ARRAY['bsn_group_id'],'blockchain.valoores_aml_alerts',true,true,true,true,true,true,true,ARRAY[]::TEXT[],ARRAY[]::TEXT[],'Phase 26 source table audit configuration'),
  ('sdedba','cfg_customer_def','CUSTOMER_KYC',ARRAY['customer_def_id'],'blockchain.valoores_customer_kyc',true,true,true,true,true,true,true,ARRAY[]::TEXT[],ARRAY[]::TEXT[],'Phase 26 source table audit configuration'),
  ('sdedba','ref_com_risk_score_interval','AML_ALERTS',ARRAY['risk_score_interval_id'],'blockchain.valoores_aml_alerts',true,true,true,true,true,true,true,ARRAY[]::TEXT[],ARRAY[]::TEXT[],'Phase 26 source table audit configuration'),
  ('sdedba','ref_com_sanction_list','SANCTION_LIST',ARRAY['sanction_list_id'],'blockchain.valoores_sanction_list',true,true,true,true,true,true,true,ARRAY[]::TEXT[],ARRAY[]::TEXT[],'Phase 26 source table audit configuration'),
  ('sdedba','ref_com_snction_lst_cust_mtch','SCREENING_ACTIVITIES',ARRAY['sanction_list_cust_match_id'],'blockchain.valoores_screening_activities',true,true,true,true,true,true,true,ARRAY[]::TEXT[],ARRAY[]::TEXT[],'Phase 26 source table audit configuration'),
  ('sdedba','ref_customer','CUSTOMER_KYC',ARRAY['customer_id'],'blockchain.valoores_customer_kyc',true,true,true,true,true,true,true,ARRAY[]::TEXT[],ARRAY[]::TEXT[],'Phase 26 source table audit configuration'),
  ('sdedba','ref_customer_misc_info','AML_ALERTS',ARRAY['customer_id'],'blockchain.valoores_aml_alerts',true,true,true,true,true,true,true,ARRAY[]::TEXT[],ARRAY[]::TEXT[],'Phase 26 source table audit configuration'),
  ('suitedba','br_business_rule_definition','AML_RULES',ARRAY['business_rule_id'],'blockchain.valoores_aml_rules',true,true,true,true,true,true,true,ARRAY[]::TEXT[],ARRAY[]::TEXT[],'Phase 26 source table audit configuration'),
  ('suitedba','br_business_rule_message','AML_RULES',ARRAY['business_rule_message_id'],'blockchain.valoores_aml_rules',true,true,true,true,true,true,true,ARRAY[]::TEXT[],ARRAY[]::TEXT[],'Phase 26 source table audit configuration'),
  ('suitedba','br_business_rule_message_info','AML_ALERTS',ARRAY['business_rule_message_info_id'],'blockchain.valoores_aml_alerts',true,true,true,true,true,true,true,ARRAY[]::TEXT[],ARRAY[]::TEXT[],'Phase 26 source table audit configuration'),
  ('suitedba','br_business_rule_msg_info_dstat','AML_ALERTS',ARRAY['status_id'],'blockchain.valoores_aml_alerts',true,true,true,true,true,true,true,ARRAY[]::TEXT[],ARRAY[]::TEXT[],'Phase 26 source table audit configuration'),
  ('suitedba','br_business_rule_query','AML_RULES',ARRAY['business_rule_query_id','business_rule_id'],'blockchain.valoores_aml_rules',true,true,true,true,true,true,true,ARRAY[]::TEXT[],ARRAY[]::TEXT[],'Phase 26 source table audit configuration'),
  ('suitedba','cfg_object_api_def','TRANSACTIONS',ARRAY['object_api_def_id'],'blockchain.valoores_transactions',true,true,true,true,true,true,true,ARRAY[]::TEXT[],ARRAY[]::TEXT[],'Phase 26 source table audit configuration')
ON CONFLICT (schema_name, table_name)
DO UPDATE SET
  module_name = EXCLUDED.module_name,
  primary_key_columns = EXCLUDED.primary_key_columns,
  source_view_name = EXCLUDED.source_view_name,
  audit_enabled = EXCLUDED.audit_enabled,
  capture_insert = EXCLUDED.capture_insert,
  capture_update = EXCLUDED.capture_update,
  capture_delete = EXCLUDED.capture_delete,
  capture_old_row = EXCLUDED.capture_old_row,
  capture_new_row = EXCLUDED.capture_new_row,
  blockchain_enabled = EXCLUDED.blockchain_enabled,
  sensitive_fields = EXCLUDED.sensitive_fields,
  excluded_fields = EXCLUDED.excluded_fields,
  notes = EXCLUDED.notes,
  updated_at = now();

DROP TRIGGER IF EXISTS trg_data_change_audit ON blockchain.aml_cases;
CREATE TRIGGER trg_data_change_audit
AFTER INSERT OR UPDATE OR DELETE ON blockchain.aml_cases
FOR EACH ROW
EXECUTE FUNCTION blockchain.fn_generic_data_change_audit_trigger();

DROP TRIGGER IF EXISTS trg_data_change_audit ON findba.fin_transaction;
CREATE TRIGGER trg_data_change_audit
AFTER INSERT OR UPDATE OR DELETE ON findba.fin_transaction
FOR EACH ROW
EXECUTE FUNCTION blockchain.fn_generic_data_change_audit_trigger();

DROP TRIGGER IF EXISTS trg_data_change_audit ON mdmdba.mdm_bsn_unit_group;
CREATE TRIGGER trg_data_change_audit
AFTER INSERT OR UPDATE OR DELETE ON mdmdba.mdm_bsn_unit_group
FOR EACH ROW
EXECUTE FUNCTION blockchain.fn_generic_data_change_audit_trigger();

DROP TRIGGER IF EXISTS trg_data_change_audit ON sdedba.cfg_customer_def;
CREATE TRIGGER trg_data_change_audit
AFTER INSERT OR UPDATE OR DELETE ON sdedba.cfg_customer_def
FOR EACH ROW
EXECUTE FUNCTION blockchain.fn_generic_data_change_audit_trigger();

DROP TRIGGER IF EXISTS trg_data_change_audit ON sdedba.ref_com_risk_score_interval;
CREATE TRIGGER trg_data_change_audit
AFTER INSERT OR UPDATE OR DELETE ON sdedba.ref_com_risk_score_interval
FOR EACH ROW
EXECUTE FUNCTION blockchain.fn_generic_data_change_audit_trigger();

DROP TRIGGER IF EXISTS trg_data_change_audit ON sdedba.ref_com_sanction_list;
CREATE TRIGGER trg_data_change_audit
AFTER INSERT OR UPDATE OR DELETE ON sdedba.ref_com_sanction_list
FOR EACH ROW
EXECUTE FUNCTION blockchain.fn_generic_data_change_audit_trigger();

DROP TRIGGER IF EXISTS trg_data_change_audit ON sdedba.ref_com_snction_lst_cust_mtch;
CREATE TRIGGER trg_data_change_audit
AFTER INSERT OR UPDATE OR DELETE ON sdedba.ref_com_snction_lst_cust_mtch
FOR EACH ROW
EXECUTE FUNCTION blockchain.fn_generic_data_change_audit_trigger();

DROP TRIGGER IF EXISTS trg_data_change_audit ON sdedba.ref_customer;
CREATE TRIGGER trg_data_change_audit
AFTER INSERT OR UPDATE OR DELETE ON sdedba.ref_customer
FOR EACH ROW
EXECUTE FUNCTION blockchain.fn_generic_data_change_audit_trigger();

DROP TRIGGER IF EXISTS trg_data_change_audit ON sdedba.ref_customer_misc_info;
CREATE TRIGGER trg_data_change_audit
AFTER INSERT OR UPDATE OR DELETE ON sdedba.ref_customer_misc_info
FOR EACH ROW
EXECUTE FUNCTION blockchain.fn_generic_data_change_audit_trigger();

DROP TRIGGER IF EXISTS trg_data_change_audit ON suitedba.br_business_rule_definition;
CREATE TRIGGER trg_data_change_audit
AFTER INSERT OR UPDATE OR DELETE ON suitedba.br_business_rule_definition
FOR EACH ROW
EXECUTE FUNCTION blockchain.fn_generic_data_change_audit_trigger();

DROP TRIGGER IF EXISTS trg_data_change_audit ON suitedba.br_business_rule_message;
CREATE TRIGGER trg_data_change_audit
AFTER INSERT OR UPDATE OR DELETE ON suitedba.br_business_rule_message
FOR EACH ROW
EXECUTE FUNCTION blockchain.fn_generic_data_change_audit_trigger();

DROP TRIGGER IF EXISTS trg_data_change_audit ON suitedba.br_business_rule_message_info;
CREATE TRIGGER trg_data_change_audit
AFTER INSERT OR UPDATE OR DELETE ON suitedba.br_business_rule_message_info
FOR EACH ROW
EXECUTE FUNCTION blockchain.fn_generic_data_change_audit_trigger();

DROP TRIGGER IF EXISTS trg_data_change_audit ON suitedba.br_business_rule_msg_info_dstat;
CREATE TRIGGER trg_data_change_audit
AFTER INSERT OR UPDATE OR DELETE ON suitedba.br_business_rule_msg_info_dstat
FOR EACH ROW
EXECUTE FUNCTION blockchain.fn_generic_data_change_audit_trigger();

DROP TRIGGER IF EXISTS trg_data_change_audit ON suitedba.br_business_rule_query;
CREATE TRIGGER trg_data_change_audit
AFTER INSERT OR UPDATE OR DELETE ON suitedba.br_business_rule_query
FOR EACH ROW
EXECUTE FUNCTION blockchain.fn_generic_data_change_audit_trigger();

DROP TRIGGER IF EXISTS trg_data_change_audit ON suitedba.cfg_object_api_def;
CREATE TRIGGER trg_data_change_audit
AFTER INSERT OR UPDATE OR DELETE ON suitedba.cfg_object_api_def
FOR EACH ROW
EXECUTE FUNCTION blockchain.fn_generic_data_change_audit_trigger();

COMMIT;
