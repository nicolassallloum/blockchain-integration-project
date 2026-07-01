# Phase 8 — Stable Hash Generator Service Location Decision

## Objective

Decide the correct backend location and testing approach for the stable SHA-256 hash generator service.

## Backend Findings

The backend is a Node.js CommonJS project.

The package configuration uses:

- Main entry: `src/server.js`
- Module type: `commonjs`
- Existing backend service folder: `blockchain-api/src/services`
- Existing backend utility folder: `blockchain-api/src/utils`
- No dedicated unit test framework is currently configured in `package.json`

## Decision

The stable hash generator will be implemented as a backend service here:

`blockchain-api/src/services/stable-hash-generator.service.js`

## Why This Location

The hash generator is business-critical blockchain proof logic, not a generic formatting utility.

It belongs in `src/services` because it will be used by blockchain proof generation, verification, retry, and history workflows.

## Test Location

Unit tests will be added here:

`blockchain-api/tests/stable-hash-generator.service.test.js`

## Test Runner Decision

The backend currently does not define a dedicated unit test framework.

To avoid adding unnecessary dependencies, Phase 8 will use the built-in Node.js test runner available in Node.js 20:

`node --test tests/stable-hash-generator.service.test.js`

## Future Package Script

A package script will be added:

`"test:hash": "node --test tests/stable-hash-generator.service.test.js"`

## Hash Service Responsibilities

The service must:

1. Convert record data to canonical JSON.
2. Sort all object keys alphabetically.
3. Trim text values.
4. Normalize dates consistently.
5. Normalize numbers consistently.
6. Handle null values consistently.
7. Remove excluded fields before hashing.
8. Generate SHA-256 hash.
9. Return hash version metadata.

## Initial Excluded Fields

The first implementation will exclude technical and volatile fields that should not affect business-data proof hashes, including:

- `created_at`
- `updated_at`
- `submitted_at`
- `verified_at`
- `blockchain_transaction_id`
- `blockchain_status`
- `verification_status`
- `error_message`
- `retry_count`

Additional fields can be excluded per module by passing an explicit exclude list to the service.

## Planned Public Methods

The service should expose:

- `canonicalizeRecord(record, options)`
- `toCanonicalJson(record, options)`
- `generateRecordHash(record, options)`
- `getHashVersion()`

## Status

Location and testing approach decided.
