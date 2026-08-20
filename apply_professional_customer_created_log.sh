#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_ROOT="${1:-$HOME/u01/blockchain-integration}"
TARGET="$PROJECT_ROOT/blockchain-api/src/routes/valoores-blockchain.routes.js"

TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR="$PROJECT_ROOT/backups/professional-customer-created-log-$TIMESTAMP"
BACKUP_FILE="$BACKUP_DIR/blockchain-api/src/routes/valoores-blockchain.routes.js"
POINTER_FILE="$PROJECT_ROOT/.last_professional_customer_created_log_backup"

if [[ ! -f "$TARGET" ]]; then
  echo "ERROR: Route file not found: $TARGET" >&2
  exit 1
fi

mkdir -p "$(dirname "$BACKUP_FILE")"
cp -a "$TARGET" "$BACKUP_FILE"
printf '%s\n' "$BACKUP_DIR" > "$POINTER_FILE"

python3 - "$TARGET" <<'PY'
from pathlib import Path
import re
import sys

path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8")

start_marker = "/* BLOCKCHAIN_CUSTOMER_CREATED_ONLY_LOGGER_V2 */"
end_marker = "/* END BLOCKCHAIN_CUSTOMER_CREATED_ONLY_LOGGER_V2 */"

if start_marker not in text or end_marker not in text:
    raise SystemExit(
        "ERROR: Customer-created-only logger markers were not found."
    )

professional_block = r"""/* BLOCKCHAIN_CUSTOMER_CREATED_ONLY_LOGGER_V2 */
const customerLogFs = require('fs');
const customerLogPath = require('path');

const BLOCKCHAIN_CUSTOMER_LOG_FILE = customerLogPath.resolve(
  __dirname,
  '../../logs/blockchain-customers.log'
);

const loggedBlockchainCustomerTransactions = new Set();

function sanitizeCustomerLogValue(value) {
  return String(value ?? '')
    .replace(/[\r\n\t]+/g, ' ')
    .trim();
}

function appendBlockchainCustomerLog(event) {
  try {
    customerLogFs.mkdirSync(
      customerLogPath.dirname(BLOCKCHAIN_CUSTOMER_LOG_FILE),
      { recursive: true }
    );

    customerLogFs.appendFileSync(
      BLOCKCHAIN_CUSTOMER_LOG_FILE,
      `${JSON.stringify(event)}\n`,
      'utf8'
    );

    return true;
  } catch (error) {
    console.error(
      '[KYC AUDIT] Failed to write customer event:',
      error.message
    );

    return false;
  }
}

function formatCustomerLogField(label, value) {
  return `${label.padEnd(20, ' ')}: ${sanitizeCustomerLogValue(value)}`;
}

function logCreatedBlockchainCustomer(customer) {
  const transactionId = sanitizeCustomerLogValue(
    customer.blockchainTransactionId
  );

  if (!transactionId) {
    console.error(
      '[KYC AUDIT] Customer-created event skipped because ' +
      'the Fabric transaction ID is missing.'
    );

    return false;
  }

  if (
    loggedBlockchainCustomerTransactions.has(transactionId)
  ) {
    console.warn(
      `[KYC AUDIT] Duplicate event suppressed for transaction ${transactionId}`
    );

    return false;
  }

  loggedBlockchainCustomerTransactions.add(transactionId);

  const timestamp = new Date().toISOString();
  const commitSuccessful =
    customer.commitSuccessful === true;
  const commitCode =
    customer.commitCode === 0 ||
    String(customer.commitCode) === '0'
      ? 'VALID'
      : sanitizeCustomerLogValue(
          customer.commitCode || 'UNKNOWN'
        );

  const event = {
    schemaVersion: '1.0',
    timestamp,
    eventId: `KYC-CREATED-${transactionId.slice(0, 16)}`,
    eventType: 'BLOCKCHAIN_CUSTOMER_CREATED',
    outcome: 'SUCCESS',
    source: 'FABRIC_BLOCKCHAIN',
    storageMode: 'BLOCKCHAIN_ONLY',
    customerId: sanitizeCustomerLogValue(
      customer.customerId
    ),
    residentId: sanitizeCustomerLogValue(
      customer.residentId
    ),
    ledgerKey: sanitizeCustomerLogValue(
      customer.ledgerKey
    ),
    fullName: sanitizeCustomerLogValue(
      customer.fullName
    ),
    kycStatus: sanitizeCustomerLogValue(
      customer.kycStatus || 'Submitted'
    ),
    riskCategory: sanitizeCustomerLogValue(
      customer.riskCategory || 'LOW'
    ),
    blockchainTransactionId: transactionId,
    channelName: sanitizeCustomerLogValue(
      customer.channelName
    ),
    chaincodeName: sanitizeCustomerLogValue(
      customer.chaincodeName
    ),
    blockNumber: sanitizeCustomerLogValue(
      customer.blockNumber
    ),
    commitStatus: commitSuccessful
      ? 'VALID'
      : commitCode,
    commitCode: sanitizeCustomerLogValue(
      customer.commitCode
    ),
    durationMs: Number(
      customer.durationMs || 0
    )
  };

  const separator =
    '======================================================================';

  console.log('');
  console.log(separator);
  console.log(' KYC CUSTOMER CREATION — BLOCKCHAIN COMMIT CONFIRMED');
  console.log(separator);
  console.log(formatCustomerLogField('Outcome', event.outcome));
  console.log(formatCustomerLogField('Event Type', event.eventType));
  console.log(formatCustomerLogField('Event ID', event.eventId));
  console.log(formatCustomerLogField('Timestamp (UTC)', event.timestamp));
  console.log(formatCustomerLogField('Customer ID', event.customerId));
  console.log(formatCustomerLogField('Customer Name', event.fullName));
  console.log(formatCustomerLogField('Resident ID', event.residentId));
  console.log(formatCustomerLogField('Ledger Key', event.ledgerKey));
  console.log(formatCustomerLogField('KYC Status', event.kycStatus));
  console.log(formatCustomerLogField('Risk Category', event.riskCategory));
  console.log(formatCustomerLogField('Storage Mode', event.storageMode));
  console.log(formatCustomerLogField('Fabric Channel', event.channelName));
  console.log(formatCustomerLogField('Chaincode', event.chaincodeName));
  console.log(formatCustomerLogField('Block Number', event.blockNumber || 'N/A'));
  console.log(formatCustomerLogField('Commit Status', event.commitStatus));
  console.log(formatCustomerLogField('Execution Time', `${event.durationMs} ms`));
  console.log(formatCustomerLogField('Transaction ID', event.blockchainTransactionId));
  console.log(separator);
  console.log('');

  appendBlockchainCustomerLog(event);

  return true;
}
/* END BLOCKCHAIN_CUSTOMER_CREATED_ONLY_LOGGER_V2 */"""

