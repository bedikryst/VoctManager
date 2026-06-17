#!/usr/bin/env bash
# ==========================================================================
# infra/backup.sh
# --------------------------------------------------------------------------
# On-droplet backup for VoctManager: a gzipped PostgreSQL dump + a tar of the
# user-uploaded media tree, written OUTSIDE the repo checkout with day-based
# rotation. Designed to run from cron on the production host.
#
# Scope: protects against human error, a bad deploy, and `git clean -fdx`
# (which would otherwise wipe the gitignored voct_data/). It does NOT protect
# against loss of the droplet/disk itself — for that, copy $BACKUP_DIR off-box
# (DO Spaces, scp to another machine). That is a deliberate follow-up.
#
# Usage:   bash infra/backup.sh
# Cron:    see the deploy notes in README — runs daily, keeps $KEEP_DAYS days.
# Restore: see the "RESTORE" section at the bottom of this file.
# ==========================================================================
set -euo pipefail

# --- Config (override via environment if needed) --------------------------
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$HOME/voct-backups}"   # kept outside the repo on purpose
KEEP_DAYS="${KEEP_DAYS:-14}"                      # rotation window
# Pin the prod compose files so the dev override is never merged in by accident.
COMPOSE="${COMPOSE:-docker compose -f docker-compose.yml -f docker-compose.prod.yml}"

TS="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
cd "$REPO_DIR"

echo "[backup] $(date -Is) → $BACKUP_DIR"

# --- 1. PostgreSQL ---------------------------------------------------------
# Dump from inside the running db container, using ITS OWN env vars so no
# credentials are duplicated here. --clean --if-exists makes the dump safe to
# replay onto an existing database during a restore.
DB_FILE="$BACKUP_DIR/voct-db-$TS.sql.gz"
echo "[backup] postgres → $(basename "$DB_FILE")"
$COMPOSE exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists' \
  | gzip > "$DB_FILE"

# --- 2. Media tree ---------------------------------------------------------
# voct_data/media is the single live copy of user uploads (avatars, audio,
# scores, documents). Archive the directory as-is.
MEDIA_FILE="$BACKUP_DIR/voct-media-$TS.tgz"
if [ -d "$REPO_DIR/voct_data/media" ]; then
  echo "[backup] media → $(basename "$MEDIA_FILE")"
  tar czf "$MEDIA_FILE" -C "$REPO_DIR/voct_data" media
else
  echo "[backup] WARNING: voct_data/media not found — skipping media archive"
fi

# --- 3. Rotation -----------------------------------------------------------
echo "[backup] pruning archives older than ${KEEP_DAYS} days"
find "$BACKUP_DIR" -maxdepth 1 -name 'voct-db-*.sql.gz' -mtime +"$KEEP_DAYS" -delete
find "$BACKUP_DIR" -maxdepth 1 -name 'voct-media-*.tgz' -mtime +"$KEEP_DAYS" -delete

echo "[backup] done. Current archives:"
ls -lh "$BACKUP_DIR" | tail -n +2 || true

# ==========================================================================
# RESTORE (manual, run from the repo root on the droplet)
# --------------------------------------------------------------------------
#   Database:
#     gunzip -c ~/voct-backups/voct-db-<TS>.sql.gz \
#       | docker compose -f docker-compose.yml -f docker-compose.prod.yml \
#           exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
#
#   Media (stop writers first to avoid mid-write races):
#     docker compose -f docker-compose.yml -f docker-compose.prod.yml stop web celery
#     rm -rf voct_data/media && tar xzf ~/voct-backups/voct-media-<TS>.tgz -C voct_data
#     docker compose -f docker-compose.yml -f docker-compose.prod.yml start web celery
# ==========================================================================
