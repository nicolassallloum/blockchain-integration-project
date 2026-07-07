\set ON_ERROR_STOP on
\pset pager off

\echo 'PHASE 26 VALIDATION - Audit Config Count'
SELECT
  COUNT(*) AS configured_table_count
FROM blockchain.data_change_audit_config
WHERE (schema_name, table_name) IN (
  ('blockchain','aml_cases'),
  ('findba','fin_transaction'),
  ('mdmdba','mdm_bsn_unit_group'),
  ('sdedba','cfg_customer_def'),
  ('sdedba','ref_com_risk_score_interval'),
  ('sdedba','ref_com_sanction_list'),
  ('sdedba','ref_com_snction_lst_cust_mtch'),
  ('sdedba','ref_customer'),
  ('sdedba','ref_customer_misc_info'),
  ('suitedba','br_business_rule_definition'),
  ('suitedba','br_business_rule_message'),
  ('suitedba','br_business_rule_message_info'),
  ('suitedba','br_business_rule_msg_info_dstat'),
  ('suitedba','br_business_rule_query'),
  ('suitedba','cfg_object_api_def')
);

\echo 'PHASE 26 VALIDATION - Audit Config Rows'
SELECT
  schema_name,
  table_name,
  module_name,
  primary_key_columns,
  source_view_name,
  audit_enabled,
  blockchain_enabled
FROM blockchain.data_change_audit_config
WHERE (schema_name, table_name) IN (
  ('blockchain','aml_cases'),
  ('findba','fin_transaction'),
  ('mdmdba','mdm_bsn_unit_group'),
  ('sdedba','cfg_customer_def'),
  ('sdedba','ref_com_risk_score_interval'),
  ('sdedba','ref_com_sanction_list'),
  ('sdedba','ref_com_snction_lst_cust_mtch'),
  ('sdedba','ref_customer'),
  ('sdedba','ref_customer_misc_info'),
  ('suitedba','br_business_rule_definition'),
  ('suitedba','br_business_rule_message'),
  ('suitedba','br_business_rule_message_info'),
  ('suitedba','br_business_rule_msg_info_dstat'),
  ('suitedba','br_business_rule_query'),
  ('suitedba','cfg_object_api_def')
)
ORDER BY schema_name, table_name;

\echo 'PHASE 26 VALIDATION - Attached Trigger Count'
SELECT
  COUNT(*) AS attached_trigger_count
FROM information_schema.triggers
WHERE trigger_name = 'trg_data_change_audit'
  AND action_statement = 'EXECUTE FUNCTION blockchain.fn_generic_data_change_audit_trigger()'
  AND (event_object_schema, event_object_table) IN (
    ('blockchain','aml_cases'),
    ('findba','fin_transaction'),
    ('mdmdba','mdm_bsn_unit_group'),
    ('sdedba','cfg_customer_def'),
    ('sdedba','ref_com_risk_score_interval'),
    ('sdedba','ref_com_sanction_list'),
    ('sdedba','ref_com_snction_lst_cust_mtch'),
    ('sdedba','ref_customer'),
    ('sdedba','ref_customer_misc_info'),
    ('suitedba','br_business_rule_definition'),
    ('suitedba','br_business_rule_message'),
    ('suitedba','br_business_rule_message_info'),
    ('suitedba','br_business_rule_msg_info_dstat'),
    ('suitedba','br_business_rule_query'),
    ('suitedba','cfg_object_api_def')
  );

\echo 'PHASE 26 VALIDATION - Attached Trigger Details'
SELECT
  event_object_schema AS table_schema,
  event_object_table AS table_name,
  trigger_name,
  event_manipulation,
  action_timing,
  action_orientation,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'trg_data_change_audit'
  AND (event_object_schema, event_object_table) IN (
    ('blockchain','aml_cases'),
    ('findba','fin_transaction'),
    ('mdmdba','mdm_bsn_unit_group'),
    ('sdedba','cfg_customer_def'),
    ('sdedba','ref_com_risk_score_interval'),
    ('sdedba','ref_com_sanction_list'),
    ('sdedba','ref_com_snction_lst_cust_mtch'),
    ('sdedba','ref_customer'),
    ('sdedba','ref_customer_misc_info'),
    ('suitedba','br_business_rule_definition'),
    ('suitedba','br_business_rule_message'),
    ('suitedba','br_business_rule_message_info'),
    ('suitedba','br_business_rule_msg_info_dstat'),
    ('suitedba','br_business_rule_query'),
    ('suitedba','cfg_object_api_def')
  )
ORDER BY event_object_schema, event_object_table, event_manipulation;

\echo 'PHASE 26 VALIDATION - CHECK STATUS'
SELECT
  CASE
    WHEN (
      SELECT COUNT(*)
      FROM blockchain.data_change_audit_config
      WHERE (schema_name, table_name) IN (
        ('blockchain','aml_cases'),
        ('findba','fin_transaction'),
        ('mdmdba','mdm_bsn_unit_group'),
        ('sdedba','cfg_customer_def'),
        ('sdedba','ref_com_risk_score_interval'),
        ('sdedba','ref_com_sanction_list'),
        ('sdedba','ref_com_snction_lst_cust_mtch'),
        ('sdedba','ref_customer'),
        ('sdedba','ref_customer_misc_info'),
        ('suitedba','br_business_rule_definition'),
        ('suitedba','br_business_rule_message'),
        ('suitedba','br_business_rule_message_info'),
        ('suitedba','br_business_rule_msg_info_dstat'),
        ('suitedba','br_business_rule_query'),
        ('suitedba','cfg_object_api_def')
      )
    ) = 15
    AND (
      SELECT COUNT(DISTINCT event_object_schema || '.' || event_object_table)
      FROM information_schema.triggers
      WHERE trigger_name = 'trg_data_change_audit'
        AND action_statement = 'EXECUTE FUNCTION blockchain.fn_generic_data_change_audit_trigger()'
        AND (event_object_schema, event_object_table) IN (
          ('blockchain','aml_cases'),
          ('findba','fin_transaction'),
          ('mdmdba','mdm_bsn_unit_group'),
          ('sdedba','cfg_customer_def'),
          ('sdedba','ref_com_risk_score_interval'),
          ('sdedba','ref_com_sanction_list'),
          ('sdedba','ref_com_snction_lst_cust_mtch'),
          ('sdedba','ref_customer'),
          ('sdedba','ref_customer_misc_info'),
          ('suitedba','br_business_rule_definition'),
          ('suitedba','br_business_rule_message'),
          ('suitedba','br_business_rule_message_info'),
          ('suitedba','br_business_rule_msg_info_dstat'),
          ('suitedba','br_business_rule_query'),
          ('suitedba','cfg_object_api_def')
        )
    ) = 15
    THEN 'PASS'
    ELSE 'FAIL'
  END AS phase_26_validation_status;
