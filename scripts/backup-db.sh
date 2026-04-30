#!/usr/bin/env bash
# Daily backup for natives_db
# Keeps 7 daily backups + one snapshot per week (Sunday) for 4 weeks.
# Dumps in PostgreSQL custom format (~5-10x smaller than plain SQL, fully restorable).

set -euo pipefail

DB_NAME="natives_db"
DB_USER="postgres"
DB_HOST="localhost"
DB_PORT="5432"
PGPASSWORD="postgres"
export PGPASSWORD

BACKUP_DIR="/var/backups/natives_db"
B2_REMOTE="b2-natives:NativeDB"
LOG="$BACKUP_DIR/backup.log"
TIMESTAMP=$(date +"%Y-%m-%d_%H%M")
DOW=$(date +%u)   # 1=Mon … 7=Sun
FILE="$BACKUP_DIR/${DB_NAME}_${TIMESTAMP}.dump"

mkdir -p "$BACKUP_DIR"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting backup → $FILE" >> "$LOG"

pg_dump \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --format=custom \
  --compress=9 \
  --file="$FILE"

SIZE=$(du -sh "$FILE" | cut -f1)
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Done. Size: $SIZE" >> "$LOG"

# --- Retention ---
# Keep all backups from the last 7 days
find "$BACKUP_DIR" -name "*.dump" -mtime +7 | while read -r OLD; do
  # Preserve Sunday snapshots for up to 28 days
  FILE_DOW=$(date -r "$OLD" +%u 2>/dev/null || stat -c %Y "$OLD" | xargs -I{} date -d @{} +%u)
  FILE_AGE=$(( ( $(date +%s) - $(date -r "$OLD" +%s 2>/dev/null || stat -c %Y "$OLD") ) / 86400 ))
  if [[ "$FILE_DOW" == "7" && "$FILE_AGE" -lt 29 ]]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Keeping weekly: $(basename "$OLD")" >> "$LOG"
  else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Removing old: $(basename "$OLD")" >> "$LOG"
    rm "$OLD"
  fi
done

# --- Upload to Backblaze B2 ---
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Uploading to B2..." >> "$LOG"
if rclone copy "$FILE" "$B2_REMOTE" --stats-one-line >> "$LOG" 2>&1; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Upload complete." >> "$LOG"
  # Mirror local retention to B2: remove B2 files older than 30 days
  rclone delete "$B2_REMOTE" --min-age 30d >> "$LOG" 2>&1 || true
else
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] WARNING: B2 upload failed — local backup still intact." >> "$LOG"
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backup complete." >> "$LOG"
echo "---" >> "$LOG"
