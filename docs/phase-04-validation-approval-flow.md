# Phase 4 — VALOORES Blockchain Validation and Approval Flow

## 1. Phase Objective

Phase 4 defines the validation and approval workflow that must happen before any proof is submitted to Hyperledger Fabric.

The main rule is:

**No proof may be submitted to blockchain until the record is validated by the backend and approved by a Compliance or Audit user.**

PostgreSQL remains the system of record for the full business data. Hyperledger Fabric stores only the proof metadata required for integrity verification.

---

## 2. Required End-to-End Flow

1. A record is created or updated in VALOORES.
2. PostgreSQL stores the full business data.
3. Backend validates the record.
4. Compliance or Audit user approves the record.
5. Backend generates a stable hash.
6. Backend submits proof to Hyperledger Fabric.
7. Fabric returns the blockchain transaction ID.
8. PostgreSQL stores:
   - stable hash
   - blockchain key
   - Fabric transaction ID
   - blockchain submission status
9. User can verify the record anytime.

---

## 3. Approval Workflow Design

### 3.1 Main Actors

| Actor | Responsibility |
|---|---|
| Business User / System Process | Creates or updates the VALOORES business record. |
| Backend Validation Layer | Validates required data, ownership rules, privacy rules, and hash readiness. |
| Compliance User | Reviews and approves or rejects the validated record. |
| Audit User | Can review, approve, reject, and verify records based on audit permissions. |
| Blockchain Submission Service | Generates the stable hash and submits proof-only data to Hyperledger Fabric. |
| Verification Service | Recalculates the hash and compares it with PostgreSQL and Fabric proof data. |

### 3.2 Approval Workflow

When a VALOORES record is created or updated, the backend must not submit it directly to blockchain.

The record first enters a validation stage. If validation fails, the record remains stored in PostgreSQL but cannot continue to approval.

If validation passes, the record becomes pending approval. A Compliance or Audit user reviews the record and either approves or rejects it.

Only approved records can continue to hash generation and blockchain proof submission.

### 3.3 Approval Rules

1. Records must be validated before approval.
2. Only Compliance or Audit users can approve.
3. The user who created or last changed the record should not approve the same record when segregation of duties is required.
4. Rejected records must include a rejection reason.
5. Approved records must store approver information and approval timestamp.
6. Approved records must not be changed silently after approval.
7. If the business record changes after approval but before blockchain submission, approval must be reset.
8. If the business record changes after blockchain submission, a new history version must be created and approved separately.
9. Blockchain submission must be proof-only and must not include sensitive business data.
10. Every approval, rejection, validation failure, retry, and verification event should be auditable.

---

## 4. Status Lifecycle

### 4.1 Recommended Statuses

| Status | Meaning |
|---|---|
| `CHANGE_CAPTURED` | A create or update event was detected and stored in PostgreSQL. |
| `VALIDATION_PENDING` | Record is waiting for backend validation. |
| `VALIDATION_FAILED` | Backend validation failed. |
| `APPROVAL_PENDING` | Backend validation passed and the record is waiting for Compliance/Audit approval. |
| `REJECTED` | Compliance/Audit user rejected the record. |
| `APPROVED` | Compliance/Audit user approved the record. |
| `HASH_GENERATED` | Stable hash was generated after approval. |
| `BLOCKCHAIN_PENDING` | Proof is ready to be submitted to Fabric. |
| `BLOCKCHAIN_SUBMITTING` | Backend is actively submitting proof to Fabric. |
| `BLOCKCHAIN_CONFIRMED` | Fabric accepted the proof and returned a transaction ID. |
| `BLOCKCHAIN_FAILED` | Fabric submission failed. |
| `RETRY_PENDING` | Submission failed and is waiting for retry. |
| `VERIFY_OK` | Latest verification succeeded. |
| `VERIFY_FAILED` | Latest verification failed. |

### 4.2 Allowed Transitions

