#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_ROOT="${1:-$HOME/u01/blockchain-integration}"
TARGET="$PROJECT_ROOT/blockchain-api/src/routes/valoores-blockchain.routes.js"

TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR="$PROJECT_ROOT/backups/customer-created-only-log-$TIMESTAMP"
BACKUP_FILE="$BACKUP_DIR/blockchain-api/src/routes/valoores-blockchain.routes.js"
LAST_BACKUP_FILE="$PROJECT_ROOT/.last_customer_created_only_backup"

if [[ ! -f "$TARGET" ]]; then
  echo "ERROR: Active route file not found: $TARGET" >&2
  exit 1
fi

mkdir -p "$(dirname "$BACKUP_FILE")"
cp -a "$TARGET" "$BACKUP_FILE"
printf '%s\n' "$BACKUP_DIR" > "$LAST_BACKUP_FILE"

echo "============================================================"
echo "BACKUP CREATED"
echo "Source: $TARGET"
echo "Backup: $BACKUP_FILE"
echo "============================================================"

echo
echo "Existing logging markers before modification:"
grep -nE \
  "BLOCKCHAIN_CUSTOMER_STARTUP_LOGGER_V1|BLOCKCHAIN_CUSTOMER_CREATED_LOG_CALL_V1|BLOCKCHAIN_CUSTOMER_STARTUP_LOG_SCHEDULE_V1" \
  "$TARGET" || true

python3 - "$TARGET" <<'PY'
from pathlib import Path
import re
import sys

path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8")

v1_start = "/* BLOCKCHAIN_CUSTOMER_STARTUP_LOGGER_V1 */"
v1_end = "/* END BLOCKCHAIN_CUSTOMER_STARTUP_LOGGER_V1 */"
v2_start = "/* BLOCKCHAIN_CUSTOMER_CREATED_ONLY_LOGGER_V2 */"

logging_only_block = r"""/* BLOCKCHAIN_CUSTOMER_CREATED_ONLY_LOGGER_V2 */
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
      '[BLOCKCHAIN CUSTOMER LOG] Failed to write log file:',
      error.message
    );

    return false;
  }
}

function logCreatedBlockchainCustomer(customer) {
  const transactionId = sanitizeCustomerLogValue(
    customer.blockchainTransactionId
  );

  if (!transactionId) {
    console.error(
      '[BLOCKCHAIN CUSTOMER LOG] Creation event skipped: ' +
      'Fabric transaction ID is missing.'
    );

    return false;
  }

  if (
    loggedBlockchainCustomerTransactions.has(transactionId)
  ) {
    return false;
  }

  loggedBlockchainCustomerTransactions.add(transactionId);

  const event = {
    timestamp: new Date().toISOString(),
    eventType: 'BLOCKCHAIN_CUSTOMER_CREATED',
    source: 'FABRIC_BLOCKCHAIN',
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
    )
  };

  console.log('');
  console.log(
    '============================================================'
  );
  console.log('[BLOCKCHAIN CUSTOMER CREATED]');
  console.log(`Customer ID:     ${event.customerId}`);
  console.log(`Resident ID:     ${event.residentId}`);
  console.log(`Ledger Key:      ${event.ledgerKey}`);
  console.log(`Customer Name:   ${event.fullName}`);
  console.log(`KYC Status:      ${event.kycStatus}`);
  console.log(`Risk Category:   ${event.riskCategory}`);
  console.log(`Fabric Tx ID:    ${event.blockchainTransactionId}`);
  console.log(`Channel:         ${event.channelName}`);
  console.log(`Chaincode:       ${event.chaincodeName}`);
  console.log(`Created At:      ${event.timestamp}`);
  console.log(
    '============================================================'
  );
  console.log('');

  appendBlockchainCustomerLog(event);

  return true;
}
/* END BLOCKCHAIN_CUSTOMER_CREATED_ONLY_LOGGER_V2 */"""

if v1_start in text:
    start = text.index(v1_start)
    end = text.index(v1_end, start) + len(v1_end)
    text = text[:start] + logging_only_block + text[end:]
elif v2_start not in text:
    raise SystemExit(
        "ERROR: Neither the V1 startup logger nor the V2 "
        "customer-created-only logger was found."
    )

schedule_pattern = re.compile(
    r"/\*\s*BLOCKCHAIN_CUSTOMER_STARTUP_LOG_SCHEDULE_V1\s*\*/"
    r".*?(?=module\.exports\s*=\s*router\s*;)",
    flags=re.DOTALL,
)

