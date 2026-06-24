# Step 1 — Blockchain Integration Scope Document

## 1. Document Purpose

This document confirms the integration scope for the Blockchain Integration Project.

The project will integrate PostgreSQL source views with a Hyperledger Fabric blockchain network to create an immutable proof, verification, and audit layer for selected business records.

PostgreSQL will remain the source of truth for operational and sensitive business data. Blockchain will store only cryptographic proof and non-sensitive metadata required for verification, traceability, and auditability.

---

## 2. Project Goal

The goal of this project is to build a secure, production-ready integration where:

* PostgreSQL remains the main operational data source.
* PostgreSQL source views are used as the integration source.
* CREATE and UPDATE events are detected by a backend sync service.
* Stable hashes are generated from approved business fields.
* Only proof records are submitted to blockchain.
* Blockchain transaction IDs are linked back to PostgreSQL history records.
* Verification APIs can prove whether PostgreSQL records match the blockchain proof.
* Dashboards and screens provide audit, retry, monitoring, and verification visibility.

---

## 3. What Will Be Integrated

The integration will cover the following business domains:

1. AML history records
2. Customer Data history records
3. Transaction Data history records
4. Screening Activity history records

Each domain will be integrated using the same generic history sync pattern.

The integration will detect:

* New business records as `CREATE`
* Changed business records as `UPDATE`
* Records with no change as `UNCHANGED` and skipped from blockchain submission

The first implemented business domain will be AML history. After the generic logic is validated, the same pattern will be applied to Customer Data, Transaction Data, and Screening Activity.

---

## 4. What Will Remain in PostgreSQL

PostgreSQL will remain the source of truth for all full business data.

The following data will remain only in PostgreSQL:

* Full AML data
* Full customer data
* Full transaction data
* Full screening activity data
* Source views
* History tables
* Sync status
* Retry count
* Error messages
* Blockchain key references
* Blockchain transaction IDs
* Verification results
* Dashboard reporting data
* Operational logs

PostgreSQL will also store the full integration history required for operational support and reconciliation.

---

## 5. What Will Be Submitted to Blockchain

Blockchain will store only proof records.

Each blockchain proof record will include:

* Blockchain key
* Record type
* Source record ID
* Stable hash
* Action type: `CREATE` or `UPDATE`
* PostgreSQL history ID
* Timestamp
* Submitted by service name
* Optional non-sensitive metadata
* Blockchain transaction ID

The blockchain key format will follow this standard:

```text
PROOF::{RECORD_TYPE}::{SOURCE_RECORD_ID}::{HASH}
```

Example:

```text
PROOF::AML::AML_RULE_10001::9F2A8D7C...
```

The blockchain record will be used to prove that a specific version of a PostgreSQL source record existed at a specific time and was submitted by the authorized integration service.

---

## 6. What Will Not Be Submitted to Blockchain

The following information must not be submitted to blockchain:

* Customer names
* Customer addresses
* Phone numbers
* Email addresses
* Identity numbers
* Passport numbers
* Date of birth
* Full AML rule details
* Full transaction details
* Transaction amounts, unless explicitly approved as non-sensitive metadata
* Screening result details
* Raw JSON payloads from PostgreSQL
* Any PII, confidential, regulated, or sensitive business fields
* Authentication tokens
* Database credentials
* Internal error stack traces
* Full request or response payloads containing business data

Blockchain must not become a duplicate business database.

Blockchain must only act as the immutable proof, verification, and audit layer.

---

## 7. Main Project Modules

### 7.1 PostgreSQL Source Views Module

Responsible for exposing approved source records from PostgreSQL.

Source views will be confirmed in Step 3.

Expected source view categories:

* AML source view
* Customer Data source view
* Transaction Data source view
* Screening Activity source view

---

### 7.2 PostgreSQL History Module

Responsible for storing all detected CREATE and UPDATE events.

History tables will track:

* Source view name
* Source primary key
* Business record type
* Old hash
* New hash
* Action type
* Sync status
* Blockchain key
* Blockchain transaction ID
* Error message
* Retry count
* Created date
* Updated date

