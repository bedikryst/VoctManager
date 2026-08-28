# Frontend performance — audit and remediation (2026-08)

Status: **open** — stages 1 and 2 shipped 2026-08-28, stages 3–6 outstanding ·
Audited 2026-08-28 · Surface: `frontend/` (panel PWA only; `web/` is out of scope).

Reported symptom: the panel "feels heavy", most visibly on a phone — the entrance of the
Spotlight text on the admin dashboard, and opening/closing the mobile menu.

Successor to the 2026-06 jank audit, whose conclusion still holds and must not be re-litigated:
the panel is **paint/composite-bound, not re-render-bound**, and the mandate is to cut invisible
cost while preserving the Ethereal look. That pass fixed `EtherealBackground`'s infinite breath,
`GlassCard`'s blanket `transform-gpu` + `will-change`, backdrop-blur on the `ethereal`/`dark`
in-flow tiles, hover box-shadow animation, and lazy locale bundles. Everything below is what it
did not reach, plus what has been added since.

## How to read this file

Six stages, ordered by (impact ÷ risk), not by section letter. Each stage is independently
shippable and touches files no other stage touches — they can be done in any order, in any
session, without merge pain. A stage is done when its **Exit** line is true.

The developer verifies every visual change in their own browser; `npm run typecheck` +
`npm run build` green is the automated bar (see the verification policy in `CLAUDE.md`).

---

## Measurements (2026-08-28, production build)

Taken so later passes can tell movement from noise. All raw unless marked gzip.

| Metric | Value |
|---|---|
| Eager boot payload (entry + modulepreload + CSS) | 816 KB raw · **339 KB gzip** |
| Largest eager chunk — `index` | 384 KB raw (was 326 KB after the 2026-06 pass) |
| `motion` (framer-motion) | 124 KB raw · 40 KB gzip |
| `index.css` | 215 KB raw · 26 KB gzip |
| Active locale bundle (lazy, 1 of 3) | 178–203 KB raw |
| **Service-worker precache** | **170 entries · 10 057 KiB** |
| …of which unreferenced marketing images | ~6 MB |
| `frontend/public/` on disk | ~44 MB (21.6 MB mp4 · 14.3 MB jpg · 11.8 MB mp3) |
| Google Maps SDK fetched on every `/panel/*` route | ~350–500 KB, third-party origin |

Two numbers are **not** measured yet and gate stage 5:

```js
// in the console, after the admin dashboard has settled
(localStorage.getItem('voctmanager-query-cache')?.length / 1024).toFixed(0) + ' KB'
```

and a 3-second Performance recording of "open menu → close menu" on a real phone.

---

## Stage 1 — animated `filter: blur()` and permanent backdrop-filter — **SHIPPED 2026-08-28**

**Why first:** this is the direct cause of the reported Spotlight symptom, it is surgical, and
it needs no architectural decision. `filter: blur()` is not a compositor property — every frame
of a blur animation is a full re-rasterisation of the layer through a gaussian kernel. Animating
it for 1.2 s on four elements at once is a guaranteed sub-30 fps window on a phone.

| # | Defect | Fix |
|---|---|---|
| 1.1 | `ArtifactCard.tsx` + `SpotlightProjectCard.tsx` each declare an identical `fadeUpVariant` animating `blur(8px) → blur(0px)` over 1.2 s with a 0.4 s delay. Four elements run it simultaneously (date · dot · location · "Maestro X") | One shared variant, `opacity` + `y` only, ~0.45 s, no delay. The soft-arrival reading survives; the per-frame cost does not |
| 1.2 | `VocalClefShadow.tsx` animates `blur(8px) → blur(5px)` **over 10 s** on a viewport-scale element under `mix-blend-overlay`, and settles at a permanent `blur(5px)` | Blur becomes a static CSS class; the variant animates `opacity` + `scale` only |
| 1.3 | `EtherealBackground.tsx` draws five stave lines at `duration: 10` inside a `300vh × 300vw` rotated container, during the exact window the dashboard is mounting | **Left alone — deliberately.** `scaleX` + `opacity` are compositor properties; the lines rasterise once and the ten seconds cost transform composites, not repaints. The defect in that subtree was the clef's blur keyframe (1.2), not the duration. Shortening the draw-in would have been a taste change dressed as a fix |
| 1.4 | `DashboardHome.tsx` loader/stage swap animates `blur(12px)` and `blur(8px)` | `opacity` (+ `scale` on exit) |
| 1.5 | `ArtistEmptyState.tsx`, `LocationPreview.tsx` popover — same `filter: blur` pattern at smaller radii | Same treatment |
| 1.6 | `ArtifactCard.tsx` background element: 800 × 800 px with `blur-[160px]`, inside a `mix-blend-overlay` wrapper. One of the most expensive single rasterisations in the app | Smaller box, smaller radius — same visible glow, a fraction of the kernel |
| 1.7 | `MetricBlock.tsx` `interactiveMode="glass"` carries `backdrop-blur-sm`, and its backdrop is the already-160px-blurred gradient above. It blurs a blur | Removed |
| 1.8 | `GlassCard variant="light"` carries `backdrop-blur-[4px]` and is used on **28 surfaces** (every settings card, most dashboard tiles). The 2026-06 pass removed blur from `ethereal`/`dark` for exactly this reason — blur over the near-flat ambient field re-samples nothing — and `light` was missed | Removed; the surface keeps its translucency |

