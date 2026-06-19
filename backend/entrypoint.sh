#!/bin/bash
# ==========================================
# Docker Entrypoint Script
# ==========================================
# Exit immediately if a command exits with a non-zero status
set -e

# Which OS user the app process runs as. Production (and the default) drops
# privileges to the unprivileged `voctuser`. Local dev on Windows/macOS sets
# APP_RUN_USER=root, because the media directory is a HOST bind mount whose
# ownership cannot be chowned to voctuser through the Docker Desktop file-sharing
# layer — so a privilege-dropped process hits EACCES the moment it writes an
# upload (PDF score / avatar). Prod uses a managed volume and stays unprivileged.
APP_RUN_USER="${APP_RUN_USER:-voctuser}"

echo ">>> Weryfikacja i naprawa uprawnień wolumenów Dockera..."
# May be a silent no-op on a Windows/macOS bind mount — never let it abort boot.
chown -R voctuser:voctgroup /app/media /app/static || true

# Check if the container is starting the web server (gunicorn or runserver)
if [[ "$*" == *"gunicorn"* ]] || [[ "$*" == *"runserver"* ]]; then
    echo ">>> Zbieranie plików statycznych (jako ${APP_RUN_USER})..."
    if [ "$APP_RUN_USER" = "root" ]; then
        python manage.py collectstatic --noinput
    else
        gosu "$APP_RUN_USER" python manage.py collectstatic --noinput
    fi
fi

# Execute the main command passed from Docker Compose (CMD)
echo ">>> Uruchamianie procesu (jako ${APP_RUN_USER}): $@"
if [ "$APP_RUN_USER" = "root" ]; then
    exec "$@"
else
    exec gosu "$APP_RUN_USER" "$@"
fi
