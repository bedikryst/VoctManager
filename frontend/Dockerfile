# syntax=docker/dockerfile:1.7
# ==========================================
# VoctManager Frontend — Production Build
# ==========================================
# Build context is the REPO ROOT (`context: .` in docker-compose.yml) so this
# single Dockerfile can produce both frontends in one nginx image:
#   • panel SPA      → /usr/share/nginx/html/app        (served at /panel/*, the PWA's whole scope)
#   • Astro public  → /usr/share/nginx/html/marketing  (served at /, /koncerty, /o-nas, /kontakt, /polityka-prywatnosci)
#
# The public site needs `web/src/assets/photos/` and `web/src/assets/videos/`
# populated on the build host before `docker compose build` (both are .gitignored
# collaborator-owned originals uploaded manually). A missing photo fails fast with
# `[photos] No image "<name>"`; a missing video fails in the asset import stage.
# See web/README.md §Conventions.
# ==========================================

# ==========================================
# Stage 1: Panel SPA builder (Vite + React)
# ==========================================
FROM node:24-alpine AS panel-builder

WORKDIR /app

# Configure npm for non-interactive, low-noise CI behavior before install.
ENV CI=true \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_AUDIT=false \
    NPM_CONFIG_UPDATE_NOTIFIER=false

# Copy lockfile + manifest first to maximize Docker layer cache hits when
# only application source changes.
COPY frontend/package.json frontend/package-lock.json ./

# BuildKit cache mount — persists ~/.npm between builds. The lockfile drives
# determinism via `npm ci`; the cache only affects download speed.
RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    npm ci --prefer-offline --no-audit --no-fund

# Copy the application source after deps so source edits don't bust the deps layer.
COPY frontend/ ./

# Vite resolves these at build time and bakes them into the static bundle.
ARG VITE_API_URL
ARG VITE_GOOGLE_MAPS_FRONTEND_KEY
ARG VITE_GOOGLE_MAP_ID
ARG VITE_VAPID_PUBLIC_KEY
ARG VAPID_PUBLIC_KEY
# The last commit that touched frontend/ other than this file, stamped into the
# bundle for feedback reports. Resolved on the host (see the Makefile): `.git` is
# excluded from the build context, so vite's own `git log` cannot answer this from
# inside the image. It is part of this stage's cache key, which is why it must not
# be HEAD, and why neither it nor `COPY frontend/` (.dockerignore) sees this file.
ARG APP_BUILD_SHA
ENV VITE_API_URL=$VITE_API_URL \
    VITE_GOOGLE_MAPS_FRONTEND_KEY=$VITE_GOOGLE_MAPS_FRONTEND_KEY \
    VITE_GOOGLE_MAP_ID=$VITE_GOOGLE_MAP_ID \
    APP_BUILD_SHA=$APP_BUILD_SHA

# Production build.
#  - max-old-space-size=4096: rollup graphs for 3000+ modules with sourcemaps
#    can briefly hit 1.8–2.4 GB. The default ~1.5 GB heap is what causes the
#    "Mark-Compact … allocation failure" SIGABRT seen on cold builds.
#  - The final dist/ contains hashed, code-split chunks (see vite.config.ts).
#  - The VAPID fallback (VAPID_PUBLIC_KEY when VITE_VAPID_PUBLIC_KEY is unset)
#    is applied inline at the only point it matters — an `export` in a separate
#    RUN never survives its layer, and compose files apply the same fallback in
#    their build args anyway.
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN VITE_VAPID_PUBLIC_KEY="${VITE_VAPID_PUBLIC_KEY:-$VAPID_PUBLIC_KEY}" npm run build


# ==========================================
# Stage 2: Astro public-site builder (Astro 6 + Sharp image pipeline)
# ==========================================
FROM node:24-alpine AS web-builder

WORKDIR /app

ENV CI=true \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_AUDIT=false \
    NPM_CONFIG_UPDATE_NOTIFIER=false

# Astro's image pipeline uses Sharp, which needs libvips. The node:24-alpine
# image ships pre-built vips bindings for Sharp via npm, so no extra apk packages
# are needed in this lane; if a future Astro version drops Alpine prebuilts, add
# `RUN apk add --no-cache vips-dev build-base python3` here.

COPY web/package.json web/package-lock.json ./

RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    npm ci --prefer-offline --no-audit --no-fund

# Copy the rest of the public-site source. `web/src/assets/photos/` and
# `web/src/assets/videos/` are part of this context iff the operator placed the
# originals on the build host — they are .gitignored, so CI/build hosts must seed
# them out-of-band.
COPY web/ ./

