# Phase 1 AML Case Closure Blockchain Proof Validation

## Status

Completed successfully.

## Validation Date

2026-06-29

## Scope

This document validates the Phase 1 AML Case Closure blockchain proof flow.

The tested source view was:

- blockchain.aml_case_closure_sync

The tested record type was:

- AML_CASE_CLOSURE

## Source View

The AML case closure source view was created as a proof-safe PostgreSQL view.

Source table:

- blockchain.aml_cases

Source view:

- blockchain.aml_case_closure_sync

The view includes only closed AML cases.

The view excludes sensitive fields, including:

- closure_reason
- investigation_notes
- case_description
- raw case payloads

The view count during validation was:

- totalSourceRecords: 2

## Backend Implementation

The following backend components were added:

- blockchain-proof-aml-case-closure-history.service.js
- blockchain-proof-aml-case-closure-history.controller.js
- AML_CASE_CLOSURE routes in blockchain-proof-api.routes.js
- AML_CASE_CLOSURE source view configuration

The service supports:

- source discovery
- source count
- preview
- real sync
- stable hash generation
- PostgreSQL history insert
- Fabric proof submission
- PostgreSQL transaction ID update

## Real Sync Result

A real AML Case Closure proof sync was executed with limit 1.

Result:

- scannedRecords: 1
- createCount: 1
- updateCount: 0
- unchangedCount: 0
- insertableHistoryRows: 1
- insertedHistoryRows: 1
- fabricSubmittedCount: 1
- fabricFailedCount: 0
- errorCount: 0

## PostgreSQL History Result

The new AML Case Closure proof was stored in PostgreSQL history.

- history_id: 114
- record_type: AML_CASE_CLOSURE
- source_view_name: aml_case_closure_sync
- source_record_id: AML_CASE_CLOSURE::189f006c-f666-4998-89b0-944c25d6b5c5
- action_type: CREATE
- sync_status: SYNCED
- verification_status: NOT_VERIFIED
- error_message: null
- blockchain_transaction_id: db2d56a94c27846816ee4ff7ac095513a7f24db3b1f273b2884b058b5f823181

## Fabric Proof Result

The proof was queried directly from Fabric using GetBlockchainProof.

Fabric returned:

- docType: BLOCKCHAIN_PROOF
- recordType: AML_CASE_CLOSURE
- sourceRecordId: AML_CASE_CLOSURE::189f006c-f666-4998-89b0-944c25d6b5c5
- postgresHistoryId: 114
- hashAlgorithm: SHA-256
- stableHash: eebcf7310168de95804b0d9d3985da6f361bcc2bf62cb929f955253cbcc05e51
- txId: db2d56a94c27846816ee4ff7ac095513a7f24db3b1f273b2884b058b5f823181

## Fabric Verification Result

The proof hash was verified directly from Fabric using VerifyBlockchainProof.

Result:

- verified: true
- status: VERIFIED
- storedHash: eebcf7310168de95804b0d9d3985da6f361bcc2bf62cb929f955253cbcc05e51
- submittedHash: eebcf7310168de95804b0d9d3985da6f361bcc2bf62cb929f955253cbcc05e51
- txId: db2d56a94c27846816ee4ff7ac095513a7f24db3b1f273b2884b058b5f823181

## Privacy Confirmation

The Fabric proof stores only hash and proof metadata.

Confirmed metadata flags:

- proofOnly: true
- rawSourceRowExcluded: true
- closureReasonExcluded: true
- investigationNotesExcluded: true
- caseDescriptionExcluded: true
- sensitiveFieldsExcluded: true
- sourceSystem: PostgreSQL
- sourceView: blockchain.aml_case_closure_sync

No raw closure reason, investigation notes, full case description, customer data, password, token, secret, or sensitive case payload was submitted to Fabric.

## Conclusion

AML Case Closure blockchain proof submission is working end-to-end across:

- PostgreSQL aml_cases source table
- PostgreSQL aml_case_closure_sync proof-safe source view
- PostgreSQL blockchain_sync_history
- Backend AML Case Closure proof sync service
- Hyperledger Fabric SaveBlockchainProof
- Hyperledger Fabric GetBlockchainProof
- Hyperledger Fabric VerifyBlockchainProof

The AML Case Closure proof flow is completed and validated for Phase 1.
