# Phase 8 — Stable Hash Generator CLI Validation

## Objective

Add a repeatable CLI validation script to confirm stable hash behavior outside of the unit test file.

## Script

`blockchain-api/scripts/phase8-validate-stable-hash.js`

## Command

From `blockchain-api`:

`npm run validate:hash`

## Package Script Added

`"validate:hash": "node scripts/phase8-validate-stable-hash.js"`

## Validation Coverage

The CLI script validates:

1. SHA-256 hash format.
2. Hash version metadata.
3. Same business data returns the same hash.
4. Same business data returns the same canonical JSON.
5. Changed business data returns a different hash.
6. Volatile fields are excluded:
   - `updated_at`
   - `blockchain_transaction_id`
   - `verification_status`
7. Canonical JSON helper stability.

## Status

CLI validation script added and passing.
