# Phase 40 — Operations Readiness

## Runtime Components

- PostgreSQL database
- Blockchain API backend
- Hyperledger Fabric network
- Fabric chaincode
- Angular frontend
- Audit outbox worker
- Retry worker
- Export/report workflow

## Operational Checks

Before production deployment:

1. Confirm backend environment variables.
2. Confirm database connectivity.
3. Confirm Fabric gateway connectivity.
4. Confirm chaincode name and channel name.
5. Confirm hash tests pass.
6. Confirm key tests pass.
7. Confirm Fabric SDK test passes.
8. Confirm chaincode tests pass.
9. Confirm dashboard screens load.
10. Confirm export workflow is available.

## Recovery Expectations

- Failed proof submissions must remain in retry/outbox workflow.
- Database remains source of truth if Fabric is temporarily unavailable.
- Mismatch results must be visible to business users.
- Invalid records must remain reviewable.
- Evidence must remain exportable for audit.

## Final Status

Operations readiness is acceptable for final audit readiness review.
