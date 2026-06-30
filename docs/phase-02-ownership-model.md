# Phase 2 — VALOORES Blockchain Integration Ownership Model

## 1. Phase Objective

This phase defines the ownership model between PostgreSQL, Hyperledger Fabric, backend APIs, VALOORES UI, and Compliance/Audit users.

The main rule is:

PostgreSQL owns the complete business data. Hyperledger Fabric owns immutable proof only. The backend owns validation, hash generation, blockchain submission, retry, and verification logic. The frontend owns user interaction, dashboards, verification buttons, and audit screens. Compliance/Audit users approve records before blockchain submission.

---

## 2. Ownership Matrix

| Area | Primary Owner | Responsibility | Stored Data |
|---|---|---|---|
| Business Data | PostgreSQL | Store full VALOORES business records, source views, history tables, approval status, blockchain transaction references, retry status, and verification status | Full business data |
| Immutable Proof | Hyperledger Fabric | Store immutable proof hash, ledger key, source module, source record reference, timestamp, submitted-by user, and blockchain transaction metadata | Proof only |
| Validation Logic | Backend API | Validate record eligibility before blockchain submission | No permanent business ownership |
| Hash Generation | Backend API | Generate deterministic stable hashes from approved PostgreSQL records | Hash output only |
| Blockchain Submission | Backend API | Submit approved proof payloads to Hyperledger Fabric | Submission response and tx ID |
| Retry Logic | Backend API | Detect failed submissions and retry eligible records | Retry metadata in PostgreSQL |
| Verification Logic | Backend API | Recalculate hash from PostgreSQL and compare with Fabric proof | Verification result |
| User Interaction | VALOORES UI | Display records, approval actions, blockchain status, verification buttons, dashboards, and audit screens | UI state only |
| Approval Decision | Compliance/Audit Users | Review and approve records before blockchain submission | Approval decision stored in PostgreSQL |
| Audit Review | Compliance/Audit Users | Review proof history, verification status, retry status, and exceptions | Audit trail displayed from PostgreSQL and Fabric |

---

## 3. Role Responsibility Mapping

| Role | Responsibilities | Not Responsible For |
|---|---|---|
| Business User | Creates or updates business records in VALOORES | Blockchain submission, proof generation, retry, verification |
| Compliance User | Reviews records and approves eligible records for blockchain submission | Fabric chaincode execution, hash generation implementation |
| Audit User | Reviews blockchain status, verification results, proof history, and exceptions | Editing source business data |
| Backend Service | Validates data, creates stable hash, submits proof to Fabric, stores tx ID, manages retries, verifies records | Final business approval decisions |
| PostgreSQL Database | Stores business records, source views, history, approval status, retry status, tx ID, and verification results | Immutable blockchain proof ownership |
| Hyperledger Fabric | Stores immutable proof and supports proof lookup/history | Full business data storage |
| Frontend UI | Shows approval screens, status dashboards, audit history, verify buttons, and error messages | Business data ownership, proof immutability, backend validation |

---

## 4. Data Flow Ownership

### 4.1 Source Business Data

Owner: PostgreSQL

PostgreSQL remains the source of truth for all VALOORES business data.

Examples:
- AML records
- Customer data
- Transaction data
- Screening activity
- History tables
- Source views
- Approval status
- Blockchain transaction references

### 4.2 Approval Flow

Owner: Compliance/Audit Users

Records must be approved before blockchain submission.

Flow:
1. Business data is created or updated in PostgreSQL.
2. Backend detects eligible history records.
3. Frontend displays pending records.
4. Compliance/Audit user reviews the record.
5. Compliance/Audit user approves or rejects the record.
6. PostgreSQL stores the approval decision.
7. Only approved records become eligible for blockchain proof submission.

### 4.3 Blockchain Proof Flow

Owner: Backend API and Hyperledger Fabric

Flow:
1. Backend reads approved record from PostgreSQL.
2. Backend validates required fields.
3. Backend generates a stable deterministic hash.
4. Backend creates a proof-only payload.
5. Backend submits the proof payload to Hyperledger Fabric.
6. Hyperledger Fabric stores immutable proof only.
7. Backend receives Fabric transaction ID.
8. Backend stores Fabric transaction ID and submission status in PostgreSQL.

### 4.4 UI Flow

Owner: VALOORES UI

The frontend owns:
- Pending approval screens
- Blockchain status display
- Verification buttons
- Retry buttons if allowed by role
- Dashboard cards
- Audit/history screens
- Error and success messages

The frontend does not generate hashes and does not submit directly to Fabric.

---

## 5. Approval Ownership

| Approval Area | Owner | Rule |
|---|---|---|
| Approval decision | Compliance/Audit Users | Human approval is required before blockchain submission |
| Approval storage | PostgreSQL | Approval status, approved by, approved at, and rejection reason are stored in PostgreSQL |
| Approval validation | Backend API | Backend validates that only approved records can be submitted |
| Approval screen | Frontend UI | Frontend displays pending, approved, rejected, submitted, and failed states |
| Approval audit trail | PostgreSQL + UI | PostgreSQL stores the approval audit trail and UI displays it |

