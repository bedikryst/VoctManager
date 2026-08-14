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

# Root filesystem usage (percent) at which age-based trimming is no longer
# enough and a budgeted prune runs anyway. Below it, disk is not the emergency
# and a warm image-encode cache is worth more than the gigabytes it occupies.
GC_DISK_PCT="${GC_DISK_PCT:-80}"

# Budget for the pressure path only — NOT the ordinary trim. One build's layers
# are ~2.5 GB, so this keeps roughly the last two. Raise it if the droplet has
# the disk: the higher it is, the less a pressure trim costs the next build.
GC_KEEP="${GC_KEEP:-6GB}"

# Stopped containers younger than this are left alone — a container that died
# minutes ago is evidence, not garbage.
GC_CONTAINER_AGE="${GC_CONTAINER_AGE:-24h}"

# Modes, and they are mutually exclusive in effect:
#   (default)            trim BuildKit by AGE, budget only under disk pressure
#   --deep               drop ALL build cache including cache mounts
#   --keep-build-cache   reclaim images/containers only, never touch build cache
#
# --keep-build-cache exists for the run that BRACKETS a build from the front
# (Makefile `deploy`). Pruning there deleted the very records the build was
# about to ask for: the backend's `pip wheel` layer re-downloaded every package
# on every deploy, and a budgeted prune evicts by LRU, so the layers that never
# change — exactly the ones worth keeping — were the first to go. Reclaiming
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

log "start (max_age=$GC_MAX_AGE, disk_pct=$GC_DISK_PCT, keep=$GC_KEEP, deep=$DEEP, keep_build_cache=$KEEP_BUILD_CACHE)"
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
  # cache and Astro's image-encode cache (node_modules/.astro). The ordinary
  # mode below never reaches them, and its pressure path only might; this
  # reaches them always. The next build then re-encodes every image variant:
  # 522 of them, ~30s apiece for a 2560px AVIF on one vCPU. Reach for it only
  # when disk is the emergency and the age trim has already been tried.
  log "deep prune: dropping ALL build cache including cache mounts…"
  docker builder prune -af
else
  # Ordinary trim: evict by AGE, and fall back to a budget only when the disk
  # actually demands it.
  #
  # A budgeted prune has no concept of "a build". It holds a flat list of records
  # and deletes from the least-recently-used end until the total is under the
  # number — so it can cut through the build that just finished, and BuildKit
  # cache MOUNTS are ordinary removable records in that list. Losing the Astro
  # image-encode mount (frontend/Dockerfile, web-builder) costs the next build a
  # full re-encode of ~530 variants: half an hour on this one vCPU, every deploy,
  # because the prune that runs at the end of `make deploy` destroys the cache the
  # next `make deploy` needs. That self-defeating loop is why age comes first.
  #
  # `until` filters on last use, so a record the latest build touched is never
  # eligible. Growth stays bounded because records from builds older than
  # GC_MAX_AGE do age out; a burst of deploys inside that window is exactly what
  # the pressure path below is for.
  log "trimming build cache unused for more than $GC_MAX_AGE…"
  docker builder prune -f --filter "until=$GC_MAX_AGE" || true

  # `df -P` pins the POSIX single-line-per-filesystem format, but the capacity
  # column still cannot be addressed positionally: a device name containing a
  # space shifts every field after it. Scan for the field that ENDS in `%`
  # instead. An unparseable result falls through to 0, i.e. "no pressure" — the
  # safe default here is leaving the cache warm, not pruning on a bad reading.
  disk_pct="$(df -P / | awk 'NR==2 { for (i = 1; i <= NF; i++) if ($i ~ /%$/) { gsub(/%/, "", $i); print $i; exit } }')"
  if [ "${disk_pct:-0}" -lt "$GC_DISK_PCT" ]; then
    log "/ at ${disk_pct}% (under ${GC_DISK_PCT}%) — build cache left warm, no budgeted prune."
  else
    log "WARNING: / at ${disk_pct}% (threshold ${GC_DISK_PCT}%) — falling back to a budgeted prune."
    log "WARNING: this can evict the Astro image-encode cache mount. Expect the next"
    log "WARNING: build that touches web/ to re-encode every variant (~30 min)."
    log "WARNING: raise GC_KEEP, or free disk outside Docker, to stop this recurring."

    # Docker 28 replaced `--keep-storage` with `--reserved-space`, and the two are
    # NOT equivalent: reserved-space is "never prune below N", not "prune down to
    # N". A cron line carrying the old flag is silently accepted, warns about the
    # rename, and reclaims exactly 0 B — which is how ~14 GB of build cache
    # accumulated unnoticed. `--max-used-space` is the flag with the intended
    # "trim to a budget" meaning, so prefer it and detect rather than assume.
    if docker builder prune --help 2>/dev/null | grep -q -- '--max-used-space'; then
      budget_flag="--max-used-space"
    else
      budget_flag="--keep-storage"
    fi
    log "trimming build cache to $GC_KEEP ($budget_flag)…"
    prune_out="$(docker builder prune -f "$budget_flag" "$GC_KEEP" 2>&1)" || true
    printf '%s\n' "$prune_out"

    # A prune that reclaims nothing while the cache is still over budget means the
    # flag was accepted but did not do what it says. Never let that pass quietly
    # again — an unread warning in prune.log is what this whole script exists for.
    if printf '%s' "$prune_out" | grep -qi 'reclaimed space: *0B'; then
      if printf '%s' "$prune_out" | grep -qi 'deprecated'; then
        log "WARNING: reclaimed 0 B and Docker reported a deprecated flag."
        log "WARNING: this docker build cache is NOT being trimmed — check the flag"
        log "WARNING: names in \`docker builder prune --help\` and fix this script."
      else
        log "note: reclaimed 0 B (cache already at or below $GC_KEEP)."
      fi
    fi
  fi
fi

log "disk after:"
docker system df
df -h / | tail -n 1
log "done"
