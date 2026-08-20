#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_ROOT="${1:-$HOME/u01/blockchain-integration}"
TARGET="$PROJECT_ROOT/inspect_fabric_org1_context_and_lifecycle.sh"

STAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP="$TARGET.before_node_check_fix_$STAMP"

if [[ ! -f "$TARGET" ]]; then
  echo "ERROR: Inspection script not found: $TARGET" >&2
  exit 1
fi

cp -a "$TARGET" "$BACKUP"

python3 - "$TARGET" <<'PY'
from pathlib import Path
import re
import sys

path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8")

pattern = re.compile(
    r'''docker exec "\$CLI_CONTAINER" sh -lc "
  set -e
  test -f '\$CLI_CONTRACT'
  node --check '\$CLI_CONTRACT'
  echo 'UpdateResident count:' \\\$\(grep -c 'async UpdateResident' '\$CLI_CONTRACT'\)
  echo 'DeleteResident count:' \\\$\(grep -c 'async DeleteResident' '\$CLI_CONTRACT'\)
"'''
)

replacement = '''docker exec "$CLI_CONTAINER" sh -lc "
  set -e
  test -f '$CLI_CONTRACT'
  echo 'PASS: Chaincode source is mounted inside the CLI container.'
  echo 'UpdateResident count:' \\$(grep -c 'async UpdateResident' '$CLI_CONTRACT')
  echo 'DeleteResident count:' \\$(grep -c 'async DeleteResident' '$CLI_CONTRACT')
"'''

updated, count = pattern.subn(replacement, text, count=1)

if count != 1:
    raise SystemExit(
        "ERROR: Expected CLI node-check block was not found exactly once."
    )

path.write_text(updated, encoding="utf-8")
print(f"UPDATED: {path}")
PY

bash -n "$TARGET"

echo "PASS: Inspection script syntax is valid."
echo "Backup: $BACKUP"
echo
grep -nA 8 -B 2 \
  "VERIFY CHAINCODE SOURCE MOUNT INSIDE CLI" \
  "$TARGET"
