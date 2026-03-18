#!/bin/bash
# ==========================================
# Docker Entrypoint Script
# ==========================================
# Exit immediately if a command exits with a non-zero status
set -e

echo ">>> Weryfikacja i naprawa uprawnień wolumenów Dockera..."
chown -R voctuser:voctgroup /app/media /app/static
# Check if the container is starting the web server (gunicorn or runserver)
if [[ "$*" == *"gunicorn"* ]] || [[ "$*" == *"runserver"* ]]; then
    echo ">>> Zbieranie plików statycznych (jako voctuser)..."
    gosu voctuser python manage.py collectstatic --noinput

fi

# Execute the main command passed from Docker Compose (CMD)
echo ">>> Uruchamianie procesu: $@"
exec gosu voctuser "$@"