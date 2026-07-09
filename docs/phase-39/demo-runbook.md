# Phase 39 — Demo Runbook

## Pre-Demo Validation

Run:

- npm run test:hash
- npm run test:key
- npm run fabric:test
- npm run check:syntax
- node tests/phase10-proof.test.js
- node tests/phase28-audit-proof.test.js

## Opening Script

Today we will demonstrate the end-to-end blockchain proof lifecycle.

The system keeps PostgreSQL as the source of truth and uses Hyperledger Fabric only for proof.

The goal is not to move business data to blockchain. The goal is to prove that approved records were not changed without detection.

## CEO Focus

- Business trust
- Executive visibility
- Tamper detection
- Audit evidence
- Production readiness

## Compliance Focus

- Validation before approval
- Compliance proof rules
- Auto approval for low-risk changes
- Manual approval for sensitive changes
- Invalid record review workflow

## Audit Focus

- Audit trail
- Stable hash
- Blockchain proof
- Verification result
- Mismatch detection
- Batch proof
- Exportable evidence

## Closing Script

This confirms that the Blockchain Integration Project is ready for production readiness review.
