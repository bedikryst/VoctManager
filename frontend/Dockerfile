# syntax=docker/dockerfile:1.7
# ==========================================
# VoctManager Frontend — Production Build
# Standard: Enterprise SaaS 2026
# ==========================================
# Build context is the REPO ROOT (`context: .` in docker-compose.yml) so this
# single Dockerfile can produce both frontends in one nginx image:
#   • panel SPA      → /usr/share/nginx/html/app        (served at /panel, /login, /documents)
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
FROM node:22-alpine AS panel-builder

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
ENV VITE_API_URL=$VITE_API_URL \
    VITE_GOOGLE_MAPS_FRONTEND_KEY=$VITE_GOOGLE_MAPS_FRONTEND_KEY \
    VITE_GOOGLE_MAP_ID=$VITE_GOOGLE_MAP_ID

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
FROM node:22-alpine AS web-builder

WORKDIR /app

ENV CI=true \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_AUDIT=false \
    NPM_CONFIG_UPDATE_NOTIFIER=false

# Astro's image pipeline uses Sharp, which needs libvips. The node:22-alpine
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
# Without it every prod build re-encodes ~380 image variants from ~1150 megapixels of
# camera originals — the dominant cost, since a single 2560w AVIF takes ~4s and the
# root .dockerignore's `**/node_modules` guarantees the host's warm cache never lands here.
# The cache is content-addressed (`<name>.<srcContentHash>_<transformHash>.<ext>`), so the
# fresh mtimes from `COPY web/ ./` above do NOT invalidate it — only changed image BYTES do.
# Cold builds (new host, empty cache) pay full price exactly once.
RUN --mount=type=cache,target=/app/node_modules/.astro,sharing=locked \
    npm run build


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

# Astro public site → mirrors `root /usr/share/nginx/html/marketing` in prod.conf;
# this replaces the previous host-side bind mount of `./web/dist`.
COPY --from=web-builder /app/dist /usr/share/nginx/html/marketing

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
