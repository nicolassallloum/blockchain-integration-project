# Phase 3 — Data Privacy and Blockchain Data Classification

## 1. Phase Objective

This phase defines the blockchain data privacy rules for the VALOORES Blockchain Integration Project.

The objective is to classify which data can be used for hashing, which data can be stored as safe blockchain metadata, which data must remain PostgreSQL-only, and which data must never be stored directly on blockchain.

## 2. Core Privacy Rule

Sensitive customer data must never be stored directly on blockchain.

PostgreSQL remains the source of truth for business data.

Blockchain stores proof only: hashes, transaction references, and safe metadata.

## 3. Data Classification Table

| Classification | Description | Blockchain Rule | Examples | Storage |
|---|---|---|---|---|
| Public metadata | Non-sensitive operational proof metadata | Allowed | module, entity type, proof type, source system, version | Blockchain + PostgreSQL |
| Internal business data | Internal workflow or business process data | Do not store directly unless converted to safe metadata | case status, workflow status, rule category | PostgreSQL only; selected fields may be hash input |
| Sensitive data | Personal, financial, compliance, or customer-linked data | Forbidden directly on blockchain | name, phone, email, address, document number, account number, transaction amount | PostgreSQL only; selected fields may be hash input |
| Restricted data | Secrets, documents, credentials, investigation details, or highly regulated data | Never store on blockchain | passwords, tokens, private keys, scanned IDs, biometric data, analyst notes | Secure internal systems only |
| Hash-only data | Data used to prove integrity but not readable on blockchain | Store only final hash | normalized customer snapshot, AML rule state, transaction proof fields | PostgreSQL source + blockchain hash |

## 4. Fields Allowed on Blockchain

| Field | Allowed | Reason |
|---|---:|---|
| ledger_key | Yes | Blockchain record identifier |
| entity_type | Yes | Describes the business object type |
| entity_id_hash | Yes | Hashed internal entity reference |
| module | Yes | AML, KYC, Transaction, or Screening |
| source_system | Yes | Identifies the source system |
| proof_type | Yes | CREATE, UPDATE, CLOSE, VERIFY |
| data_hash | Yes | Integrity proof of normalized PostgreSQL data |
| previous_hash | Yes | Supports history chain continuity |
| hash_algorithm | Yes | Required for verification |
| payload_version | Yes | Supports future schema evolution |
| postgres_history_id | Yes | Internal history reference when not sensitive |
| blockchain_tx_id | Yes | Fabric transaction reference |
| created_at | Yes | Proof creation timestamp |
| submitted_by_service | Yes | Backend service name only |
| verification_status | Yes | Proof verification status |

## 5. Fields Forbidden on Blockchain

| Category | Forbidden Examples |
|---|---|
| Customer identity | customer name, resident name, first name, last name, mother name |
| Personal identifiers | national ID, passport number, residency number, document number, tax ID |
| Contact information | phone number, mobile number, email, address |
| Personal details | date of birth, place of birth, nationality when linked to a person |
| Financial data | account number, IBAN, card number, balance, salary, transaction amount |
| Transaction parties | sender, receiver, beneficiary, remitter, account holder |
| AML details | analyst notes, investigation notes, suspicious activity explanation |
| Screening details | sanctions details, watchlist raw response, PEP details, adverse media details |
| Documents | scanned IDs, passport images, PDFs, attachments, uploaded files |
| Security data | passwords, password hashes, JWT tokens, API keys, private keys, session IDs |
| Biometric data | face image, fingerprint, voiceprint, biometric templates |
| Raw payloads | raw customer JSON, raw transaction JSON, raw screening JSON |

## 6. Recommended Blockchain Payload Structure

The blockchain payload must contain proof-only data.

