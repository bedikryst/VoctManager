#!/usr/bin/env bash
# ==========================================================================
# infra/docker-gc.sh
# --------------------------------------------------------------------------
# Reclaims the disk a production build leaves behind on the droplet.
#
# A single `make deploy` adds a few GB, and almost none of it is the running
# stack:
#   • ~525 MB  BuildKit layer for `COPY web/ ./` (photo proxies + video originals)
#   • ~465 MB  BuildKit layer holding the Astro `dist/` the build produced
#   • ~465 MB  the same dist baked into the new nginx image — which orphans
#              the previous image (dangling, but still on disk)
#   • the rest: panel SPA layers, backend layers, growing cache mounts
# Every one of those is a NEW record per build; nothing evicts the old ones.
# Left alone the droplet fills in a couple of weeks of ordinary deploys.
#
# Those three used to be ~960 MB / ~1.1 GB / ~1.1 GB, before 2560px proxies
# replaced the camera originals (web/downscale-photos.mjs). What remains is
# now almost entirely VIDEO — 427 of the 465 MB of dist is three MP4s — so the
# next real cut is the AV1 work, not anything on the photograph side.
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

# Age threshold for the ordinary build-cache trim. `until` filters on LAST USE,
# so nothing the most recent build touched is ever in range — which is the whole
# point of preferring it to a budget (see the default branch below).
GC_MAX_AGE="${GC_MAX_AGE:-168h}"

# Root filesystem usage (percent) at which the run prints a disk-pressure
# warning into prune.log. It prunes nothing extra at that point — see the
# default branch below for why there is no budgeted prune to fall back to.
GC_DISK_PCT="${GC_DISK_PCT:-80}"

# Stopped containers younger than this are left alone — a container that died
# minutes ago is evidence, not garbage.
GC_CONTAINER_AGE="${GC_CONTAINER_AGE:-24h}"

# Modes, and they are mutually exclusive in effect:
#   (default)            trim BuildKit by AGE, warn under disk pressure
#   --deep               drop ALL build cache including cache mounts
#   --keep-build-cache   reclaim images/containers only, never touch build cache
#
# --keep-build-cache exists for the run that BRACKETS a build from the front
# (Makefile `deploy`). Pruning there deleted the very records the build was
# about to ask for: the backend's `pip wheel` layer re-downloaded every package
# on every deploy. Reclaiming
# dangling IMAGES is what buys the headroom that call is there for, and this
# script already calls that the single biggest one-shot win.
DEEP=0
KEEP_BUILD_CACHE=0
for arg in "$@"; do
  case "$arg" in
    --deep) DEEP=1 ;;
    --keep-build-cache) KEEP_BUILD_CACHE=1 ;;
    "") ;;
    *)
      printf '[docker-gc] unknown argument: %s\n' "$arg" >&2
      exit 2
      ;;
  esac
done

log() { printf '[docker-gc] %s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"; }

log "start (max_age=$GC_MAX_AGE, disk_pct=$GC_DISK_PCT, deep=$DEEP, keep_build_cache=$KEEP_BUILD_CACHE)"
log "disk before:"
docker system df
df -h / | tail -n 1

# Dangling images: every rebuild untags the previous nginx/backend image and
# leaves it behind at ~1.1 GB a piece. This is the single biggest one-shot win.
log "pruning dangling images…"
docker image prune -f

log "pruning containers stopped for more than $GC_CONTAINER_AGE…"
docker container prune -f --filter "until=$GC_CONTAINER_AGE"

if [ "$KEEP_BUILD_CACHE" -eq 1 ]; then
  log "build cache left untouched (--keep-build-cache)"
elif [ "$DEEP" -eq 1 ]; then
  # `--all` drops BuildKit CACHE MOUNTS unconditionally — the npm download
  # cache and Astro's image-encode cache (node_modules/.astro). The next build
  # re-downloads npm packages; the Astro mount is refilled by `make astro-stage`
  # from the build host's copy (ASTRO_CACHE_DIR), which no prune here touches.
  # Reach for it only when disk is the emergency and the age trim has already
  # been tried.
  log "deep prune: dropping ALL build cache including cache mounts…"
  docker builder prune -af
else
  # Ordinary trim: evict by AGE, and by nothing else. `until` filters on last
  # use, so a record the latest build touched is never eligible, and growth stays
  # bounded because records from builds older than GC_MAX_AGE do age out.
  #
  # There is deliberately NO budgeted prune (`--max-used-space`), not even under
  # disk pressure. A budget evicts from the least-recently-used end of a flat list
  # of records, cache mounts included, until the total is under the number — and
  # on this droplet's engine (containerd image store) `docker buildx du` reports a
  # total no build or prune ever changes: 19.74 GB, 0 B reclaimable, the same 128
  # records in every reading. No budget below that is ever met, so the prune runs
  # to the bottom of the list every time. It ran at the end of two deploys,
  # reclaimed 0 B both times, and each following build found none of the records
  # that back an image (the Astro site, the backend's runtime stage) — pruning a
  # record whose layers an image holds frees nothing and drops only the cache
  # metadata. A plain rebuild right after a build, and one after
  # `docker image prune`, were fully cached. Disk is reclaimed by the
  # dangling-image prune above; past that, the space is outside Docker, or the
  # emergency is `make gc DEEP=--deep` by hand.
  #
  # The Astro image-encode mount is the exception age cannot protect: a build
  # that leaves web/ alone never mounts it, so a week without a web deploy ages
  # it out here. `make astro-stage` refills it from the build host's copy
  # (ASTRO_CACHE_DIR), which is why losing it costs seconds, not a re-encode.
  log "trimming build cache unused for more than $GC_MAX_AGE…"
  docker builder prune -f --filter "until=$GC_MAX_AGE" || true

  # `df -P` pins the POSIX single-line-per-filesystem format, but the capacity
  # column still cannot be addressed positionally: a device name containing a
  # space shifts every field after it. Scan for the field that ENDS in `%`
  # instead. An unparseable result falls through to 0, i.e. "no warning".
  disk_pct="$(df -P / | awk 'NR==2 { for (i = 1; i <= NF; i++) if ($i ~ /%$/) { gsub(/%/, "", $i); print $i; exit } }')"
  if [ "${disk_pct:-0}" -ge "$GC_DISK_PCT" ]; then
    log "WARNING: / at ${disk_pct}% (threshold ${GC_DISK_PCT}%). Build cache is not trimmed"
    log "WARNING: to a budget (see this script). Free disk outside Docker first — the"
    log "WARNING: journal (\`journalctl --disk-usage\`), ~/voct-backups — or, as the"
    log "WARNING: emergency, \`make gc DEEP=--deep\`."
  fi
fi

log "disk after:"
docker system df
df -h / | tail -n 1
log "done"
