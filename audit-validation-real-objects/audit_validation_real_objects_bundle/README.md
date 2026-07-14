# Blockchain Audit Validation — Real PostgreSQL Objects Bundle

This bundle implements the production audit-validation replacement for the test-only table `public.blockchain_ui_audit_test`.

Audited source objects:

- `blockchain.v_aml_alert_by_customer`
- `blockchain.v_customers`
- `blockchain.v_transactions`
- `blockchain.v_queries`
- `blockchain.v_aml_rules`

## Important behavior

1. The SQL migration inspects each target object using `pg_class.relkind`.
2. If the target is a table or partitioned table, the audit trigger is attached directly.
3. If the target is a normal view or materialized view, base tables are discovered through `pg_rewrite` / `pg_depend`, and triggers are attached to the base tables.
4. The audit event stores `source_object` and `source_view` so the UI can still show the original business object.
5. Full `old_data` / `new_data` remains only in PostgreSQL.
6. Blockchain submission sends only proof metadata and hash.

## Install order

Run in the application PostgreSQL database:

```bash
psql "$APPLICATION_DATABASE_URL" -f sql/001_blockchain_audit_validation_real_objects.sql
psql "$APPLICATION_DATABASE_URL" -f sql/002_validate_blockchain_audit_validation_real_objects.sql
```

Copy backend files:

```text
backend/src/db/applicationPostgres.js
backend/src/db/blockchainPostgres.js
backend/src/routes/audit-validation.routes.js
backend/src/services/auditProof.service.js
```

Mount the route:

```js
const auditValidationRoutes = require('./routes/audit-validation.routes');
app.use('/api/v1/audit-validation', auditValidationRoutes);
```

Copy Angular files:

```text
angular/src/app/blockchain/audit-validation/audit-validation.service.ts
angular/src/app/blockchain/audit-validation/audit-validation.component.ts
angular/src/app/blockchain/audit-validation/audit-validation.component.html
angular/src/app/blockchain/audit-validation/audit-validation.component.scss
```

If the project does not already import `FormsModule`, add it to the Angular module that declares this page.

## Required environment variables

Application PostgreSQL:

```bash
POSTGRES_HOST=
POSTGRES_PORT=
POSTGRES_DATABASE=
POSTGRES_DB=
DB=
POSTGRES_USER=
POSTGRES_PASSWORD=
POSTGRES_SCHEMA=
```

Blockchain PostgreSQL:

```bash
DB_HOST=
DB_PORT=
DB_NAME=
DB_USER=
DB_PASSWORD=
```

CouchDB / Fabric:

```bash
COUCHDB_ENABLED=
COUCHDB_PROTOCOL=
COUCHDB_HOST=
COUCHDB_PORT=
COUCHDB_USERNAME=
COUCHDB_PASSWORD=
COUCHDB_URL=
COUCHDB_CHAINCODE_DB=
COUCHDB_TIMEOUT_MS=
```

## Chaincode

If no audit proof function exists, add the methods in:

```text
backend/src/services/chaincode_audit_validation_proof_snippet.js
```

to the existing `kyc-wallet-chaincode-js` contract and deploy a new chaincode sequence.

## Safe test rule

Do not update or delete production data. Use controlled test rows with marker:

```text
AUDIT_TEST_DO_NOT_USE
```

Update/delete only those rows.
