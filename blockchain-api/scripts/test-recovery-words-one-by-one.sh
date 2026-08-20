#!/usr/bin/env bash

set -Eeuo pipefail

PROJECT_DIR="$HOME/u01/blockchain-integration/blockchain-api"

DEFAULT_KEYSTORE_DIR="$PROJECT_DIR/license-wallet-output/2026-07-30T14-20-14-076Z/keystores"

KEYSTORE_DIR="${KEYSTORE_DIR:-$DEFAULT_KEYSTORE_DIR}"
CUSTOMER_ID="${1:-}"

cleanup() {
    unset RECOVERY_WORD
    unset RECOVERY_PHRASE
    RECOVERY_WORDS=()
}

trap cleanup EXIT INT TERM

if [[ -z "$CUSTOMER_ID" ]]; then
    echo "[FAIL] Customer ID is required."
    echo ""
    echo "Usage:"
    echo "  $0 CUSTOMER_ID"
    exit 1
fi

if [[ ! -d "$KEYSTORE_DIR" ]]; then
    echo "[FAIL] Keystore directory does not exist:"
    echo "$KEYSTORE_DIR"
    exit 1
fi

WALLET_FILE="$(
    find "$KEYSTORE_DIR" \
        -maxdepth 1 \
        -type f \
        -name "${CUSTOMER_ID}-*.json" \
        -print \
        -quit
)"

if [[ -z "$WALLET_FILE" || ! -f "$WALLET_FILE" ]]; then
    echo "[FAIL] No wallet keystore found for customer:"
    echo "$CUSTOMER_ID"
    exit 1
fi

echo "============================================================"
echo "12-WORD LICENSE RECOVERY TEST"
echo "============================================================"
echo "Customer ID : $CUSTOMER_ID"
echo "Wallet file : $WALLET_FILE"
echo ""
echo "Enter each recovery word separately."
echo "The words will not be displayed or written to a file."
echo ""

RECOVERY_WORDS=()

for WORD_NUMBER in $(seq 1 12); do
    while true; do
        read -r -s -p \
            "Enter recovery word ${WORD_NUMBER} of 12: " \
            RECOVERY_WORD

        echo

        RECOVERY_WORD="${RECOVERY_WORD,,}"
        RECOVERY_WORD="${RECOVERY_WORD//[[:space:]]/}"

        if [[ -z "$RECOVERY_WORD" ]]; then
            echo "[FAIL] The word cannot be empty."
            continue
        fi

        if [[ ! "$RECOVERY_WORD" =~ ^[a-z]+$ ]]; then
            echo "[FAIL] Enter one word using letters only."
            continue
        fi

        RECOVERY_WORDS+=("$RECOVERY_WORD")
        break
    done
done

if [[ "${#RECOVERY_WORDS[@]}" -ne 12 ]]; then
    echo "[FAIL] Exactly 12 words were not captured."
    exit 1
fi

RECOVERY_PHRASE="${RECOVERY_WORDS[*]}"

printf '%s\n' "$RECOVERY_PHRASE" |
    node \
        "$PROJECT_DIR/scripts/verify-recovery-words-from-stdin.mjs" \
        "$WALLET_FILE"
