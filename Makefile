# ------------------------------------------------------------------
# VoctManager - Developers Tool
# ------------------------------------------------------------------
# The dev overrides live in docker-compose.dev.yml and are NEVER auto-loaded
# (see the note in that file) — always go through these targets.

COMPOSE_DEV  = docker compose -f docker-compose.yml -f docker-compose.dev.yml
COMPOSE_PROD = docker compose -f docker-compose.yml -f docker-compose.prod.yml

# The production droplet has ONE vCPU. Compose builds its services concurrently by
# default, which on a single core buys nothing and costs real memory: a deploy was
# observed running the backend's `pip install` and the Astro sharp pass at the same
# time, each slowing the other. Serialising them does not lengthen the build — there
# is one core either way — it only stops them fighting over it.
# NOTE: this bounds concurrency BETWEEN services. Independent stages inside a single
# Dockerfile (frontend's panel-builder and web-builder) still overlap; serialising
# those needs a dependency edge that would also make a panel change invalidate the
# Astro image pass, so it is deliberately left alone.
BUILD_ENV = COMPOSE_PARALLEL_LIMIT=1 APP_BUILD_SHA=$(shell git rev-parse --short HEAD 2>/dev/null)

# The commit the panel bundle was built from, stamped into it and carried by every
# in-app feedback report. It has to be resolved HERE: `.git` is excluded by
# .dockerignore (it would push the whole history through the build context), so a
# `git` call inside the image has nothing to read and the bundle would fall back to
# a bare timestamp — leaving "already fixed" and "still broken" indistinguishable
# in the triage queue, which is the one thing the stamp exists to prevent.

.PHONY: up prod deploy gc down logs shell migrate seed superuser reset-test-data

up:
	$(BUILD_ENV) $(COMPOSE_DEV) up --build -d

prod:
	$(BUILD_ENV) $(COMPOSE_PROD) up --build -d

# Full production deploy. Nothing here is optional and the order matters:
# migrations are applied by NO other path (entrypoint.sh only collects static,
# `up` never migrates), so a deploy that stops after `up` leaves the new code
# running against the old schema. `migrate --check` at the end fails the deploy
# loudly if anything is still outstanding. Make aborts on the first non-zero
# step, so a failed build never reaches the database.
#
# The two `gc` calls bracket the build because a build adds a few GB of image
# layers and BuildKit cache: the first clears headroom so a nearly-full droplet
# doesn't fail mid-build, the second drops the image this build just orphaned.
# Both are `-` prefixed — disk hygiene must never abort or fail a deploy that
# otherwise succeeded (make prints "Error N (ignored)" if the script trips).
#
# NEITHER call may delete records the next build wants, and they avoid it in
# different ways. The FIRST is explicit: --keep-build-cache, because pruning
# immediately before a build deleted the records the line below was about to
# reuse (the backend re-downloaded every pip package on every deploy). The SECOND
# relies on the script's ordinary mode trimming by AGE — nothing the build that
# just finished touched is eligible, so the Astro image cache survives its own
# deploy. On this one-vCPU droplet that cache is worth far more than the disk it
# occupies: a single 2560px AVIF costs ~30s, and a full pass is 522 variants.
# Dangling images are what actually free the headroom, in both calls.
deploy:
	-@bash infra/docker-gc.sh --keep-build-cache
	$(BUILD_ENV) $(COMPOSE_PROD) build
	$(COMPOSE_PROD) up -d
	$(COMPOSE_PROD) exec -T web python manage.py migrate
	$(COMPOSE_PROD) exec -T web python manage.py migrate --check
	-@bash infra/docker-gc.sh

# Manual disk reclaim, same script cron runs. `make gc DEEP=--deep` also drops
# the BuildKit cache mounts (npm + Astro encode cache) — bigger reclaim, and on
# this one-vCPU droplet a much slower next build: every image variant re-encodes,
# at ~30s apiece for a 2560px AVIF. Reach for it only when disk is the emergency.
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

# Destructive pre-test-round wipe. Empties operational data but keeps donations,
# patron leads, the knowledge base and the superuser accounts. The script owns
# the procedure around the wipe — confirmation, backup, and stopping celery so a
# beat-scheduled task cannot write into tables as they are emptied; the table
# list and its safety interlocks live in `manage.py reset_test_data`.
#
# Preview it first — the dry run reports every row count and touches nothing:
#   make reset-test-data ARGS=--dry-run
#
# NOTE: never reach for `make seed` on production to do this. `seed_db --clear`
# hard-wipes donations, patron leads and the knowledge base, which is precisely
# what this target exists to preserve.
reset-test-data:
	bash infra/reset-test-data.sh $(ARGS)
