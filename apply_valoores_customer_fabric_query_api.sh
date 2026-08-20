#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_ROOT="${1:-$HOME/u01/blockchain-integration}"

CHAINCODE_FILE="$PROJECT_ROOT/chaincode/kyc-wallet-chaincode-js/lib/kycWalletContract.js"
ROUTE_FILE="$PROJECT_ROOT/blockchain-api/src/routes/valoores-blockchain.routes.js"

TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR="$PROJECT_ROOT/backups/valoores-fabric-customer-query-$TIMESTAMP"

CHAINCODE_BACKUP="$BACKUP_DIR/chaincode/kyc-wallet-chaincode-js/lib/kycWalletContract.js"
ROUTE_BACKUP="$BACKUP_DIR/blockchain-api/src/routes/valoores-blockchain.routes.js"

for file in "$CHAINCODE_FILE" "$ROUTE_FILE"; do
  if [[ ! -f "$file" ]]; then
    echo "ERROR: Missing active file: $file" >&2
    exit 1
  fi
done

mkdir -p "$(dirname "$CHAINCODE_BACKUP")" "$(dirname "$ROUTE_BACKUP")"
cp -a "$CHAINCODE_FILE" "$CHAINCODE_BACKUP"
cp -a "$ROUTE_FILE" "$ROUTE_BACKUP"

python3 - "$CHAINCODE_FILE" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8")

if "async QueryValooresCustomers(" not in text:
    marker = "    async CreateResidentWallet("
    pos = text.find(marker)

    if pos < 0:
        raise SystemExit(
            "Could not find CreateResidentWallet marker in chaincode."
        )

    methods = r'''
    /**
     * Query current VALOORES customers through Fabric.
     *
     * The query uses deterministic world-state key ranges:
     * KYC_VALOORES-...
     */
    async QueryValooresCustomers(
        ctx,
        pageSize = '100',
        bookmark = ''
    ) {
        const parsedPageSize = Number.parseInt(
            String(pageSize || '100'),
            10
        );

        const normalizedPageSize = Number.isFinite(parsedPageSize)
            ? Math.min(Math.max(parsedPageSize, 1), 1000)
            : 100;

        const normalizedBookmark = String(bookmark || '');
        const startKey = 'KYC_VALOORES-';
        const endKey = 'KYC_VALOORES-\uffff';

        const queryResult =
            await ctx.stub.getStateByRangeWithPagination(
                startKey,
                endKey,
                normalizedPageSize,
                normalizedBookmark
            );

        const iterator = queryResult.iterator;
        const metadata = queryResult.metadata || {};
        const customers = [];

        try {
            while (true) {
                const item = await iterator.next();

                if (
                    item.value &&
                    item.value.value &&
                    item.value.value.length > 0
                ) {
                    const ledgerKey = item.value.key;
                    const value = JSON.parse(
                        item.value.value.toString('utf8')
                    );

                    customers.push({
                        ...value,
                        ledgerKey,
                        customerId: String(
                            value.residentId || ''
                        ).replace(/^VALOORES-/, '')
                    });
                }

                if (item.done) {
                    break;
                }
            }
        } finally {
            await iterator.close();
        }

        return JSON.stringify({
            source: 'FABRIC_BLOCKCHAIN',
            customers,
            pagination: {
                pageSize: normalizedPageSize,
                fetchedRecordsCount: Number(
                    metadata.fetchedRecordsCount ||
                    customers.length
                ),
                bookmark: String(metadata.bookmark || '')
            }
        });
    }

    /**
     * Count current VALOORES customer records through Fabric.
     */
    async CountValooresCustomers(ctx) {
        const startKey = 'KYC_VALOORES-';
        const endKey = 'KYC_VALOORES-\uffff';

        const iterator = await ctx.stub.getStateByRange(
            startKey,
            endKey
        );

        let totalCustomers = 0;

        try {
            while (true) {
                const item = await iterator.next();

                if (
                    item.value &&
                    item.value.value &&
                    item.value.value.length > 0
                ) {
                    totalCustomers += 1;
                }

                if (item.done) {
                    break;
                }
            }
        } finally {
            await iterator.close();
        }

        return JSON.stringify({
            source: 'FABRIC_BLOCKCHAIN',
            totalCustomers
        });
    }

'''

    text = text[:pos] + methods + text[pos:]
    path.write_text(text, encoding="utf-8")
    print(f"UPDATED CHAINCODE: {path}")
else:
    print(f"CHAINCODE ALREADY PATCHED: {path}")
PY

python3 - "$ROUTE_FILE" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8")

start_marker = "router.get('/customers', async (req, res) => {"
end_marker = "router.get('/dashboard', async (req, res) => {"

start = text.find(start_marker)
end = text.find(end_marker)

if start < 0:
    raise SystemExit("GET /customers route was not found.")

if end < 0 or end <= start:
    raise SystemExit("GET /dashboard route was not found after GET /customers.")

