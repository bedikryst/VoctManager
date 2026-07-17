# ==========================================
# Multi-Stage Dockerfile
# ==========================================

# ------------------------------------------
# Stage 1: Builder
# Compiles dependencies to generate Python wheels.
# ------------------------------------------
FROM python:3.12-slim AS builder

WORKDIR /app

# Install system dependencies strictly required for C-extension compilation
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

# Build Python wheels (INCLUDING transitive dependencies) so the runtime stage
# installs fully offline and never needs gcc. `--no-deps` here would silently
# push transitive resolution into the runtime stage's network install.
RUN pip wheel --no-cache-dir --wheel-dir /usr/src/app/wheels -r requirements.txt


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