| From | To |
|---|---|
| `CHANGE_CAPTURED` | `VALIDATION_PENDING` |
| `VALIDATION_PENDING` | `VALIDATION_FAILED` |
| `VALIDATION_PENDING` | `APPROVAL_PENDING` |
| `VALIDATION_FAILED` | `VALIDATION_PENDING` |
| `APPROVAL_PENDING` | `REJECTED` |
| `APPROVAL_PENDING` | `APPROVED` |
| `REJECTED` | `VALIDATION_PENDING` |
| `APPROVED` | `HASH_GENERATED` |
| `HASH_GENERATED` | `BLOCKCHAIN_PENDING` |
| `BLOCKCHAIN_PENDING` | `BLOCKCHAIN_SUBMITTING` |
| `BLOCKCHAIN_SUBMITTING` | `BLOCKCHAIN_CONFIRMED` |
| `BLOCKCHAIN_SUBMITTING` | `BLOCKCHAIN_FAILED` |
| `BLOCKCHAIN_FAILED` | `RETRY_PENDING` |
| `RETRY_PENDING` | `BLOCKCHAIN_SUBMITTING` |
| `BLOCKCHAIN_CONFIRMED` | `VERIFY_OK` |
| `BLOCKCHAIN_CONFIRMED` | `VERIFY_FAILED` |

---

## 5. Required PostgreSQL Status Fields

The following fields should exist in the blockchain proof/history table or in a linked approval tracking table.

### 5.1 Validation Fields

| Field | Purpose |
|---|---|
| `validation_status` | Stores `VALIDATION_PENDING`, `VALIDATION_FAILED`, or `VALIDATED`. |
| `validation_errors` | JSONB list of validation errors. |
| `validation_rules_version` | Version of backend validation rules used. |
| `validated_by` | System user/service that completed validation. |
| `validated_at` | Timestamp when validation completed. |

### 5.2 Approval Fields

| Field | Purpose |
|---|---|
| `approval_status` | Stores `APPROVAL_PENDING`, `APPROVED`, or `REJECTED`. |
| `approval_requested_at` | Timestamp when approval was requested. |
| `approved_by` | Compliance/Audit user who approved. |
| `approved_at` | Timestamp when approval happened. |
| `rejected_by` | Compliance/Audit user who rejected. |
| `rejected_at` | Timestamp when rejection happened. |
| `rejection_reason` | Required explanation when rejected. |
| `approval_comment` | Optional approval or review note. |

### 5.3 Blockchain Proof Fields

| Field | Purpose |
|---|---|
| `record_hash` | Stable hash generated from approved canonical business data. |
| `hash_algorithm` | Hash algorithm, for example `SHA-256`. |
| `hash_generated_at` | Timestamp when the stable hash was generated. |
| `blockchain_key` | Deterministic key used on Hyperledger Fabric. |
| `fabric_tx_id` | Transaction ID returned by Hyperledger Fabric. |
| `blockchain_status` | Stores `BLOCKCHAIN_PENDING`, `BLOCKCHAIN_SUBMITTING`, `BLOCKCHAIN_CONFIRMED`, `BLOCKCHAIN_FAILED`, or `RETRY_PENDING`. |
| `blockchain_submitted_at` | Timestamp when proof was submitted. |
| `blockchain_confirmed_at` | Timestamp when Fabric confirmation was stored. |
| `blockchain_error` | Last Fabric submission error message. |
| `retry_count` | Number of submission retry attempts. |
| `last_retry_at` | Timestamp of latest retry attempt. |

### 5.4 Verification Fields

| Field | Purpose |
|---|---|
| `last_verification_status` | Stores `VERIFY_OK` or `VERIFY_FAILED`. |
| `last_verified_at` | Timestamp of latest verification. |
| `last_verified_by` | User or service that performed verification. |
| `verification_error` | Reason if verification failed. |

---

## 6. Required Backend Validation Rules

Before approval, the backend must validate:

### 6.1 Record Identity Rules

1. Source table or source view is known.
2. Business record ID is present.
3. History version or change timestamp is present.
4. Operation type is valid: `CREATE` or `UPDATE`.
5. Blockchain key can be generated deterministically.

### 6.2 Data Completeness Rules

1. Required business fields are present.
2. Required ownership fields are present.
3. Required status fields are present.
4. Required source metadata is present.
5. Record can be converted to canonical JSON for stable hashing.

### 6.3 Data Privacy Rules

1. Sensitive fields must not be sent to blockchain.
2. Full business data remains only in PostgreSQL.
3. Fabric payload contains only proof metadata.
4. The hash input must follow the Phase 3 privacy classification.
5. Personal data, financial details, documents, and confidential notes must not be included in Fabric payload.

### 6.4 Approval Readiness Rules

1. Record must pass validation before approval.
2. Record must not already be rejected unless resubmitted.
3. Record must not already be blockchain-confirmed for the same version.
4. Record must not be changed after validation without revalidation.
5. Record must not be changed after approval without resetting approval.

