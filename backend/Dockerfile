# ==========================================
# Backend Dockerfile (Django/Python)
# ==========================================

# Use the official lightweight Python 3.12 image
FROM python:3.12-slim

# Disable output buffering to ensure logs are immediately visible in the terminal
ENV PYTHONUNBUFFERED=1
# Prevent Python from writing .pyc files to disk (saves space and improves performance)
ENV PYTHONDONTWRITEBYTECODE=1

# Create a dedicated system user and group (non-root privilege for security)
RUN addgroup --system voctgroup && adduser --system --ingroup voctgroup voctuser

# Set the working directory inside the container
WORKDIR /app

# Install system dependencies required for WeasyPrint (PDF generation engine)
RUN apt-get update && apt-get install -y \
    libpango-1.0-0 \
    libpangoft2-1.0-0 \
    libharfbuzz0b \
    fontconfig \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies securely without caching
COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code
COPY --chown=voctuser:voctgroup . /app/

# Create directories for media and static files, and assign ownership to the non-root user
RUN mkdir -p /app/media /app/static && \
    chown -R voctuser:voctgroup /app/media /app/static && \
    chmod -R 755 /app/media /app/static

RUN chmod +x /app/entrypoint.sh && chown voctuser:voctgroup /app/entrypoint.sh

# Build global font cache for WeasyPrint as root before switching users
RUN fc-cache -f -v 

# Redirect application cache to a globally writable temporary directory
ENV XDG_CACHE_HOME=/tmp/.cache

# Switch to the secure, non-root user
USER voctuser

# Set the default command to run the application
ENTRYPOINT ["/app/entrypoint.sh"]

# Default command to start the Gunicorn server with 3 workers, binding to all interfaces on port 8000
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "3"]