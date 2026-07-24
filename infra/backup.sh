#!/usr/bin/env bash
# ==========================================================================
# infra/backup.sh
# --------------------------------------------------------------------------
# On-droplet backup for VoctManager: a gzipped PostgreSQL dump + a tar of the
# user-uploaded media tree, written OUTSIDE the repo checkout with day-based
# rotation, then mirrored OFF-SITE to the foundation's Google Shared Drive.
#
# Two independent guarantees:
#   • Local copy in $BACKUP_DIR — protects against human error, a bad deploy,
#     and `git clean -fdx` (which would wipe the gitignored voct_data/).
#   • Off-site copy on Google Drive (rclone) — the ONLY thing that survives
#     loss of the droplet/disk itself. Kept in the foundation's own Workspace
#     tenant so no new RODO sub-processor is introduced.
#
# Failure is never silent: every run pings a healthcheck monitor (start /
# success / fail). A missing success ping is what raises the alarm — the exact
# gap that went unnoticed for a month before this was hardened.
#
# Setup, cron install and the restore drill live in docs/backups.md.
# Secrets (healthcheck URL, rclone remote) come from infra/backup.env
# (gitignored — copy infra/backup.env.example on the droplet).
# ==========================================================================
set -euo pipefail

# cron runs with a near-empty PATH (/usr/bin:/bin); docker and rclone commonly
# live in /usr/local/bin. Pin a full PATH so a scheduled run resolves the same
# binaries an interactive shell does — the classic "works by hand, dies under
# cron" trap that leaves you with no backups and no error.
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:${PATH:-}"

# --- Config (override via environment or infra/backup.env) ----------------
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Load operator secrets/overrides if present. `set -a` exports every assignment
# so child processes inherit them — notably rclone, which reads RCLONE_CONFIG
# straight from the environment.
BACKUP_ENV="${BACKUP_ENV:-$REPO_DIR/infra/backup.env}"
if [ -f "$BACKUP_ENV" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$BACKUP_ENV"
  set +a
fi

BACKUP_DIR="${BACKUP_DIR:-$HOME/voct-backups}"    # kept outside the repo on purpose
KEEP_DAYS="${KEEP_DAYS:-14}"                       # rotation window (local + remote)
RCLONE_REMOTE="${RCLONE_REMOTE:-}"                # e.g. voct-drive:backups (empty = off-site skipped)
HEALTHCHECK_URL="${HEALTHCHECK_URL:-}"            # e.g. https://hc-ping.com/<uuid> (empty = no pings)
# Pin the prod compose files so the dev override is never merged in by accident.
COMPOSE="${COMPOSE:-docker compose -f docker-compose.yml -f docker-compose.prod.yml}"

TS="$(date +%Y%m%d-%H%M%S)"

# --- Health monitor -------------------------------------------------------
# Best-effort ping; never allowed to abort the backup. Suffix selects the
# signal: "/start" on entry, "" on success, "/fail" from the error trap.
ping_health() {
  [ -n "$HEALTHCHECK_URL" ] || return 0
  curl -fsS -m 10 --retry 3 -o /dev/null "${HEALTHCHECK_URL}${1:-}" || true
}

# Any unhandled failure (set -e) alerts and preserves whatever local archives
# already landed — a failed off-site step must never delete the local copy.
on_error() {
  local rc=$?
  echo "[backup] FAILED (exit $rc) — see output above" >&2
  ping_health /fail
  exit "$rc"
}
trap on_error ERR

mkdir -p "$BACKUP_DIR"
cd "$REPO_DIR"

echo "[backup] $(date -Is) → $BACKUP_DIR"
ping_health /start

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
  MEDIA_FILE=""
fi

# --- 3. Off-site (Google Shared Drive via rclone) --------------------------
# The only copy that survives losing the droplet. rclone auth + the target
# remote are configured out-of-band (service account + Shared Drive) — see
# docs/backups.md. A failure here trips the error trap on purpose: silently
# dropping to local-only is exactly the state we are engineering against.
if [ -n "$RCLONE_REMOTE" ]; then
  echo "[backup] off-site → $RCLONE_REMOTE"
  rclone copy "$DB_FILE" "$RCLONE_REMOTE" --no-traverse
  [ -n "$MEDIA_FILE" ] && rclone copy "$MEDIA_FILE" "$RCLONE_REMOTE" --no-traverse
else
  echo "[backup] WARNING: RCLONE_REMOTE unset — OFF-SITE COPY SKIPPED (local only)" >&2
fi

# --- 4. Rotation (local + remote, same window) -----------------------------
echo "[backup] pruning archives older than ${KEEP_DAYS} days"
find "$BACKUP_DIR" -maxdepth 1 -name 'voct-db-*.sql.gz' -mtime +"$KEEP_DAYS" -delete
find "$BACKUP_DIR" -maxdepth 1 -name 'voct-media-*.tgz' -mtime +"$KEEP_DAYS" -delete
if [ -n "$RCLONE_REMOTE" ]; then
  # --include scopes the delete to OUR archives only — it never touches
  # anything else that may live in the Shared Drive. Non-fatal: rotation
  # trouble must not fail a run whose backup already succeeded and uploaded.
  rclone delete "$RCLONE_REMOTE" --min-age "${KEEP_DAYS}d" \
    --include 'voct-db-*.sql.gz' --include 'voct-media-*.tgz' || true
fi

echo "[backup] done. Current local archives:"
ls -lh "$BACKUP_DIR" | tail -n +2 || true
ping_health

# ==========================================================================
# RESTORING
# --------------------------------------------------------------------------
#   Routine verification:  bash infra/restore-drill.sh
#     Non-destructive — replays into a throwaway database and a scratch media
#     directory, checks integrity, row counts and migration state.
#
#   Actual disaster recovery: docs/backups.md §"Real restore".
#     Deliberately not inlined here. These dumps carry --clean --if-exists, so
#     a replay DROPs every object before writing: the procedure needs an
#     integrity check, a safety dump and stopped writers around it, and that
#     belongs in the runbook where it can be read in full under pressure.
# ==========================================================================
