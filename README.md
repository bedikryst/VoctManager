# VoctManager

*Read this in [Polski](README.pl.md).*

![Django 6](https://img.shields.io/badge/Django_6.0-092E20?logo=django&logoColor=white)
![React 19](https://img.shields.io/badge/React_19-20232A?logo=react&logoColor=61DAFB)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?logo=postgresql&logoColor=white)
![Celery](https://img.shields.io/badge/Celery-37814A?logo=celery&logoColor=white)
![Anthropic](https://img.shields.io/badge/Claude_Sonnet_4.6-D97757?logo=anthropic&logoColor=white)

An ERP for a professional vocal ensemble, and the AI pipeline that catalogues its sheet music.

A conductor was spending hours per concert on work no software was doing for her: tracking who sings what, generating contracts, assembling singers' score books, and typing metadata off PDF scores by hand. VoctManager replaced that. It runs in production for **VoctEnsemble** and the foundation behind it.

Built and maintained by one person. 711 commits since February 2026.

**Public site:** [voctensemble.com](https://voctensemble.com)

| Conductor dashboard | AI score review cockpit |
|:---:|:---:|
| <img src="docs/assets/admin-dashboard.png" width="420" alt="Admin dashboard showing projects, rehearsals and pending actions"/> | <img src="docs/assets/score-compiler-review.png" width="420" alt="Review cockpit with per-field provenance chips and confidence scores next to the source PDF"/> |

---

## The interesting part: the score pipeline

A conductor uploads a PDF score. Minutes later the archive holds a catalogued work — composer resolved to a canonical ID, movements split out, sung text transcribed, IPA aligned line by line, singing translations, and a programme note in the ensemble's language. She reviews it and approves. What used to take an afternoon takes a few minutes of checking.

```
upload PDF
  → Celery chain starts, browser subscribes to Server-Sent Events
  → one consolidated Sonnet call reads the whole document by vision
    (text layer and scans both; the key inferred from the key signature,
     composer split from arranger, movements, sung text, IPA, translations)
  → composer + work resolved against MusicBrainz (MBID) and Wikidata (QID)
  → Spotify / YouTube looked up for reference recordings
  → every field stamped with provenance, persisted
  → conductor reviews, corrects, approves → published
```

### Three things I'd point at

**The model extracts, it never asserts.** Every AI- or API-sourced field carries `(model, prompt_version, source_reference, confidence, retrieved_at)` in a `ProvenanceRecord`, and the review UI renders it *per field* — an `AI · 95%` chip, a `MusicBrainz` chip, or a `Verified` chip once a human has touched the value. Canonical identifiers come from MusicBrainz and Wikidata, never from the model. A conductor should not have to guess which fields to double-check.

**Retry policy follows the billing, not the status code.** The exception taxonomy in [`archive/infrastructure/ai_client.py`](backend/archive/infrastructure/ai_client.py) splits failures by whether retrying can possibly help *and* whether the failed attempt was billed:

| Failure | Billed? | Policy |
|---|---|---|
| 529 overloaded / 5xx / 429 / connection timeout | no | **Retryable.** Wait patiently — tens of seconds to minutes — and surface a "service busy, retrying" state to the conductor. |
| `stop_reason='max_tokens'` truncation | yes | Double the budget, retry up to 2 escalations, then **terminal**. A fixed budget truncates deterministically; re-issuing the identical call burns the same money for the same failure. |
| 400 / auth / permission | no | **Terminal.** Abort the chain immediately instead of burning autoretry cycles on a request Anthropic already rejected as invalid. |

The naive version of this is `retry(3)` on everything, which turns a capacity blip into a retry storm and a truncation into three identical bills.

**Spend is a system invariant, not a hope.** Three independent ceilings enforced at the Celery task boundary — per-run, a never-reset lifetime cap per edition, and an org-wide daily budget circuit breaker. Defaults: $1.00 / $5.00 / $20.00. A re-uploaded identical PDF is deduplicated by SHA-256 and skips the model entirely. End-to-end an ingest averages **$0.11–0.22**; the PDF goes up as a native `document` block with `cache_control: ephemeral`, so an escalation reads it back at cache rates.

<img src="docs/assets/score-compiler-upload.png" width="620" alt="Upload screen streaming live pipeline progress over Server-Sent Events"/>

---

## Decisions, including the ones to not build something

The full list lives in [Deliberately out of scope](#deliberately-out-of-scope). Three that shaped the system:

**Two frontends instead of one.** The panel is a React SPA; the public site is a separate Astro app. The SPA shell was a measurable SEO and performance regression for a charity applying for Google Ad Grants — crawlers got an empty div. Astro emits static HTML and hydrates React only where state actually lives (donation flow, audio gate, sticky chrome). Two builds, one backend, one deploy.

**Liveness and readiness answer different questions.** `/api/health/` is dependency-free and backs the Docker healthcheck. `/api/health/ready/` touches Postgres and Redis and returns 503 when it can't serve. They are deliberately not the same endpoint: restarting a container because Postgres is slow gives you a container that comes back equally degraded, and `depends_on` cascades it into Celery. The Redis check is a write-then-read rather than a `PING`, because a Redis at `maxmemory` under `noeviction` answers `PING` perfectly while refusing every write.

**Alert on silence, not on errors.** A dead Celery beat scheduler doesn't raise — it stops. So a periodic task pings an external heartbeat monitor, and the alert fires on the *absence* of that ping. It's an end-to-end proof: the ping only happens if beat scheduled the task, the broker delivered it, and a worker consumed it. The ping task itself never retries and never raises, so a flaky monitor can't become a source of alerts about itself.

---

## What I got wrong

**I built the ingestion as a chain of small model calls first.** One call for identity, one for movements, one for lyrics, one for translations. It cost several times more and produced worse output, because each call lost the context of the pages around it — the model would fall back on a hymn's canonical text from memory instead of reading the printed text on the page. Consolidating to a single call that sees the whole PDF fixed both problems at once. I found this by reading the bill, not by reasoning about it.

**I shipped features the conductor didn't want.** Several interactions I was pleased with had to be removed or redesigned. The pattern was always the same: I had built for my model of her workflow rather than hers. Watching her work for twenty minutes taught me more than any conversation where I asked what she wanted. She valued predictability and fewer clicks over anything I'd added.

**I under-tested the boring parts for too long.** Coverage grew around the AI pipeline first, because that's where the interesting failures were. The dull paths — contract generation, attendance, settlements — got covered late, and that's where the production bugs actually came from.

---

## How this was built, and where AI stops

I use Claude Code daily, and this project would not exist at this size in five months without it. The git history says so plainly — some commits are co-authored.

What AI did not do: decide to split the frontend after the Ad Grants audit; decide that retry policy should follow billing rather than status codes; decide that Prometheus, a Postgres replica and a Redis cluster stay out of scope on a single-droplet single-maintainer deployment; decide that the score watermark carries a singer's name and never their email, because the file gets printed and left on a music stand.

Architecture, cost, priorities, and what stays out — mine. Those are the parts I can be held to.

---

## The rest of the platform

**Roster and production.** Four-role RBAC (admin, manager, artist, crew) enforced at endpoint, payload and UI level. Casting via drag-and-drop, rehearsals, attendance, per-project budgets and settlements, iCal feeds for Google and Apple Calendar.

**Documents.** Contracts and run sheets generated asynchronously through Celery + WeasyPrint. Print-ready concert score books assembled from a project's repertoire: title page, dotted-leader table of contents, per-piece frontispiece cards drawn from the AI-resolved archive, continuous folios, PDF bookmarks, optional double-sided mode. Deterministic assembly — no model runs at build time.

**Licensed-score protection.** Each edition carries a copyright status, with *unclassified* treated as protected by default. Public-domain scores export freely; protected editions are in-app-only for singers and served through a per-recipient server-side watermark stamping copy number, singer, concert and date — applied without shifting page count or breaking PDF outline anchors, at both delivery points (single edition and the score book that embeds it). Every serve goes to an append-only access log. The build cockpit warns when a licensed edition is bound for more singers than the ensemble owns copies of.

**Digital music stand.** A PDF reader built for a tablet on a music stand: prefetched page turns, Bluetooth pedal keys, screen wake lock, focal pinch zoom. On top, a role-aware annotation layer — the conductor writes a shared layer every cast singer sees, and each singer gets a personal layer that stays invisible even to managers, enforced server-side. Musical stamp palette (breath marks, dynamics, hairpins, fermata, caesura), stylus-first input routing, undo/redo, optimistic persistence.

**Messaging and notifications.** Two-way threads and project broadcast channels, delivered in-app, by email (Resend) and web push (VAPID), with a manager triage workflow. Deliberately not a real-time chat — no presence, no typing indicators. The message store is decoupled from delivery, so every message reuses the existing notification pipeline.

**Payments.** Donation module integrating Axepta BNP Paribas with MAC signature validation and Celery-based asynchronous reconciliation.

---

## Stack

**Backend** — Python 3.13, Django 6, DRF, PostgreSQL (psycopg 3), Redis, Celery 5.3, Pydantic DTOs at the service boundary, cookie-based JWT (`httpOnly` + `Secure` + `SameSite=Lax`, so the SPA never touches the token) with CSRF double-submit. Layered into services and selectors.

**Panel** — React 19, Vite 7, TypeScript 5.9, Feature-Sliced Design, TanStack Query v5, Zustand, Tailwind v4, Framer Motion, React Hook Form + Zod, Radix primitives.

**Public site** — Astro 6 with React islands, hand-authored CSS, self-hosted variable fonts (no third-party font CDN, so no user-IP leakage), native View Transitions.

**Documents & AI** — WeasyPrint, pypdf, pypdfium2, Anthropic SDK (vision over native PDF, structured outputs, prompt caching, adaptive thinking).

**Infrastructure** — Docker Compose with dev/prod parity, Nginx, Gunicorn/Uvicorn, GitHub Actions, Sentry.

---

## Quality and operations

- **~676 tests** across roster, archive, payments, messaging, notifications, documents and core — including contract generation, the score-package cockpit, licensed-score protection and the AI provenance pipeline.
- **CI** runs Ruff, mypy in strict mode, and the full suite against PostgreSQL 16 on every push and PR.
- **Backups are restore-tested, not assumed.** [`infra/restore-drill.sh`](infra/restore-drill.sh) replays the off-site archive into a throwaway database and scratch directory, then checks archive integrity, row counts against live, media completeness, migration state and measured RTO — without touching production. Runbook: [`docs/backups.md`](docs/backups.md).
- **Monitoring** — Sentry, the liveness/readiness split above, external uptime and TLS-expiry polling, and the beat heartbeat. Runbook: [`docs/monitoring.md`](docs/monitoring.md).
- **Soft deletes** preserve production history without leaking removed records into active queries; foreign-key and check constraints guard multi-entity operations at the database layer.

### Deliberately out of scope

Scope decisions, recorded so they don't get re-proposed as gaps.

**Prometheus / Grafana / OpenTelemetry.** Metrics answer *how much*. A single-tenant install on one droplet with one maintainer has no SLO, no on-call rotation, and no traffic volume to ask that of. The questions actually asked here — *is it down*, *what threw* — are answered by the health probes and the heartbeat at a fraction of the operating cost, on a host whose RAM is already the binding constraint during builds. Revisit if a second ensemble ever shares the deployment.

**PostgreSQL streaming replication.** A hot standby protects against instance loss, which daily off-site backups already cover with a verified restore measured in seconds. On a single droplet a replica is a second stateful service sharing the same disk and the same power failure: correlated failure dressed as redundancy.

**Redis cluster.** One instance backs the cache and the Celery broker. Clustering solves a coordination problem this deployment does not have.

### Open

- [ ] Burn the shared annotation layer into the score book at assembly time
- [ ] Fernet at-rest encryption for contract and financial fields, plus an immutable mutation log
- [ ] Frontend CI and Playwright end-to-end coverage
- [ ] Rate limiting at the edge (CloudFlare + WAF) on top of the DRF throttling in place
- [ ] Automated accessibility testing against the EAA baseline the UI is built to
- [ ] Zero-downtime deploys

---

## Architecture

```mermaid
graph TD
    Client([Browser / Tablet]) -->|HTTPS| Nginx[Nginx]

    Nginx -->|static HTML| Astro[Astro 6 · public site]
    Nginx -->|/panel| React[React 19 SPA · FSD]
    Nginx -->|/api| Gunicorn[Gunicorn / Uvicorn]

    Astro -->|/api/payments · /api/contact| Gunicorn
    React -->|TanStack Query · cookie JWT| Gunicorn

    Gunicorn <-->|psycopg3| DB[(PostgreSQL)]
    Gunicorn -->|task queue| Redis[(Redis)]

    Redis <--> Celery[Celery workers]
    Celery <--> DB
    Celery -->|WeasyPrint / pypdf| Files[Documents · score books]
    Celery -->|Resend · Firebase| Notify[Email · web push]

    Celery -->|native-PDF vision| Claude[Claude Sonnet 4.6]
    Claude -->|tool-orchestrated lookups| Ext[MusicBrainz · Wikidata<br/>Spotify · YouTube]
    Ext -.->|cached| Redis
    Claude -->|provenance-stamped| DB

    classDef default fill:#1f2937,stroke:#4b5563,color:#f3f4f6;
    classDef db fill:#059669,stroke:#047857,color:#ffffff;
    classDef ai fill:#D97757,stroke:#b85c3e,color:#ffffff;
    class DB,Redis db;
    class Claude,Ext ai;
```

The Celery ingestion chain: `prepare_document → analyze_score → resolve_composer_and_piece → persist_analysis → generate_program_note → lookup_spotify → lookup_youtube → finalize_edition`. Progress streams from an async ASGI endpoint at `GET /api/archive/editions/<id>/events/`, so production runs under `gunicorn config.asgi -k uvicorn.workers.UvicornWorker`.

Deep dive on the pipeline: [`docs/archive-ai-ingestion-pipeline.md`](docs/archive-ai-ingestion-pipeline.md).

---

## Running it locally

Requires Docker, Compose v2 and GNU Make.

```bash
git clone https://github.com/bedikryst/VoctManager.git
cd VoctManager
cp .env.example .env
cp frontend/.env.example frontend/.env
make up
make migrate && make seed && make superuser
```

`make seed` builds a full realistic dataset — 28 singers across the vocal spectrum, 2 conductors, 5 crew, 6 projects in every lifecycle state, 10 composers with movements and translations, plus messaging, payments and notifications. It's idempotent. Logins: `admin / admin123`, `manager / manager123`.

```bash
python manage.py seed_db --artists 12 --no-media   # smaller and faster
python manage.py seed_db --clear                   # wipe and reseed
python manage.py seed_db --seed 2026               # reproducible
```

- API: `http://localhost:8000/api/`
- OpenAPI docs: `http://localhost:8000/api/docs`
- Panel: `http://localhost:5173/panel` (`cd frontend && npm install && npm run dev`)
- Public site: `http://localhost:4321` (`cd web && npm install && npm run dev`)

The Astro build needs source photos in `web/src/assets/photos/` and videos in `web/src/assets/videos/`. Both are gitignored — they're collaborator-owned originals that live on the build host. The build fails with a clear error if one is missing.

---

## Deploying

```bash
cd ~/VoctManager && git pull && make deploy
```

`make deploy` is `gc → build → up -d → migrate → migrate --check → gc`, and each step earns its place:

- **`build` with no service name rebuilds the backend too.** `build frontend` alone leaves `web` and `celery` on the previous image, so a backend change silently doesn't ship.
- **Nothing applies migrations for you.** Not `entrypoint.sh` (it only runs `collectstatic`), not `up`. A deploy that stops after `up` leaves new code against the old schema.
- **`migrate --check` is the receipt.** Non-zero if anything is outstanding, so the deploy fails loudly instead of looking successful.

Make aborts on the first failure, so a broken build never reaches the database.

`frontend/Dockerfile` is a three-stage build rooted at the repo root: `panel-builder` (Vite) and `web-builder` (Astro + Sharp) both feed an `nginx:1.27` runtime, so one image ships both frontends. No Node on the host. Needs ~3 GB free RAM during the build — the rollup graph peaks around 2 GB and Sharp adds ~500 MB. [`infra/docker-gc.sh`](infra/docker-gc.sh) runs before and after the build, because nothing evicts the previous build's layers on its own.

---

**Krystian Bugalski** — [GitHub](https://github.com/bedikryst) · [LinkedIn](https://www.linkedin.com/in/krystian-bugalski) · krystian@bugalski.dev
