# Score stand for the concert: deliberate exit, half-page turns, margin crop — implementation plan

Status: **Spec only, nothing built (2026-09-23).** Builds on `score-stand-two-thirds-fit-2026-09.md`
(committed in `3895a466`) and on the overflow-allowance fix in `PdfViewer` (`readableScrollRange`),
uncommitted when this was written. Three stages, each shippable on its own; stage 3 has a
measurement gate before its default goes on.

## Why

The developer's goal: choristers read from VoctManager on stage, including the four who today read
from tablets in forScore-type apps. Florent's rule for the stage: the reader sees the whole page.

What that rule costs is settled geometry. A tablet held upright shows the whole page at nearly the
size ⅔ gives on its side (×1.06 on 8–11", ×1.12 on 12.9–13"), because in both cases the page is as
wide as the short side of the screen; and `auto` already picks the whole page upright on every
tablet. The stage posture is therefore a tablet upright, whole page — no change to `auto`, no
device-size rule, no choir-wide setting.

What keeps a forScore reader in forScore is what happens around that page:
1. A stray touch in the middle of the paper ends performance mode and re-fits the page mid-piece.
2. A whole-page turn replaces the system the singer is still reading; forScore answers with
   half-page turns.
3. The page carries its print margins; forScore readers crop them.

## Decisions

- **Leaving performance mode takes two deliberate touches**: a centre tap shows the exit, the exit
  button leaves. Escape stays one key.
- **Half-page turns are a reader's habit, off by default**, offered on score surfaces, active only
  in performance mode and only where the page fits the screen — partial fits and zoom already turn
  by screenfuls. Never on a page of a whole-page edition (`stand_whole_page`): a single system
  cannot be halved.
- **The seam sits at the middle of the visible page.** A fixed seam cuts a system that crosses it,
  exactly as in forScore; the reader chooses when to tap. A seam between systems needs system
  detection, which stays shelved.
- **One crop box per document**, so the music keeps one size from page to page. A per-page crop
  would change the scale at every turn.
- **The crop never hides a mark and never touches the bottom of the page.** The watermark footer
  (`#6b6b6b`, 7 pt, in the bottom 15 pt — `roster/infrastructure/score_watermark.py`) and the
  binder's folio live there, and a detector cannot be trusted to see 7-pt grey type at thumbnail
  resolution. Vertical gain comes from the top margin only; accepted — upright on an 8–11" tablet
  the width is what limits the page.
- **Crop is on by default where offered**, once the stage-3 gate has passed.

## Stage 1 — Deliberate exit (frontend only)

Today `PdfViewer.handleCenterTap` calls `exitImmersive()` on any tap in the middle third of the
paper (`TAP_ZONE_FRACTION`). On a stand that is where a steadying finger or a slightly-off turn
lands, and leaving re-fits the page: the insets and the width cap come back and `auto` may flip
page ↔ ⅔.

- `PdfViewer/components/StagePill.tsx` (new): bottom-centre pill in the page chip's place — the
  position (`3 / 9`) and a button „Zakończ tryb występu”. `data-pdf-gesture-exempt`; only the
  button takes pointer events. Opacity via framer-motion; `prefers-reduced-motion` shows and hides
  it without the fade. Same tokens as the chip.
- `PdfViewer.tsx`: in performance mode a centre tap shows the pill for `STAGE_PILL_MS` (3000, in
  `constants.ts`); another centre tap while it shows restarts the timer; the button exits. The page
  chip stays hidden while the pill shows. Escape unchanged. (A quick second tap cannot be the exit:
  `useViewerGestures` drops clicks with `detail > 1`.)
- Locales: `pdf_viewer.immersive_exit` — „Zakończ tryb występu” / "Leave performance mode" /
  « Quitter le mode concert ».

Verify: `npm run typecheck`. The developer checks on a tablet: one centre tap leaves the page
exactly as it was; the button leaves.

## Stage 2 — Half-page turns (frontend, one backend field)

Behaviour, in performance mode with the habit on:
- The page fits (`readableScrollRange` is 0), a next page exists, is rasterized, and both pages may
  be split → the first forward turn lays the top half of the next page over the top half of the
  current one; the second forward turn completes it.
