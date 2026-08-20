#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_ROOT="${1:-$HOME/u01/blockchain-integration}"
TARGET="$PROJECT_ROOT/blockchain-api/src/routes/valoores-blockchain.routes.js"

TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR="$PROJECT_ROOT/backups/blockchain-customer-console-log-$TIMESTAMP"
BACKUP_FILE="$BACKUP_DIR/blockchain-api/src/routes/valoores-blockchain.routes.js"

if [[ ! -f "$TARGET" ]]; then
  echo "ERROR: Target file not found: $TARGET" >&2
  exit 1
fi

mkdir -p "$(dirname "$BACKUP_FILE")"
cp -a "$TARGET" "$BACKUP_FILE"

python3 - "$TARGET" <<'PY'
from pathlib import Path
import re
import sys

path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8")

helper_marker = "BLOCKCHAIN_CUSTOMER_STARTUP_LOGGER_V1"

if helper_marker not in text:
    fabric_match = re.search(
        r"^const\s+fabricService\s*=\s*require\([^\n]+\);\s*$",
        text,
        flags=re.MULTILINE,
    )

    if not fabric_match:
        raise SystemExit(
            "ERROR: fabricService require statement was not found."
        )

    helper_code = r'''
/* BLOCKCHAIN_CUSTOMER_STARTUP_LOGGER_V1 */
const customerLogFs = require('fs');
const customerLogPath = require('path');

const BLOCKCHAIN_CUSTOMER_LOG_FILE = customerLogPath.resolve(
  __dirname,
  '../../logs/blockchain-customers.log'
);

function normalizeFabricQueryData(result) {
  return result?.data ?? result?.result ?? result ?? {};
}

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
  } catch (error) {
    console.error(
      '[BLOCKCHAIN CUSTOMER LOG] Failed to write log file:',
      error.message
    );
  }
}

function logCreatedBlockchainCustomer(customer) {
  const event = {
    timestamp: new Date().toISOString(),
    eventType: 'BLOCKCHAIN_CUSTOMER_CREATED',
    source: 'FABRIC_BLOCKCHAIN',
    channelName: customer.channelName || null,
    chaincodeName: customer.chaincodeName || null,
    customerId: sanitizeCustomerLogValue(customer.customerId),
    residentId: sanitizeCustomerLogValue(customer.residentId),
    ledgerKey: sanitizeCustomerLogValue(customer.ledgerKey),
    fullName: sanitizeCustomerLogValue(customer.fullName),
    kycStatus: sanitizeCustomerLogValue(
      customer.kycStatus || 'Submitted'
    ),
    riskCategory: sanitizeCustomerLogValue(
      customer.riskCategory || 'LOW'
    ),
    blockchainTransactionId: sanitizeCustomerLogValue(
      customer.blockchainTransactionId
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
  console.log(
    `Fabric Tx ID:    ${event.blockchainTransactionId || 'N/A'}`
  );
  console.log(
    '============================================================'
  );
  console.log('');

  appendBlockchainCustomerLog(event);
}

async function loadAllBlockchainCustomersForStartupLog() {
  const requestTime = Date.now();

  const countResult = await fabricService.evaluateTransaction(
    'CountValooresCustomers',
    [],
    {
      requestId:
        `STARTUP-VALOORES-CUSTOMER-COUNT-${requestTime}`,
      correlationId:
        `STARTUP-VALOORES-CUSTOMER-COUNT-${requestTime}`,
      sourceSystem: 'BLOCKCHAIN_API',
      requestSource: 'STARTUP_CUSTOMER_LOG'
    }
  );

  const countData = normalizeFabricQueryData(countResult);
  const totalCustomers = Number(
    countData.totalCustomers || 0
  );

  const pageSize = Math.min(
    Math.max(
      Number.parseInt(
        process.env.BLOCKCHAIN_CUSTOMER_LOG_PAGE_SIZE || '500',
        10
      ) || 500,
      1
    ),
    1000
  );

  const customers = [];
  let bookmark = '';
  let previousBookmark = null;
  let pageNumber = 0;

  while (
    customers.length < totalCustomers &&
    pageNumber < 10000
  ) {
    pageNumber += 1;

    const listResult = await fabricService.evaluateTransaction(
      'QueryValooresCustomers',
      [String(pageSize), bookmark],
      {
        requestId:
          `STARTUP-VALOORES-CUSTOMER-LIST-${requestTime}-${pageNumber}`,
        correlationId:
          `STARTUP-VALOORES-CUSTOMER-LIST-${requestTime}`,
        sourceSystem: 'BLOCKCHAIN_API',
        requestSource: 'STARTUP_CUSTOMER_LOG'
      }
    );

    const listData = normalizeFabricQueryData(listResult);
    const pageCustomers = Array.isArray(listData.customers)
      ? listData.customers
      : [];

    customers.push(...pageCustomers);

    const nextBookmark = String(
      listData?.pagination?.bookmark || ''
    );

    if (
      pageCustomers.length === 0 ||
      customers.length >= totalCustomers ||
      !nextBookmark ||
      nextBookmark === bookmark ||
      nextBookmark === previousBookmark
    ) {
      break;
    }

    previousBookmark = bookmark;
    bookmark = nextBookmark;
  }

  const includeName =
    String(
      process.env.BLOCKCHAIN_CUSTOMER_LOG_INCLUDE_NAME ??
      'true'
    ).toLowerCase() !== 'false';

  const rows = customers.map((customer, index) => ({
    No: index + 1,
    CustomerID:
      sanitizeCustomerLogValue(
        customer.customerId ||
        String(customer.residentId || '').replace(
          /^VALOORES-/,
          ''
        )
      ),
    ResidentID:
      sanitizeCustomerLogValue(customer.residentId),
    FullName: includeName
      ? sanitizeCustomerLogValue(customer.fullName)
      : '[HIDDEN]',
    KYCStatus:
      sanitizeCustomerLogValue(customer.kycStatus),
    Risk:
      sanitizeCustomerLogValue(customer.riskCategory),
    CreatedAt:
      sanitizeCustomerLogValue(customer.createdAt)
  }));

  console.log('');
  console.log(
    '============================================================'
  );
  console.log(
    '[BLOCKCHAIN CUSTOMERS STARTUP SNAPSHOT]'
  );
  console.log('Source:      FABRIC_BLOCKCHAIN');
  console.log(
    `Channel:     ${countResult?.channelName || 'N/A'}`
  );
  console.log(
    `Chaincode:   ${countResult?.chaincodeName || 'N/A'}`
  );
  console.log(`Total:       ${totalCustomers}`);
  console.log(`Loaded:      ${customers.length}`);
  console.log(
    `Log file:    ${BLOCKCHAIN_CUSTOMER_LOG_FILE}`
  );
  console.log(
    '============================================================'
  );

  if (rows.length > 0) {
    console.table(rows);
  } else {
    console.log(
      '[BLOCKCHAIN CUSTOMERS] No VALOORES customers found.'
    );
  }

  console.log(
    '============================================================'
  );
  console.log('');

  appendBlockchainCustomerLog({
    timestamp: new Date().toISOString(),
    eventType: 'BLOCKCHAIN_CUSTOMER_STARTUP_SNAPSHOT',
    source: 'FABRIC_BLOCKCHAIN',
    channelName: countResult?.channelName || null,
    chaincodeName: countResult?.chaincodeName || null,
    totalCustomers,
    loadedCustomers: customers.length,
    customers: rows
  });

  return customers;
}

function scheduleBlockchainCustomerStartupLog() {
  const enabled =
    String(
      process.env.LOG_BLOCKCHAIN_CUSTOMERS_ON_STARTUP ??
      'true'
    ).toLowerCase() !== 'false';

  if (!enabled) {
    console.log(
      '[BLOCKCHAIN CUSTOMERS] Startup customer logging is disabled.'
    );
    return;
  }

  const delayMs = Math.max(
    Number.parseInt(
      process.env.BLOCKCHAIN_CUSTOMER_LOG_DELAY_MS || '5000',
      10
    ) || 5000,
    0
  );

  const timer = setTimeout(() => {
    loadAllBlockchainCustomersForStartupLog()
      .catch((error) => {
        console.error('');
        console.error(
          '[BLOCKCHAIN CUSTOMERS STARTUP LOG FAILED]'
        );
        console.error(error.message);
        console.error('');

        appendBlockchainCustomerLog({
          timestamp: new Date().toISOString(),
          eventType:
            'BLOCKCHAIN_CUSTOMER_STARTUP_SNAPSHOT_FAILED',
          source: 'FABRIC_BLOCKCHAIN',
          error: error.message
        });
      });
  }, delayMs);

  if (typeof timer.unref === 'function') {
    timer.unref();
  }
}
/* END BLOCKCHAIN_CUSTOMER_STARTUP_LOGGER_V1 */
'''

    insert_at = fabric_match.end()
    text = text[:insert_at] + helper_code + text[insert_at:]

