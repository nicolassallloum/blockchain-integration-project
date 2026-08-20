#!/usr/bin/env bash

set -Eeuo pipefail

PROJECT_DIR="$HOME/u01/blockchain-integration/blockchain-api"
DEFAULT_KEYSTORE_DIR="$PROJECT_DIR/license-wallet-output/2026-07-30T14-20-14-076Z/keystores"

KEYSTORE_DIR="${KEYSTORE_DIR:-$DEFAULT_KEYSTORE_DIR}"
CUSTOMER_ID="${1:-}"

cleanup() {
    unset RECOVERY_WORD
    unset RECOVERY_PHRASE
    unset POSTGRES_PASSWORD
    unset WALLET_FILE

    if declare -p RECOVERY_WORDS >/dev/null 2>&1; then
        RECOVERY_WORDS=()
        unset RECOVERY_WORDS
    fi
}

trap cleanup EXIT INT TERM

if [[ -z "$CUSTOMER_ID" ]]; then
    echo "[FAIL] Customer ID is required."
    echo
    echo "Usage:"
    echo "  $0 CUSTOMER_ID"
    exit 1
fi

if [[ ! "$CUSTOMER_ID" =~ ^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$ ]]; then
    echo "[FAIL] Invalid customer UUID format."
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
    echo "[FAIL] No wallet was found for customer:"
    echo "$CUSTOMER_ID"
    exit 1
fi

export POSTGRES_HOST="${POSTGRES_HOST:-172.31.13.133}"
export POSTGRES_PORT="${POSTGRES_PORT:-5444}"
export POSTGRES_DATABASE="${POSTGRES_DATABASE:-vfortress_licensing}"
export POSTGRES_USER="${POSTGRES_USER:-pgdata}"

echo "============================================================"
echo "VALOORES LICENSE RECOVERY"
echo "============================================================"
echo "Customer ID : $CUSTOMER_ID"
echo "Wallet found: YES"
echo

read -r -s -p "Enter PostgreSQL password: " POSTGRES_PASSWORD
echo

export POSTGRES_PASSWORD

echo
echo "Enter the 12 recovery words individually."
echo "The words will not be displayed or written to a file."
echo

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
            echo "[FAIL] Recovery word cannot be empty."
            continue
        fi

        if [[ ! "$RECOVERY_WORD" =~ ^[a-z]+$ ]]; then
            echo "[FAIL] Enter one recovery word using letters only."
            continue
        fi

        RECOVERY_WORDS+=("$RECOVERY_WORD")
        break
    done
done

if [[ "${#RECOVERY_WORDS[@]}" -ne 12 ]]; then
    echo "[FAIL] Exactly 12 recovery words were not captured."
    exit 1
fi

RECOVERY_PHRASE="${RECOVERY_WORDS[*]}"

printf '%s\n' "$RECOVERY_PHRASE" |
    node \
        "$PROJECT_DIR/scripts/recover-and-display-license.mjs" \
        "$CUSTOMER_ID" \
        "$WALLET_FILE"