- A back turn while half-turned cancels (the current page whole again). Otherwise a back turn shows
  the previous page whole, as today.
- Any other move — `goToPage`, the outline, a piece jump, zoom, a fit change, leaving performance
  mode, a new document — drops the half state.
- A next page not rasterized yet gets a whole-page turn. The stage never waits.

Turn logic, `PdfViewer/scrollTurn.ts`:
- Pure `planTurn(input)` → `scroll(by) | half | complete | cancel | page | none`, built on
  `readableScrollRange` and `planScrollTurn`. `turnPage` in `PdfViewer.tsx` gathers the input and
  applies the plan.
- `scrollTurn.test.ts`: two taps per page with the habit on; back from half cancels; an
  unrasterized next page turns whole; an unsplittable page turns whole; the last page does nothing;
  a zoomed page scrolls.

Viewer:
- `hooks/usePrefetchedPages.ts` — expose `isRasterized(page)`.
- `PdfViewer.tsx` — in the half state the next page renders visible with
  `clip-path: inset(0 0 <below-seam>% 0)`, measured in the page element's own frame (50% until
  stage 3 moves the seam); a hairline at the seam in an Ethereal ink token; the current page's
  overlay clipped below the seam, a second overlay for the next page above it with `passive: true`.
- `types.ts` — `PdfPageGeometry.passive?: boolean`; `PdfViewerProps.halfTurns?: boolean` (offer the
  habit) and `isPageSplittable?: (page: number) => boolean` (default: every page).
- `hooks/usePdfState.ts` — the habit `voct.pdf.half_turns:<scope>`, default off, stored like the
  fit.
- `components/PdfBottomNav.tsx` — in the fit panel, a switch „Przewracaj połową strony” with the
  hint „W trybie występu najpierw zmienia się górna połowa, potem dolna”; only when offered.
- `shared/ui/composites/PdfViewerModal.tsx` — forward the new props.

Callers:
- `features/annotations/useScoreAnnotator.tsx` — passive geometry renders display-only:
  `tool="pointer"`, `canEdit={false}`, no selection. If `AnnotationOverlay` registers
  document-level listeners, gate them on not passive. In the binder a next page from another
  edition shows no marks until the turn completes (the existing `activeEditionId` guard); accepted.
- `ScoreStandModal.tsx` — `halfTurns`; no page is splittable when `preferredFit === "page"` (the
  same edition flag).
- `ScoreBookModal.tsx` — `halfTurns`; a page whose frame's edition is in `book.wholePageEditions`
  is not splittable.
- Backend, `roster/views.py` `ProjectViewSet.score_map`: add `whole_page_editions: list[str]`, the
  bound editions with `stand_whole_page=True`. Test in `roster/test_score_book_map.py`.
- Frontend: the DTO in `features/projects/api/project.service.ts`; `features/annotations/lib/
  scoreBook.ts` gains `ScoreBook.wholePageEditions` (a map without the field — an older cache, the
  offline copy — reads as none); the call site in `features/projects/components/
  ProjectScoreBook.tsx`. Bump `QUERY_CACHE_BUSTER`.
- Locales: EN "Half-page turns" / "In performance mode the top half turns first, then the bottom";
  FR « Tourner par demi-page » / « En mode concert, la moitié haute tourne d'abord, puis la basse ».

Verify: ruff + mypy on `roster`; `manage.py test roster --settings=config.test_settings_sqlite`;
`npm run typecheck`; `npx vitest run src/shared/ui/composites/PdfViewer src/features/annotations`;
`npm run build`. The developer checks on a tablet upright: two taps per page, a back tap from the
half state, the Lark always turning whole, the concert book across a piece boundary.

## Stage 3 — Margin crop (frontend only)

Detection, `PdfViewer/crop.ts` (pure) and `hooks/useContentCrop.ts`:
- Render every page at ~200 px wide through pdf.js — the document proxy from `Document
  onLoadSuccess` (widen `OutlineCapableDocument` for `getPage`) — one page after another on one
  reused canvas, aborted on a document change. Ink = luminance below 160.
