# ------------------------------------------------------------------
# VoctManager - Developers Tool
# ------------------------------------------------------------------
# The dev overrides live in docker-compose.dev.yml and are NEVER auto-loaded
# (see the note in that file) — always go through these targets.

COMPOSE_DEV  = docker compose -f docker-compose.yml -f docker-compose.dev.yml
COMPOSE_PROD = docker compose -f docker-compose.yml -f docker-compose.prod.yml

.PHONY: up prod deploy gc down logs shell migrate seed superuser

up:
	$(COMPOSE_DEV) up --build -d

prod:
	$(COMPOSE_PROD) up --build -d

# Full production deploy. Nothing here is optional and the order matters:
# migrations are applied by NO other path (entrypoint.sh only collects static,
# `up` never migrates), so a deploy that stops after `up` leaves the new code
# running against the old schema. `migrate --check` at the end fails the deploy
# loudly if anything is still outstanding. Make aborts on the first non-zero
# step, so a failed build never reaches the database.
#
# The two `gc` calls bracket the build because a build adds ~4–5 GB of image
# layers and BuildKit cache: the first clears headroom so a nearly-full droplet
# doesn't fail mid-build, the second drops the image this build just orphaned.
# Both are `-` prefixed — disk hygiene must never abort or fail a deploy that
# otherwise succeeded (make prints "Error N (ignored)" if the script trips).
deploy:
	-@bash infra/docker-gc.sh
	$(COMPOSE_PROD) build
	$(COMPOSE_PROD) up -d
	$(COMPOSE_PROD) exec -T web python manage.py migrate
	$(COMPOSE_PROD) exec -T web python manage.py migrate --check
	-@bash infra/docker-gc.sh

# Manual disk reclaim, same script cron runs. `make gc DEEP=--deep` also drops
# the BuildKit cache mounts (npm + Astro encode cache) — bigger reclaim, much
# slower next build.
gc:
	bash infra/docker-gc.sh $(DEEP)

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
