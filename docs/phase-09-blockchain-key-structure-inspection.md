# Phase 9 — Blockchain Key Format Structure Inspection

## Objective

Inspect the current backend structure and existing blockchain key usage before defining and implementing the standard blockchain key generator.

## Phase 9 Goal

Define and implement a standard blockchain key format.

## Recommended Format

`VALOORES:{MODULE}:{SOURCE_RECORD_ID}:{HASH_VERSION}`

## Example Keys

- `VALOORES:AML_RULE:RULE_1001:V1`
- `VALOORES:CUSTOMER_KYC:CUST_5001:V1`
- `VALOORES:CASE_CLOSURE:CASE_9001:V1`
- `VALOORES:EVIDENCE:EVD_7001:V1`

## Inspection Areas

The inspection checked:

1. Project root structure.
2. Backend folder structure.
3. Backend package configuration.
4. Existing backend services.
5. Existing test files.
6. Existing blockchain key references.
7. Existing Phase 8 stable hash generator.
8. Existing Phase 8 hash tests and CLI validation.

## Current Backend Pattern

The backend uses:

- Node.js
- CommonJS modules
- Service files under `blockchain-api/src/services`
- Tests under `blockchain-api/tests`
- Built-in Node.js test runner

## Phase 9 Implementation Direction

The blockchain key generator should follow the existing Phase 8 backend pattern:

- Service location: `blockchain-api/src/services/blockchain-key-generator.service.js`
- Test location: `blockchain-api/tests/blockchain-key-generator.service.test.js`
- Test command: `npm run test:key`

## Required Capabilities

The key generator must:

1. Produce keys using the final project format.
2. Validate allowed module names.
3. Validate source record IDs.
4. Support hash version values.
5. Return consistent key metadata.
6. Include unit tests.

## Status

Inspection completed.
