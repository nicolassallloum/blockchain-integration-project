# VALOORES Blockchain Integration Project

## Phase 1 — Customer KYC Blockchain Proof Gap Assessment

### 1. Purpose

This document records the Customer KYC blockchain proof assessment after inspecting the existing route, controller, service, PostgreSQL, and Fabric integration files.

The goal is to confirm whether Customer KYC proof is fully implemented as a proof-only blockchain flow.

---

### 2. Assessment Result

Customer KYC blockchain proof status: PARTIAL.

Customer KYC has an existing PostgreSQL proof-history foundation, but Customer KYC proof submission to Hyperledger Fabric is not fully implemented.

The existing Customer history API creates PostgreSQL history rows for CUSTOMER proof records only.

It does not currently submit Customer proof records to Fabric through the generic SaveBlockchainProof chaincode function.

---

### 3. Confirmed Existing Foundation

The following Customer KYC proof components already exist:

1. Customer history controller.
2. Customer history service.
3. Customer source view discovery.
4. Customer source count API.
5. Customer history preview API.
6. Customer history sync API.
7. Stable hash generation.
8. Sensitive field exclusion.
9. PostgreSQL history row creation.
10. PostgreSQL blockchain transaction ID linkage column.
11. Verification status column.
12. Proof-only metadata flags.

---

### 4. Existing Customer History APIs

The following API endpoints exist through the blockchain proof API route:

1. GET /records/CUSTOMER/history/source-discovery
2. GET /records/CUSTOMER/history/source-count
3. GET /records/CUSTOMER/history/preview
4. POST /records/CUSTOMER/history/sync

These APIs are designed to create or preview PostgreSQL history rows for customer proof records.

They are not Fabric submission APIs yet.

---

### 5. Confirmed Gap

Customer history sync creates PostgreSQL proof-history records only.

Customer proof submission to Fabric is not yet wired.

The Customer history service does not currently show a direct dependency on:

1. blockchain-proof-fabric-submit.service.js
2. submitBlockchainProof
3. SaveBlockchainProof

Therefore, Customer KYC proof is classified as PARTIAL.

---

### 6. Separation Requirement

The project currently has two Customer KYC-related flows:

1. Operational KYC wallet/document flow.
2. Customer data proof-history flow.

These must remain clearly separated.

The operational KYC wallet/document flow may store required operational data in PostgreSQL, including KYC request metadata and document file references.

The blockchain proof flow must never send full customer data, document files, document paths, personal details, passwords, tokens, or sensitive KYC values to Fabric.

---

### 7. Approved Direction

The approved direction is:

1. Keep PostgreSQL as the source of truth for Customer KYC data.
2. Keep Customer KYC documents and file paths in PostgreSQL or file storage only.
3. Use Fabric only for Customer KYC proof records.
4. Submit only proof key, record type, source record ID, stable hash, action type, PostgreSQL history ID, submitted-by reference, and non-sensitive metadata to Fabric.
5. Reuse the existing generic SaveBlockchainProof chaincode function.
6. Reuse the existing blockchain-proof-fabric-submit.service.js.
7. Do not send customer PII or document content to Fabric.

---

### 8. Required Future Work

To complete Customer KYC Blockchain Proof, the following work is required:

1. Wire Customer history sync to the generic Fabric proof submission service.
2. Submit Customer proof records to SaveBlockchainProof.
3. Store returned Fabric transaction ID in PostgreSQL history.
4. Mark sync status as submitted or failed based on Fabric result.
5. Keep dry-run mode PostgreSQL-only.
6. Add retry support for failed Customer proof submissions if not already covered.
7. Add verification support for Customer proof records.
8. Test Customer proof end-to-end from PostgreSQL source view to Fabric proof and verification.

---

### 9. Decision

Customer KYC Blockchain Proof is approved to continue using the existing proof-only architecture.

Current status: PARTIAL.

Next implementation decision: Implement Customer KYC Fabric proof submission after this gap assessment is committed.
