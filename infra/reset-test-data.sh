#!/usr/bin/env bash
# ==========================================================================
# infra/reset-test-data.sh
# --------------------------------------------------------------------------
# Empties operational data before a public test round, DESTRUCTIVELY. Wraps
# `manage.py reset_test_data` in the steps that command cannot do for itself:
# take a backup, stop the writer that would race it, and clear the broker
# afterwards.
#
# What survives: donations and patron leads (financial + consent records with
# no second copy), the knowledge base and its files, and the superuser accounts
# that keep the panel reachable. Everything else — roster, archive, rehearsals,
# messages, notifications, locations, sessions — is emptied. The table list and
# its safety interlocks live in the management command, not here.
#
# Why celery stops for the duration: the wipe is one transaction, but a worker
# running through it would insert fresh rows into tables that were just emptied
# — reminders and digests fire on a beat schedule. It is restarted on the way
# out even if the wipe fails.
#
# Why the broker is flushed: queued tasks carry primary keys of rows that no
# longer exist, so every one of them would fail on pickup. FLUSHALL also drops
# the result backend and the Django cache, both of which are rebuildable.
#
# Confirmation is taken UP FRONT, before anything is touched, so there is no
# half-applied state to reason about if you change your mind.
#
#   bash infra/reset-test-data.sh                 # backup, confirm, wipe
#   bash infra/reset-test-data.sh --dry-run       # report only, touches nothing
#   bash infra/reset-test-data.sh --yes           # no prompt (scripted runs)
#   bash infra/reset-test-data.sh --skip-backup   # repeat resets in one session
# ==========================================================================
set -euo pipefail

export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:${PATH:-}"

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Pinned to the prod compose pair for the same reason backup.sh pins it: the
# dev override must never be merged in by accident on the droplet.
COMPOSE="${COMPOSE:-docker compose -f docker-compose.yml -f docker-compose.prod.yml}"

DRY_RUN=0
ASSUME_YES=0
SKIP_BACKUP=0

while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run)     DRY_RUN=1 ;;
    --yes|-y)      ASSUME_YES=1 ;;
    --skip-backup) SKIP_BACKUP=1 ;;
    *)
      echo "[reset] unknown option: $1" >&2
      echo "Usage: bash infra/reset-test-data.sh [--dry-run] [--yes] [--skip-backup]" >&2
      exit 2
      ;;
  esac
  shift
done

cd "$REPO_DIR"

# --- Celery restart guarantee ---------------------------------------------
# Flag-guarded so the ERR and EXIT traps cannot double-start, and so a failure
# before the stop never tries to start something this script did not stop.
CELERY_STOPPED=0
restore_celery() {
  if [ "$CELERY_STOPPED" = "1" ]; then
    echo "[reset] restarting celery"
    $COMPOSE start celery || echo "[reset] WARNING: celery did not restart — start it by hand" >&2
    CELERY_STOPPED=0
  fi
}
on_error() {
  local rc=$?
  echo "[reset] FAILED (exit $rc) — see output above" >&2
  restore_celery
  exit "$rc"
}
trap on_error ERR
trap restore_celery EXIT

# --- Dry run: report and leave ---------------------------------------------
# No backup, no stopped worker — the command only reads in this mode.
if [ "$DRY_RUN" = "1" ]; then
  echo "[reset] dry run — nothing will be changed"
  $COMPOSE exec -T web python manage.py reset_test_data --dry-run
  exit 0
fi

# --- Confirmation ----------------------------------------------------------
echo "[reset] $(date -Is)"
echo "[reset] this EMPTIES the production database except payments, documents"
echo "[reset]   and superuser accounts, and deletes uploaded scores and audio."
if [ "$ASSUME_YES" != "1" ]; then
  # </dev/tty so the prompt still works when the script is piped or run
  # from a Makefile recipe that redirects stdin.
  printf "[reset] type 'wipe' to proceed: "
  read -r answer </dev/tty
  if [ "$answer" != "wipe" ]; then
    echo "[reset] aborted — nothing was changed"
    exit 0
  fi
fi

# --- 1. Backup -------------------------------------------------------------
# The only way back if the wrong thing turns out to have been in the wipe list.
if [ "$SKIP_BACKUP" = "1" ]; then
  echo "[reset] WARNING: --skip-backup — no fresh restore point for this wipe" >&2
else
  echo "[reset] backup first"
  bash "$REPO_DIR/infra/backup.sh"
fi

# --- 2. Stop the writer ----------------------------------------------------
echo "[reset] stopping celery"
$COMPOSE stop celery
CELERY_STOPPED=1

# --- 3. Wipe ---------------------------------------------------------------
# --noinput because this script already took the confirmation; the command's
# own interlocks (protected tables, foreign-key closure) still run and still
# abort the whole thing if the table list is not what it should be.
echo "[reset] wiping"
$COMPOSE exec -T web python manage.py reset_test_data --noinput

# --- 4. Clear the broker ---------------------------------------------------
echo "[reset] flushing redis"
$COMPOSE exec -T redis redis-cli FLUSHALL

# --- 5. Back up and verify -------------------------------------------------
restore_celery
echo "[reset] verifying schema"
$COMPOSE exec -T web python manage.py migrate --check

echo "[reset] done — the panel is ready for a fresh test round"