post_start = text.find(
    "router.post('/customers', async (req, res) => {"
)

if post_start < 0:
    raise SystemExit(
        "ERROR: POST /customers route was not found."
    )

next_route = text.find(
    "router.get('/customers/count'",
    post_start
)

if next_route < 0:
    next_route = text.find(
        "router.get('/customers'",
        post_start
    )

if next_route < 0:
    raise SystemExit(
        "ERROR: Could not locate the route after POST /customers."
    )

post_block = text[post_start:next_route]

creation_marker = "BLOCKCHAIN_CUSTOMER_CREATED_LOG_CALL_V1"

if creation_marker not in post_block:
    return_marker = "return res.status(201).json({"
    return_pos = post_block.find(return_marker)

    if return_pos < 0:
        raise SystemExit(
            "ERROR: Successful HTTP 201 response was not found "
            "inside POST /customers."
        )

    creation_log = r'''/* BLOCKCHAIN_CUSTOMER_CREATED_LOG_CALL_V1 */
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

      '''

    post_block = (
        post_block[:return_pos] +
        creation_log +
        post_block[return_pos:]
    )

    text = (
        text[:post_start] +
        post_block +
        text[next_route:]
    )

schedule_marker = "BLOCKCHAIN_CUSTOMER_STARTUP_LOG_SCHEDULE_V1"

if schedule_marker not in text:
    export_marker = "module.exports = router;"
    export_pos = text.rfind(export_marker)

    if export_pos < 0:
        raise SystemExit(
            "ERROR: module.exports = router was not found."
        )

    schedule_code = r'''
/* BLOCKCHAIN_CUSTOMER_STARTUP_LOG_SCHEDULE_V1 */
if (
  !global.__VALOORES_BLOCKCHAIN_CUSTOMER_LOG_SCHEDULED__
) {
  global.__VALOORES_BLOCKCHAIN_CUSTOMER_LOG_SCHEDULED__ = true;
  scheduleBlockchainCustomerStartupLog();
}

'''

    text = (
        text[:export_pos] +
        schedule_code +
        text[export_pos:]
    )

path.write_text(text, encoding="utf-8")
print(f"UPDATED: {path}")
PY

node --check "$TARGET"

echo
echo "Blockchain customer console logging was installed."
echo "Target: $TARGET"
echo "Backup directory: $BACKUP_DIR"
echo
echo "Logs will be written to:"
echo "$PROJECT_ROOT/blockchain-api/logs/blockchain-customers.log"