**Exit — met.** `grep -rn 'filter:\s*"' frontend/src --include=*.tsx` returns nothing; the only
`backdrop-blur` left on a `GlassCard` variant is `surface`, which genuinely floats over a PDF.
Static blur on decorative layers and on floating overlays (palette, sheets, dropdowns, PDF
chrome) stays — settled in 2026-06.

The shared variant now lives in `ArtifactCard.tsx` as the exported `ARTIFACT_SLOT_REVEAL`, because
`metadataSlot` is filled by the caller and its children must speak the same hidden/visible words
as the card that orchestrates them. `EtherealEasing` was duplicated in both files and is gone —
`EASE.buttery` in `motion-presets.ts` is the same curve and already the SSOT.

**Needs the developer's eye** (three changes are visible by design, not invisible cost):
1. The Spotlight metadata + subtitle now arrive in ~0.45 s with no delay, instead of ~1.6 s with
   a blur. Intended reading: the same soft rise, arriving when the card does.
2. `ArtifactCard`'s corner bloom is a radial gradient rather than a blurred disc. Should be
   indistinguishable; if it reads harder, widen the middle stop, do not put the filter back.
3. `VocalClefShadow` standalone (the first-run welcome moment) now carries the same 5px softening
   as the orchestrated one. The old docblock claimed it "renders settled" while actually rendering
   sharp; the mark is now consistent across both call sites.

---

## Stage 2 — the mobile menu — **SHIPPED 2026-08-28**

**Why:** the second reported symptom. `MobileNavSheet` itself is well built (`contain: paint`,
no backdrop-filter on the moving subtree, spring on `y` alone) — the cost is entirely in what
surrounds it, and all three items land in the same frame as the opening spring.

| # | Defect | Fix |
|---|---|---|
| 2.1 | The scrim is `fixed inset-0` with `backdrop-blur-[4px]` **and** an animated `opacity`. Animating opacity on a backdrop-filter element re-flattens and re-blurs the whole viewport every frame — and the backdrop is `EtherealBackground` (two 110/120px-blurred blobs, `mix-blend-multiply`, a noise overlay). Behind a 45 % ink veil the blur is barely visible | Drop the blur; deepen the veil slightly if it needs to read as heavier |
| 2.2 | `MobileNavTrigger` bottom dock: `bg-ethereal-alabaster/94 backdrop-blur-md`. At 94 % opacity the blur is invisible, and a `backdrop-filter` on a `fixed` bar re-evaluates on every scroll frame of the content beneath | Removed. The dock's own comment claims the filter is "computed once and never re-rasterised"; that is true only if nothing scrolls behind it |
| 2.3 | `useBodyScrollLock` sets `overflow: hidden` on **both** `html` and `body` from a `useLayoutEffect` — a synchronous full-document relayout in the frame the spring starts. On close the lock released immediately while the sheet was still animating out (0.22 s), giving a second relayout mid-animation | The lock moved from `MobileNavigation` (driven by `isOpen`) into `MobileNavSheet` itself as `useBodyScrollLock(true)`. AnimatePresence keeps the sheet mounted until its exit ends, so the cleanup — and its relayout — now lands after the motion rather than inside it. No deferral machinery needed; the lock's lifetime simply became the sheet's. Acquiring stays in `useLayoutEffect` on purpose: batched with the mount's layout pass, and a frame of scrollable page behind an opening sheet is a real bug where a frame of extra relayout is not |
| 2.4 | `useCommandItems` built every project / artist / **whole-archive** row and called `foldSearchText` (NFD + regex) on each, inside a `useMemo` that depended on `query` — so every keystroke rebuilt all of it | Two memos: `sources` (rows, no `query`) then sections (matching only). The fold now happens once per data change instead of once per character |