---

### 7.3 Backend Sync Service Module

Responsible for the generic sync process.

The service will:

* Read records from PostgreSQL source views
* Normalize records
* Generate stable hashes
* Detect CREATE events
* Detect UPDATE events
* Skip unchanged records
* Insert PostgreSQL history records
* Submit proof records to blockchain
* Save blockchain transaction IDs back to PostgreSQL
* Retry failed blockchain submissions
* Verify PostgreSQL hashes against blockchain proofs

---

### 7.4 Blockchain Chaincode Module

Responsible for storing and retrieving immutable proof records.

Required chaincode functions:

* `SaveProof`
* `GetProof`
* `GetProofHistory`
* `VerifyProof`
* `QueryProofsByRecordType`
* `QueryProofsBySourceRecord`

---

### 7.5 Backend API Module

Responsible for exposing protected APIs for sync, history, retry, verification, and dashboard operations.

Required API groups:

* Sync APIs
* History APIs
* Failed record APIs
* Retry APIs
* Verification APIs
* Dashboard APIs
* Monitoring APIs

---

### 7.6 Dashboard and Monitoring Module

Responsible for operational visibility.

The dashboard will show:

* Total records synced
* Total CREATE records
* Total UPDATE records
* Total unchanged records skipped
* Total failed records
* Retry count
* Last sync date
* Blockchain verification status
* Records by type
* Records by status

---

### 7.7 Security and Audit Module

Responsible for ensuring the integration does not expose sensitive data.

The security layer must validate that:

* Blockchain receives only hashes and approved metadata
* APIs are protected
* Logs do not expose sensitive business data
* Hash generation is stable
* Tampering can be detected
* Failed records can be retried safely
* Verification results are auditable

---

## 8. Main Data Flows

### 8.1 CREATE Event Flow

1. Backend sync service reads a record from a PostgreSQL source view.
2. Service generates a stable hash from approved fields.
3. Service checks whether the source record already exists in history.
4. If no previous hash exists, the record is marked as `CREATE`.
5. A PostgreSQL history record is inserted.
6. A blockchain proof record is submitted using `SaveProof`.
7. Blockchain returns a transaction ID.
8. PostgreSQL history record is updated with the blockchain transaction ID.
9. Record status becomes `SYNCED`.
10. Dashboard and verification APIs reflect the successful sync.

---

### 8.2 UPDATE Event Flow

1. Backend sync service reads a record from a PostgreSQL source view.
2. Service generates a stable hash from approved fields.
3. Service compares the new hash with the latest stored hash.
4. If the hash changed, the record is marked as `UPDATE`.
5. Old hash and new hash are stored in PostgreSQL history.
6. A blockchain proof record is submitted.
7. Blockchain returns a transaction ID.
8. PostgreSQL history record is updated with the blockchain transaction ID.
9. Record status becomes `SYNCED`.
10. The record can be verified against blockchain.

---

### 8.3 Unchanged Record Flow

1. Backend sync service reads a record from a PostgreSQL source view.
2. Service generates a stable hash.
3. Service compares it with the latest stored hash.
4. If the hash is identical, the record is skipped.
5. No blockchain transaction is submitted.
6. Skip count is reflected in dashboard statistics.

---

### 8.4 Failed Submission Flow

1. Backend sync service creates a PostgreSQL history record.
2. Service attempts to submit proof to blockchain.
3. If blockchain submission fails, the history record status becomes `FAILED`.
4. Error message and retry count are stored in PostgreSQL.
5. Failed records are available through failed-record APIs.
6. Retry service can safely resubmit the same proof.
7. On success, PostgreSQL is updated with the blockchain transaction ID.

---

### 8.5 Verification Flow

1. User or system requests verification for a record.
2. Backend reads the latest PostgreSQL source record.
3. Backend regenerates the stable hash.
4. Backend retrieves the blockchain proof by key, record type, or source record ID.
5. Backend compares PostgreSQL hash with blockchain hash.
6. If hashes match, verification status is `VERIFIED`.
7. If hashes do not match, verification status is `TAMPERED` or `MISMATCHED`.
8. Verification result is returned through API and dashboard.

