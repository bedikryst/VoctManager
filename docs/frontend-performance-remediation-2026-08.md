# Frontend performance — audit and remediation (2026-08)

Status: **open** — stages 1–5 shipped 2026-08-28, stage 6 part-shipped (6.1 in, 6.2/6.4/6.5 out) ·
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

| Metric | Before | After stages 3–4 |
|---|---|---|
| Eager boot payload (entry + modulepreload + CSS) | 339 KB gzip | **326 KB gzip** |
| Largest eager chunk — `index` | 384 KB raw | 394 KB raw |
| `motion` (framer-motion) | 124 KB raw · 40 KB gzip | unchanged |
| `index.css` | 215 KB raw · 26 KB gzip | unchanged |
| Active locale bundle (lazy, 1 of 3) | 178–203 KB raw | unchanged |
| **Service-worker precache** | **170 entries · 10 057 KiB** | **160 entries · 5 216 KiB** |
| …of which unreferenced marketing images | ~6 MB | 0 |
| `frontend/public/` on disk | ~44 MB | **472 KB** |
| Google Maps SDK on a dashboard load | ~350–500 KB, third-party | **not fetched** |
| `@vis.gl` wrapper in the dashboard chunk | 38 KB raw · 12.5 KB gzip | **not in it** |

The eager-payload row is the one to read carefully: the old raw figure (816 KB) is not
reproducible and was probably taken over a partial file list — the gzip number is the
comparable one. Stage 4's win is mostly invisible to it, because what left the boot path was a
third-party script the bundler never counted.

**The stage-5 gate, measured 2026-08-28: 320 KB.** A manager's dehydrated cache,
warm, read off `localStorage.getItem('voctmanager-query-cache')`. That is above the 300 KB
line the stage set for itself, so it ran — see stage 5.

