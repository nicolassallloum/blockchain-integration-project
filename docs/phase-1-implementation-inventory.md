# VALOORES Blockchain Integration Project

## Phase 1 — Implementation Inventory

### 1. Purpose

This document records the current implementation status after inspecting the existing VALOORES Blockchain Integration Project files.

It maps the approved Phase 1 blockchain scope to the current backend, PostgreSQL, and Hyperledger Fabric implementation.

PostgreSQL remains the source of truth. Hyperledger Fabric stores proof only.

---

### 2. Confirmed Existing Project Areas

#### 2.1 Backend Routes

The project already includes blockchain-related route files, including:

- blockchain-api/src/routes/blockchain-kyc.routes.js
- blockchain-api/src/routes/blockchain-proof-api.routes.js
- blockchain-api/src/routes/blockchain-proof-history-sync.routes.js
- blockchain-api/src/routes/blockchain-proof-ownership.routes.js
- blockchain-api/src/routes/blockchain-proof-source-views.routes.js
- blockchain-api/src/routes/documents-kyc.routes.js
- blockchain-api/src/routes/fabric.routes.js
- blockchain-api/src/routes/government-blockchain-proofs.routes.js
- blockchain-api/src/routes/government-valoores-aml-rules.routes.js
- blockchain-api/src/routes/hash-verification.routes.js
- blockchain-api/src/routes/valoores-blockchain.routes.js

#### 2.2 Backend Controllers

The project already includes blockchain proof controllers, including:

- blockchain-proof-aml-history.controller.js
- blockchain-proof-api.controller.js
- blockchain-proof-customer-history.controller.js
- blockchain-proof-dashboard.controller.js
- blockchain-proof-history.controller.js
- blockchain-proof-history-sync.controller.js
- blockchain-proof-ownership.controller.js
- blockchain-proof-retry.controller.js
- blockchain-proof-screening-history.controller.js
- blockchain-proof-source-views.controller.js
- blockchain-proof-transaction-history.controller.js
- blockchain-proof-verification.controller.js
- blockchain-proof-verification-logic.controller.js

#### 2.3 Backend Services

The project already includes blockchain proof services, including:

- blockchain-proof-aml-history.service.js
- blockchain-proof-customer-history.service.js
- blockchain-proof-dashboard.service.js
- blockchain-proof-fabric-submit.service.js
- blockchain-proof-history.service.js
- blockchain-proof-history-sync.service.js
- blockchain-proof-ownership.service.js
- blockchain-proof-postgres.service.js
- blockchain-proof-retry.service.js
- blockchain-proof-screening-history.service.js
- blockchain-proof-source-views.service.js
- blockchain-proof-transaction-history.service.js
- blockchain-proof-verification.service.js
- blockchain-proof-verification-logic.service.js
- fabric.service.js
- fabricGateway.service.js
- valoores-aml-rules-sync.service.js

#### 2.4 PostgreSQL Scripts

The project already includes database scripts related to blockchain proof history and validation:

- step03c_create_normalized_aml_source_view.sql
- step03_confirm_source_views.sql
- step04_create_blockchain_history_tables.sql
- step05_create_blockchain_history_indexes.sql
- step07_validate_create_detection.sql
- step08_validate_update_detection.sql
- step09_validate_skip_unchanged_records.sql
- step10_validate_stable_hash_source_data.sql
- step12_validate_blockchain_key_format.sql
- step13_validate_proof_only_submission.sql
- step14_validate_blockchain_tx_link.sql

#### 2.5 Chaincode Files

The active chaincode package is:

- chaincode/kyc-wallet-chaincode-js

The main contract file is:

- chaincode/kyc-wallet-chaincode-js/lib/kycWalletContract.js

The chaincode includes generic blockchain proof functions:

- SaveBlockchainProof
- GetBlockchainProof
- VerifyBlockchainProof
- QueryBlockchainProofsByRecordType
- GetBlockchainProofHistory
- GetHistoryForKey

The chaincode also includes AML rule functions:

- SaveAmlRule
- GetAmlRule
- QueryAmlRulesByStatus
- GetAmlRuleHistory

---

### 3. Phase 1 Scope Mapping

#### 3.1 AML Rules Blockchain Proof

Status: Mostly implemented.

Existing foundation:

