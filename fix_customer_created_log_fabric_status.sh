#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_ROOT="${1:-$HOME/u01/blockchain-integration}"
TARGET="$PROJECT_ROOT/blockchain-api/src/routes/valoores-blockchain.routes.js"

TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR="$PROJECT_ROOT/backups/customer-created-log-scope-fix-$TIMESTAMP"
BACKUP_FILE="$BACKUP_DIR/blockchain-api/src/routes/valoores-blockchain.routes.js"
LAST_BACKUP_FILE="$PROJECT_ROOT/.last_customer_created_log_scope_fix_backup"

if [[ ! -f "$TARGET" ]]; then
  echo "ERROR: Active route file not found: $TARGET" >&2
  exit 1
fi

mkdir -p "$(dirname "$BACKUP_FILE")"
cp -a "$TARGET" "$BACKUP_FILE"
printf '%s\n' "$BACKUP_DIR" > "$LAST_BACKUP_FILE"

python3 - "$TARGET" <<'PY'
from pathlib import Path
import re
import sys

path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8")

pattern = re.compile(
    r"""if\s*\(\s*
        fabricStatus\s*===\s*['"]CONFIRMED['"]\s*&&\s*
        fabricTransactionId\s*
        \)\s*\{
        (?P<body>\s*logCreatedBlockchainCustomer\s*\(\s*\{.*?\}\s*\)\s*;\s*)
        \}""",
    flags=re.DOTALL | re.VERBOSE,
)

match = pattern.search(text)

if not match:
    if re.search(
        r"if\s*\(\s*fabricTransactionId\s*\)\s*\{\s*"
        r"logCreatedBlockchainCustomer",
        text,
        flags=re.DOTALL,
    ):
        print("ALREADY FIXED: logging condition uses fabricTransactionId.")
        sys.exit(0)

    raise SystemExit(
        "ERROR: Broken fabricStatus logging condition was not found."
    )

replacement = (
    "if (fabricTransactionId) {"
    + match.group("body")
    + "}"
)

text, count = pattern.subn(replacement, text, count=1)

if count != 1:
    raise SystemExit(
        f"ERROR: Expected one replacement, completed {count}."
    )

if "fabricStatus === 'CONFIRMED'" in text:
    raise SystemExit(
        "ERROR: fabricStatus condition still exists."
    )

path.write_text(text, encoding="utf-8")

print(f"UPDATED: {path}")
print("REPLACED: fabricStatus condition -> fabricTransactionId condition")
PY

node --check "$TARGET"

echo
echo "Verification:"
grep -nA 18 -B 3 \
  "BLOCKCHAIN_CUSTOMER_CREATED_LOG_CALL_V1" \
  "$TARGET"

echo
echo "Backup directory:"
echo "$BACKUP_DIR"