start = text.index(start_marker)
end = text.index(end_marker, start) + len(end_marker)
text = text[:start] + professional_block + text[end:]

call_start_marker = "/* BLOCKCHAIN_CUSTOMER_CREATED_LOG_CALL_V1 */"
call_start = text.find(call_start_marker)

if call_start < 0:
    raise SystemExit(
        "ERROR: Customer-created logging call marker was not found."
    )

call_end = text.find("return res.status(201).json({", call_start)

if call_end < 0:
    raise SystemExit(
        "ERROR: Successful response marker was not found after log call."
    )

call_block = text[call_start:call_end]

if "blockNumber:" not in call_block:
    call_block = call_block.replace(
        "chaincodeName: fabricResult?.chaincodeName",
        """chaincodeName: fabricResult?.chaincodeName,
          blockNumber: fabricResult?.commitStatus?.blockNumber,
          commitSuccessful:
            fabricResult?.commitStatus?.successful,
          commitCode: fabricResult?.commitStatus?.code,
          durationMs: fabricResult?.durationMs"""
    )

text = text[:call_start] + call_block + text[call_end:]

for forbidden in (
    "BLOCKCHAIN_CUSTOMER_STARTUP_SNAPSHOT",
    "scheduleBlockchainCustomerStartupLog",
    "loadAllBlockchainCustomersForStartupLog",
    "console.table(rows)",
):
    if forbidden in text:
        raise SystemExit(
            f"ERROR: Startup logger token still exists: {forbidden}"
        )

if text.count(
    "function logCreatedBlockchainCustomer"
) != 1:
    raise SystemExit(
        "ERROR: Expected exactly one customer-created logger."
    )

path.write_text(text, encoding="utf-8")

print(f"UPDATED: {path}")
PY

node --check "$TARGET"

echo
echo "Professional customer-created logger installed."
echo "Backup directory: $BACKUP_DIR"
echo "Active file:      $TARGET"
echo
echo "Verification markers:"
grep -nE \
  "KYC CUSTOMER CREATION|schemaVersion|blockNumber|durationMs|BLOCKCHAIN_CUSTOMER_STARTUP" \
  "$TARGET" || true
