#!/usr/bin/env bash
# ==========================================================================
# infra/restore-drill.sh
# --------------------------------------------------------------------------
# Proves that the backups produced by infra/backup.sh can actually be restored.
# Runs ON THE DROPLET and is NON-DESTRUCTIVE: the dump is replayed into a
# throwaway database (voct_restore_test) and the media tar is unpacked into a
# scratch directory. The live database and voct_data/media are never touched.
#
# Why not restore onto the live stack: the dumps are taken with
# `pg_dump --clean --if-exists`, so replaying one DROPs every object first. A
# corrupt or truncated dump — precisely what a drill exists to detect — would
# therefore destroy production at the exact moment it proves the backup is
# worthless. The drill must never share a failure mode with the disaster.
#
# Why the drill defaults to the OFF-SITE copy: the local copy in $BACKUP_DIR
# survives almost every scenario. The one that actually motivates backups —
# losing the droplet — is served only by the Google Shared Drive copy, so that
# is the path worth exercising. Use --from local to skip the download.
#
# Personal data never leaves the droplet: the dump is restored in place, beside
# the database it came from. Do not run this drill on a laptop.
#
#   bash infra/restore-drill.sh                    # newest off-site archive
#   bash infra/restore-drill.sh --from local       # newest local archive
#   bash infra/restore-drill.sh --timestamp 20260724-033001
# ==========================================================================
set -euo pipefail

export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:${PATH:-}"

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Same secrets file as the backup job, so the drill talks to the same remote.
BACKUP_ENV="${BACKUP_ENV:-$REPO_DIR/infra/backup.env}"
if [ -f "$BACKUP_ENV" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$BACKUP_ENV"
  set +a
fi

BACKUP_DIR="${BACKUP_DIR:-$HOME/voct-backups}"
RCLONE_REMOTE="${RCLONE_REMOTE:-}"
COMPOSE="${COMPOSE:-docker compose -f docker-compose.yml -f docker-compose.prod.yml}"
SCRATCH_DB="${SCRATCH_DB:-voct_restore_test}"

SOURCE="offsite"
TS=""
while [ $# -gt 0 ]; do
  case "$1" in
    --from)      SOURCE="$2"; shift 2 ;;
    --timestamp) TS="$2"; shift 2 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

cd "$REPO_DIR"

WORK_DIR="$(mktemp -d)"
FAILURES=0

# The scratch database and directory must disappear even on failure — a
# half-restored copy of production data left lying around is its own incident.
cleanup() {
  echo
  echo "[drill] cleaning up"
  $COMPOSE exec -T db sh -c "dropdb -U \"\$POSTGRES_USER\" --if-exists $SCRATCH_DB" || true
  rm -rf "$WORK_DIR"
}
trap cleanup EXIT

note()  { echo "[drill] $*"; }
fail()  { echo "[drill] FAIL: $*" >&2; FAILURES=$((FAILURES + 1)); }

echo "[drill] $(date -Is) — restore drill (source: $SOURCE)"
note "free space on $(df -P "$BACKUP_DIR" | awk 'NR==2 {print $6}'): $(df -Ph "$BACKUP_DIR" | awk 'NR==2 {print $4}')"

# --- 1. Fetch the archives ------------------------------------------------
if [ "$SOURCE" = "offsite" ]; then
  [ -n "$RCLONE_REMOTE" ] || { echo "[drill] RCLONE_REMOTE unset — cannot drill the off-site path" >&2; exit 1; }
  if [ -z "$TS" ]; then
    # Timestamps are lexically sortable (YYYYmmdd-HHMMSS), so newest == last.
    TS="$(rclone lsf "$RCLONE_REMOTE" --include 'voct-db-*.sql.gz' \
          | sed 's/^voct-db-//; s/\.sql\.gz$//' | sort | tail -1)"
    [ -n "$TS" ] || { echo "[drill] no archives found on $RCLONE_REMOTE" >&2; exit 1; }
  fi
  note "pulling $TS from $RCLONE_REMOTE"
  rclone copy "$RCLONE_REMOTE/voct-db-$TS.sql.gz"  "$WORK_DIR" --no-traverse
  rclone copy "$RCLONE_REMOTE/voct-media-$TS.tgz"  "$WORK_DIR" --no-traverse || \
    note "WARNING: no media archive for $TS off-site"
  SRC_DIR="$WORK_DIR"
else
  if [ -z "$TS" ]; then
    TS="$(ls "$BACKUP_DIR"/voct-db-*.sql.gz 2>/dev/null \
          | sed 's#.*/voct-db-##; s/\.sql\.gz$//' | sort | tail -1)"
    [ -n "$TS" ] || { echo "[drill] no archives found in $BACKUP_DIR" >&2; exit 1; }
  fi
  SRC_DIR="$BACKUP_DIR"
fi

DB_FILE="$SRC_DIR/voct-db-$TS.sql.gz"
MEDIA_FILE="$SRC_DIR/voct-media-$TS.tgz"
note "archive age: $(( ( $(date +%s) - $(date -d "${TS:0:8} ${TS:9:2}:${TS:11:2}:${TS:13:2}" +%s) ) / 3600 )) h"

