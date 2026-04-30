# syntax=docker/dockerfile:1.7
# ==========================================
# VoctManager Frontend — Production Build
# Standard: Enterprise SaaS 2026
# ==========================================

# ==========================================
# Stage 1: Build Environment (Node.js 22 LTS)
# ==========================================
FROM node:22-alpine AS builder

WORKDIR /app

# Configure npm for non-interactive, low-noise CI behavior before install.
ENV CI=true \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_AUDIT=false \
    NPM_CONFIG_UPDATE_NOTIFIER=false

# Copy lockfile + manifest first to maximize Docker layer cache hits when
# only application source changes.
COPY package.json package-lock.json ./

# BuildKit cache mount — persists ~/.npm between builds. The lockfile drives
# determinism via `npm ci`; the cache only affects download speed.
RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    npm ci --prefer-offline --no-audit --no-fund

# Copy the application source after deps so source edits don't bust the deps layer.
COPY . .

# Vite resolves these at build time and bakes them into the static bundle.
ARG VITE_API_URL
ARG VITE_GOOGLE_MAPS_FRONTEND_KEY
ARG VITE_GOOGLE_MAP_ID
ARG VITE_VAPID_PUBLIC_KEY
ENV VITE_API_URL=$VITE_API_URL \
    VITE_GOOGLE_MAPS_FRONTEND_KEY=$VITE_GOOGLE_MAPS_FRONTEND_KEY \
    VITE_GOOGLE_MAP_ID=$VITE_GOOGLE_MAP_ID \
    VITE_VAPID_PUBLIC_KEY=$VITE_VAPID_PUBLIC_KEY

# Production build.
#  - max-old-space-size=4096: rollup graphs for 3000+ modules with sourcemaps
#    can briefly hit 1.8–2.4 GB. The default ~1.5 GB heap is what causes the
#    "Mark-Compact … allocation failure" SIGABRT seen on cold builds.
#  - The final dist/ contains hashed, code-split chunks (see vite.config.ts).
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN npm run build


# ==========================================
# Stage 2: Production Server (Nginx)
# ==========================================
FROM nginx:1.27-alpine AS runtime

LABEL org.opencontainers.image.title="voctmanager-frontend" \
      org.opencontainers.image.description="VoctManager SaaS — production frontend bundle served by Nginx." \
      org.opencontainers.image.source="https://github.com/bedikryst/VoctManager" \
      org.opencontainers.image.licenses="Proprietary"

# Copy the compiled static assets. Target path mirrors the `root` in prod.conf.
COPY --from=builder /app/dist /usr/share/nginx/html/app

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
