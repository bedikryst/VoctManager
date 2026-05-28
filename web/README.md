# 🌅 VoctEnsemble / VoctFoundation — Public Site (Astro)

🌍 *Read this in other languages: [English](README.md), [Polski](README.pl.md).*

![Astro 6](https://img.shields.io/badge/Astro_6.3-%23BC52EE.svg?style=for-the-badge&logo=astro&logoColor=white)
![React 19](https://img.shields.io/badge/React_19-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)
![TypeScript 6](https://img.shields.io/badge/TypeScript_6-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)
![View Transitions](https://img.shields.io/badge/View_Transitions-API-c6a45b?style=for-the-badge)

This directory contains the source code for the **public marketing site** of VoctEnsemble (voctensemble.com / .pl) and VoctFoundation (voctfoundation.pl / .com / .org) — all five domains resolve to the same Astro build. The site is an art-directed sacred-minimalism landing in the spirit of *"Nawa światła"*: hand-authored CSS, art-directed images, sparse React islands for the genuinely stateful pieces (donation Vault, audio Threshold gate, header chrome). Built as a separate app from the panel SPA at [`../frontend/`](../frontend/); both share the Django backend at `/api/*`.

> **Why Astro and not the SPA?** The panel CSR shell was a SEO/perf regression for a charity site chasing Google Ad Grants. Astro gives crawlable static HTML + native View Transitions + selective hydration — Awwwards-grade transitions without the empty-`#root` shell. Decision locked 2026-05-27; rationale archived in `MEMORY.md` (`project_react_landing_migration`).

---

## 🎨 Design Mandate — Art-Directed, *Not* Ethereal

This site is **NOT subject to the project-root `CLAUDE.md` No-Raw-HTML / Tailwind / Ethereal-tokens mandate.** It is a hand-authored sacred-minimalism landing in the spirit of the original `LandingPage.html` (see `MEMORY.md` → `project_landing_page_html`). Raw `<h1>`, `<p>`, custom CSS, manual gradients — all welcome. The only rules are:

* **Newest 2026 tech, zero tech-debt.**
* **GDPR-strict:** no Google Fonts, no Maps, no Spotify embeds, no reCAPTCHA, no analytics that ship a cookie. Self-host everything (fonts under `public/fonts/`, ambient audio under `public/ambient.m4a`).
* **Awwwards baseline:** every interactive surface must be hardware-accelerated (`transform` / `opacity`), respect `prefers-reduced-motion`, and degrade gracefully without JavaScript.
* **Creative direction:** *Nawa światła* — sacred minimalism, A-B-C braid, LIGHT parchment palette. The full spec lives in `.ai/07_marketing_public_site.md` §10 and governs every subpage.

---

## 🏗️ Architecture

```text
web/
├── astro.config.mjs   ← Astro config (build.format: "file", React integration, prefetch)
├── public/            ← Served verbatim at the site root
│   ├── fonts/         #   Self-hosted Cormorant Garamond + Inter + IBM Plex Mono (woff2, OFL)
│   ├── ambient.m4a    #   Sacred ambient track (gated behind the Threshold choice)
│   ├── docs/          #   Static PDFs (Statut, regulamin)
│   ├── donation-progress.json  # Tier progress data (read by the Vault island)
│   ├── polityka-prywatnosci.html  # Self-contained privacy policy (static HTML)
│   ├── robots.txt / sitemap.xml    # SEO; sitemap is hand-curated (5 URLs)
│   └── logo_icon.png / logo-mark.png / qr-bank.png  # Brand + payment assets
│
└── src/
    ├── pages/         ← Astro file-based routing (build.format: "file")
    │   ├── index.astro    # / — landing (full sacred-minimalism choreography)
    │   ├── koncerty.astro # /koncerty — concert stations + 5-century repertoire
    │   ├── o-nas.astro    # /o-nas — ensemble identity, director, partners
    │   └── kontakt.astro  # /kontakt — channels-only (form pulled pending RODO; backend ready)
    │
    ├── layouts/
    │   └── BaseLayout.astro  # <head> + SEO/OG + ClientRouter + Lenis + reveal/parallax
    │
    ├── components/    ← Astro components (zero JS unless explicitly hydrated)
    │   ├── BleedImage.astro      # Art-directed full-bleed <picture> (AVIF + WebP + parallax)
    │   ├── SiteChrome.astro      # Shared marketing header (light/dark tone variants)
    │   ├── SiteFooter.astro      # Static footer (KRS/NIP/REGON, channels, sitemap)
    │   └── landing/              # The 9 landing sections (Hero, Manifest, Ensemble, …)
    │
    ├── islands/       ← React islands — hydrate only the genuinely stateful pieces
    │   └── landing/
    │       ├── Preloader.tsx       # Opening rite (once-per-session, sessionStorage gated)
    │       ├── ThresholdGate.tsx   # "Enter in silence / with voice" — localStorage, 3h TTL
    │       ├── AudioController.tsx # Always-mounted owner of useChantAudio (WebAudio analyser)
    │       ├── StickyHeader.tsx    # Adaptive tint chrome — owns audio toggle + Wesprzyj
    │       ├── SiteCursor.tsx      # Custom cursor (desktop only, fine pointer)
    │       ├── SiteFooter.tsx      # Footer wordmark cursor reactivity
    │       ├── BrandGlyph.tsx      # Shared mask-based gold candle mark
    │       ├── VaultIsland.tsx     # Donation funnel — Vault + Regulamin + Gratitude + Failure
    │       └── vault/, hooks/, lib/, api/, providers/, constants/
    │
    ├── scripts/       ← Plain-TS scripts loaded by pages
    │   ├── landing.ts        # Cross-browser kinetic typography + reveal/parallax/rite-glow
    │   └── vault-triggers.ts # Capture-phase document delegate for [data-vault-open]
    │
    ├── styles/
    │   ├── tokens.css        # CSS custom-property design tokens (--candle, --ink, --paper…)
    │   ├── base.css          # Global reset, fonts, reveal, View Transitions, brand-glyph
    │   ├── landing.css       # Landing-only — sacred-minimalism choreography (large, intentional)
    │   └── vault.css         # Donation modals — extracted for subpage import
    │
    ├── data/landing/  ← Hand-curated content modules (TS, not collections — small + typed)
    │   ├── manifestLines.ts  #   Three-stanza ensemble manifest
    │   └── paths.ts          #   Six concert stations (poster + Spotify + meta)
    │
    ├── content.config.ts  # Astro Content Collections schema (concerts + repertoire)
    │
    ├── content/       ← Source-of-truth YAML for the team to edit
    │   ├── concerts/         #   Per-station YAML (one file per concert) — koncerty.astro reads this
    │   └── repertoire/       #   Five eras of sacred repertoire (Renaissance → contemporary)
    │
    ├── lib/photos.ts  # Extension-agnostic image lookup; `photo("name")` + `bleedPair("base")`
    └── assets/photos/ ← Hero/portrait originals (gitignored — uploaded to build host manually)
```

> **`entities/` is intentionally omitted.** This is not an FSD codebase — it's an Astro site where domain content lives in YAML collections or hand-curated TS modules.

---

## 🌬️ Kinematics & Motion System

* **Astro `<ClientRouter />`** — native View Transitions API powers cross-page swaps. Cinematic root fade (320ms out / 540ms in) + shared `view-transition-name: voct-brand` so the candle mark morphs continuously between pages. Sacred tone, hardware-accelerated, zero JS.
* **Reveal pipeline** — `.reveal` (+ `data-d="1..4"` stagger) hidden via `html.reveal-ready` (inline head script with `data-astro-rerun` so it re-arms on every ClientRouter swap), IntersectionObserver toggles `.is-in`. Above-the-fold animates on load, persists once revealed.
* **Parallax** — JS-driven via `data-parallax="0.16"` (and optional `data-parallax-scale="1.5"` for scaled inset:0 layers). Native `animation-timeline` is still partial in Firefox/Safari, so we drive a single rAF scroll loop in `BaseLayout` instead.
* **Manifest raking light** — text-emanating glow (gold textShadow bloom + variable-font `wght` axis breath 320 → 480 peak → 360 settled + per-word stagger 28ms apart). No backdrop shaft — "sacrum nie zdobi, odsłania".
* **Lenis v1.3+** — window-level smooth scroll, mounted in BaseLayout. Fine-pointer + motion-allowed only. Re-anchored on `astro:after-swap`.

---

## 🏝️ Cross-Island Communication

Each Astro island is a **separate React root** — context providers from one don't reach the other. State that must cross island boundaries travels over `window` CustomEvents:

| Event | Direction | Payload | Owner |
|:---|:---|:---|:---|
| `voct:open-vault`   | header / footer / CTA → `VaultIsland`           | `{ amount?: number }` | `VaultIsland.VaultBridge` |
| `voct:toggle-audio` | `StickyHeader` → `AudioController`              | (none)                 | `AudioController` |
| `voct:audio-state`  | `AudioController` → `StickyHeader` (and any)    | `{ isOn: boolean }`    | `AudioController` (broadcaster) |

`window.__voctAudioOn` mirrors the audio state for race-proof reads (e.g. StickyHeader mounting after the controller).

---

## 🛣️ Routing, Cutover & nginx

* **Pages are static.** `build.format: "file"` emits `index.html`, `koncerty.html`, `kontakt.html`, `o-nas.html` to `dist/`. Production nginx (`../infra/nginx/prod.conf`) routes `try_files /<page>.html` for each clean URL.
* **`/_astro/*`** is content-addressed and served with `Cache-Control: public, max-age=31536000, immutable`.
* **`/home` legacy** — old SPA preview path; permanently redirects to `/` via nginx.
* **`docker-compose.prod.yml`** mounts this directory's `dist/` as `/usr/share/nginx/html/marketing:ro`. The build must run on the host (or in CI) — the container does not bundle Node.

---

## 🔌 Backend Surface

Two endpoints are consumed:

* **`POST /api/payments/donations/initiate/`** — Axepta hosted-link redirect. The Vault initiates the donation, the gateway returns `?donated=success|failure` and the result modal self-triggers.
* **`POST /api/contact/`** (since 2026-05-25) — public contact form (Django `contact` app). Currently surfaced as channels-only on `/kontakt`; form is pending a final RODO review.

`/donation-progress.json` is served as a static asset from `public/`, not from Django — the tier display refreshes on page load only.

---

## 🚦 Conventions & Code Guidelines

* **Photos live outside the repo.** `src/assets/photos/` is `.gitignore`d (`web/.gitignore`) — originals are 5-12 MB JPGs and belong to the artists. Upload them manually to the build host before `npm run build`. `lib/photos.ts` resolves them by bare name (`photo("chor-poklon")`, `bleedPair("koncerty-hero")`).
* **Full-bleed images** go through `<BleedImage desktop mobile alt position … />` — it emits AVIF + WebP at responsive widths with a 1920px WebP fallback `<img src>`. In-flow images use Astro's `<Picture>`.
* **No external CSS frameworks.** Tokens in `tokens.css`, primitives in `base.css`, art-directed CSS per page or section. Tailwind is *not* installed here.
* **No `any`.** Strict TypeScript. The `astro check` gate must stay at `0 errors / 0 warnings`.
* **File header comment** required on every new file (project-root `CLAUDE.md` §5 still applies for documentation discipline, even though styling rules don't).

---

## 🛠️ Available Scripts

Run from the `web/` directory:

| Command | Description |
|:---|:---|
| `npm run dev`     | Astro dev server with HMR (default port `4321`). The Dev Toolbar appears at the bottom of the page — **dev-only**, not present in builds. |
| `npm run build`   | Type-check + production build into `dist/`. Image pipeline (Sharp) runs here. |
| `npm run preview` | Serve `dist/` locally — the canonical way to verify production behaviour (caching, fonts, View Transitions). |
| `npm run check`   | `astro check` — TypeScript + Astro diagnostics. Required to stay 0/0 before merge. |

---

## 📦 Key Dependencies

* **Core:** `astro@6.3+`, `@astrojs/react@5+`, `react@19`, `react-dom@19`, `typescript@6`
* **Motion:** `lenis@1.3+` (window smooth-scroll only)
* **Tooling:** `@astrojs/check`

---

## 🔐 Privacy & Browser Storage

The site does not set first-party cookies, ship analytics, or embed third-party trackers. Browser storage is limited to a few strictly-necessary functional entries (documented in `public/polityka-prywatnosci.html` §10):

| Key | Storage | Purpose | Lifetime |
|:---|:---|:---|:---|
| `voct.demo.audio` | localStorage | Threshold choice (silence / voice) | 3 hours |
| `voct.preloader.seen` | sessionStorage | Skip the opening rite on intra-session returns | tab close |
| `voct.preloader.last-load` | sessionStorage | Distinguish reload from ClientRouter swap | tab close |

Payment-gateway scripts (BNP Paribas Axepta / PayU) load only when the user enters the donation funnel; cookies they set are strictly necessary for the transaction (PSD2 SCA, fraud detection).

---

*Designed and engineered for VoctEnsemble / VoctFoundation by Krystian Bugalski — Astro public site, sacred-minimalism build.*
