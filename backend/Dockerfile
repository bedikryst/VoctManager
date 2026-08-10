# syntax=docker/dockerfile:1.7
# ==========================================
# Multi-Stage Dockerfile
# ==========================================
# The `syntax` line above is load-bearing and must stay the FIRST line of the
# file — parser directives are only read before any other comment or
# instruction, and without it the `RUN --mount=type=cache` below is a syntax
# error rather than a cache mount.

# ------------------------------------------
# Stage 1: Builder
# Compiles dependencies to generate Python wheels.
# ------------------------------------------
FROM python:3.12-slim AS builder

WORKDIR /app

# Install system dependencies strictly required for C-extension compilation.
#
# OPEN QUESTION, worth settling before touching this stage again: nothing in
# requirements.txt obviously needs to compile. `psycopg[binary]` exists
# precisely to avoid libpq-dev and a compiler, pypdfium2 bundles its own
# native engine, and Pillow / grpcio / uvloop all publish cp312 manylinux
# wheels. If that holds, this apt layer and the whole builder stage are
# ceremony, and the runtime could install straight from PyPI.
#
# It is one command to find out — anything that really compiles prints
# "Building wheel for <pkg>", while a prebuilt one prints "Saved":
#   docker build --target builder --progress=plain backend/ 2>&1 | grep -i "building wheel for"
# Silence means the stage can be collapsed. Do NOT delete it on the strength
# of the reasoning above alone: the failure lands mid-deploy, on the droplet.
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

# Build Python wheels (INCLUDING transitive dependencies) so the runtime stage
# installs fully offline and never needs gcc. `--no-deps` here would silently
# push transitive resolution into the runtime stage's network install.
#
# NO `--no-cache-dir` here, deliberately — that flag earns its keep only in a
# stage that SHIPS, by keeping pip's cache out of the image. This stage is
# discarded; nothing leaves it but /usr/src/app/wheels. All the flag did was
# guarantee a full re-download from PyPI (~120s) whenever this layer missed,
# which `make deploy` used to cause on every single run by pruning the build
# cache immediately beforehand. The cache mount survives a layer miss, so a
# rebuild now re-uses the downloaded wheels instead of fetching them again.
# `sharing=locked` because `web` and `celery` build this identical Dockerfile
# as two services and pip's cache is not safe under concurrent writers.
#
# The runtime stage keeps its own --no-cache-dir. That one is correct: its
# layer is in the shipped image.
RUN --mount=type=cache,target=/root/.cache/pip,sharing=locked \
    pip wheel --wheel-dir /usr/src/app/wheels -r requirements.txt


# ------------------------------------------
# Stage 2: Runtime
# Lightweight production image running as a restricted non-root user.
# ------------------------------------------
FROM python:3.12-slim

# Python & System environment configurations
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    XDG_CACHE_HOME=/tmp/.cache

# Provision a non-root system user for enhanced container security
RUN addgroup --system voctgroup && adduser --system --ingroup voctgroup voctuser

WORKDIR /app

# Install strictly required runtime system libraries (WeasyPrint & DB drivers).
# fonts-dejavu-core is the glyph fallback for WeasyPrint: the slim base ships
# ZERO fonts, so anything outside the bundled Gentium Plus @font-face set
# (see roster/infrastructure/print_fonts.py) would render as tofu without it.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpango-1.0-0 \
    libpangoft2-1.0-0 \
    libmagic1 \
    libharfbuzz0b \
    fontconfig \
    fonts-dejavu-core \
    libpq5 \
    dos2unix \
    gosu \
    gettext \
    && rm -rf /var/lib/apt/lists/*

# Inject pre-compiled wheels from the builder stage and install strictly
# offline — every dependency (transitive included) must come from /wheels.
COPY --from=builder /usr/src/app/wheels /wheels
RUN pip install --no-cache-dir --no-index --find-links=/wheels /wheels/* && rm -rf /wheels

# Copy application source code and explicitly transfer ownership
COPY --chown=voctuser:voctgroup . /app/

# Standardize line endings and configure executable permissions
RUN dos2unix /app/entrypoint.sh && \
    chmod +x /app/entrypoint.sh

# Provision directories for ephemeral static/media files with correct permissions
RUN mkdir -p /app/media /app/static && \
    chown -R voctuser:voctgroup /app/media /app/static && \
    chmod -R 755 /app/media /app/static

# Pre-build the global font cache for WeasyPrint PDF generation engine
RUN fc-cache -f -v

# Define process execution entrypoint and application server command
ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["gunicorn", "config.asgi:application", "-k", "uvicorn.workers.UvicornWorker", "--bind", "0.0.0.0:8000", "--workers", "3"]