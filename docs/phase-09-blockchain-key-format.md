# Phase 9 — Standard Blockchain Key Format

## Objective

Define the final standard blockchain key format for the VALOORES Blockchain Integration Project.

## Final Key Format

`VALOORES:{MODULE}:{SOURCE_RECORD_ID}:{HASH_VERSION}`

## Format Parts

| Part | Description | Required | Example |
|---|---|---|---|
| `VALOORES` | Fixed project namespace | Yes | `VALOORES` |
| `{MODULE}` | Approved blockchain proof module name | Yes | `AML_RULE` |
| `{SOURCE_RECORD_ID}` | Stable source record identifier from PostgreSQL source view | Yes | `RULE_1001` |
| `{HASH_VERSION}` | Stable hash/key version label | Yes | `V1` |

## Final Examples

| Module | Source Record ID | Hash Version | Blockchain Key |
|---|---|---|---|
| `AML_RULE` | `RULE_1001` | `V1` | `VALOORES:AML_RULE:RULE_1001:V1` |
| `CUSTOMER_KYC` | `CUST_5001` | `V1` | `VALOORES:CUSTOMER_KYC:CUST_5001:V1` |
| `CASE_CLOSURE` | `CASE_9001` | `V1` | `VALOORES:CASE_CLOSURE:CASE_9001:V1` |
| `EVIDENCE` | `EVD_7001` | `V1` | `VALOORES:EVIDENCE:EVD_7001:V1` |

## Approved Module Names

The initial approved module names are:

| Module | Purpose |
|---|---|
| `AML_RULE` | AML rule proof |
| `CUSTOMER_KYC` | Customer KYC proof |
| `TRANSACTION` | Transaction proof |
| `AML_ALERT` | AML alert proof |
| `AUDIT_LOG` | Audit log proof |
| `SCREENING_ACTIVITY` | Screening activity proof |
| `SANCTION_LIST` | Sanction list proof |
| `CASE_CLOSURE` | AML case closure proof |
| `EVIDENCE` | Evidence chain proof |

## Validation Rules

### Namespace

The namespace must always be:

`VALOORES`

### Module Name

Module name must:

1. Be required.
2. Be trimmed.
3. Be uppercase.
4. Use only letters, numbers, and underscore.
5. Be one of the approved module names.

Invalid module examples:

- `AML RULE`
- `aml-rule`
- `CUSTOMER:KYC`
- `UNKNOWN_MODULE`

### Source Record ID

Source record ID must:

1. Be required.
2. Be trimmed.
3. Be converted to uppercase by default.
4. Use only letters, numbers, underscore, dash, and dot.
5. Not contain colon `:`.
6. Not contain whitespace.
7. Not exceed 128 characters.

Invalid source record ID examples:

- empty value
- `RULE 1001`
- `RULE:1001`
- `RULE/1001`

### Hash Version

Hash version must:

1. Be required.
2. Be trimmed.
3. Be uppercase.
4. Match the format `V` followed by a number.
5. Default to `V1` when not provided.

Valid hash version examples:

- `V1`
- `V2`
- `V10`

Invalid hash version examples:

- `1`
- `VERSION1`
- `sha256-canonical-json-v1`
- `V1:TEST`

## Final Decision

Phase 9 will implement a backend blockchain key generator service using this file:

`blockchain-api/src/services/blockchain-key-generator.service.js`

The service will expose:

- `generateBlockchainKey(input)`
- `parseBlockchainKey(blockchainKey)`
- `validateBlockchainKey(blockchainKey)`
- `normalizeModuleName(moduleName)`
- `normalizeSourceRecordId(sourceRecordId)`
- `normalizeHashVersion(hashVersion)`
- `getApprovedModules()`

## Test Decision

Unit tests will be added here:

`blockchain-api/tests/blockchain-key-generator.service.test.js`

Package script:

`npm run test:key`

## Status

Final blockchain key format defined.
