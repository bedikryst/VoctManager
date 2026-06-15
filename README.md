# 🎼 VoctManager | Enterprise Choral OS & Digital Operations Platform

🌍 *Read this in other languages: [English](README.md), [Polski](README.pl.md).*

![React 19](https://img.shields.io/badge/React_19.2-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![TypeScript 5.9](https://img.shields.io/badge/TypeScript_5.9-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Tailwind CSS v4.2](https://img.shields.io/badge/Tailwind_v4.2-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Django 6](https://img.shields.io/badge/Django_6.0-092E20?style=for-the-badge&logo=django&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)
![Redis 5](https://img.shields.io/badge/Redis_5-DC382D?style=for-the-badge&logo=redis&logoColor=white)
![Celery 5](https://img.shields.io/badge/Celery_5-37814A?style=for-the-badge&logo=celery&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2CA5E0?style=for-the-badge&logo=docker&logoColor=white)
![Claude](https://img.shields.io/badge/Claude_4.7-D97757?style=for-the-badge&logo=anthropic&logoColor=white)

**VoctManager** is a high-performance, dual-architecture enterprise resource planning (ERP) and digital operations platform. Engineered specifically as the official digital infrastructure for the professional vocal ensemble **VoctEnsemble**, it seamlessly bridges the gap between complex production logistics, secure asset management, and an immersive, cinematic digital experience.

The platform strictly adheres to **Feature-Sliced Design (FSD)** architecture, ensuring massive scalability, domain separation, and robust long-term maintainability.

🌐 **Live Public Experience:** [test.voctensemble.com](https://voctensemble.com)

---

## 🏛️ System Architecture & Engineering Standards

The platform is built on a highly decoupled architecture designed for high availability, offline-resilient caching, and asynchronous background processing. 

```mermaid
graph TD
    Client([Web Browser / Mobile]) -->|HTTPS| Nginx[Nginx Reverse Proxy]

    subgraph PublicWeb [Public Site &nbsp;·&nbsp; web/]
        Nginx -->|Static HTML + _astro/*| Astro[Astro 6 · Islands]
        Astro -->|/api/payments · /api/contact| Gunicorn
    end

    subgraph Panel [Authenticated Panel &nbsp;·&nbsp; frontend/]
        Nginx -->|/panel · /login · /documents| React[React SPA]
        React -->|TanStack Query v5 / Zustand| StateManager[State & Cache]
    end

    subgraph Backend
        Nginx -->|REST API requests| Gunicorn[Gunicorn / Uvicorn]
        StateManager -->|JSON / JWT| Gunicorn
    end

    subgraph DataStorage
        Gunicorn <-->|psycopg3| DB[(PostgreSQL)]
        Gunicorn -->|Task Queues| Redis[(Redis 5)]
    end

    subgraph BackgroundProcessing
        Redis <--> Celery[Celery 5.3 Workers]
        Celery <--> NotificationService[Notification Router Service]
        NotificationService -->|Email| Resend[Resend Email API]
        NotificationService -->|Push| Firebase[Firebase Push API]
        Celery <--> DB
        Celery -->|WeasyPrint PDF Gen| Ext[File System / S3]
    end

    subgraph AIScoreCompiler[AI Score Package Compiler]
        Celery -->|PDF ingestion| Claude["Tiered Claude Pipeline<br/>Haiku 4.5 · Sonnet 4.6 · Opus 4.7"]
        Claude -->|Tool-orchestrated lookups| ExtMeta["MusicBrainz · Wikidata<br/>Spotify · YouTube"]
        ExtMeta -.->|cached responses| Redis
        Claude -->|Provenance-stamped fields| DB
    end

    classDef default fill:#1f2937,stroke:#4b5563,stroke-width:1px,color:#f3f4f6;
    classDef highlight fill:#3b82f6,stroke:#2563eb,stroke-width:2px,color:#ffffff;
    classDef db fill:#059669,stroke:#1d4ed8,stroke-width:2px,color:#ffffff;
    classDef ai fill:#D97757,stroke:#b85c3e,stroke-width:2px,color:#ffffff;

    class React,StateManager,Gunicorn highlight;
    class DB,Redis db;
    class Claude,ExtMeta ai;
```

---

## ✨ Core Enterprise Features

### 1. Dual Frontend — Panel (React SPA) + Public Site (Astro)

The platform ships **two independent frontends** that share a single Django backend:

* **Panel SPA — [`frontend/`](frontend/README.md):** authenticated ERP for managers, artists, and crew (`/panel/*`). React 19 + TanStack Query + Framer Motion, strict FSD, Ethereal design system. Owns the cinematic, glassmorphic operational surface.
* **Public site — [`web/`](web/README.md):** the voctensemble.com / voctfoundation.pl landing + subpages (`/`, `/koncerty`, `/o-nas`, `/kontakt`, `/polityka-prywatnosci`). **Astro 6** (static HTML + React islands + native View Transitions), Lenis smooth-scroll, sacred-minimalism art direction in the spirit of *"Nawa światła"*. Crawlable and Ad-Grants-ready by construction.

Frontend engineering pillars:

- **Zero-Layout-Shift Architecture:** Suspense boundaries + `<EtherealLoader>` + strict skeleton states keep CLS at 0 during async fetches — no jank, ever.
- **60FPS Kinematics:** Animations driven exclusively by `transform` / `opacity` via **Framer Motion v12** (panel) and hand-authored CSS choreography + JS rAF loops (public site). The public site runs **Lenis v1.3+** window-level smooth-scroll synced to View Transitions; the panel uses native platform scrolling.
- **Cinematic Page Transitions:** The Astro public site composes native `::view-transition-old/new(root)` keyframes (sacred fade + Y-drift + blur, 320ms / 540ms) with a shared `view-transition-name: voct-brand` so the candle mark morphs across navigations instead of cross-fading.
- **Staggered Bento Dashboards:** All panel views composed with `<StaggeredBentoContainer>` / `<StaggeredBentoItem>` over a shared glassmorphism token set (`shadow-glass-ethereal`) — spatial, predictable, and theme-driven.
- **EAA Accessibility:** Radix UI Primitives + semantic HTML to meet the European Accessibility Act baseline; the public site adds `prefers-reduced-motion` opt-outs on every animated surface.

### 2. AI-Powered Score Package Compiler
- **Tiered Claude Pipeline:** Multi-stage ingestion that scales the model to the task — Haiku 4.5 for fast classification, Sonnet 4.6 for enrichment, Opus 4.7 for the hardest reasoning. Adaptive thinking + `effort` parameter let Claude allocate compute dynamically.
- **Canonical Identity Resolution:** Composer and work deduplication via **MusicBrainz MBID** and **Wikidata QID** cross-referencing — the AI extracts, but never hallucinates, biographical facts or canonical IDs.
- **External Metadata Enrichment:** Tool-orchestrated lookups across MusicBrainz, Wikidata, Spotify Web API, and YouTube Data API v3, with Redis-cached responses, exponential-backoff retries, and graceful degradation when any source is unavailable.
- **Audit-Grade Provenance:** Every AI- or API-sourced field is stamped with `(model, prompt_version, source_reference, confidence, retrieved_at)` in a generic-FK `ProvenanceRecord` table — enabling one-click regeneration and forensic compliance review.
- **Cost-Aware by Construction:** End-to-end ingestion of a single PDF score averages **~$0.20** (composer + work + program note + IPA + singing translation). Per-entity hard ceilings enforced at the Celery task boundary prevent runaway spend; Anthropic prompt caching (`cache_control: ephemeral`) drives cache-read tokens to dominate on repeat runs, slashing cost ≥80%.
- **Conductor-in-the-Loop:** AI suggests, conductor decides. Every extraction surfaces a confidence score and a review screen — the platform never silently mutates canonical repertoire.

### 3. Enterprise OS & Logistics (Backend)
- **Granular RBAC:** Deep, Role-Based Access Control matrix (Admin, Manager, Artist, Crew) securing endpoints, data payloads, and UI visibility.
- **Web Push & Real-Time Alerts:** Native-like, real-time push notifications built on the W3C VAPID standard. Handled asynchronously via Celery alongside a robust transactional email engine, keeping artists instantly updated on casting and schedule changes.
- **Internal Messaging:** Async two-way conversation threads between choristers and the conducting/management pool, delivered in-app + email + push with unread badges and a unified inbox. Deliberately **not** a real-time chat (no presence/typing) — the store (`messaging` app) is decoupled from delivery (`notifications`), so each message reuses the existing notification pipeline.
- **Calendar Synchronization (iCal):** Seamless external calendar integration, providing auto-generated iCal feeds for Google Calendar and Apple Calendar synchronization.
- **Optimistic UI:** Aggressive server-state caching using **@tanstack/react-query v5.91+**, delivering a zero-latency feel for critical mutations (e.g., attendance confirmation, casting updates).
- **Asynchronous Document Engine:** Production workflows, such as dynamic Contract generation and Run Sheet compilation, are offloaded to **Celery workers** and **WeasyPrint**, guaranteeing the main thread remains unblocked.
- **Smart Archive & Asset Protection:** Secure, token-gated distribution of sensitive repertoire assets (Sheet Music PDFs, Reference Audio) tied strictly to active project casting.
- **Micro-Casting System:** Touch-ready Drag & Drop interfaces (`@dnd-kit/core`) for building complex concert programs and managing individual artist assignments.
- **Internationalization (i18n):** Full localization support (English, French, Polish) tailored for international touring and diverse artist rosters.

---

## 🛠️ Tech Stack (2026 Standards)

### Panel SPA — [`frontend/`](frontend/README.md)
* **Core:** React 19.2+, Vite 7.3+, TypeScript 5.9+
* **Architecture:** Feature-Sliced Design (FSD)
* **Styling:** Tailwind CSS v4.2+ (with Ethereal Design System tokens), `clsx`, `tailwind-merge`
* **State & Fetching:** Zustand 5+, `@tanstack/react-query` v5.91+
* **Motion & Interactions:** Framer Motion v12+, `@dnd-kit/core` v6+ (TouchSensor)
* **Forms:** React Hook Form v7+ combined with Zod v4.3+

### Public Site (Astro) — [`web/`](web/README.md)
* **Core:** Astro 6.3+ (`build.format: "file"`), `@astrojs/react` 5+, React 19, TypeScript 6+
* **Architecture:** Astro islands — server-rendered HTML by default, React hydrated only for the donation Vault, audio Threshold gate, sticky chrome, and site cursor
* **Styling:** Hand-authored sacred-minimalism CSS — no Tailwind here, no third-party CSS framework. CSS custom-property tokens (`--candle`, `--ink`, `--paper`), self-hosted variable fonts (GDPR-strict, zero third-party)
* **Motion:** `lenis@1.3+` window-level smooth-scroll, native View Transitions API, IntersectionObserver-driven reveal pipeline, JS rAF parallax (cross-browser fallback for partial `animation-timeline` support)
* **Content:** Astro Content Collections (`concerts.yaml`, `repertoire.yaml`) + hand-curated TS modules (manifest, paths)

### Backend Environment
* **Core:** Python 3.12+, Django 6.0+, Django REST Framework (DRF) 3.16+
* **Validation & Typing:** Strict Python Type Hints, Pydantic 
* **Database:** PostgreSQL (via `psycopg` v3 driver)
* **Authentication:** JWT via `djangorestframework-simplejwt`
* **Message Broker & Workers:** Redis 5+, Celery 5.3+
* **Document Generation:** WeasyPrint v68+, pypdf v5+
* **AI / Repertoire Intelligence:** Anthropic Python SDK (Claude Opus 4.7 / Sonnet 4.6 / Haiku 4.5), adaptive thinking, prompt caching, structured output via Pydantic schemas

### Infrastructure & DevOps
* **Containerization:** Docker & Docker Compose (Zero-parity between Dev and Prod)
* **Web Server:** Nginx, Gunicorn 21+ (Uvicorn for async)
* **Static Asset Management:** WhiteNoise

---

## 🔒 Security & Data Compliance

Processing artist contracts, rehearsal schedules, and copyrighted musical material requires uncompromising security:

### Authentication & Access Control
* **Stateless Authentication:** Secure, `httpOnly` cookie strategies with JWT rotation to mitigate XSS and CSRF vectors.
* **Granular RBAC:** Role-based access matrices (Admin, Manager, Artist, Crew) with fine-grained endpoint and payload restrictions.
* **Token-Gated Asset Distribution:** Sensitive repertoire (Sheet Music PDFs, Reference Audio) secured with time-limited, signed tokens tied exclusively to active project participation.

### Data Protection & Privacy
* **GDPR Compliance:** Built-in data minimization workflows and soft-deletion mechanisms to preserve production history while meeting strict privacy regulations.
* **Field-Level Encryption:** Sensitive fields (contracts, payroll data) encrypted at rest using FERNET cipher.
* **Audit Logging:** Immutable transaction logs for all mutations on HR and financial records, enabling forensic analysis and compliance reporting.

### Domain Integrity
* **Relational Constraints:** Strict foreign key and check constraints at the database layer prevent data corruption during complex multi-entity operations (e.g., casting rollbacks, contract terminations).
* **Pydantic Validation:** Service-layer DTOs enforce type safety and business rule validation before persistence, eliminating silent data degradation.

---

## 🚦 Engineering Roadmap (2026 Vision)

VoctManager is architected for continuous evolution toward production-grade observability and resilience:

- [x] **Core ERP & Logistics:** Complete domain models for projects, rosters, contracts, and scheduling.
- [x] **Event-Driven Notifications:** Async notification routing with Resend (email) and Firebase (push) providers.
- [x] **Containerization & Orchestration:** Docker & Docker Compose with zero-parity between Dev and Prod environments.
- [x] **Asynchronous Processing:** Celery + Redis for background tasks (document generation, batch notifications, data export).
- [x] **Error Tracking:** Sentry SDK wired into Django for production error capture and release-health monitoring.
- [x] **AI Score Compiler — Schema & Ingestion Pipeline:** Canonical domain schema (`Composer.mbid`, `Piece.mbid_work`, `ScoreEdition`, `Movement`, `Translation`, `Recording`, `Annotation`, `ProgramNote`, `ProvenanceRecord`) plus the live Celery ingestion chain — a tiered Claude wrapper (adaptive thinking, cost tracking, prompt caching) that extracts PDF metadata, resolves composers/works against MusicBrainz & Wikidata, generates program notes + IPA + singing translations, and surfaces a conductor review screen. External clients (MusicBrainz, Wikidata, Spotify, YouTube) are Redis-cached.
- [ ] **AI Score Compiler — Concert Assembly & Annotation:** WeasyPrint + pypdf concert-binder generation (cover, TOC, per-piece front matter, original scores) plus a PDF.js + Konva in-browser annotation overlay (highlight, comment, freehand, page reorder) with versioned, layer-aware persistence and export-time flattening.
- [ ] **Metrics & Distributed Tracing:** Prometheus + Grafana dashboards and OpenTelemetry instrumentation for end-to-end request tracing across services and external APIs.
- [ ] **Automated Testing:** PyTest coverage for critical business paths (contract generation, payroll calculations, casting algorithms).
- [ ] **CI/CD Pipelines:** GitHub Actions for automated lint, build, test, and zero-downtime deploys.
- [ ] **Advanced Caching:** Redis cluster for session management and distributed cache invalidation.
- [ ] **Rate Limiting & DDoS Protection:** CloudFlare + WAF rules for API abuse prevention.
- [ ] **Database Replication:** PostgreSQL streaming replication for high availability and disaster recovery.
- [ ] **SMS & Voice:** Twilio integration for rehearsal reminders and critical schedule alerts.

---

## 🎬 Public Site — `web/` (Astro)

The voctensemble.com / voctfoundation.pl public surface is an **Astro 6** app built around a sacred-minimalism art direction ("Nawa światła") — server-rendered HTML by default, React islands hydrated only where genuine state lives. It composes a once-per-session preloader → threshold gate → sticky chrome → hero → manifest → three "aether interludes" weaving through past concerts → final support → coda. Choreography runs at a sustained 60 FPS over Lenis-driven smooth scroll, with native View Transitions API for between-page swaps.

The full experience relies on scroll-linked kinematics, audio cues, parallax, custom cursor, magnetic-snap hover, View Transitions, and threshold-gate physics. **Static screenshots and GIFs cannot do it justice** — they capture frames, not flow. The live site is publicly accessible:

### ▶ [voctensemble.com](https://voctensemble.com) — open in a desktop browser with sound on

> **Why a separate Astro app?** The panel CSR shell was a SEO/perf regression for a charity site chasing Google Ad Grants. Astro emits crawlable static HTML, ships React only where needed (donation Vault, audio gate, sticky chrome), and uses the platform's native View Transitions API for Awwwards-grade cross-page animation without a CSR runtime tax. Source-of-truth docs: [`web/README.md`](web/README.md).

| Section | What to watch for |
|---|---|
| **Preloader → Threshold Gate** | Sacred rite (once-per-session), localStorage-gated audio choice, first-paint orchestration |
| **Hero → Manifest** | Custom cursor with magnetic snap, variable-font wght breath + per-word stagger, text-emanating gold bloom |
| **Aether Interludes I / II / III** | Audio-reactive knot intensity (Web Audio analyser), Roman-numeral Latin motifs |
| **Path of Past Concerts** | Parallax stack (cross-browser JS), smooth-details accordion |
| **Final Support / Vault Flow** | Multi-step donation sheet, Axepta gateway redirect, gratitude/failure result modals |
| **Cross-page navigation** | Native `::view-transition-*` keyframes with shared `voct-brand` candle mark morphing between pages |

> **Source:** [`web/src/pages/index.astro`](web/src/pages/index.astro) — composes 9 section components and 6 React islands (Preloader, ThresholdGate, AudioController, StickyHeader, SiteCursor, SiteFooter, VaultIsland). Subpages (`/koncerty`, `/o-nas`, `/kontakt`) reuse `SiteChrome` + `SiteFooter` and mount only the Vault island for in-place donations.

> **Public-site source photos** (`web/src/assets/photos/*.jpg`) are intentionally gitignored — they're 5-12 MB collaborator-owned originals uploaded directly to the build host. See [`web/README.md`](web/README.md) §Conventions for the deploy contract.

---

## 🤖 AI Score Package Compiler

| Score Ingestion (Upload & Tiered Analysis) | Conductor Review (AI-Extracted Repertoire) |
|:---:|:---:|
| <img src="docs/assets/score-compiler-upload.png" width="400" alt="Score Compiler upload zone — placeholder: replace with screenshot of the PDF drag-and-drop ingestion screen showing live tiered-Claude status"/> | <img src="docs/assets/score-compiler-review.png" width="400" alt="Conductor review modal — placeholder: replace with screenshot of AI-extracted composer/work/program-note fields with confidence scores"/> |

---

## 📸 System Interface (Ethereal Design System)

| Main Dashboard (Staggered Bento OS) | Project & Logistics Editor |
|:---:|:---:|
| <img src="docs/assets/dashboard.png" width="400" alt="Main Dashboard showcasing Bento Grid"/> | <img src="docs/assets/editor.png" width="400" alt="Project Editor"/> |
| **Locations Management** | **Notifications Center** |
| <img src="docs/assets/locations.png" width="400" alt="Locations Management view"/> | <img src="docs/assets/notifications.png" width="400" alt="Notifications Center"/> |
| **System Settings** | **Knowledge Base** |
| <img src="docs/assets/settings.png" width="400" alt="System Settings view"/> | <img src="docs/assets/chorister.png" width="400" alt="Knowledge base"/> |
| **Locations Atlas (Map View)** | **Sheet Music Archive** |
| <img src="docs/assets/locations-atlas.png" width="400" alt="Locations Atlas map view — placeholder: replace with screenshot of the Google Maps-backed venue atlas"/> | <img src="docs/assets/archive-pieces.png" width="400" alt="Sheet music archive — placeholder: replace with screenshot of the repertoire archive (pieces, editions, recordings)"/> |

---

## 📊 Performance Budget & AI Cost Telemetry

The platform enforces explicit budgets at both the frontend (perceived performance) and backend (AI spend) layers. Numbers below are target ceilings measured in production.

### Frontend Lighthouse

The cinematic entry gate is bypassed with `?nogate` so the auditor measures the page itself, not the modal overlay.

| Route | Stack | Notes |
|---|---|---|
| `/` &nbsp;(homepage, sacred-minimalism rite) | Astro 6 static HTML + React islands | Once-per-session preloader, audio gate, donation Vault — islands hydrate only when needed. JS budget per page ≈ 80 kB gzipped. |
| `/koncerty`, `/o-nas`, `/kontakt` | Astro 6 static HTML + Vault island only | Server-rendered content, the donation Vault is `client:idle`; the Threshold gate and audio engine are scoped to `/`. |
| `/panel/*` | React 19 SPA (lazy-loaded) | `<EtherealLoader>` Suspense fallback; Maps SDK (~350 kB) scoped to logistics routes only. |

<sub>The Astro public site is built around the same foundation as the prior hand-authored landing — self-hosted variable fonts (zero third-party CDN), `scrollbar-gutter: stable` for layout stability, `transform`/`opacity`-only animation — and trades the SPA runtime tax for static HTML + selective hydration. AVIF/WebP responsive images via the Astro asset pipeline (1920px WebP fallback `<img src>`); ambient audio (`/ambient.m4a`) lazy-loaded only on `"voice"` choice.</sub>

**Render-time targets enforced regardless of route:**

| Metric | Target | Notes |
|---|---|---|
| **CLS** (Cumulative Layout Shift) | < 0.1 | Astro static HTML + `scrollbar-gutter: stable` + `contain` on full-viewport overlays keep the public site at effectively 0; the panel SPA holds < 0.1 via Suspense skeletons. |
| **INP** (Interaction to Next Paint) | ≤ 200 ms | |
| **JS bundle (gzipped, route-split)** | ≤ 180 kB per route chunk | Maps SDK (~350 kB) scoped to authenticated panel only |
| **Animation frame rate** | 60 FPS sustained | `transform` / `opacity` only |

### AI Score Compiler (Per-Piece Ingestion)

| Stage | Model | Avg. cost | Cache-read share |
|---|---|---|---|
| PDF metadata classification | Haiku 4.5 | ~$0.01 | _placeholder_ |
| Composer + work resolution (MusicBrainz / Wikidata) | Sonnet 4.6 | ~$0.04 | _placeholder_ |
| Program note + IPA + singing translation | Opus 4.7 | ~$0.13 | _placeholder_ |
| Provenance stamping + persistence | — (no LLM) | ~$0.02 (DB/API) | n/a |
| **End-to-end average per PDF** | mixed | **~$0.20** | ≥80% on repeat runs |

> Anthropic prompt caching (`cache_control: ephemeral`) is enabled on every tiered call, so cache-read tokens dominate after the first ingestion of a given piece — slashing marginal cost on re-runs and review iterations.

---

## 🚀 Quickstart (Local Infrastructure)

The project utilizes Docker Compose for a standardized development environment.

### Prerequisites
* Docker and Docker Compose (v2)
* GNU Make

### Initialization

1. **Clone the repository:**
   ```bash
   git clone https://github.com/bedikryst/voctmanager.git
   cd voctmanager
   ```

2. **Environment Configuration:**
   ```bash
   cp .env.example .env
   cp frontend/.env.example frontend/.env
   ```

3. **Orchestrate Infrastructure:**
   Using the provided Makefile for streamlined execution:
   ```bash
   make up
   ```

4. **Database Provisioning:**
   ```bash
   make migrate
   make seed
   make superuser
   ```

   **Seeder Details (`make seed`):**
   
   The seeder generates a rich, realistic test database for local development, demos, and QA. It covers all application contexts:
   - **logistics:** 5 locations (concert halls, church, studio, rehearsal room, tour stop)
   - **archive:** 10 composers, 10 pieces with movements, translations, recordings, score editions (PDF), audio tracks, program notes
   - **roster:** 28 singers (full vocal spectrum), 2 conductors, 5 collaborators (crew), 6 projects in every lifecycle state, castings, rehearsals, attendance, piece readiness
   - **documents:** Knowledge Base (categories + role-gated documents)
   - **messaging:** 1:1 threads (artist ↔ management), project channels with messages
   - **payments:** donations, patron leads
   - **notifications:** inbox items, push devices, delivery preferences
   
   The seeder is **idempotent** — re-running it does not duplicate data. Default login credentials:
   ```
   admin / admin123     (Administrator)
   manager / manager123 (Production Manager)
   ```
   
   **Available Flags:**
   ```bash
   python manage.py seed_db [OPTIONS]
   
   --artists N      number of singers to generate (default 28)
   --seed N         RNG seed for reproducibility (default 2026)
   --clear          hard-wipe previously-seeded data before re-seeding
   --no-media       skip generating files (audio, PDFs, documents) — faster
   --quiet          only print the final summary
   ```
   
   **Examples:**
   ```bash
   # Default — full dataset, 28 singers, placeholder media
   python manage.py seed_db
   
   # Small dataset without files (fast)
   python manage.py seed_db --artists 12 --no-media
   
   # Reset and reseed
   python manage.py seed_db --clear
   
   # Reproducible seed (same RNG → identical names/data)
   python manage.py seed_db --seed 2026
   ```

5. **Frontend Development Servers (Optional for UI engineering):**
   The two frontends are independent — run whichever surface you're building. They both proxy to the same Django backend.

   ```bash
   # Authenticated panel SPA (frontend/) — port 5173
   cd frontend && npm install && npm run dev

   # Public Astro site (web/) — port 4321
   cd web && npm install && npm run dev
   ```

   > For `web/` you must first place the source photos under `web/src/assets/photos/` (gitignored — they live on the build host only; see [`web/README.md`](web/README.md) §Conventions). The Astro build will throw a clear `[photos] No image …` error if a referenced photo is missing.

   * API Access: `http://localhost:8000/api/`
   * Panel SPA: `http://localhost:5173/panel`
   * Public Astro site: `http://localhost:4321`

### 📖 API Documentation
The backend provides fully interactive, automatically generated OpenAPI (Swagger) documentation. Once the containers are running, access it at:
👉 **[http://localhost:8000/api/docs](http://localhost:8000/api/docs)**

---

## 🚢 Production Deployment

Prod is single-command. `frontend/Dockerfile` is a **3-stage multi-stage build** rooted at the repo root:

```
panel-builder  (node:22-alpine) → frontend/ → /app/dist (Vite + React SPA)
web-builder    (node:22-alpine) → web/      → /app/dist (Astro + Sharp image pipeline)
runtime        (nginx:1.27)     → COPY from both → /usr/share/nginx/html/{app,marketing}
```

The nginx container therefore ships **both** the panel SPA and the Astro public site baked in — no `npm` on the host, no `web/dist` bind-mount.

```bash
# One-off, on first deploy (or whenever photos change):
mkdir -p ~/VoctManager/web/src/assets/photos/
# rsync / scp / sftp the original JPGs here — they are .gitignored and live
# only on the build host (collaborator-owned, 5-12 MB each).

# Every deploy:
cd ~/VoctManager
git pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml build frontend
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

**Build-host requirements:** Docker + Compose v2, ≥ ~3 GB free RAM during build (rollup graph for the panel SPA peaks at ~2 GB; Sharp for the Astro pipeline adds ~500 MB). No Node.js, no npm, no host-side lockfile. The root `.dockerignore` keeps `voct_data/`, `**/node_modules`, `.git`, etc. out of the build context so context transfer stays under a few MB. If the photos directory is missing or incomplete, the Astro stage fails fast with `[photos] No image "<name>"`.

---

## 👨‍💻 Engineering Leadership

**Krystian Bugalski**  
Software Engineer & UI/UX Specialist  
* [LinkedIn](https://www.linkedin.com/in/krystian-bugalski)  
* [GitHub](https://github.com/bedikryst)  

*Designed and engineered with strict adherence to the VoctManager 2026 AI directives and Ethereal design principles.*