---

## 9. Assumptions

The project assumes that:

* PostgreSQL source views are available or can be created.
* Each source view has a stable primary key.
* Each business domain can be represented by a record type.
* Approved hash fields will be confirmed before implementation.
* Blockchain network is available and reachable by the backend service.
* Chaincode can be updated or deployed for proof management.
* Backend service has permission to read source views and write history tables.
* Backend service has permission to submit transactions to blockchain.
* Sensitive data classification rules are approved by the business and security teams.
* API authentication and authorization will be enforced before production release.

---

## 10. Risks

### 10.1 Sensitive Data Exposure Risk

Risk: Sensitive business or customer data may accidentally be submitted to blockchain.

Mitigation:

* Use a strict blockchain payload model.
* Submit only hash and approved metadata.
* Add validation before blockchain submission.
* Review logs to ensure sensitive data is not written.

---

### 10.2 Unstable Hash Risk

Risk: Hash values may change because of inconsistent field ordering, date formatting, null handling, or whitespace differences.

Mitigation:

* Use canonical JSON generation.
* Sort fields consistently.
* Normalize dates, numbers, strings, and null values.
* Reuse one generic hash service.

---

### 10.3 Duplicate Proof Risk

Risk: The same proof may be submitted multiple times due to retries or service failures.

Mitigation:

* Use stable blockchain keys.
* Check existing proof before resubmission.
* Make retry logic idempotent.
* Track retry count and status in PostgreSQL.

---

### 10.4 Blockchain Availability Risk

Risk: Blockchain may be temporarily unavailable.

Mitigation:

* Store failed submissions in PostgreSQL.
* Add retry mechanism.
* Separate PostgreSQL history creation from blockchain submission.
* Monitor failed records.

---

### 10.5 Source View Change Risk

Risk: Changes to PostgreSQL source views may break hash generation or sync logic.

Mitigation:

* Version source view definitions.
* Confirm source fields before implementation.
* Add validation checks.
* Monitor failed syncs.

---

### 10.6 Performance Risk

Risk: Large source views may cause slow sync operations.

Mitigation:

* Add proper PostgreSQL indexes.
* Process data in batches.
* Use incremental detection where possible.
* Track last sync date.
* Optimize queries after testing.

---

## 11. Deliverables for This Integration

The full project will deliver:

1. Confirmed integration scope
2. Confirmed ownership model
3. Confirmed PostgreSQL source views
4. PostgreSQL history tables
5. Performance indexes
6. Generic backend sync service
7. Stable hash generation service
8. CREATE detection logic
9. UPDATE detection logic
10. Unchanged record skip logic
11. Hyperledger Fabric chaincode proof functions
12. Blockchain key format standard
13. Blockchain proof submission logic
14. PostgreSQL transaction ID linking
15. Backend sync APIs
16. Backend history APIs
17. Backend verification APIs
18. AML history implementation
19. Customer Data history implementation
20. Transaction Data history implementation
21. Screening Activity history implementation
22. Retry mechanism
23. Verification logic
24. Dashboard APIs
25. Monitoring dashboard
26. History screens
27. Full flow testing
28. Security validation
29. End-to-end validation
30. Final delivery package

---

## 12. Acceptance Criteria for Step 1

Step 1 is accepted when:

* The integration scope is clearly defined.
* PostgreSQL is confirmed as the source of truth.
* Blockchain is confirmed as the proof, verification, and audit layer only.
* Sensitive business data is explicitly excluded from blockchain.
* Main business domains are identified.
* Main modules are identified.
* Main data flows are documented.
* Assumptions are listed.
* Risks and mitigations are documented.
* Project deliverables are listed.
* Acceptance criteria are defined.

---

## 13. Step 1 Status

Status: Completed

This scope document confirms the project direction and allows the project to continue to Step 2: Confirm the ownership model.