**Exit:** opening and closing the sheet holds 60 fps on the developer's phone with the Frame
Rendering Stats overlay on; typing in the sheet's search field does not drop frames.
*Automated bar met (typecheck · lint · 168/168 vitest · build); the fps claim is the
developer's to confirm on device.*

**Needs the developer's eye:** the scrim went from `ink/45` + a 4px blur to a flat `ink/55`.
If the sheet no longer separates enough from the page behind it, deepen the veil further — do
not restore the `backdrop-filter`, which is the entire cost being removed here.

---

## Stage 3 — dead weight in `public/`

**Why:** one `rm`, no code, the largest single number in the audit. Zero risk once the
zero-reference claim is re-verified at execution time.

`frontend/public/` holds ~44 MB of assets from the pre-`web/` landing page — videos, session
photos, audio samples, 2 MB PNG logos. **Nothing in `frontend/src` references any of them**
(verified by filename grep, which also catches `/foo.png` string literals). They are not merely
inert: `vite.config.ts`'s `globPatterns` include `**/*.{svg,png,webp,ico}`, so every PNG and
WebP among them is precached by the service worker — ~6 MB of the 10 MB install.

| # | Action |
|---|---|
| 3.1 | Re-verify zero references (grep `src/`, `index.html`, `public/manifest.webmanifest`, and `web/` in case anything was shared), then delete. Keep `icons/`, `fonts/`, `manifest.webmanifest`, and anything the manifest or `index.html` names |
| 3.2 | Narrow `globPatterns` so the precache lists what the app ships, not whatever lands in `public/` — a future stray asset should not silently join the install |
| 3.3 | Delete the dead Lenis CSS block in `panel.css`, drop `lenis` from `manualChunks` in `vite.config.ts`, and uninstall the package. It has zero imports in `src/` |

**Exit:** `precache N entries (…KiB)` in the build log is ≈ 4 MB; `du` on `frontend/public/`
is under 1 MB; `grep -r lenis frontend/src` is empty.

---

## Stage 4 — Google Maps off the boot path

**Why:** the largest network + main-thread win, and the one that needs actual care with routing.

`App.tsx` mounts `<APIProvider>` as the route element wrapping `<ProtectedRoute />`, i.e. the
whole `/panel/*` tree. `APIProvider` injects the Google Maps JS API as soon as it mounts, so
every panel surface — the dashboard on a phone included — downloads and executes ~350–500 KB of
third-party JS plus the `places` and `geocoding` libraries. The comment in `index.html` claims
the SDK loads "on demand when a panel route renders"; it does, for every panel route.

No map is even on screen on the dashboard: `LocationPreview` renders a `<Map>` only inside its
portalled popover, which most sessions never open.

| # | Action |
|---|---|
| 4.1 | Establish who genuinely needs the SDK: `LocationPreview` (popover), `LocationsAtlas`, `LocationMapPicker`, `LocationAutocomplete` |
| 4.2 | Replace the blanket route-level provider with a provider mounted on demand — the honest shape is a small `MapsProvider` that the four consumers opt into, so the SDK arrives when a map is actually about to render, not when a session starts |
| 4.3 | Correct the stale claims in the `index.html` comment and in `App.tsx`'s `RootLayout` docblock |

**Exit:** a fresh dashboard load on a phone issues **no** request to `maps.googleapis.com`;
opening a location popover still shows a working map.

---

## Stage 5 — the synchronous query persister

**Why:** likely the largest remaining main-thread cost, but it is the one finding that is
**inferred, not measured** — do not rewrite anything before the number is in.

