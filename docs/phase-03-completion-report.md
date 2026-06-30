# Phase 3 — Data Privacy and Blockchain Data Classification Completion Report

## 1. Phase Summary

Phase 3 has been completed for the VALOORES Blockchain Integration Project.

This phase defined the privacy and data classification foundation required before implementing the next blockchain integration steps.

The main rule confirmed in this phase is:

Sensitive customer data must never be stored directly on blockchain.

## 2. Completed Deliverables

| # | Deliverable | Status |
|---:|---|---|
| 1 | Data classification table | Completed |
| 2 | Fields allowed on blockchain | Completed |
| 3 | Fields forbidden on blockchain | Completed |
| 4 | Recommended blockchain payload structure | Completed |
| 5 | Recommended PostgreSQL-only fields | Completed |
| 6 | Recommended hash input fields | Completed |
| 7 | Security and privacy checklist before Phase 4 | Completed |

## 3. Classification Categories Defined

The following classification categories were defined:

| Classification | Status |
|---|---|
| Public metadata | Defined |
| Internal business data | Defined |
| Sensitive data | Defined |
| Restricted data | Defined |
| Hash-only data | Defined |

## 4. Blockchain Storage Decision

The approved blockchain storage decision is:

| Data Type | Blockchain Decision |
|---|---|
| Safe metadata | Allowed |
| Hash values | Allowed |
| Blockchain transaction IDs | Allowed |
| Entity hash references | Allowed |
| Customer personal data | Forbidden |
| Financial sensitive data | Forbidden |
| Documents and attachments | Forbidden |
| Passwords, tokens, keys, and secrets | Forbidden |
| Raw customer, transaction, AML, or screening payloads | Forbidden |

## 5. Approved Blockchain Payload Direction

Blockchain payloads must contain proof-only data.

Approved payload fields include:

- ledger key
- entity type
- entity ID hash
- module
- source system
- proof type
- data hash
- previous hash
- hash algorithm
- payload version
- PostgreSQL history reference
- blockchain transaction ID
- proof creation timestamp
- submitting service name
- verification status

## 6. Approved PostgreSQL-Only Direction

PostgreSQL remains the source of truth for:

- customer KYC data
- AML rule details
- AML case details
- transaction business data
- screening raw responses
- documents and attachments
- audit details
- security credentials and secrets

## 7. Hashing Direction

The approved hashing direction is:

- Use SHA-256 by default.
- Normalize data before hashing.
- Sort fields before hashing.
- Keep hash input reproducible from PostgreSQL.
- Submit only the final hash value to blockchain.
- Never submit original sensitive values to blockchain.
- Never include passwords, tokens, secrets, private keys, or session IDs in hash input.

## 8. Security and Privacy Result

Phase 3 confirms that the VALOORES blockchain integration must follow a proof-only blockchain model.

This protects sensitive data while still allowing independent verification of record integrity and history.

## 9. Phase 3 Final Status

Phase 3 is completed and ready for Phase 4.

Phase 4 must follow the data classification and privacy rules defined in:

docs/phase-03-data-privacy-classification.md
