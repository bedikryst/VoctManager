#!/bin/bash
# ==========================================
# Docker Entrypoint Script
# ==========================================
# Exit immediately if a command exits with a non-zero status
set -e

# Check if the container is starting the web server (gunicorn or runserver)
if [[ "$*" == *"gunicorn"* ]] || [[ "$*" == *"runserver"* ]]; then
    echo ">>> Running web container pre-flight checks..."
    
    echo ">>> Applying database migrations..."
    python manage.py migrate --noinput

    echo ">>> Collecting static files..."
    python manage.py collectstatic --noinput
fi

# Execute the main command passed from Docker Compose (CMD)
echo ">>> Starting process: $@"
exec "$@"