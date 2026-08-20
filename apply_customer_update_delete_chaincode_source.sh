#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_ROOT="${1:-$HOME/u01/blockchain-integration}"
TARGET="$PROJECT_ROOT/chaincode/kyc-wallet-chaincode-js/lib/kycWalletContract.js"

STAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR="$PROJECT_ROOT/backups/customer-crud-chaincode-source-$STAMP"
BACKUP_FILE="$BACKUP_DIR/chaincode/kyc-wallet-chaincode-js/lib/kycWalletContract.js"
POINTER_FILE="$PROJECT_ROOT/.last_customer_crud_chaincode_source_backup"

if [[ ! -f "$TARGET" ]]; then
  echo "ERROR: Active chaincode file not found: $TARGET" >&2
  exit 1
fi

mkdir -p "$(dirname "$BACKUP_FILE")"
cp -a "$TARGET" "$BACKUP_FILE"
printf '%s\n' "$BACKUP_DIR" > "$POINTER_FILE"

echo "======================================================================"
echo "CHAINCODE SOURCE BACKUP CREATED"
echo "Source: $TARGET"
echo "Backup: $BACKUP_FILE"
echo "======================================================================"

echo
echo "Existing resident functions:"
grep -nE \
  "async (CreateResident|GetResident|UpdateResident|DeleteResident|CreateResidentWallet)" \
  "$TARGET" || true

python3 - "$TARGET" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8")

start_marker = "/* VALOORES_CUSTOMER_CRUD_CHAINCODE_V1 */"
end_marker = "/* END VALOORES_CUSTOMER_CRUD_CHAINCODE_V1 */"

if start_marker in text and end_marker in text:
    print(f"ALREADY PATCHED: {path}")
    sys.exit(0)

if "async CreateResident(ctx, residentJson)" not in text:
    raise SystemExit("ERROR: Active CreateResident function was not found.")

if "async GetResident(ctx, residentId)" not in text:
    raise SystemExit("ERROR: Active GetResident function was not found.")

if "async UpdateResident(" in text or "async DeleteResident(" in text:
    raise SystemExit(
        "ERROR: An UpdateResident or DeleteResident function already exists. "
        "Inspect it manually instead of creating a duplicate."
    )

insert_marker = "    async CreateResidentWallet("
position = text.find(insert_marker)

if position < 0:
    raise SystemExit("ERROR: CreateResidentWallet insertion marker was not found.")

