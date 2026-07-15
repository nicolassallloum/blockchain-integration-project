# git_commit_commands.sh

cd /path/to/blockchain-integration-project

git status

# Step 1: backup before editing
mkdir -p backups/audit-validation-real-objects
cp -R backend/src/routes backups/audit-validation-real-objects/routes_$(date +%Y%m%d_%H%M%S) || true
cp -R backend/src/db backups/audit-validation-real-objects/db_$(date +%Y%m%d_%H%M%S) || true
cp -R frontend/src/app/blockchain/audit-validation backups/audit-validation-real-objects/angular_audit_validation_$(date +%Y%m%d_%H%M%S) || true

git checkout -b feature/audit-validation-real-objects

# Copy files from this bundle into the project, then:
git add sql/001_blockchain_audit_validation_real_objects.sql sql/002_validate_blockchain_audit_validation_real_objects.sql sql/099_rollback_blockchain_audit_validation_real_objects.sql
git commit -m "feat(audit): add production PostgreSQL audit model"

git add backend/src/db/applicationPostgres.js backend/src/db/blockchainPostgres.js backend/src/routes/audit-validation.routes.js backend/src/services/auditProof.service.js
git commit -m "feat(audit): read real audit events from application PostgreSQL"

git add frontend/src/app/blockchain/audit-validation
git commit -m "feat(audit): show real audit validation events in UI"

git add tests/full_server_test_commands.sh
git commit -m "test(audit): add audit validation server test commands"

git status
git push origin feature/audit-validation-real-objects

# After review:
# git checkout master
# git pull origin master
# git merge feature/audit-validation-real-objects
# git push origin master