# Astro static build → emits `dist/index.html`, `dist/koncerty.html`, etc.,
# plus content-addressed assets under `dist/_astro/`.
#
# BuildKit cache mount for Astro's asset cache (`cacheDir` default = node_modules/.astro).
# Without it every prod build re-encodes ~530 image variants, and the root .dockerignore's
# `**/node_modules` guarantees the host's warm cache never lands here to help.
# The cache is content-addressed (`<name>.<srcContentHash>_<transformHash>.<ext>`), so the
# fresh mtimes from `COPY web/ ./` above do NOT invalidate it — only changed image BYTES do,
# and only for the photograph that changed (verified: adding one file to src/assets/photos
# rebuilt 531/531 from cache).
#
# TWO THINGS MAKE THIS MOUNT LOOK BROKEN, and both have bitten:
#  • It is only ever EXERCISED on a build where a photo changed. When none did, `COPY web/ ./`
#    hits the layer cache and this whole RUN is skipped — no image lines at all. So "the cache
#    works when I change nothing" is the layer cache, not this one, and says nothing about it.
#  • Prunes evict it. A budgeted `docker builder prune` evicts by LRU across ALL records, cache
#    mounts included, which is why infra/docker-gc.sh trims by age only; BuildKit's own GC and
#    a `--deep` run drop it too. Symptom: image lines reading `(before: … after: …)` instead of
#    `(reused cache entry)`.
# Neither eviction has to cost a re-encode: the astro-cache stages below refill this mount
# from a copy on the build host before the build and add its new entries to that copy after.
# Sources are 2560px proxies (web/downscale-photos.mjs), yet a genuinely cold pass is still
# ~20 minutes on one vCPU: ~790 variants, the AVIFs at 10–20 s apiece.
#
# `dist/audio` is removed in the same step. The concert recordings are in this context only so the
# build can see which of them the host holds (a page prints its player only for an uploaded file,
# web/src/lib/audio.ts); nginx serves them from the bind mount in docker-compose.prod.yml, so a
# copy in the image would be bytes nobody can reach under the mount.
RUN --mount=type=cache,target=/app/node_modules/.astro,sharing=locked \
    npm run build && rm -rf dist/audio


# ==========================================
# The public site alone, as `make astro-stage` tags it
# ==========================================
# The production build never runs web-builder itself. `make astro-stage` builds this target on
# its own, right after refilling the encode cache, and tags it; docker-compose.prod.yml passes
# that image to the compose build as the named context `astro-dist`, which replaces this stage,
# so `runtime` copies the site that run built. Only dist travels: a tag on web-builder would keep
# its node_modules on the droplet's disk between deploys.
# Without the named context (`make up`, a bare build) this stage builds here as usual.
FROM scratch AS astro-dist
COPY --from=web-builder /app/dist /app/dist


# ==========================================
# Astro encode cache, kept on the build host
# ==========================================
# The cache mount above belongs to BuildKit, and BuildKit evicts it. Its last-used time moves
# only on a build that changed web/ — on any other build that RUN is layer-cached and never
# mounts it — so two days without a web deploy age it out of infra/docker-gc.sh's trim, and
# BuildKit's own GC drops idle cache mounts on a schedule of its own.
#
# A plain directory on the build host is out of reach of every prune, so `make astro-stage`
# keeps a copy there (ASTRO_CACHE_DIR) and passes it in as the `astro-seed` build context:
#   • astro-cache-restore, before the build: copies into the mount each entry it lacks.
#   • astro-cache-new, after the build: exports each mount entry the host copy lacks.
# Both must run on every invocation, so the Makefile passes a fresh ASTRO_CACHE_RUN. Never
# `--no-cache` or `--no-cache-filter` for this: an ignored-cache step is handed a fresh,
# throwaway cache mount, so the restore would fill nothing and the harvest would read nothing.
# With nothing to move, each takes seconds.
# Entry names are content-addressed (see web-builder), so the copy never needs invalidating:
# a changed photograph gets new names, and the entries of its old bytes are never read again.
# Only `assets/` travels — the rest of node_modules/.astro is Astro's content store, which it
# rebuilds in seconds and discards whenever the config changes.
#
# This empty stage answers for the context when a build does not pass one, so the compose
# build of `runtime`, which never reaches the stages below, resolves the name locally.
FROM scratch AS astro-seed

FROM node:24-alpine AS astro-cache-restore
ARG ASTRO_CACHE_RUN
RUN --mount=type=cache,target=/app/node_modules/.astro,sharing=locked \
    --mount=type=bind,from=astro-seed,target=/seed,rw \
    cache=/app/node_modules/.astro/assets; mkdir -p "$cache"; n=0; \
    for f in /seed/*; do \
      if [ -f "$f" ] && [ ! -e "$cache/${f##*/}" ]; then cp -p "$f" "$cache/" && n=$((n + 1)); fi; \
    done; \
    echo "[astro-cache] run $ASTRO_CACHE_RUN: restored $n entries from the build host into the cache mount"

FROM node:24-alpine AS astro-cache-harvest
ARG ASTRO_CACHE_RUN
RUN --mount=type=cache,target=/app/node_modules/.astro,sharing=locked \
    --mount=type=bind,from=astro-seed,target=/seed,rw \
    mkdir -p /out; n=0; \
    for f in /app/node_modules/.astro/assets/*; do \
      if [ -f "$f" ] && [ ! -e "/seed/${f##*/}" ]; then cp -p "$f" /out/ && n=$((n + 1)); fi; \
    done; \
    echo "[astro-cache] run $ASTRO_CACHE_RUN: $n new entries for the build host's copy"

FROM scratch AS astro-cache-new
COPY --from=astro-cache-harvest /out/ /


# ==========================================
# Stage 3: Production Server (Nginx) — serves BOTH builds
# ==========================================
FROM nginx:1.27-alpine AS runtime

LABEL org.opencontainers.image.title="voctmanager-frontend" \
      org.opencontainers.image.description="VoctManager SaaS — panel SPA + Astro public site, served by Nginx." \
      org.opencontainers.image.source="https://github.com/bedikryst/VoctManager" \
      org.opencontainers.image.licenses="Proprietary"

# Panel SPA → mirrors `root /usr/share/nginx/html/app` in infra/nginx/prod.conf
COPY --from=panel-builder /app/dist /usr/share/nginx/html/app

# Astro public site → mirrors `root /usr/share/nginx/html/marketing` in prod.conf.
# Under `make prod` / `make deploy` astro-dist is the image `make astro-stage` tagged.
COPY --from=astro-dist /app/dist /usr/share/nginx/html/marketing

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