| Payload Field | Example |
|---|---|
| ledgerKey | VALOORES:AML:AML_RULE:entityHash:historyId |
| entityType | AML_RULE, CUSTOMER_KYC, TRANSACTION, SCREENING_ACTIVITY |
| entityIdHash | SHA-256 hash of the internal entity ID |
| module | AML, KYC, TRANSACTION, SCREENING |
| sourceSystem | VALOORES_POSTGRESQL |
| proofType | CREATE, UPDATE, CLOSE, VERIFY |
| dataHash | SHA-256 hash of the normalized source record |
| previousHash | Previous record hash or null |
| hashAlgorithm | SHA-256 |
| payloadVersion | 1.0 |
| postgresHistoryId | Internal PostgreSQL history ID |
| createdAt | ISO-8601 timestamp |
| submittedByService | blockchain-api |
| verificationStatus | PENDING, VERIFIED, FAILED |

## 7. Recommended PostgreSQL-Only Fields

| Area | PostgreSQL-Only Fields |
|---|---|
| Customer KYC | name, national ID, date of birth, address, phone, email, document details |
| AML rules | full rule description, query text, internal rule logic, comments |
| AML cases | case notes, alert details, suspicious activity explanation, reviewer comments |
| Transactions | amount, currency, sender, receiver, account number, branch, payment details |
| Screening | raw screening response, watchlist details, sanctions details, PEP details |
| Attachments | PDFs, scanned IDs, images, exported reports, supporting documents |
| Security | tokens, passwords, secrets, API keys, private keys, service credentials |
| Audit | user IP address, session ID, raw request body, raw response body |

## 8. Recommended Hash Input Fields

Hash input fields must be normalized, ordered, and deterministic.

| Module | Recommended Hash Input Fields |
|---|---|
| Common | source_table_or_view, source_primary_key, entity_type, business_status, event_type, created_at, updated_at, payload_version |
| AML Rule | rule_id, query_id, rule_status, rule_category, normalized_rule_content, last_updated_at |
| Customer KYC | customer_id, kyc_status, customer_name, document_status, national_id_or_passport when approved, last_updated_at |
| Transaction | transaction_id, transaction_status, amount, currency, sender_receiver_account when approved, transaction_timestamp, last_updated_at |
| Screening Activity | screening_id, customer_id, screening_status, match_result_category, screened_at |

The original hash input values must remain PostgreSQL-only. Only the final hash value is submitted to blockchain.

## 9. Hashing Rules

1. Use SHA-256 unless a future architecture decision approves another algorithm.
2. Normalize JSON before hashing.
3. Sort object keys before hashing.
4. Use stable ISO-8601 date and timestamp format.
5. Remove volatile fields unless they are part of the business event.
6. Never include passwords, tokens, secrets, private keys, or session IDs in hash input.
7. Never submit the original hash input payload to blockchain.
8. Keep the normalized hash input reproducible from PostgreSQL.
9. Store only the final hash value on blockchain.
10. Version every payload to avoid future verification mismatch.

## 10. Security and Privacy Checklist Before Moving to Phase 4

| # | Checklist Item | Status |
|---:|---|---|
| 1 | No customer personal data is stored directly on blockchain | Required |
| 2 | No documents, PDFs, images, or attachments are stored on blockchain | Required |
| 3 | No passwords, tokens, API keys, or private keys are stored on blockchain | Required |
| 4 | Blockchain payload contains proof-only metadata | Required |
| 5 | Hash input fields are documented per module | Required |
| 6 | PostgreSQL remains the source of truth for business data | Required |
| 7 | Blockchain stores only hash proof, transaction ID, and safe metadata | Required |
| 8 | Entity IDs are hashed before blockchain submission | Required |
| 9 | Hash algorithm and payload version are included in every proof | Required |
| 10 | Sensitive fields are masked or excluded from logs | Required |
| 11 | Verification logic can reproduce the same hash from PostgreSQL | Required |
| 12 | Proof submission APIs are restricted to authorized backend services | Required |
| 13 | Fabric wallet and private key files are protected by server permissions | Required |
| 14 | Error logs do not expose raw customer or transaction payloads | Required |
| 15 | Phase 4 implementation must follow this classification document | Required |

## 11. Phase 3 Decision

The approved Phase 3 direction is:

- PostgreSQL stores full business and sensitive data.
- Blockchain stores only proof metadata and hash values.
- Sensitive customer data must never be stored directly on blockchain.
- Restricted data must never be stored on blockchain.
- Future implementation phases must validate blockchain payloads against this classification before submitting to Fabric.