`queryPersistence.ts` uses `createSyncStoragePersister` over `window.localStorage` with
`throttleTime: 2000`. Whenever the cache is dirty, the entire React Query cache is
`JSON.stringify`d and written **synchronously on the main thread**, at most every 2 s. For a
manager that cache holds all projects, all artists, the whole piece archive, rehearsals and the
materials read-models. Blobs are already excluded (`shouldDehydrateQuery` in `main.tsx`);
nothing else is.

| # | Action |
|---|---|
| 5.1 | Measure first — the console snippet at the top of this file, on a real manager account with a warm cache. Under ~150 KB this stage is not worth doing; over ~300 KB it is the top priority in the file |
| 5.2 | If it is large: move to an async persister (IndexedDB) so the write leaves the main thread, and/or narrow `shouldDehydrateQuery` to the queries that carry real offline value. Offline-first for choristers on the way to rehearsal is the requirement the persister exists for (`docs/` + the file's own docblock) — do not weaken it for managers' bulk collections without saying so |
| 5.3 | Independently: the admin dashboard blocks its first paint on `ArchiveService.getPieces()` (`useAdminDashboardData.ts`) purely to render `pieces.length`. Either serve the count from the backend or move that query outside the `isLoading` gate |

**Exit:** a 3-second Performance recording of idle-with-data on the dashboard shows no
recurring long task attributable to `setItem`.

---

## Stage 6 — entrance chain, fonts, leftovers

**Why last:** each item is small, and several are judgement calls about feel that are better
made once the frames underneath them are cheap.

| # | Defect | Fix |
|---|---|---|
| 6.1 | The admin dashboard nests **four** opacity animations: shell route transition (0.22 s) → `DashboardHome` stage (0.40 s) → `PageTransition` (0.50 s) → Spotlight (0.40 s delay + 1.20 s). Text is fully readable ~2.0 s after the route change, and three overlapping fades are three compositor layers multiplying their alpha | Keep one. `PageTransition` is redundant inside the panel — the shell already transitions routes — and `DashboardHome`'s stage fade duplicates it again. Audit all 23 `PageTransition` call sites for the same double-wrap |
| 6.2 | `DURATION.base = 0.8 s` presents itself as the panel's baseline transition. It is outside the perceptual budget for UI motion (0.2–0.3 s) | Rebase, or retire the constant with the dead variants below |
| 6.3 | `MENU_PANEL_VARIANTS`, `STAGGERED_REVEAL_VARIANTS`, `FADE_UP_VARIANTS`, `etherealFadeInVariants`, `SLOW_TRANSITION` in `motion-presets.ts` have no importers | Delete |
| 6.4 | `index.html` preloads both Plex Sans subsets (with a good reason recorded in its comment) but **no Cormorant subset beyond `latin`**. Headings, `Metric`, `Emphasis` and `Unit` are all serif, and Polish needs `CormorantGaramond-Variable.latin-ext`; `Emphasis`/`Unit` need the italic file. With `font-display: swap` that is a second reflow landing on exactly the Spotlight card | Preload the Cormorant subsets the panel actually draws with, or give the fallback matching metrics so the swap does not shift |
| 6.5 | 71 surviving `transition-all` (the property-animating footgun the 2026-06 sweep left behind on small elements) and 22 `animate-pulse` | Opportunistic; only where a hot list or a hover surface is involved |

**Exit:** no judgement — this stage is done when the developer says the feel is right.

---

## Decisions, settled

- **Preserve the look.** Every fix here removes cost that is invisible or near-invisible at rest.
  If a change is visible, it is called out as such and is the developer's call, not the agent's.
- **Static blur stays.** Blur is only a problem when it is *animated* or when it is a
  `backdrop-filter` on a surface that is permanently mounted over scrolling content. Decorative
  static blur and transient floating overlays keep theirs (settled 2026-06, unchanged).
- **The scroll lock stays.** It is load-bearing: the shell root is `min-h-screen`, so `<html>` is
  the document scroller and locking `<body>` alone leaves tall pages scrollable behind overlays.
  Stage 2 changes *when* it releases, not whether.
- **Offline-first is not negotiable in stage 5.** The persister exists so a chorister with no
  signal opens to data, not a spinner. Any narrowing must keep that true.
- **Not re-audited:** backend query efficiency (2026-06: `select_related`/`prefetch` widespread,
  CQRS read-models, dashboard serializer reads only prefetched lists — it was already clean), and
  React re-render volume (2026-06 established the panel is paint-bound, not render-bound).
