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
# Run by `make deploy` (before and after the build) and daily from cron — see
# docs/backups.md. Only the call after a deploy's build trims BUILD CACHE
# (`--trim-build-cache`); cron and the call before the build reclaim images and
# containers. Build-cache garbage is made only by builds, so only a build ages
# it out: a wall-clock trim from cron would expire a cache that is still exact
# after any quiet spell without a deploy, and the next deploy would rebuild it all.
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

# Age threshold for --trim-build-cache. `until` filters on LAST USE, so nothing
# the build that just finished touched is ever in range — which is the whole
# point of preferring it to a budget (see the trim branch below).
#
# Two days, not a week: deploys come in bursts, several a day, each superseding
# a couple of GB of records, and a week's window kept every burst's garbage on a
# 49 GB disk for a week. The cost is bounded: a stage whose inputs stay unchanged
# through two days of other deploys may lose its intermediate records (`npm ci`,
# `apt`, `pip install`) and re-run them the next time those inputs change —
# minutes, once. The Astro encode cache comes back from ASTRO_CACHE_DIR in seconds.
GC_MAX_AGE="${GC_MAX_AGE:-48h}"

# Root filesystem usage (percent) at which every run prints a disk-pressure
# warning into prune.log. It prunes nothing extra at that point — see the trim
# branch below for why there is no budgeted prune to fall back to.
GC_DISK_PCT="${GC_DISK_PCT:-80}"

# Stopped containers younger than this are left alone — a container that died
# minutes ago is evidence, not garbage.
GC_CONTAINER_AGE="${GC_CONTAINER_AGE:-24h}"

# Modes, and they are mutually exclusive in effect:
#   (default)            reclaim images/containers only, never touch build cache
#   --trim-build-cache   also trim BuildKit by AGE (the run after a deploy's build)
#   --deep               drop ALL build cache including cache mounts
#
# The default leaves build cache alone because two of the three callers must:
# cron, for the reason in the header, and the run that brackets a build from the
# front (Makefile `deploy`) — pruning there deleted the very records the build
# was about to ask for, and the backend's `pip wheel` layer re-downloaded every
# package on every deploy. Reclaiming dangling IMAGES is what buys the headroom
# both are there for, and this script calls that the single biggest win.
DEEP=0
TRIM_BUILD_CACHE=0
for arg in "$@"; do
  case "$arg" in
    --deep) DEEP=1 ;;
    --trim-build-cache) TRIM_BUILD_CACHE=1 ;;
    "") ;;
    *)
      printf '[docker-gc] unknown argument: %s\n' "$arg" >&2
      exit 2
      ;;
  esac
done

log() { printf '[docker-gc] %s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"; }

log "start (max_age=$GC_MAX_AGE, disk_pct=$GC_DISK_PCT, deep=$DEEP, trim_build_cache=$TRIM_BUILD_CACHE)"
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
  # `--all` drops BuildKit CACHE MOUNTS unconditionally — the npm download
  # cache and Astro's image-encode cache (node_modules/.astro). The next build
  # re-downloads npm packages; the Astro mount is refilled by `make astro-stage`
  # from the build host's copy (ASTRO_CACHE_DIR), which no prune here touches.
  # Reach for it only when disk is the emergency and the age trim has already
  # been tried.
  log "deep prune: dropping ALL build cache including cache mounts…"
  docker builder prune -af
elif [ "$TRIM_BUILD_CACHE" -eq 1 ]; then
  # Trim by AGE, and by nothing else. `until` filters on last use, so a record the
  # build that just finished touched is never eligible, and growth stays bounded
  # because the records of superseded builds age out at later deploys.
  #
  # There is deliberately NO budgeted prune (`--max-used-space`), not even under
  # disk pressure. A budget evicts from the least-recently-used end of a flat list
  # of records, cache mounts included, until the total is under the number — and
  # on this droplet's engine (containerd image store) `docker buildx du` can show
  # nearly all of the cache as not reclaimable for weeks, the daemon holding
  # references until it restarts (docs/backups.md). Then no budget is ever met and
  # the prune runs to the bottom of the list every time. It ran at the end of two
  # deploys in that state, reclaimed 0 B both times,
  # and each following build found none of the records that back an image (the
  # Astro site, the backend's runtime stage): pruning such a record frees nothing,
  # as the image holds its layers, and drops only the cache metadata.
  # Back-to-back rebuilds, one after `docker image prune`, were fully cached.
  # Disk is reclaimed by the dangling-image prune above; past that, the space is
  # outside Docker, or the emergency is `make gc DEEP=--deep` by hand.
  #
  # The Astro image-encode mount is the exception age cannot protect: a build
  # that leaves web/ alone never mounts it, so GC_MAX_AGE without a web deploy ages
  # it out here. `make astro-stage` refills it from the build host's copy
  # (ASTRO_CACHE_DIR), which is why losing it costs seconds, not a re-encode.
  log "trimming build cache unused for more than $GC_MAX_AGE…"
  docker builder prune -f --filter "until=$GC_MAX_AGE" || true
else
  log "build cache left untouched (only --trim-build-cache, after a build, ages it out)"
fi

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

log "disk after:"
docker system df
df -h / | tail -n 1
log "done"
