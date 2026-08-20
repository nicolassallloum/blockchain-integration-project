#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_ROOT="${1:-$HOME/u01/blockchain-integration}"
TARGET="$PROJECT_ROOT/blockchain-api/src/routes/valoores-blockchain.routes.js"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR="$PROJECT_ROOT/backups/valoores-customers-blockchain-only-$TIMESTAMP"
BACKUP_FILE="$BACKUP_DIR/blockchain-api/src/routes/valoores-blockchain.routes.js"

if [[ ! -f "$TARGET" ]]; then
  echo "ERROR: Target file not found: $TARGET" >&2
  exit 1
fi

mkdir -p "$(dirname "$BACKUP_FILE")"
cp -a "$TARGET" "$BACKUP_FILE"

python3 - "$TARGET" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8")

start_marker = "router.post('/customers', async (req, res) => {"
end_marker = "router.get('/customers', async (req, res) => {"

start = text.find(start_marker)
end = text.find(end_marker)

if start < 0:
    raise SystemExit("POST /customers block was not found.")
if end < 0 or end <= start:
    raise SystemExit("GET /customers block was not found after POST block.")

replacement = r"""router.post('/customers', async (req, res) => {
  try {
    const requestBody = req.body || {};

    const storageMode = String(
      requestBody.storageMode ||
      requestBody.storage_mode ||
      'BLOCKCHAIN_ONLY'
    )
      .trim()
      .toUpperCase();

    if (storageMode !== 'BLOCKCHAIN_ONLY') {
      return res.status(400).json({
        success: false,
        message:
          'This endpoint supports BLOCKCHAIN_ONLY mode only. ' +
          'Use storageMode=BLOCKCHAIN_ONLY or omit storageMode.'
      });
    }

    const formData =
      requestBody.formData ||
      requestBody.form_data ||
      requestBody.customer_payload?.formData ||
      requestBody.customerPayload?.formData ||
      {};

    const customerId =
      requestBody.customer_id ||
      requestBody.customerId ||
      formData.customer_id ||
      formData.customerId ||
      null;

    const sessionId =
      requestBody.session_id ||
      requestBody.sessionId ||
      formData.session_id ||
      formData.sessionId ||
      null;

    const customerName = formData.CUSTOMER_NAME || null;
    const customerType = formData.CUSTOMER_TYPE || null;
    const branchCode = formData.BRANCH || null;
    const vatNumber = formData.VAT_NUMBER || null;

    if (!customerId) {
      return res.status(400).json({
        success: false,
        message: 'customer_id is required'
      });
    }

    if (!customerName) {
      return res.status(400).json({
        success: false,
        message: 'formData.CUSTOMER_NAME is required'
      });
    }

    let selfieFileName = null;
    let selfieHash = null;

    if (formData.UPLOAD_SELFIE) {
      const selfieParts = String(formData.UPLOAD_SELFIE).split(',');
      selfieFileName = selfieParts[0] || null;
      const selfieBase64 = selfieParts.slice(1).join(',');
      selfieHash = sha256(selfieBase64);
    }

    const fabricResidentId = `VALOORES-${customerId}`;
    const ledgerKey = `KYC_${fabricResidentId}`;

    const blockchainPayload = {
      sourceSystem: 'VALOORES',
      entityType: 'CUSTOMER',
      operationType: 'CREATE_CUSTOMER',
      ledgerKey,
      customer: {
        customerName,
        customerId,
        sessionId,
        customerType,
        branch: branchCode,
        vatNumber,
        street: formData.STREET || null,
        building: formData.BUILDING || null,
        floor: formData.FLOOR || null,
        comments: formData.COMMENTS || null,
        legalForm: formData.LEGAL_FORM || null,
        taxCountry: formData.TAX_COUNTRY || null,
        isResident: formData.IS_RESIDENT || null
      },
      documents: {
        selfieFileName,
        selfieHash
      }
    };

    const payloadHash = sha256(JSON.stringify(blockchainPayload));
    const nameParts = String(
      customerName || 'VALOORES CUSTOMER'
    ).trim().split(/\s+/);

    const residentPayload = {
      residentId: fabricResidentId,
      firstName: nameParts[0] || 'VALOORES',
      fatherName: '',
      motherName: '',
      lastName: nameParts.slice(1).join(' ') || 'CUSTOMER',
      fullName: customerName || 'VALOORES CUSTOMER',
      arabicFullName: '',
      dateOfBirth: '',
      gender: '',
      nationality: String(formData.TAX_COUNTRY || ''),
      nationalIdNumber: '',
      passportNumber: '',
      residencyPermitNumber: '',
      taxNumber: String(vatNumber || ''),
      mobileNumber: '',
      email: '',
      governorate: '',
      district: '',
      municipality: '',
      address: [
        formData.STREET,
        formData.BUILDING,
        formData.FLOOR
      ].filter(Boolean).join(', '),
      employmentStatus: '',
      occupation: String(customerType || ''),
      monthlyIncome: 0,
      kycStatus: 'Submitted',
      riskCategory: 'LOW',
      walletAddress: '',
      walletCurrency: 'GOV',
      walletStatus: 'Not Created',

      sourceSystem: 'VALOORES',
      sourceEntityType: 'CUSTOMER',
      branchCode: String(branchCode || ''),
      customerType: String(customerType || ''),
      payloadHash,
      selfieFileName,
      selfieHash
    };

    const requestId =
      `VALOORES-CUSTOMER-${customerId}` +
      (sessionId ? `-${sessionId}` : '');

    try {
      const fabricResult = await fabricService.submitTransaction(
        'CreateResident',
        [JSON.stringify(residentPayload)],
        {
          requestId,
          correlationId: `VALOORES-${customerId}`,
          sourceSystem: 'VALOORES',
          requestSource: 'SPRINGBOOT',
          createdBy: 'SPRINGBOOT'
        }
      );

      const fabricTransactionId =
        fabricResult?.transactionId ||
        fabricResult?.txId ||
        fabricResult?.commitStatus?.transactionId ||
        null;

      return res.status(201).json({
        success: true,
        message: 'Customer saved on Fabric Blockchain successfully',
        data: {
          storageMode: 'BLOCKCHAIN_ONLY',
          postgresSaved: false,
          blockchainSaved: true,
          customerName,
          customerId,
          sessionId,
          customerType,
          branchCode,
          vatNumber,
          fabricResidentId,
          ledgerKey,
          blockchainStatus: 'CONFIRMED',
          blockchainTransactionId: fabricTransactionId,
          blockchainHash: payloadHash,
          blockchainError: null,
          fabricResult: toSafeJson(fabricResult)
        }
      });
    } catch (fabricError) {
      console.error(
        'Valoores customer Fabric submit error:',
        fabricError
      );

      return res.status(502).json({
        success: false,
        message:
          'Fabric Blockchain submission failed. ' +
          'No PostgreSQL proof record was created.',
        data: {
          storageMode: 'BLOCKCHAIN_ONLY',
          postgresSaved: false,
          blockchainSaved: false,
          customerName,
          customerId,
          sessionId,
          customerType,
          branchCode,
          vatNumber,
          fabricResidentId,
          ledgerKey,
          blockchainStatus: 'FAILED',
          blockchainTransactionId: null,
          blockchainHash: payloadHash,
          blockchainError: fabricError.message,
          fabricResult: null
        }
      });
    }
  } catch (error) {
    console.error(
      'Create Valoores blockchain-only customer error:',
      error
    );

    return res.status(500).json({
      success: false,
      message: 'Failed to save customer on Fabric Blockchain',
      error: error.message
    });
  }
});

"""

updated = text[:start] + replacement + text[end:]
path.write_text(updated, encoding="utf-8")
PY

node --check "$TARGET"

echo
echo "Blockchain-only patch applied successfully."
echo "Target: $TARGET"
echo "Backup directory: $BACKUP_DIR"
echo
echo "Save this backup path for rollback:"
echo "$BACKUP_DIR"