replacement = r'''
router.get('/customers/count', async (req, res) => {
  try {
    const fabricResult = await fabricService.evaluateTransaction(
      'CountValooresCustomers',
      [],
      {
        requestId: `VALOORES-CUSTOMER-COUNT-${Date.now()}`,
        correlationId: `VALOORES-CUSTOMER-COUNT-${Date.now()}`,
        sourceSystem: 'VALOORES',
        requestSource: 'API'
      }
    );

    const resultData =
      fabricResult?.data ??
      fabricResult?.result ??
      fabricResult ??
      {};

    return res.status(200).json({
      success: true,
      message:
        'VALOORES customer count returned from Fabric Blockchain',
      source: 'FABRIC_BLOCKCHAIN',
      data: {
        totalCustomers: Number(
          resultData.totalCustomers || 0
        )
      },
      blockchain: {
        channelName: fabricResult?.channelName || null,
        chaincodeName: fabricResult?.chaincodeName || null,
        functionName: 'CountValooresCustomers'
      }
    });
  } catch (error) {
    console.error(
      'Count VALOORES customers from Fabric error:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Failed to count VALOORES customers from Fabric Blockchain',
      source: 'FABRIC_BLOCKCHAIN',
      error: error.message
    });
  }
});

router.get('/customers/:customerId', async (req, res) => {
  try {
    const customerId = String(
      req.params.customerId || ''
    )
      .trim()
      .replace(/^VALOORES-/, '');

    if (!customerId) {
      return res.status(400).json({
        success: false,
        message: 'customerId is required'
      });
    }

    const residentId = `VALOORES-${customerId}`;

    const fabricResult = await fabricService.evaluateTransaction(
      'GetResident',
      [residentId],
      {
        requestId:
          `VALOORES-CUSTOMER-GET-${customerId}-${Date.now()}`,
        correlationId:
          `VALOORES-CUSTOMER-GET-${customerId}`,
        sourceSystem: 'VALOORES',
        requestSource: 'API'
      }
    );

    const customer =
      fabricResult?.data ??
      fabricResult?.result ??
      fabricResult;

    return res.status(200).json({
      success: true,
      message:
        'VALOORES customer returned from Fabric Blockchain',
      source: 'FABRIC_BLOCKCHAIN',
      data: {
        ...customer,
        ledgerKey: `KYC_${residentId}`,
        customerId
      },
      blockchain: {
        channelName: fabricResult?.channelName || null,
        chaincodeName: fabricResult?.chaincodeName || null,
        functionName: 'GetResident'
      }
    });
  } catch (error) {
    const notFound = /not found|does not exist/i.test(
      String(error.message || error)
    );

    console.error(
      'Get VALOORES customer from Fabric error:',
      error
    );

    return res.status(notFound ? 404 : 500).json({
      success: false,
      message: notFound
        ? 'VALOORES customer was not found on Fabric Blockchain'
        : 'Failed to retrieve VALOORES customer from Fabric Blockchain',
      source: 'FABRIC_BLOCKCHAIN',
      error: error.message
    });
  }
});

router.get('/customers', async (req, res) => {
  try {
    const requestedLimit = Number.parseInt(
      String(req.query.limit || '100'),
      10
    );

    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), 1000)
      : 100;

    const bookmark = String(req.query.bookmark || '');

    const listResult = await fabricService.evaluateTransaction(
      'QueryValooresCustomers',
      [String(limit), bookmark],
      {
        requestId: `VALOORES-CUSTOMER-LIST-${Date.now()}`,
        correlationId: `VALOORES-CUSTOMER-LIST-${Date.now()}`,
        sourceSystem: 'VALOORES',
        requestSource: 'API'
      }
    );

    const countResult = await fabricService.evaluateTransaction(
      'CountValooresCustomers',
      [],
      {
        requestId: `VALOORES-CUSTOMER-COUNT-${Date.now()}`,
        correlationId: `VALOORES-CUSTOMER-COUNT-${Date.now()}`,
        sourceSystem: 'VALOORES',
        requestSource: 'API'
      }
    );

    const listData =
      listResult?.data ??
      listResult?.result ??
      listResult ??
      {};

    const countData =
      countResult?.data ??
      countResult?.result ??
      countResult ??
      {};

    const customers = Array.isArray(listData.customers)
      ? listData.customers
      : [];

    const nextBookmark = String(
      listData?.pagination?.bookmark || ''
    );

    return res.status(200).json({
      success: true,
      message:
        'VALOORES customers returned from Fabric Blockchain',
      source: 'FABRIC_BLOCKCHAIN',
      data: customers,
      pagination: {
        totalCustomers: Number(
          countData.totalCustomers || 0
        ),
        limit,
        returnedCustomers: customers.length,
        bookmark: nextBookmark,
        hasMore: Boolean(nextBookmark)
      },
      blockchain: {
        channelName: listResult?.channelName || null,
        chaincodeName: listResult?.chaincodeName || null,
        functionName: 'QueryValooresCustomers'
      }
    });
  } catch (error) {
    console.error(
      'List VALOORES customers from Fabric error:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Failed to retrieve VALOORES customers from Fabric Blockchain',
      source: 'FABRIC_BLOCKCHAIN',
      error: error.message
    });
  }
});

'''

updated = text[:start] + replacement + text[end:]
path.write_text(updated, encoding="utf-8")
print(f"UPDATED ROUTE: {path}")
PY

node --check "$CHAINCODE_FILE"
node --check "$ROUTE_FILE"

echo
echo "Fabric customer query source patch applied."
echo "Chaincode file: $CHAINCODE_FILE"
echo "Backend route: $ROUTE_FILE"
echo "Backup directory: $BACKUP_DIR"
echo
echo "IMPORTANT:"
echo "Deploy the updated chaincode with the next lifecycle sequence."
echo "Restart the backend only after the chaincode commit succeeds."