Approval status values should support:
- PENDING_APPROVAL
- APPROVED
- REJECTED
- SUBMITTED
- FAILED
- RETRY_PENDING
- VERIFIED
- VERIFICATION_FAILED

---

## 6. Verification Ownership

| Verification Area | Owner | Rule |
|---|---|---|
| Verification trigger | Frontend UI | User clicks verify from audit/history screen |
| Verification execution | Backend API | Backend recalculates hash and compares it with Fabric proof |
| Source data for recalculation | PostgreSQL | Backend recalculates hash from PostgreSQL business/history data |
| Immutable proof source | Hyperledger Fabric | Backend reads proof from Fabric |
| Verification result storage | PostgreSQL | Verification result, timestamp, and reason are stored in PostgreSQL |
| Verification result display | Frontend UI | UI displays verified, mismatch, not found, or error state |

Verification result values should support:
- VERIFIED
- HASH_MISMATCH
- FABRIC_PROOF_NOT_FOUND
- POSTGRES_RECORD_NOT_FOUND
- VERIFICATION_ERROR

---

## 7. Error and Retry Ownership

| Error/Retry Area | Owner | Rule |
|---|---|---|
| Validation errors | Backend API | Backend rejects invalid records before hash generation |
| Business data errors | PostgreSQL + Backend API | PostgreSQL stores data; backend identifies missing/invalid fields |
| Fabric submission errors | Backend API | Backend catches Fabric errors and marks record as failed |
| Retry eligibility | Backend API | Backend decides if a failed record can be retried |
| Retry status | PostgreSQL | Retry count, last retry date, next retry date, and error message are stored in PostgreSQL |
| Retry action | Backend API | Backend performs retry submission |
| Retry button/display | Frontend UI | Frontend displays failed records and retry action based on permissions |
| Audit visibility | Frontend UI | UI shows error reason, retry count, and last retry status |

Retry rules:
1. Only approved records can be retried.
2. Rejected records must not be submitted or retried.
3. Records with unchanged hash must not be resubmitted unless the previous Fabric submission failed.
4. Retry count must be tracked in PostgreSQL.
5. Final failed records must remain visible to Audit users.
6. Fabric must not store full business data during retry.

---

## 8. Data Ownership Rules

### 8.1 PostgreSQL Owns Full Business Data

PostgreSQL owns:
- Full source records
- Source views
- History records
- Approval status
- Blockchain submission status
- Fabric transaction ID
- Retry metadata
- Verification result
- Dashboard source data

### 8.2 Hyperledger Fabric Owns Immutable Proof Only

Fabric owns:
- Ledger key
- Record hash
- Source module name
- Source record ID/reference
- Proof timestamp
- Submitted-by identity
- Fabric transaction ID
- Immutable history of proof submissions

Fabric must not store:
- Customer full personal data
- Full AML business records
- Full transaction details
- Full screening details
- Editable business fields

### 8.3 Backend Owns Integration Logic

Backend owns:
- Reading source views
- Creating history records
- Detecting creates and updates
- Skipping unchanged records
- Generating stable hash
- Validating approval status
- Submitting proof to Fabric
- Linking Fabric transaction ID to PostgreSQL
- Retry handling
- Verification logic
- API security and permissions

### 8.4 Frontend Owns User Experience

Frontend owns:
- Approval screens
- Audit screens
- Blockchain dashboard
- Status badges
- Verify buttons
- Retry buttons
- Success/error messages
- User-facing filtering and search

---

## 9. Phase 2 Final Ownership Decision

The approved ownership model is:

1. PostgreSQL is the system of record for VALOORES business data.
2. Hyperledger Fabric is the immutable proof ledger only.
3. Backend APIs are the controlled integration layer between PostgreSQL and Fabric.
4. Frontend UI provides visibility and controlled actions but does not own business data or proof logic.
5. Compliance/Audit users control approval before blockchain submission.
6. Every blockchain submission must be approval-based, hash-based, proof-only, traceable, retryable, and verifiable.

---

## 10. Checklist Before Moving to Phase 3

| # | Checklist Item | Status |
|---|---|---|
| 1 | PostgreSQL ownership of full business data is confirmed | Done |
| 2 | Hyperledger Fabric proof-only ownership is confirmed | Done |
| 3 | Backend responsibility for validation is confirmed | Done |
| 4 | Backend responsibility for stable hash generation is confirmed | Done |
| 5 | Backend responsibility for Fabric submission is confirmed | Done |
| 6 | Backend responsibility for retry logic is confirmed | Done |
| 7 | Backend responsibility for verification logic is confirmed | Done |
| 8 | Frontend responsibility for user interaction is confirmed | Done |
| 9 | Frontend responsibility for dashboards and audit screens is confirmed | Done |
| 10 | Compliance/Audit approval before blockchain submission is confirmed | Done |
| 11 | Full business data must not be stored on Fabric | Done |
| 12 | Fabric transaction ID must be linked back to PostgreSQL | Done |
| 13 | Failed submissions must remain retryable and auditable | Done |
| 14 | Verification must compare PostgreSQL recalculated hash with Fabric proof | Done |
| 15 | Phase 2 ownership model is documented | Done |

Phase 3 can start only after this document is reviewed, tested, committed, and pushed.
