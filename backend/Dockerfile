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

# Build Python wheels to avoid shipping build tools in the final image
RUN pip wheel --no-cache-dir --no-deps --wheel-dir /usr/src/app/wheels -r requirements.txt


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

# Install strictly required runtime system libraries (WeasyPrint & DB drivers)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpango-1.0-0 \
    libpangoft2-1.0-0 \
    libmagic1 \
    libharfbuzz0b \
    fontconfig \
    libpq5 \
    dos2unix \
    gosu \
    gettext \
    && rm -rf /var/lib/apt/lists/*

# Inject pre-compiled wheels from the builder stage and install
COPY --from=builder /usr/src/app/wheels /wheels
RUN pip install --no-cache /wheels/* && rm -rf /wheels

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