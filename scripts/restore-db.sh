#!/usr/bin/env bash
# Restore natives_db from a .dump file produced by backup-db.sh
#
# Usage:
#   ./scripts/restore-db.sh /var/backups/natives_db/natives_db_2026-04-30_0200.dump
#
# This restores INTO the existing database (data is replaced, schema is rebuilt).
# The live app should be stopped first to avoid write conflicts.

set -euo pipefail

DUMP_FILE="${1:-}"
DB_NAME="natives_db"
DB_USER="postgres"
DB_HOST="localhost"
DB_PORT="5432"
PGPASSWORD="postgres"
export PGPASSWORD

if [[ -z "$DUMP_FILE" ]]; then
  echo "Usage: $0 <path-to-dump-file>"
  echo ""
  echo "Available backups:"
  ls -lht /var/backups/natives_db/*.dump 2>/dev/null || echo "  (none found)"
  exit 1
fi

if [[ ! -f "$DUMP_FILE" ]]; then
  echo "Error: file not found: $DUMP_FILE"
  exit 1
fi

echo "========================================"
echo "  RESTORE natives_db"
echo "  From: $DUMP_FILE"
echo "  $(date)"
echo "========================================"
echo ""
echo "This will DROP and recreate all tables in '$DB_NAME'."
echo "Stop the API first:  pm2 stop natives-api"
echo ""
read -r -p "Type 'yes' to continue: " CONFIRM
if [[ "$CONFIRM" != "yes" ]]; then
  echo "Aborted."
  exit 1
fi

echo ""
echo "Dropping existing schema..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
  -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" -q

echo "Restoring from dump..."
pg_restore \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --no-owner \
  --no-acl \
  "$DUMP_FILE"

echo ""
echo "Done. Restart the API:  pm2 start natives-api"