- A row or column counts when it holds at least 2 ink pixels, so scan specks do not hold a margin
  open.
- Left and right edges from the ink, ignoring ink in the bottom 5% of the page: the binder's folio
  sits in the outer corner there and would hold the sides open. It may be clipped; the viewer shows
  the page number itself. Top edge from the ink. Bottom edge: the page's bottom, always.
- Document box = union over pages ∪ `keepVisible`, padded by 1.5% on the cropped edges, clamped to
  the page.
- No crop when the box keeps more than 95% of the page on both axes — a re-layout for nothing.
- Cache in localStorage under `voct.pdf.crop.v1:<docKey>:<blob byte size>`. The size is there
  because `ScoreStandModal` keys the document by edition id alone, and a replaced PDF must not
  inherit the old box.
- `keepVisible === undefined` means the marks are not loaded yet: no crop is applied until they
  are. The first box for a document applies as soon as both are known; a later change (a mark
  arriving in the margin) applies at the next page change, never under the reader's eyes.
- `crop.test.ts`, on synthetic pixel buffers: plain margins, specks, a folio in the corner, the
  marks union, the no-gain case.

Viewer:
- `fit.ts` keeps its arithmetic; `usePdfState` hands it the cropped aspect
  (`pageAspect × box.h / box.w`), and the page renders at `renderedPageWidth / box.w`.
- `PdfViewer.tsx` — the page box becomes two layers: the visible box (`pageBoxRef` — clip, pinch
  target, tap zones, scroll extent) sized to the crop, and inside it the full-page frame, offset by
  the crop origin, holding the canvases and the overlays. The overlay measurement (`pageBox`,
  `PdfPageApi.pageWidth`) moves to the full-page frame, so marks stay in the frame they were stored
  in.
- `parkViewport` "focus" maps `y` through the crop: `(y − box.y) / box.h`.
- The stage-2 seam = the middle of the visible box, `box.y + box.h / 2` in the page frame.
- Props: `cropMargins?: boolean` (offer and apply), `keepVisible?: NormRect | null` (page
  fractions).
- The habit `voct.pdf.crop:<scope>`, default on where offered; a switch „Przycinaj marginesy” in
  the fit panel.

Callers:
- `useScoreAnnotator.tsx` exposes `marksExtent`: the union of `markBounds` over every mark the
  reader can see on the document, mapped through the page frames in the binder.
- `ScoreStandModal` and `ScoreBookModal` pass `cropMargins` and `keepVisible={marksExtent}`.
- Locales: „Przycinaj marginesy” / "Trim margins" / « Rogner les marges ».

Gate before default-on: a dev-only `console.debug` of the gain per document (`1 / box.w`,
`1 / box.h`). The developer opens the current concert's book and three single editions; default-on
ships only if the book gains at least 8% in width. Otherwise the switch ships off, and the reason
goes into this file.

Verify: `npm run typecheck`; vitest as in stage 2; `npm run build`. The developer checks on a
tablet upright: music visibly larger, the footer visible, marks in margins visible, pinch-zoom
anchored, tap zones on the cropped page, the concert book.

## Later — not in this plan

- **Repeat links** (D.S., coda, a repeat across a turn): a shared jump mark set once by the
  conductor for the whole choir, where forScore has every musician draw their own. Needs a new mark
  kind (payload + `_clean_*` sanitizer), an overlay hit target and a way back. Build when a piece on
  a coming programme needs it on stage.
- **Two pages side by side in landscape**, for 12.9–13" tablets and laptops; each page at the
  landscape whole-page scale. Build on request.
- **Not planned**: a metronome (pitch pipe and practice tracks cover the choir); face gestures (no
  TrueDepth camera in the browser, and a singer's mouth is busy); leader sync like forScore's Cue
  (the programme is fixed, and the programme bar already jumps between pieces).

## To confirm with the tablet users

- Half-page turns on or off by default.
- Their pedal model — the viewer maps arrows, PageUp/PageDown and Space (`PdfViewer.tsx`, keyboard
  handler).
