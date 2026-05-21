#!/bin/bash

# ======================================================
# PostgreSQL Export Script
# Exports existing data from required tables to CSV files
# ======================================================

DB_HOST="172.31.13.133"
DB_PORT="5444"
DB_NAME="vfds_dev"
DB_USER="pgdata"

EXPORT_DIR="./postgres_export_$(date +%Y%m%d_%H%M%S)"

mkdir -p "$EXPORT_DIR"

echo "Export directory: $EXPORT_DIR"
echo "Starting export..."

# ======================================================
# 1. sdedba.ref_customer
# ======================================================
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "\COPY sdedba.ref_customer TO '$EXPORT_DIR/ref_customer.csv' WITH CSV HEADER;"

# ======================================================
# 2. sdedba.ref_customer_misc_info
# ======================================================
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "\COPY sdedba.ref_customer_misc_info TO '$EXPORT_DIR/ref_customer_misc_info.csv' WITH CSV HEADER;"

# ======================================================
# 3. sdedba.ref_item
# ======================================================
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "\COPY sdedba.ref_item TO '$EXPORT_DIR/ref_item.csv' WITH CSV HEADER;"

# ======================================================
# 4. sdedba.ref_lgcy_item_info
# ======================================================
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "\COPY sdedba.ref_lgcy_item_info TO '$EXPORT_DIR/ref_lgcy_item_info.csv' WITH CSV HEADER;"

# ======================================================
# 5. sdedba.ref_com_currency
# ======================================================
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "\COPY sdedba.ref_com_currency TO '$EXPORT_DIR/ref_com_currency.csv' WITH CSV HEADER;"

# ======================================================
# 6. public.ref_sysp71
# If your table is in another schema, update this line.
# ======================================================
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "\COPY ref_sysp71 TO '$EXPORT_DIR/ref_sysp71.csv' WITH CSV HEADER;"

# ======================================================
# 7. sdedba.sts_status
# ======================================================
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "\COPY sdedba.sts_status TO '$EXPORT_DIR/sts_status.csv' WITH CSV HEADER;"

# ======================================================
# 8. findba.fin_account_info
# ======================================================
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "\COPY findba.fin_account_info TO '$EXPORT_DIR/fin_account_info.csv' WITH CSV HEADER;"

# ======================================================
# 9. findba.fin_account_item
# ======================================================
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "\COPY findba.fin_account_item TO '$EXPORT_DIR/fin_account_item.csv' WITH CSV HEADER;"

echo "Export completed successfully."
echo "Files saved in: $EXPORT_DIR"