### 6.5 Hash Readiness Rules

1. Canonical JSON must be stable.
2. Field ordering must be deterministic.
3. Null handling must be consistent.
4. Timestamp formatting must be consistent.
5. Hash must be generated only after approval.

---

## 7. Required API Actions

### 7.1 Validation APIs

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/v1/blockchain-proof/records/:id/validate` | Validate a selected record. |
| `GET` | `/api/v1/blockchain-proof/records/:id/validation-status` | Return validation status and errors. |

### 7.2 Approval APIs

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/v1/blockchain-proof/approvals/pending` | List records waiting for approval. |
| `POST` | `/api/v1/blockchain-proof/records/:id/approve` | Approve a validated record. |
| `POST` | `/api/v1/blockchain-proof/records/:id/reject` | Reject a validated record. |
| `GET` | `/api/v1/blockchain-proof/records/:id/approval-status` | Return approval status. |

### 7.3 Blockchain Submission APIs

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/v1/blockchain-proof/records/:id/generate-hash` | Generate stable hash after approval. |
| `POST` | `/api/v1/blockchain-proof/records/:id/submit` | Submit approved proof to Fabric. |
| `POST` | `/api/v1/blockchain-proof/records/:id/retry` | Retry failed blockchain submission. |

### 7.4 Verification APIs

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/v1/blockchain-proof/records/:id/verify` | Verify PostgreSQL record against stored hash and Fabric proof. |
| `GET` | `/api/v1/blockchain-proof/records/:id/proof` | Return proof metadata and blockchain transaction information. |

---

## 8. Failure Handling Rules

### 8.1 Validation Failure

If backend validation fails:

1. Set `validation_status = VALIDATION_FAILED`.
2. Store validation errors in `validation_errors`.
3. Do not allow approval.
4. Do not generate hash.
5. Do not submit to Fabric.
6. Allow the record to be corrected and revalidated.

### 8.2 Approval Rejection

If Compliance or Audit rejects:

1. Set `approval_status = REJECTED`.
2. Store `rejected_by`, `rejected_at`, and `rejection_reason`.
3. Do not generate hash.
4. Do not submit to Fabric.
5. Allow resubmission only after correction and revalidation.

### 8.3 Hash Generation Failure

If hash generation fails:

1. Keep the record approved.
2. Store hash error details.
3. Do not submit to Fabric.
4. Allow retry after fixing canonicalization or source data issue.

### 8.4 Fabric Submission Failure

If Fabric submission fails:

1. Set `blockchain_status = BLOCKCHAIN_FAILED`.
2. Store `blockchain_error`.
3. Increase `retry_count`.
4. Set `last_retry_at` when retry is attempted.
5. Do not mark the proof as confirmed.
6. Allow retry with the same approved hash and blockchain key.

### 8.5 Fabric Confirmation Failure

If Fabric returns no transaction ID:

1. Treat the submission as failed.
2. Do not store a fake transaction ID.
3. Keep the proof in `BLOCKCHAIN_FAILED` or `RETRY_PENDING`.
4. Require retry or manual audit review.

### 8.6 Verification Failure

If verification fails:

1. Set `last_verification_status = VERIFY_FAILED`.
2. Store `verification_error`.
3. Do not overwrite original hash or transaction ID.
4. Raise an audit alert.
5. Require investigation before any corrective action.

---

## 9. Phase 4 Checklist Before Moving to Phase 5

Before Phase 5 starts, confirm that:

- [ ] Approval workflow is documented.
- [ ] Status lifecycle is documented.
- [ ] PostgreSQL status fields are defined.
- [ ] Backend validation rules are defined.
- [ ] API actions are defined.
- [ ] Failure handling rules are defined.
- [ ] Blockchain submission is blocked before validation and approval.
- [ ] Sensitive business data is not submitted to Fabric.
- [ ] Approved hash generation happens only after Compliance/Audit approval.
- [ ] Retry behavior is defined.
- [ ] Verification behavior is defined.
- [ ] Phase 4 document is committed using the required commit message format.

---

## 10. Phase 4 Completion Criteria

Phase 4 is complete when the project has a documented validation and approval flow that clearly defines:

1. Who can approve blockchain proof submission.
2. Which statuses control the workflow.
3. Which PostgreSQL fields are required.
4. Which backend validation rules must pass.
5. Which API actions are required.
6. How validation, approval, blockchain, retry, and verification failures are handled.
7. What must be checked before implementation continues in Phase 5.