Still not measured: a 3-second Performance recording of "open menu → close menu" on a real
phone (stage 2's exit), and the idle-with-data recording that closes stage 5's exit.

The snapshot now lives in IndexedDB, so the successor to that one-liner is:

```js
// top queries by weight, against the new store
indexedDB.open('voctmanager-query-cache').onsuccess = (e) => {
  e.target.result.transaction('snapshots').objectStore('snapshots').get('client')
    .onsuccess = (r) => {
      const c = JSON.parse(r.target.result);
      console.log((r.target.result.length / 1024).toFixed(0) + ' KB total');
      console.table(c.clientState.queries
        .map((q) => ({ key: JSON.stringify(q.queryKey),
                       kb: +(JSON.stringify(q).length / 1024).toFixed(1) }))
        .sort((a, b) => b.kb - a.kb).slice(0, 12));
    };
};
```

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

## Stage 3 — dead weight in `public/` — **SHIPPED 2026-08-28**

**Why:** one `rm`, no code, the largest single number in the audit.

`frontend/public/` held ~44 MB of assets from the pre-`web/` landing page — videos, session
photos, audio samples, 2 MB PNG logos. `vite.config.ts`'s `globPatterns` included
`**/*.{svg,png,webp,ico}`, so every PNG and WebP among them was precached by the service
worker — ~6 MB of the 10 MB install, confirmed against the built `sw.js`.

| # | Action | Outcome |
|---|---|---|
| 3.1 | Re-verify zero references, then delete | Done — with one correction below |
| 3.2 | Narrow `globPatterns` to what the app ships | Done — and it uncovered a real offline defect |
| 3.3 | Delete the dead Lenis CSS block, drop `lenis` from `manualChunks`, uninstall | Done |

**The audit's zero-reference claim was wrong in one place.** `DesktopSidebar.tsx:153` draws
`/logo_gold.png` — the collapsed sidebar's brand mark. Worse, that file was **gitignored**, so
it existed only on the author's disk: `npm run dev` on a fresh clone showed a broken image, and
production rendered a mark only because `infra/nginx/prod.conf` serves `*.png` marketing-first
and the Astro site ships a file of the same name. It is now tracked via a `.gitignore` negation
next to the PWA icons, and the panel no longer depends on that coincidence.

**The `globPatterns` narrowing found the inverse defect.** The old list matched `**/*.js` but
never `.mjs`, and react-pdf's worker emits as `pdf.worker.min-*.mjs` — so the one asset the 5 MB
per-file cap was raised for was the one asset missing from the install, and the offline score
viewer had nothing to run. It is precached now. That is why the precache lands at 5.2 MB rather
than the ≈4 MB this stage predicted: ~6 MB of images left and ~1.1 MB of worker arrived.

**The bulk was untracked, so `git` cannot restore it.** The ~44 MB of media is gitignored —
`git status` was clean with all of it on disk — which also means it was never in a clone, never
in the Docker context, and never in a *production* precache. The 10 MB install was the local
build's. Rather than `rm`, the media was moved to
`C:\Users\kryst\Moje aplikacje\VoctManager-attic-2026-08-28\` — some of it is session
photography with no second copy in `web/src/assets/`. **Delete that folder by hand once you have
looked at it.** The two `samples/*.mp3` (11.8 MB) and `vite.svg` *were* tracked and were removed
with `git rm`; those are recoverable from history.

**Exit — met.** `du frontend/public` = 472 KB; precache 160 entries · 5 216 KiB;
`grep -r lenis frontend/src` is empty.

---

## Stage 4 — Google Maps off the boot path — **SHIPPED 2026-08-28**

**Why:** the largest network + main-thread win, and the one that needed actual care with routing.

`App.tsx` mounted `<APIProvider>` as the route element wrapping `<ProtectedRoute />`, i.e. the
whole `/panel/*` tree, and `APIProvider` injects the Google Maps JS API as soon as it mounts. The
comment in `index.html` claimed the SDK loaded "on demand when a panel route renders"; it did,
for every panel route.

| # | Action | Outcome |
|---|---|---|
| 4.1 | Establish who genuinely needs the SDK | Three live consumers, not four — `LocationAutocomplete` has **no importers**; the location editor mounts `LocationMapPicker` instead. It is kept (search-without-a-map is a real shape) and gated like the rest, but it costs nothing today |
| 4.2 | Replace the route-level provider with one mounted on demand | `features/logistics/components/MapsProvider.tsx` |
| 4.3 | Correct the stale claims in `index.html` and `RootLayout` | Done |

**Shape of `MapsProvider`.** Two constraints decided it. First, `useMap(id)` reads a registry
held by the *nearest* `APIProvider`, so two providers in one tree would split it and a map
registered under one would be invisible to a hook reading the other — hence a presence context:
`MapsProvider` yields to an enclosing provider instead of nesting a second. Second, a consumer
that calls `useMap` / `useMapsLibrary` at its own top level cannot host the provider inside its
own body — the hooks would sit above it. So `LocationsAtlas`, `LocationMapPicker` and
`LocationAutocomplete` each became a thin exported wrapper over a private surface component.
Call sites did not change.

**`LocationPreview` needed more than a gate.** The chip is on the dashboard, the schedule, every
rehearsal row and project card, and a static import of `@vis.gl` from there put the 38 KB (12.5 KB
gzip) wrapper into the dashboard's own chunk for a popover most sessions never open. The map body
moved to `VenueMiniMap.tsx` behind `lazy()` + `Suspense fallback={null}`, so the wrapper *and* the
SDK both arrive on the first hover over a venue that has coordinates.

**Exit — automated half met.** The dashboard chunk no longer references the maps chunk (verified
against the built assets), and `App.tsx` no longer imports `@vis.gl` at all. The device half —
a fresh dashboard load issuing no request to `maps.googleapis.com`, and a location popover still
showing a working map — is the developer's to confirm in the browser's network panel.

**Needs the developer's eye:** the venue popover's map now appears one lazy chunk later than the
popover's frame. On a warm connection this is imperceptible; on a cold one the 128px map tile is
briefly empty (its frame, address and both exits are drawn from the first frame). If that reads
as broken rather than as loading, the fix is a still placeholder inside the `Suspense` fallback —
not moving the import back up.

---

## Stage 5 — the synchronous query persister — **SHIPPED 2026-08-28**

**Why:** the largest remaining main-thread cost. It was the one finding in this file that was
inferred rather than measured, and the measurement came back at **320 KB** — above the 300 KB
line, so it ran as written.

`queryPersistence.ts` used `createSyncStoragePersister` over `window.localStorage` with
`throttleTime: 2000`. Whenever the cache was dirty, the entire React Query cache was
`JSON.stringify`d and written **synchronously on the main thread**, at most every 2 s, for as
long as a session stayed active. For a manager that cache holds all projects, all artists, the
whole piece archive, rehearsals and the materials read-models.

| # | Action | Outcome |
|---|---|---|
| 5.1 | Measure first | **320 KB**, manager account, warm |
| 5.2 | Async persister and/or narrow `shouldDehydrateQuery` | Async persister only — see below |
| 5.3 | The admin dashboard blocks first paint on `ArchiveService.getPieces()` purely to render `pieces.length` | Query moved outside the `isLoading` gate |

**Only the store moved; nothing was narrowed.** `createAsyncStoragePersister` over a ~60-line
IndexedDB adapter in the same file. The write is what costs — `localStorage.setItem` of a 320 KB
string is synchronous disk I/O on the main thread — and an IndexedDB write resolves off it. The
`JSON.stringify` stays, single-digit ms at this size, and serialization stays JSON deliberately:
letting structured clone carry the object would make the restored shape differ from what the
sync persister produced (a `Date` surviving a reload as a `Date`), and nothing downstream should
have to learn that.

Narrowing was **not** done, and should not be done blind. Every narrowing trades away offline
coverage, which is the one thing this file calls non-negotiable, whereas the store move trades
nothing. If the idle recording still shows a long task, run the per-query breakdown snippet at
the top of this file first and cut the named heavy keys via `meta: { persist: false }` — the
opt-out mechanism `shouldDehydrateQuery` already honours, and which puts each decision at the
query that owns it instead of in a central blacklist.

Three details the adapter carries:
- **It degrades to localStorage, not to nothing.** A browser that refuses IndexedDB (some
  private windows, storage switched off) gets exactly the behaviour this file had before —
  its offline snapshot, at the old cost.
- **It reads the legacy localStorage key once.** A PWA can boot its updated shell from the
  service worker with no signal, so the release that moves the store must not be the release
  that hands a chorister an empty panel. The old snapshot answers the restore until the first
  IndexedDB write, which then clears it.
- **`clearPersistedQueryCache` is now awaited by logout.** An IndexedDB delete is durable only
  when its transaction commits, and the hard navigation to `/login` was previously free to tear
  the page down mid-flight. On a shared device that is the invariant that matters. A failure
  still lands the user on `/login` — a stuck logout leaves them signed in, which is worse.

**5.3 in detail.** The archive is the heaviest list the panel serves (every piece with its
tracks, movements, translations, recordings, notes and editions), and the dashboard reads
exactly one thing off it: how many there are. It is now a separate `useQuery` whose pending
state does not feed `isLoading`. `AdminTelemetryStatsDto.totalPieces` became `number | null`
and the metric renders `—` until the count lands, rather than a wrong `0`. With a restored
snapshot it is there in the opening frame, so the placeholder is what a genuinely cold archive
fetch looks like. An archive failure no longer raises `isError` either — one number is not the
screen — but the retry button still reaches it, or a blank metric would have no way back.

**Exit — automated half met** (typecheck · lint · 168/168 · build). The device half — a
3-second Performance recording of idle-with-data on the dashboard showing no recurring long
task attributable to `setItem` — is the developer's to confirm.

**Needs the developer's eye:** the first load after this deploy restores from the legacy
localStorage snapshot and then migrates; the one after that reads IndexedDB. If a cold manager
dashboard ever shows `—` where the repertoire count belongs and it does not resolve, the
archive fetch failed — that is now visible rather than fatal, which is the intended trade.

---

## Stage 6 — the entrance chain, under the ink law

**Why last:** each item is small, and several are judgement calls about feel that are better
made once the frames underneath them are cheap.

**The frame changed on 2026-08-28.** The stage used to say "keep one of the four fades and
shorten the rest", which is a taste argument with no principle under it. The principle already
exists, written down and field-tested on the marketing site (`web/src/styles/tokens.css`,
`registers.css`, `nave-menu.css`), and the panel should adopt it because it is *simultaneously*
the brand tie and the cheaper frame:

1. **Nothing enters from `opacity: 0`.** A surface waits at `--half-ink` (0.44) and is inked to
   full. The site's reason is that a hole which then fills itself in reads as generated. The
   panel's is that reason plus a harder one: a dashboard invisible for its first second is a
   dashboard unusable for a second.
2. **Nothing travels.** An entrance built from `y` / `scale` promotes every participant to its
   own composited layer for the length of the animation. Opacity on an already-painted element
   is the cheapest arrival there is.
3. **One ramp per surface.** Two nested ink ramps multiply — 0.44² ≈ 0.19, 0.44³ ≈ 0.09 — which
   is the hole again, only harder to find. `nave-menu.css` states this as its first ladder rule
   ("the veil closes first"), and it is the precondition the panel currently fails.

Rule 3 is why this is one stage and not a sweep: **applying half-ink to a nested chain makes it
worse.** The chain has to be collapsed first.

Deliberately **not** taken from the site, and this is settled unless the reasoning below is
shown wrong:

- **The ink press** (`font-variation-settings` from `--wght-press` to `--wght-rest`). Animating
  a weight axis moves advance widths, i.e. relayouts text. The site spends that on four words on
  an opaque card. The panel's serif carries `Metric` — numeric columns whose whole job is not to
  shift — and this is a stage about making frames cheaper.
- **The two-tempo counted ladder.** It exists because the nave card is an *index* of five
  destinations, each with a line a ribbon can stand on. A bento grid is a **field**: its tiles are
  read as one surface, and stretching nine of them into a countable sequence buys a second of
  staggering for nothing.

| # | Defect | Fix |
|---|---|---|
| 6.1 | The admin dashboard nests **four** opacity animations: shell route transition (`DashboardLayout.tsx`, 0.22 s, `opacity 0` + `y 6`) → `DashboardHome` stage (0.40 s, `opacity 0`) → `PageTransition` (0.50 s, `opacity 0` + `y 8`) → the bento items. Text is fully readable ~2.0 s after the route change | **Done 2026-08-28** — collapsed to `PageTransition` alone, then inked. See below |
| 6.2 | `DURATION.base = 0.8 s` presents itself as the panel's baseline transition. It is outside the perceptual budget for UI motion (0.2–0.3 s) | Rebase, or retire it — its only remaining consumer is `BASE_TRANSITION` in `ExportContractButton` |
| 6.3 | Five dead variants in `motion-presets.ts` | **Done 2026-08-28**, ahead of this stage: they encoded the *old* law (`opacity: 0` + travel) and sat next to the new `INK` register contradicting it. `MENU_PANEL_VARIANTS`, `STAGGERED_REVEAL_VARIANTS`, `FADE_UP_VARIANTS`, `etherealFadeInVariants`, `SLOW_TRANSITION` are gone |
| 6.4 | `index.html` preloads both Plex Sans subsets (with a good reason recorded in its comment) but **no Cormorant subset beyond `latin`**. Headings, `Metric`, `Emphasis` and `Unit` are all serif, and Polish needs `CormorantGaramond-Variable.latin-ext`; `Emphasis`/`Unit` need the italic file. With `font-display: swap` that is a second reflow landing on exactly the Spotlight card | Preload the Cormorant subsets the panel actually draws with, or give the fallback matching metrics so the swap does not shift |
| 6.5 | 71 surviving `transition-all` (the property-animating footgun the 2026-06 sweep left behind on small elements) and 22 `animate-pulse` | Opportunistic; only where a hot list or a hover surface is involved |

**Shipped early, because neither needed the chain collapsed** (both are unconditionally correct
under rules 1–2 and neither adds a ramp):

- `motion-presets.ts` now declares the `INK` register — `half` is the site's `--half-ink`
  verbatim so the two surfaces half-light at one strength; `in` is 0.42 s, deliberately not the
  site's 0.9 s, which is a scroll budget where the panel's is a navigation one (the site's own
  nave menu makes the same local cut, to 0.36 s).
- `BENTO_ITEM_VARIANTS` moved to the law: `0.44 → 1`, no `y`, no `scale`. That is 6–9 composited
  layers per dashboard not created.
- `BENTO_CONTAINER_VARIANTS` **stopped fading**. It ran `opacity 0 → 1` while every child ran its
  own ramp inside it — rule 3's defect, inside a single component, independent of the rest of the
  chain. Framer propagates `staggerChildren` from a variant that animates nothing, so
  orchestration costs no second ramp. `delayChildren: 0.1` went with it.

The stagger stayed at 0.05 s — below the ~0.12 s where adjacent onsets stop fusing, i.e. an
honest wash rather than a counted sequence. That is the field/index distinction above, and it is
also the cheap choice; raising it would lengthen the entrance in a stage about shortening it.

### 6.1 as built — the survivor is `PageTransition`

**The audit undercounted one thing and overcounted another.** The chain was never uniformly four
deep, because the shell's `AnimatePresence` sat **inside** `Suspense` with `initial={false}`: a
route whose chunk had not been fetched — the first load of the dashboard, every time — replaced
that whole subtree with the fallback, and remounted the presence wrapper afterwards with its
initial animation suppressed. So the shell ramp ran on warm navigation and **not** on the cold
path that the symptom is about. The one ramp that ran in both cases was `PageTransition`, which
lives inside the page and is therefore below Suspense. That is why it is the survivor rather
than the shell, which on paper is the better owner.

- **`DashboardLayout`** — the `motion.div` and its `AnimatePresence` are gone; a plain
  `<div key={transitionKey}>` remains. The key was always the remount boundary and is now only
  that. `framer-motion` left the shell's import list entirely.
- **`DashboardHome`** — no longer animates at all. It is a two-way router between the manager
  console and the chorister dashboard, and both open with `PageTransition`; its own stage fade
  sat directly above that one. The `EtherealLoader` is now cut on both edges rather than faded:
  it is the thing being waited out, and animating its departure only postponed the screen behind
  it. Under rule 1 there is no hole where the crossfade used to be, because what replaces it
  starts at half-ink.
- **`PageTransition`** — `opacity: INK.half → 1`, `INK.in` (0.42 s), `INK.ease`, no `y`, and no
  `exit`. The exit variant was dead configuration even before this: no call site is wrapped in an
  `AnimatePresence` (all 22 files that use both have theirs *inside*), so it never ran.

**Two panel routes now enter flat**, because they never used `PageTransition` and were relying on
the shell's ramp: `/panel/messages` (`MessagesPage`) and the archive piece-card routes
(`archive-management/:id`, `/edit`, `/review`). Adding the wrapper is two lines each, but it also
adds `window.scrollTo(0, 0)` on mount, which is wrong for a surface that owns its own scroll
containers — `MessagesPage` most of all. Left flat deliberately; revisit only if the inconsistency
reads.

**Also changed by this, deliberately:** `AuthShell` — login, activation, password reset — now
enters at half-ink like everything else. It is the same law, and the auth zone is where a hole
reads worst.

**Exit — automated half met** (typecheck · lint · 168/168 · build). The other half is the
developer's: the dashboard's text is legible in the first painted frame after a route change,
and the feel is right. The half-ink bento tiles shipped earlier in this stage should now be
visible for the first time — they were sitting under `PageTransition`'s `0 → 1` ramp.

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
- **The panel borrows the site's entrance LAW, not its ceremony** (stage 6). Half-ink and
  no-travel transfer, and pay for themselves in paint. The ink press and the counted two-tempo
  ladder do not — the reasons are recorded in stage 6 and are not a matter of taste to revisit.
- **`globPatterns` names files, never bare extensions.** `public/` is a drop box; an extension
  glob enrols whatever lands there into every user's install, which is how ~6 MB of a dead
  landing page ended up in the precache (stage 3).
- **Not re-audited:** backend query efficiency (2026-06: `select_related`/`prefetch` widespread,
  CQRS read-models, dashboard serializer reads only prefetched lists — it was already clean), and
  React re-render volume (2026-06 established the panel is paint-bound, not render-bound).