text, schedule_replacements = schedule_pattern.subn("", text)

call_pattern = re.compile(
    r"/\*\s*BLOCKCHAIN_CUSTOMER_CREATED_LOG_CALL_V1\s*\*/"
    r"\s*"
    r"(?:if\s*\(.*?\)\s*\{\s*)?"
    r"logCreatedBlockchainCustomer"
    r"\s*\(\s*\{"
    r"\s*customerId\s*,"
    r"\s*residentId\s*:\s*fabricResidentId\s*,"
    r"\s*ledgerKey\s*,"
    r"\s*fullName\s*:\s*customerName\s*,"
    r"\s*kycStatus\s*:\s*residentPayload\.kycStatus\s*,"
    r"\s*riskCategory\s*:\s*residentPayload\.riskCategory\s*,"
    r"\s*blockchainTransactionId\s*:\s*fabricTransactionId\s*,"
    r"\s*channelName\s*:\s*fabricResult\?\.channelName\s*,"
    r"\s*chaincodeName\s*:\s*fabricResult\?\.chaincodeName"
    r"\s*\}\s*\)\s*;"
    r"\s*(?:\}\s*)?",
    flags=re.DOTALL,
)

safe_call = r"""/* BLOCKCHAIN_CUSTOMER_CREATED_LOG_CALL_V1 */
      if (
        fabricStatus === 'CONFIRMED' &&
        fabricTransactionId
      ) {
        logCreatedBlockchainCustomer({
          customerId,
          residentId: fabricResidentId,
          ledgerKey,
          fullName: customerName,
          kycStatus: residentPayload.kycStatus,
          riskCategory: residentPayload.riskCategory,
          blockchainTransactionId: fabricTransactionId,
          channelName: fabricResult?.channelName,
          chaincodeName: fabricResult?.chaincodeName
        });
      }

      """

text, call_replacements = call_pattern.subn(
    safe_call,
    text,
    count=1
)

if call_replacements != 1:
    raise SystemExit(
        "ERROR: Expected to update exactly one "
        "BLOCKCHAIN_CUSTOMER_CREATED_LOG_CALL_V1 block, "
        f"but updated {call_replacements}."
    )

for forbidden in (
    "BLOCKCHAIN_CUSTOMER_STARTUP_SNAPSHOT",
    "BLOCKCHAIN_CUSTOMER_STARTUP_SNAPSHOT_FAILED",
    "loadAllBlockchainCustomersForStartupLog",
    "scheduleBlockchainCustomerStartupLog",
    "STARTUP_CUSTOMER_LOG",
    "console.table(rows)",
):
    if forbidden in text:
        raise SystemExit(
            f"ERROR: Startup-only token still exists: {forbidden}"
        )

if text.count("BLOCKCHAIN_CUSTOMER_CREATED_LOG_CALL_V1") != 1:
    raise SystemExit(
        "ERROR: Customer-created log call marker must exist exactly once."
    )

if text.count("function logCreatedBlockchainCustomer") != 1:
    raise SystemExit(
        "ERROR: logCreatedBlockchainCustomer must exist exactly once."
    )

path.write_text(text, encoding="utf-8")

print(f"UPDATED: {path}")
print(
    "Removed startup schedule block:",
    schedule_replacements
)
print(
    "Updated customer-created call block:",
    call_replacements
)
PY

node --check "$TARGET"

echo
echo "Validation after modification:"
grep -nE \
  "BLOCKCHAIN_CUSTOMER_CREATED_ONLY_LOGGER_V2|BLOCKCHAIN_CUSTOMER_CREATED_LOG_CALL_V1|BLOCKCHAIN_CUSTOMER_STARTUP" \
  "$TARGET" || true

echo
echo "Startup-only token check:"
if grep -nE \
  "BLOCKCHAIN_CUSTOMER_STARTUP_SNAPSHOT|BLOCKCHAIN_CUSTOMER_STARTUP_SNAPSHOT_FAILED|loadAllBlockchainCustomersForStartupLog|scheduleBlockchainCustomerStartupLog|console\.table\(rows\)" \
  "$TARGET"
then
  echo "ERROR: Startup-only customer logging remains." >&2
  exit 1
else
  echo "PASS: Startup snapshot code was removed."
fi

echo
echo "============================================================"
echo "PATCH COMPLETED"
echo "Backup directory: $BACKUP_DIR"
echo "Active file:      $TARGET"
echo "============================================================"
