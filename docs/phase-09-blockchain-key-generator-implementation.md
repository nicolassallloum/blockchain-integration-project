# Phase 9 — Blockchain Key Generator Implementation

## Objective

Implement the backend blockchain key generator service.

## Service File

blockchain-api/src/services/blockchain-key-generator.service.js

## Standard Key Format

VALOORES:{MODULE}:{SOURCE_RECORD_ID}:{HASH_VERSION}

## Default Hash Version

V1

## Namespace

VALOORES

## Public Exports

- generateBlockchainKey(input)
- parseBlockchainKey(blockchainKey)
- validateBlockchainKey(blockchainKey)
- normalizeModuleName(moduleName)
- normalizeSourceRecordId(sourceRecordId, options)
- normalizeHashVersion(hashVersion)
- getApprovedModules()

## Approved Modules

- AML_RULE
- CUSTOMER_KYC
- TRANSACTION
- AML_ALERT
- AUDIT_LOG
- SCREENING_ACTIVITY
- SANCTION_LIST
- CASE_CLOSURE
- EVIDENCE

## Example

Input moduleName: aml_rule
Input sourceRecordId: rule_1001
Output blockchain key: VALOORES:AML_RULE:RULE_1001:V1

## Validation Completed

The service passed syntax check, generation validation, parse validation, module alias validation, source record ID normalization, hash version normalization, Phase 8 unit tests, and Phase 8 CLI validation.

## Status

Backend blockchain key generator service implemented.
