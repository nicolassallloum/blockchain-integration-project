# Phase 42 — Deployment Runbook

## Pre-Deployment

1. Confirm clean Git status except inspection-output.
2. Confirm latest commits include Phases 38 through 42.
3. Run final backend and chaincode validation.
4. Run frontend build validation.
5. Confirm production environment variables.
6. Confirm PostgreSQL backup.
7. Confirm Fabric network availability.
8. Confirm rollback plan.

## Deployment Order

1. Backup PostgreSQL.
2. Confirm Fabric network is healthy.
3. Deploy backend application.
4. Start or restart backend service.
5. Start or restart audit outbox worker.
6. Start or restart retry worker.
7. Deploy frontend build.
8. Run smoke tests.
9. Verify dashboard access.
10. Verify proof submission.
11. Verify proof verification.
12. Verify evidence export.

## Post-Deployment Smoke Tests

- Backend health endpoint responds.
- Fabric SDK connection test passes.
- Hash validation passes.
- Key validation passes.
- Audit dashboard loads.
- Proof dashboard loads.
- Verification dashboard loads.
- Export workflow is available.

## Rollback

If deployment validation fails:

1. Stop new proof submissions.
2. Keep PostgreSQL as source of truth.
3. Preserve outbox/retry records.
4. Restore previous backend version.
5. Restore previous frontend version.
6. Re-run validation.
7. Document incident and corrective action.
