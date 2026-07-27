#!/usr/bin/env bash
# ==========================================================================
# infra/docker-gc.sh
# --------------------------------------------------------------------------
# Reclaims the disk a production build leaves behind on the droplet.
#
# A single `make deploy` adds roughly 4–5 GB, and almost none of it is the
# running stack:
#   • ~960 MB  BuildKit layer for `COPY web/ ./` (photo + video originals)
#   • ~1.1 GB  BuildKit layer holding the Astro `dist/` the build produced
#   • ~1.1 GB  the same dist baked into the new nginx image — which orphans
#              the previous image (dangling, but still on disk)
#   • the rest: panel SPA layers, backend layers, growing cache mounts
# Every one of those is a NEW record per build; nothing evicts the old ones.
# Left alone the droplet fills in a couple of weeks of ordinary deploys.
#
# Run by `make deploy` (before and after) and daily from cron — see
# docs/backups.md. Both entry points must stay wired: cron alone let a week of
# build cache pile up between runs, which is what made the first attempt at
# this look like it did nothing.
#
# Rollback is git-based (checkout the old commit, rebuild), so discarding old
# images costs nothing but rebuild time.
#
# DELIBERATELY ABSENT: `docker volume prune`. postgres_data is a named volume;
# with the stack down it counts as unused and a prune would destroy the
# production database. Never add it here.
# ==========================================================================
set -euo pipefail

# cron runs with a near-empty PATH (/usr/bin:/bin) and docker often lives in
# /usr/local/bin — pin the full PATH so a scheduled run resolves the same
# binaries an interactive shell does.
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:${PATH:-}"

# How much BuildKit cache to keep warm. One build's layers are ~2.5 GB, so the
# default keeps roughly the last two builds: rebuilds stay fast, growth stays
# bounded. Lower it if the droplet is tight on disk.
GC_KEEP="${GC_KEEP:-6GB}"

# Stopped containers younger than this are left alone — a container that died
# minutes ago is evidence, not garbage.
GC_CONTAINER_AGE="${GC_CONTAINER_AGE:-24h}"

DEEP=0
[ "${1:-}" = "--deep" ] && DEEP=1

log() { printf '[docker-gc] %s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"; }

log "start (keep=$GC_KEEP, deep=$DEEP)"
log "disk before:"
docker system df
df -h / | tail -n 1

# Dangling images: every rebuild untags the previous nginx/backend image and
# leaves it behind at ~1.1 GB a piece. This is the single biggest one-shot win.
log "pruning dangling images…"
docker image prune -f

log "pruning containers stopped for more than $GC_CONTAINER_AGE…"
docker container prune -f --filter "until=$GC_CONTAINER_AGE"

if [ "$DEEP" -eq 1 ]; then
  # `--all` is the only thing that also drops BuildKit CACHE MOUNTS — the npm
  # download cache and Astro's image-encode cache (node_modules/.astro), which
  # the budgeted prune below keeps warm on purpose. The next build re-encodes
  # every image variant from the originals and is correspondingly slow.
  log "deep prune: dropping ALL build cache including cache mounts…"
  docker builder prune -af
else
  # Docker 28 renamed the budget flag (`--keep-storage` → `--max-used-space`)
  # and deprecated the old one. Detect instead of guessing: a rejected flag
  # makes this exit non-zero and reclaim nothing, which is exactly how the
  # weekly cron line failed silently before.
  if docker builder prune --help 2>/dev/null | grep -q -- '--max-used-space'; then
    budget_flag="--max-used-space"
  else
    budget_flag="--keep-storage"
  fi
  log "trimming build cache to $GC_KEEP ($budget_flag)…"
  docker builder prune -f "$budget_flag" "$GC_KEEP"
fi

log "disk after:"
docker system df
df -h / | tail -n 1
log "done"
