# VALOORES Blockchain Integration Project

## Phase 1 — Blockchain Scope Confirmation Document

### 1. Purpose

The purpose of this phase is to confirm the exact role of blockchain inside the VALOORES Blockchain Integration Project.

Blockchain will not replace PostgreSQL, the existing backend, or the current operational database model. PostgreSQL remains the main source of truth for business data, application records, reporting, search, filtering, dashboards, and operational workflows.

Hyperledger Fabric will be used as a trusted proof layer. It will store tamper-evident proof records, hashes, blockchain transaction references, approval metadata, and verification references for selected VALOORES business events.

The main objective is to prove that important records existed at a specific time, were approved by a specific actor or process, and were not modified after the proof was created.

---

### 2. Confirmed Blockchain Role

Blockchain will be used for:

1. Proof of record existence.
2. Proof of data integrity using hashes.
3. Proof of approval or closure events.
4. Proof of verification history.
5. Evidence chain-of-custody tracking.
6. Blockchain transaction reference storage.
7. Independent verification against PostgreSQL data.

Blockchain will not be used for:

1. Replacing PostgreSQL.
2. Storing full customer records.
3. Storing full AML rule details.
4. Storing full case details.
5. Storing full evidence files.
6. Running business queries or reports.
7. Replacing backend authorization.
8. Replacing existing VALOORES workflows.
9. Storing sensitive personal or financial data directly.
10. Acting as the operational application database.

---

### 3. PostgreSQL Responsibility

PostgreSQL remains responsible for:

1. Full business records.
2. Customer KYC data.
3. AML rule configuration.
4. AML case data.
5. Screening data.
6. Evidence metadata and file references.
7. Application search and filtering.
8. Reports and dashboards.
9. User permissions and access control.
10. Operational workflow state.

---

### 4. Hyperledger Fabric Responsibility

Hyperledger Fabric is responsible for storing proof records only.

Each blockchain proof should contain enough information to verify that a PostgreSQL record or business event is authentic, unchanged, and linked to a trusted approval or action.

Fabric will store:

1. Record hash.
2. Business entity reference.
3. Module name.
4. Action type.
5. PostgreSQL reference ID.
6. Approval metadata.
7. Blockchain transaction ID.
8. Timestamp.
9. Actor reference.
10. Verification reference.
11. Previous proof reference where needed.
12. Evidence custody transition references where needed.

---

### 5. First Implementation Modules

The first implementation will include the following modules:

#### 5.1 AML Rules Blockchain Proof

This module will create blockchain proof when AML rules are created, updated, approved, activated, deactivated, or submitted for blockchain verification.

The blockchain will not store the complete AML rule logic. It will store only the rule reference, hash, approval metadata, and verification reference.

#### 5.2 Customer KYC Blockchain Proof

This module will create blockchain proof for selected KYC lifecycle events.

The blockchain will not store full customer personal data, documents, addresses, IDs, or sensitive fields. It will store only proof hashes and references that allow PostgreSQL data to be verified.

#### 5.3 AML Case Closure Blockchain Proof

This module will create blockchain proof when an AML case is closed, approved, escalated, rejected, or finalized.

The blockchain will not store case notes, investigation details, customer data, or sensitive case content. It will store closure proof, approval metadata, closure decision hash, and verification reference.

#### 5.4 Evidence Chain of Custody

This module will create blockchain proof for evidence registration and custody movement.

The blockchain will not store evidence files or sensitive evidence content. It will store evidence hash, custody action, actor reference, timestamp, previous custody proof reference, and verification status.

---

### 6. Actions That Require Blockchain Proof

The following actions require blockchain proof in the first implementation.

#### 6.1 AML Rules

1. AML rule created.
2. AML rule updated.
3. AML rule approved.
4. AML rule activated.
5. AML rule deactivated.
6. AML rule version submitted to blockchain.
7. AML rule verification requested.
8. AML rule integrity check completed.

#### 6.2 Customer KYC

1. Customer KYC profile created.
2. Customer KYC profile updated.
3. Customer KYC document uploaded or replaced.
4. Customer risk score updated.
5. Customer screening result approved.
6. Customer KYC review completed.
7. Customer KYC verification requested.
8. Customer KYC integrity check completed.

#### 6.3 AML Case Closure

1. AML case closure submitted.
2. AML case closure approved.
3. AML case closure rejected.
4. AML case escalated.
5. AML case reopened.
6. AML case final decision recorded.
7. AML case verification requested.
8. AML case closure integrity check completed.

