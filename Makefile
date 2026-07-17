# ------------------------------------------------------------------
# VoctManager - Developers Tool
# ------------------------------------------------------------------
# The dev overrides live in docker-compose.dev.yml and are NEVER auto-loaded
# (see the note in that file) — always go through these targets.

COMPOSE_DEV  = docker compose -f docker-compose.yml -f docker-compose.dev.yml
COMPOSE_PROD = docker compose -f docker-compose.yml -f docker-compose.prod.yml

.PHONY: up prod down logs shell migrate seed superuser

up:
	$(COMPOSE_DEV) up --build -d

prod:
	$(COMPOSE_PROD) up --build -d

down:
	docker compose down

logs:
	docker compose logs -f

shell:
	docker compose exec web bash

migrate:
	docker compose exec web python manage.py migrate

seed:
	docker compose exec web python manage.py seed_db

superuser:
	docker compose exec web python manage.py createsuperuser
