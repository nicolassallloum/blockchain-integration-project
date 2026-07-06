# Phase 15 — AML Case Closure Blockchain Proof Source View Gap Report

## Status

Phase 15 implementation is blocked before proof submission.

## Checked Source View

`blockchain.valoores_aml_alerts`

## Result

The existing Phase 5 source view exists and contains AML alert closure-like data.

Observed closure records:

- `alert_status_code = 17`
- `alert_status_normalized = closed alert`
- Closure-like records found: 5

This confirms that closure status is represented in the existing Phase 5 AML Alerts view.

## Blocking Gap

The existing source view does not expose the full required Phase 5 proof contract needed for Phase 15 proof submission.

Missing required columns:

1. `source_system`
2. `source_entity`
3. `business_reference`
4. `record_status`
5. `standardized_event_timestamp`
6. `proof_version`
7. `record_type` or `event_type`

Existing useful columns found:

1. `source_module`
2. `source_record_id`
3. `alert_status_code`
4. `alert_status_normalized`
5. `execution_ts_utc`
6. `hash_input`
7. `hash_md5`

## Decision

Phase 15 proof submission, verification, and blockchain status APIs must not be implemented yet.

Reason:

The Phase 15 instruction requires the proof input to come only from the approved Phase 5 source view and requires the expected proof contract columns before implementation.

## Required Separate Approved Change

A separate approved Phase 5 compatibility patch is required to extend the existing view `blockchain.valoores_aml_alerts`.

The patch should not create a new source view.

The patch should add proof-safe compatibility columns to the existing view, such as:

1. `source_system`
2. `source_entity`
3. `business_reference`
4. `event_type`
5. `record_status`
6. `standardized_event_timestamp`
7. `proof_version`

The patch should preserve the existing `hash_input` behavior and avoid exposing raw sensitive data.

## Important Data Rule

Raw AML case tables must not be used for Phase 15 proof generation.

Raw AML case tables were inspected only to understand the data model and must not be used as proof input.

## Conclusion

Phase 15 is stopped safely at the source-view validation stage.

Next required action:

Approve and apply a Phase 5 compatibility patch to the existing `blockchain.valoores_aml_alerts` view, then restart Phase 15 proof implementation.
