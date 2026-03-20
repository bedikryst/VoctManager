# ------------------------------------------------------------------
# VoctManager - Developers Tool
# ------------------------------------------------------------------

.PHONY: up down logs shell migrate seed superuser

up:
	docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d

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