# --- 2. Archive integrity (writes nothing, so it goes first) --------------
note "verifying archive integrity"
gunzip -t "$DB_FILE" || fail "database dump is corrupt or truncated"
if [ -f "$MEDIA_FILE" ]; then
  tar tzf "$MEDIA_FILE" > /dev/null || fail "media archive is corrupt or truncated"
fi
[ "$FAILURES" -eq 0 ] || { echo "[drill] archives failed integrity checks — stopping" >&2; exit 1; }

# --- 3. Replay into a throwaway database ----------------------------------
# ON_ERROR_STOP is what makes this a real check: without it psql reports
# success after skipping every failed statement.
note "restoring into $SCRATCH_DB"
RESTORE_START=$(date +%s)
$COMPOSE exec -T db sh -c "dropdb -U \"\$POSTGRES_USER\" --if-exists $SCRATCH_DB"
$COMPOSE exec -T db sh -c "createdb -U \"\$POSTGRES_USER\" $SCRATCH_DB"
if ! gunzip -c "$DB_FILE" \
     | $COMPOSE exec -T db sh -c "psql -q -v ON_ERROR_STOP=1 -U \"\$POSTGRES_USER\" -d $SCRATCH_DB" \
     > "$WORK_DIR/restore.log" 2>&1; then
  fail "psql aborted during restore — see below"
  tail -20 "$WORK_DIR/restore.log" >&2
fi
RESTORE_SECONDS=$(( $(date +%s) - RESTORE_START ))
note "database restored in ${RESTORE_SECONDS}s"

# --- 4. Row counts, restored vs live --------------------------------------
# A dump can replay cleanly and still be empty (e.g. taken against the wrong
# database). Compare the tables whose loss would end the project.
count_rows() {  # <database> <table>
  $COMPOSE exec -T db sh -c \
    "psql -tAq -U \"\$POSTGRES_USER\" -d $1 -c \
     \"SELECT CASE WHEN to_regclass('$2') IS NULL THEN -1 ELSE (SELECT count(*) FROM $2) END\"" \
    2>/dev/null | tr -d '[:space:]'
}

echo
printf '  %-28s %10s %10s\n' 'table' 'restored' 'live'
for table in auth_user roster_artist roster_project roster_participation archive_piece; do
  restored="$(count_rows "$SCRATCH_DB" "$table")"
  live="$(count_rows "\$POSTGRES_DB" "$table")"
  printf '  %-28s %10s %10s\n' "$table" "$restored" "$live"
  [ "$restored" = "-1" ] && fail "table $table missing from the restored dump"
done
echo

# --- 5. Does the application accept this schema? --------------------------
# The check everyone skips: a dump restores perfectly and is still useless
# because it predates a migration the current code requires.
note "checking migration state against the restored database"
if $COMPOSE exec -T -e DB_NAME="$SCRATCH_DB" web python manage.py migrate --check > "$WORK_DIR/migrate.log" 2>&1; then
  note "migration state matches the deployed code"
else
  fail "restored schema does not match the deployed code (unapplied migrations)"
  tail -10 "$WORK_DIR/migrate.log" >&2
fi

# --- 6. Media -------------------------------------------------------------
# Unpacked beside the live tree, never over it.
if [ -f "$MEDIA_FILE" ]; then
  note "unpacking media to scratch"
  MEDIA_START=$(date +%s)
  mkdir -p "$WORK_DIR/media-restore"
  tar xzf "$MEDIA_FILE" -C "$WORK_DIR/media-restore"
  MEDIA_SECONDS=$(( $(date +%s) - MEDIA_START ))

  restored_files="$(find "$WORK_DIR/media-restore/media" -type f 2>/dev/null | wc -l)"
  live_files="$(find "$REPO_DIR/voct_data/media" -type f 2>/dev/null | wc -l)"
  restored_size="$(du -sh "$WORK_DIR/media-restore/media" 2>/dev/null | cut -f1)"
  live_size="$(du -sh "$REPO_DIR/voct_data/media" 2>/dev/null | cut -f1)"
  printf '  %-28s %10s %10s\n' 'media files' "$restored_files" "$live_files"
  printf '  %-28s %10s %10s\n' 'media size'  "$restored_size" "$live_size"
  note "media unpacked in ${MEDIA_SECONDS}s"
  [ "$restored_files" -eq 0 ] && fail "media archive unpacked to zero files"
else
  fail "no media archive for $TS — user uploads are NOT covered by this backup"
  MEDIA_SECONDS=0
fi

# --- 7. Verdict -----------------------------------------------------------
echo
note "measured RTO (data replay only, excludes rebuilding the stack): $(( RESTORE_SECONDS + MEDIA_SECONDS ))s"
if [ "$FAILURES" -eq 0 ]; then
  note "PASS — archive $TS is restorable"
else
  echo "[drill] $FAILURES CHECK(S) FAILED for archive $TS" >&2
  exit 1
fi