- VALOORES AML rules route exists.
- AML auto-sync service exists.
- AML proof history service exists.
- AML source view is referenced as blockchain.valoores_aml_rules_sync.
- PostgreSQL history table is referenced as blockchain.blockchain_sync_history.
- Stable hash extraction exists.
- Blockchain key generation exists.
- Blockchain transaction ID linkage exists.
- Fabric proof submission exists.
- Chaincode AML rule functions exist.
- AML CouchDB indexes exist.

Remaining confirmation:

- Validate the full AML rule proof flow end-to-end.
- Confirm that only proof, hashes, references, and metadata are stored on Fabric.
- Confirm no sensitive AML rule logic is stored on Fabric unless intentionally hashed only.

#### 3.2 Customer KYC Blockchain Proof

Status: Partially implemented.

Existing foundation:

- KYC route exists.
- Documents KYC route exists.
- KYC controller exists.
- KYC service exists.
- Customer history proof service exists.

Remaining confirmation:

- Inspect exact KYC proof payload.
- Confirm full customer personal data is not stored on blockchain.
- Confirm KYC documents are not stored on blockchain.
- Confirm only hash, reference, proof key, actor, approval metadata, and transaction references are stored.

#### 3.3 AML Case Closure Blockchain Proof

Status: Partially present, not fully confirmed.

Existing foundation:

- AML case route exists.
- AML case management route exists.
- AML dashboard and AML alerts routes exist.

Remaining work:

- Confirm whether AML case closure proof generation exists.
- Confirm whether AML case closure creates a stable hash.
- Confirm whether AML case closure links PostgreSQL records to Fabric transaction IDs.
- Confirm whether case closure verification API exists.
- Add missing case closure proof service if required.

#### 3.4 Evidence Chain of Custody

Status: Not clearly implemented yet.

Existing foundation:

- Generic blockchain proof chaincode functions can support evidence proof.
- Generic backend proof submission service can support evidence proof.
- Generic PostgreSQL proof history pattern can support evidence proof.

Remaining work:

- Add or confirm evidence PostgreSQL source table/view.
- Add or confirm evidence custody history table.
- Add or confirm evidence custody service.
- Add or confirm evidence custody route/controller.
- Store only evidence hash, custody action, actor reference, timestamp, previous proof reference, and verification metadata.
- Do not store evidence files, evidence images, or sensitive investigation content on blockchain.

---

### 4. Verification and Hashing Inventory

#### 4.1 Verification

Existing foundation:

- hash-verification.routes.js
- blockchain-proof-verification.controller.js
- blockchain-proof-verification.service.js
- blockchain-proof-verification-logic.service.js
- blockchain_verification_logs reference
- proof_key reference
- record_hash reference
- verification_status reference
- blockchain transaction reference aliases

Remaining confirmation:

- Confirm verification endpoints for AML Rules.
- Confirm verification endpoints for Customer KYC.
- Confirm verification endpoints for AML Case Closure.
- Confirm verification endpoints for Evidence Chain of Custody.

#### 4.2 Hash Generation

Existing foundation:

- AML history service retrieves or extracts stable hash.
- Transaction history service includes canonical object hashing.
- Chaincode uses SHA-256 for internal payload hashing.

Required standard:

All Phase 1 modules must use stable deterministic hashing with:

- Sorted keys.
- Normalized values.
- Exclusion of volatile fields.
- Exclusion of sensitive fields.
- SHA-256 hash algorithm.
- Same input producing the same hash every time.

---

### 5. Approved Technical Direction

The project should continue with the existing proof-only architecture.

The next implementation work should focus on filling the missing Phase 1 scope gaps instead of replacing existing services.

Approved direction:

1. Keep PostgreSQL as the source of truth.
2. Keep Fabric as proof-only storage.
3. Reuse SaveBlockchainProof for all Phase 1 modules.
4. Reuse PostgreSQL history tables where compatible.
5. Add module-specific source views where needed.
6. Add module-specific APIs only when existing APIs are not enough.
7. Keep sensitive data off-chain.

---

### 6. Current Missing Items

The following items still need confirmation or implementation:

- Customer KYC proof payload inspection.
- AML case closure proof service confirmation.
- Evidence chain-of-custody source model.
- Evidence chain-of-custody API.
- Evidence chain-of-custody PostgreSQL history linkage.
- Verification endpoint coverage for all four Phase 1 modules.
- Standard proof payload contract for all Phase 1 modules.
- Standard stable hash rules for all Phase 1 modules.

---

### 7. Step 5 Status

This document confirms the implementation inventory after Step 4 inspection.

Step 5 is complete when this file is created, checked, committed, and pushed to GitHub.
