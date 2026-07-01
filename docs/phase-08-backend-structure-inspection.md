# Phase 8 — Backend Structure Inspection

## Objective

Inspect the current backend structure before implementing the stable SHA-256 hash generator service.

## Phase 8 Goal

Build a stable hash generator service that always returns the same SHA-256 hash when the business data is the same.

## Required Hash Rules

1. Convert record data to canonical JSON.
2. Sort all keys alphabetically.
3. Trim text values.
4. Normalize dates.
5. Normalize numbers.
6. Handle null values consistently.
7. Remove fields that should not be hashed.
8. Generate SHA-256 hash.
9. Add hash version support.

## Inspection Areas

The inspection checked:

1. Project root structure.
2. Backend folder structure.
3. Backend package configuration.
4. Existing source files.
5. Existing services.
6. Existing tests.
7. Existing script folders.
8. Node and npm versions.
9. Available npm scripts.

## Next Decision Needed

Based on the inspected backend structure, Phase 8 Step 2 will decide the correct service location and testing approach.

## Status

Inspection completed.