#### 6.4 Evidence Chain of Custody

1. Evidence registered.
2. Evidence hash generated.
3. Evidence assigned to an investigator or officer.
4. Evidence transferred between users or departments.
5. Evidence reviewed.
6. Evidence attached to a case.
7. Evidence marked as sealed.
8. Evidence verification requested.
9. Evidence custody integrity check completed.

---

### 7. Data Allowed on Blockchain

The following data is allowed on blockchain:

1. Module name.
2. Entity type.
3. Entity reference ID.
4. PostgreSQL table or view reference.
5. PostgreSQL record ID.
6. Business key or generated proof key.
7. Hash of approved data.
8. Hash algorithm.
9. Blockchain transaction ID.
10. Fabric channel name.
11. Chaincode name.
12. Chaincode function name.
13. Actor user ID or system actor reference.
14. Approver user ID or approver reference.
15. Approval status.
16. Action type.
17. Event timestamp.
18. Proof creation timestamp.
19. Previous proof hash.
20. Previous blockchain transaction reference.
21. Verification status.
22. Verification timestamp.
23. Evidence hash.
24. Custody transition reference.
25. Non-sensitive comments or reason codes when approved.

---

### 8. Data Not Allowed on Blockchain

The following data must not be stored on blockchain:

1. Full customer name.
2. National ID number.
3. Passport number.
4. Date of birth.
5. Address.
6. Phone number.
7. Email address.
8. Customer documents.
9. KYC document images or files.
10. Full AML rule logic.
11. Full AML scenario conditions.
12. Full AML case description.
13. Investigation notes.
14. Suspicious activity narrative.
15. Full transaction data.
16. Account numbers.
17. Card numbers.
18. IBAN.
19. Bank account details.
20. Source-of-funds details.
21. Evidence files.
22. Evidence images.
23. Confidential legal documents.
24. Internal user passwords.
25. Authentication tokens.
26. Session tokens.
27. API keys.
28. Private keys.
29. Fabric certificates or secrets.
30. Any sensitive personal, financial, legal, or confidential business data.

---

### 9. Approved Architecture Summary

The approved architecture is a hybrid PostgreSQL and Hyperledger Fabric model.

PostgreSQL remains the operational source of truth. All VALOORES business data stays in PostgreSQL and continues to be managed by the existing backend and application workflows.

When a blockchain-relevant business action occurs, the backend prepares a normalized proof payload. The backend generates a stable hash from the selected approved data. Only the hash, references, transaction metadata, approval metadata, and verification details are submitted to Hyperledger Fabric.

After Fabric confirms the transaction, the blockchain transaction ID and proof reference are stored back in PostgreSQL. This creates a two-way verification model:

1. PostgreSQL stores the full business data and blockchain reference.
2. Fabric stores the immutable proof and verification metadata.
3. Verification APIs compare the current PostgreSQL data hash with the blockchain hash.
4. If both hashes match, the record is verified.
5. If the hashes do not match, the record is flagged as changed, corrupted, or not matching the approved blockchain proof.

This architecture keeps sensitive data inside PostgreSQL while using blockchain for trust, integrity, auditability, and tamper-evidence.

---

### 10. Final Approved Scope Decision

The approved blockchain scope for the first implementation is:

1. AML Rules Blockchain Proof.
2. Customer KYC Blockchain Proof.
3. AML Case Closure Blockchain Proof.
4. Evidence Chain of Custody.

The blockchain will store proof only. It will not store full business records, customer data, evidence files, AML rule details, or sensitive operational data.

PostgreSQL remains the source of truth.

Hyperledger Fabric acts as the proof, integrity, and verification layer.

---

### 11. Checklist Before Moving to Phase 2

Before starting Phase 2, confirm the following:

- [x] Project structure inspected.
- [x] Correct repository branch confirmed.
- [x] Documentation location confirmed.
- [x] Backend folder confirmed.
- [x] Frontend folder confirmed.
- [x] Existing blockchain-related files identified.
- [x] Existing Fabric chaincode/service files identified.
- [x] Existing PostgreSQL integration files identified.
- [x] Scope document added to the repository.
- [x] Scope document reviewed.
- [ ] Scope document committed.
- [x] PostgreSQL remains confirmed as source of truth.
- [x] Hyperledger Fabric confirmed as proof layer only.
- [x] First implementation modules confirmed.
- [x] Blockchain-allowed data confirmed.
- [x] Blockchain-forbidden data confirmed.
- [x] Verification approach confirmed.
- [ ] Phase 2 can begin.
