# Phase 8 — Stable Hash Generator Unit Tests

## Objective

Add repeatable unit tests for the stable SHA-256 hash generator service.

## Test File

`blockchain-api/tests/stable-hash-generator.service.test.js`

## Test Command

From `blockchain-api`:

`npm run test:hash`

## Test Runner

Node.js built-in test runner:

`node --test`

## Test Coverage

The unit tests validate:

1. Hash version metadata.
2. Canonical JSON key sorting.
3. Recursive text trimming.
4. Same business data returns the same hash.
5. Changed business data returns a different hash.
6. Date normalization.
7. Number normalization.
8. Null and undefined handling.
9. Default excluded volatile fields.
10. Custom excluded fields.
11. Explicit `dateFields` and `numericFields` options.
12. Plain object validation.

## Package Script Added

`"test:hash": "node --test tests/stable-hash-generator.service.test.js"`

## Status

Unit tests added and passing.