methods = r'''
    /* VALOORES_CUSTOMER_CRUD_CHAINCODE_V1 */

    _customerCrudTimestamp(ctx) {
        const timestamp = ctx.stub.getTxTimestamp();
        const rawSeconds = timestamp.seconds;

        const seconds =
            rawSeconds &&
            typeof rawSeconds.toNumber === 'function'
                ? rawSeconds.toNumber()
                : Number(rawSeconds || 0);

        const nanos = Number(timestamp.nanos || 0);

        return new Date(
            (seconds * 1000) + Math.floor(nanos / 1000000)
        ).toISOString();
    }

    async UpdateResident(ctx, residentJson) {
        let patch;

        try {
            patch = JSON.parse(String(residentJson || ''));
        } catch (error) {
            throw new Error(
                'UpdateResident requires valid resident JSON.'
            );
        }

        const residentId = String(
            patch.residentId || ''
        ).trim();

        if (!residentId) {
            throw new Error(
                'residentId is required for UpdateResident.'
            );
        }

        const key = `KYC_${residentId}`;
        const existingBytes = await ctx.stub.getState(key);

        if (
            !existingBytes ||
            existingBytes.length === 0
        ) {
            throw new Error(
                `Resident not found on blockchain: ${residentId}`
            );
        }

        const existing = JSON.parse(
            existingBytes.toString()
        );

        if (
            existing.docType &&
            existing.docType !== 'resident'
        ) {
            throw new Error(
                `Ledger record is not an active resident: ${residentId}`
            );
        }

        const allowedFields = [
            'firstName',
            'fatherName',
            'motherName',
            'lastName',
            'fullName',
            'arabicFullName',
            'dateOfBirth',
            'gender',
            'nationality',
            'nationalIdNumber',
            'passportNumber',
            'residencyPermitNumber',
            'taxNumber',
            'mobileNumber',
            'email',
            'governorate',
            'district',
            'municipality',
            'address',
            'employmentStatus',
            'occupation',
            'monthlyIncome',
            'kycStatus',
            'riskCategory',
            'sourceSystem',
            'sourceEntityType',
            'branchCode',
            'customerType',
            'payloadHash',
            'selfieFileName',
            'selfieHash'
        ];

        const updated = Object.assign({}, existing);
        const changedFields = [];

        for (const field of allowedFields) {
            if (
                !Object.prototype.hasOwnProperty.call(
                    patch,
                    field
                )
            ) {
                continue;
            }

            const nextValue = patch[field];
            const previousValue = existing[field];

            if (
                JSON.stringify(previousValue) !==
                JSON.stringify(nextValue)
            ) {
                updated[field] = nextValue;
                changedFields.push(field);
            }
        }

        if (changedFields.length === 0) {
            throw new Error(
                `No resident fields changed: ${residentId}`
            );
        }

        if (!String(updated.fullName || '').trim()) {
            throw new Error(
                'fullName cannot be empty after UpdateResident.'
            );
        }

        updated.docType = 'resident';
        updated.residentId = residentId;
        updated.createdAt = existing.createdAt;
        updated.createdTxId =
            existing.createdTxId ||
            existing.creationTxId ||
            null;
        updated.updatedAt =
            this._customerCrudTimestamp(ctx);
        updated.updatedTxId =
            ctx.stub.getTxID();

        await ctx.stub.putState(
            key,
            Buffer.from(JSON.stringify(updated))
        );

        return JSON.stringify({
            success: true,
            operation: 'UPDATE',
            residentId,
            ledgerKey: key,
            fullName: updated.fullName || '',
            kycStatus: updated.kycStatus || '',
            riskCategory: updated.riskCategory || '',
            changedFields,
            changeCount: changedFields.length,
            payloadHashBefore:
                existing.payloadHash || null,
            payloadHashAfter:
                updated.payloadHash || null,
            updatedAt: updated.updatedAt,
            updatedTxId: updated.updatedTxId,
            resident: updated
        });
    }

    async DeleteResident(
        ctx,
        residentId,
        deletionReason
    ) {
        const normalizedResidentId = String(
            residentId || ''
        ).trim();

        const normalizedReason = String(
            deletionReason || ''
        ).trim();

        if (!normalizedResidentId) {
            throw new Error(
                'residentId is required for DeleteResident.'
            );
        }

        if (normalizedReason.length < 5) {
            throw new Error(
                'A deletion reason of at least 5 characters is required.'
            );
        }

        const key = `KYC_${normalizedResidentId}`;
        const existingBytes = await ctx.stub.getState(key);

        if (
            !existingBytes ||
            existingBytes.length === 0
        ) {
            throw new Error(
                `Resident not found on blockchain: ${normalizedResidentId}`
            );
        }

        const existing = JSON.parse(
            existingBytes.toString()
        );

        if (
            existing.docType &&
            existing.docType !== 'resident'
        ) {
            throw new Error(
                `Ledger record is not an active resident: ${normalizedResidentId}`
            );
        }

        const deletedAt =
            this._customerCrudTimestamp(ctx);
        const deletedTxId =
            ctx.stub.getTxID();

        await ctx.stub.deleteState(key);

        return JSON.stringify({
            success: true,
            operation: 'DELETE',
            residentId: normalizedResidentId,
            ledgerKey: key,
            fullName: existing.fullName || '',
            kycStatus: existing.kycStatus || '',
            riskCategory: existing.riskCategory || '',
            deletionReason: normalizedReason,
            payloadHashBefore:
                existing.payloadHash || null,
            payloadHashAfter: null,
            deletedAt,
            deletedTxId
        });
    }

    /* END VALOORES_CUSTOMER_CRUD_CHAINCODE_V1 */

'''

text = text[:position] + methods + text[position:]
path.write_text(text, encoding="utf-8")
print(f"UPDATED: {path}")
PY

node --check "$TARGET"

echo
echo "Installed resident functions:"
grep -nE \
  "VALOORES_CUSTOMER_CRUD_CHAINCODE_V1|async (CreateResident|GetResident|UpdateResident|DeleteResident|CreateResidentWallet)" \
  "$TARGET"

echo
echo "Safety checks:"

if grep -q \
  "ctx.stub.deleteState(key)" \
  "$TARGET"
then
  echo "PASS: DeleteResident removes only the active world-state key."
else
  echo "ERROR: DeleteResident deleteState call was not found." >&2
  exit 1
fi

if grep -q \
  "ctx.stub.getHistoryForKey" \
  "$TARGET"
then
  echo "PASS: Existing ledger history support remains available."
else
  echo "WARNING: No getHistoryForKey token was found in the active chaincode."
fi

echo
echo "======================================================================"
echo "CHAINCODE SOURCE PATCH COMPLETED"
echo "No chaincode package was deployed."
echo "No backend or frontend file was changed."
echo "Backup directory: $BACKUP_DIR"
echo "======================================================================"
