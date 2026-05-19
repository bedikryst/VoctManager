# ⚛️ VoctManager – Frontend Application

🌍 *Read this in other languages: [English](README.md), [Polski](README.pl.md).*

![Vite 7](https://img.shields.io/badge/Vite_7-%23646CFF.svg?style=for-the-badge&logo=vite&logoColor=white)
![React 19](https://img.shields.io/badge/React_19.2-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)
![TypeScript 5.9](https://img.shields.io/badge/TypeScript_5.9-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)
![Tailwind v4](https://img.shields.io/badge/Tailwind_v4.2-%2338B2AC.svg?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Framer Motion v12](https://img.shields.io/badge/Framer_Motion_v12-black?style=for-the-badge&logo=framer&logoColor=blue)
![TanStack Query v5](https://img.shields.io/badge/TanStack_Query_v5-FF4154?style=for-the-badge&logo=react-query&logoColor=white)

This directory contains the source code for the Single Page Application of the **VoctManager** platform. The codebase is engineered around three non-negotiable goals: **strict Feature-Sliced Design**, **zero-layout-shift UX at 60 FPS**, and **aggressive server-state caching** via TanStack Query.

---

## 🏗️ Architecture — Feature-Sliced Design (FSD)

The frontend strictly follows the [Feature-Sliced Design](https://feature-sliced.design/) methodology. Imports flow **downward only** — a higher layer may import from layers below it, never sideways or upward. This guarantees domain isolation and prevents the classic "everything imports everything" decay of large React codebases.

```text
src/
├── app/              ← Application shell (highest layer)
│   ├── providers/    # Top-level providers (AuthProvider, CSRFProvider, CursorProvider)
│   ├── router/       # Route guards (ProtectedRoute, ManagerRoute) + panel data preloaders
│   ├── store/        # App-level Zustand store (useAppStore)
│   └── styles/       # Global Tailwind v4 layer + Ethereal/marketing design tokens
│
├── pages/            ← Route-level compositions
│   ├── auth/         # Login, password reset, account activation
│   ├── marketing/    # Public landing (HomePage.tsx — React port of LandingPage.html)
│   └── panel/        # Authenticated ERP panel routes
│
├── widgets/          ← Composite UI blocks built from features + shared
│   ├── domain/       # Cross-feature domain widgets (dashboards, summary cards)
│   ├── landing/      # Landing-only widgets (HeroSection, AetherInterlude, VaultModal…)
│   ├── panel-shell/  # Panel chrome (sidebar, navbar, breadcrumbs)
│   └── utility/      # Generic widgets (error boundaries, empty states)
│
├── features/         ← Self-contained domain slices
│   ├── archive/      # Repertoire archive (pieces, editions, recordings)
│   ├── artists/      # Roster, profiles, voice parts
│   ├── auth/         # Authentication flows + JWT lifecycle
│   ├── chorister-hub/# Knowledge base + artist identity metrics
│   ├── contracts/    # Contract generation & WeasyPrint download
│   ├── crew/         # Stage crew, technical staff
│   ├── dashboard/    # Bento dashboard data hooks
│   ├── landing/      # Landing hooks/providers (useChantAudio, VaultContext…)
│   ├── logistics/    # Locations, travel, venue management
│   ├── materials/    # Sheet music + reference audio distribution
│   ├── notifications/# Web push (VAPID) + transactional email log
│   ├── projects/     # Concert projects, casting, run sheets
│   ├── rehearsals/   # Rehearsal scheduling + attendance
│   ├── schedule/     # iCal sync, calendar feed
│   ├── score-compiler/# AI Score Package Compiler UI (NEW)
│   └── settings/     # User & system settings
│
└── shared/           ← Reusable building blocks (lowest layer)
    ├── api/          # Axios client, interceptors, generated OpenAPI types
    ├── assets/       # Static assets (audio samples, illustrations)
    ├── auth/         # JWT decode, session helpers
    ├── config/       # i18n setup + centralized locales, navigation manifest
    ├── hooks/        # Cross-domain hooks (useDebounce, useMediaQuery…)
    ├── lib/          # Pure utilities (date, currency, file helpers)
    ├── types/        # Global TypeScript types
    └── ui/
        ├── primitives/    # Atomic primitives (Button, Input, Heading, Text…)
        ├── composites/    # Composed UI (GlassCard, PageHeader, MetricBlock…)
        └── kinematics/    # Motion primitives (PageTransition, EtherealLoader…)
```

> **Note:** the `entities/` layer is intentionally omitted. Domain entities live alongside their owning feature (`features/<domain>/types/`), keeping the dependency graph flatter without sacrificing FSD discipline.

---

## 🧠 State Management Strategy

The application strictly separates state into **server state** and **client state** — they are never mixed.

### 1. Server State — TanStack Query v5.91+

All asynchronous data (projects, roster, archive, score compiler results) flows through `@tanstack/react-query`. Each feature owns its query hooks under `features/<domain>/hooks/`.

- **Optimistic UI:** mutations (casting changes, attendance confirmation, archive edits) update the cache immediately, then reconcile on server response. Failures roll back transparently.
- **Stale-while-revalidate** defaults keep the UI responsive while background refetches stay invisible to the user.
- **Query keys are domain-scoped** (`["archive", "piece", pieceId]`) so cross-feature invalidations stay surgical.

### 2. Client State — Zustand v5+

Used **only** for global UI state that cannot reasonably live in URL or context: slide-over panel visibility, ephemeral form drafts, user preferences. Stores live under `app/store/` (app-wide) or `features/<domain>/store/` (domain-scoped).

> **Rule of thumb:** if a piece of state comes from the API, it belongs to TanStack Query. Everything else is either local component state or — if it must be shared — a small Zustand slice.

---

## 🎨 Styling, Kinematics & Design System

1. **Tailwind CSS v4.2+** — utility-first; the entire Ethereal design system (color tokens, z-index scale, shadows, noise utility) is defined in [`app/styles/index.css`](src/app/styles/index.css). Raw HTML typography and ad-hoc glassmorphism (`bg-white/10`) are **prohibited** — see the project-root `CLAUDE.md` for the No-Raw-HTML mandate.
2. **Framer Motion v12+** — all declarative entrance animations, gestures, and scroll-linked kinematics. Animations are restricted to `transform` and `opacity` only, ensuring hardware acceleration and a sustained 60 FPS.
3. **Lenis v1.3+** — smooth scrolling at the window level, mounted via `<ReactLenis root>` on the marketing landing. Lenis ticks are synchronized with React's render cycle so Framer Motion springs stay physically coherent.
4. **Radix UI Primitives** — accessible foundations for Dialog, Tooltip, Switch, Slot. Combined with semantic HTML to meet the European Accessibility Act baseline.

---

## 🛣️ Routing & Code-Splitting

The route table lives in [`app/App.tsx`](src/app/App.tsx) using **React Router v7**; access guards (`ProtectedRoute`, `ManagerRoute`) and idle panel-chunk preloaders live in [`app/router/`](src/app/router/). Every panel route is lazy-loaded behind a `<Suspense>` boundary that renders `<EtherealLoader>` — never a generic spinner. Public marketing routes (`/`, `/home`) and auth routes resolve against an outer `<Suspense fallback={null}>` so the SaaS loader never flashes on public surfaces. This keeps the initial JS bundle small and guarantees a stable, on-brand loading state.

---

## 🌍 Internationalization

The platform ships with **i18next v26** + `react-i18next` v17, supporting English, French, and Polish. Translations are centralized in [`shared/config/locales/{en,fr,pl}/translation.json`](src/shared/config/locales/) and loaded synchronously at boot (no Suspense flash). Language is resolved via `localStorage` → browser default, with `pl` as fallback. Keys are re-extracted via:

```bash
npm run extract-i18n
```

---

## 🚦 Conventions & Code Guidelines

* **Named exports only.** Default exports are reserved for page components (the convention React Router expects).
* **No `any`.** Strict TypeScript across the codebase; types either come from `shared/types/`, generated OpenAPI types in `shared/api/`, or feature-local `types/` folders.
* **No raw HTML typography.** Use `<Heading>`, `<Text>`, `<Eyebrow>`, `<Metric>` from `shared/ui/primitives/typography/`.
* **No magic Tailwind values.** Use Ethereal tokens (`text-ethereal-gold`, `z-nav-dock`, `shadow-glass-ethereal`) defined in `app/styles/index.css`.
* **React list keys** must be stable database identifiers (`artist.id`), never array indices — prevents UI corruption during soft-deletion and reordering.
* **File header comment** required on every file (see project-root `CLAUDE.md` §5).
* **Environment variables** — copy `.env.example` to `.env` and point `VITE_API_URL` at your backend origin (default: `http://localhost:8000`; the `/api/` suffix is appended by the Axios client).

---

## 🛠️ Available Scripts

Run from the `frontend/` directory:

| Command | Description |
|:---|:---|
| `npm run dev` | Vite dev server with HMR (default port `5173`). |
| `npm run build` | Type-check + production build into `dist/`. |
| `npm run build:analyze` | Production build with `rollup-plugin-visualizer` bundle report. |
| `npm run preview` | Serve the `dist/` build locally for pre-deploy verification. |
| `npm run lint` | ESLint with `typescript-eslint` + `react-hooks` rules. |
| `npm run extract-i18n` | Re-extract translation keys via `i18next-cli`. |

---

## 📦 Key Dependencies (versions in `package.json`)

* **Core:** `react@19.2`, `react-dom@19.2`, `react-router-dom@7`, `vite@7.3`, `typescript@5.9`
* **State & data:** `@tanstack/react-query@5.91+`, `zustand@5+`, `axios@1.13+`
* **UI / motion:** `framer-motion@12+`, `lenis@1.3+`, `@radix-ui/react-*`, `lucide-react`
* **Forms & validation:** `react-hook-form@7.74+`, `zod@4.3+`, `@hookform/resolvers@5+`
* **Interaction:** `@dnd-kit/core@6+`, `@dnd-kit/sortable@10+` (TouchSensor-ready)
* **PDF & maps:** `react-pdf@10+`, `@vis.gl/react-google-maps`
* **i18n:** `i18next@26+`, `react-i18next@17+`
* **PWA:** `vite-plugin-pwa@0.21+`, `workbox-precaching@7+`

---

*Designed and engineered for VoctEnsemble by Krystian Bugalski — VoctManager 2026 / Ethereal Design System.*
