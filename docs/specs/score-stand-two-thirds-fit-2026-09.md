# Score stand: two-thirds fit, whole-page editions, tap-zone affordance — implementation plan

Status: **Stages 1, 2, 2b and 3 IMPLEMENTED 2026-09-23, uncommitted and not yet seen in a browser.
Open: `make migrate` (archive `0033`, after the unapplied `0032`); golden-set labels for
`single_system_pages` plus a positive case, then a harness run before the suggestion is trusted.**
Deviations: the stage 2 hint copy says "⅔" instead of "half", the suggestion lives in its own column
(`stand_whole_page_suggested`), and the old text hint chip on entering performance mode is gone.
Decided with the developer
after Florent's feedback on performance mode. Already done in the same session and uncommitted:
the rehearsal dock on scores opened from the songbook list (`PieceRow`), the practice player
opening on the `blend` preset, `turnPage` without the sliver turn, and tap zones measured against
the visible page (`PdfViewer/tapZone.ts`, middle third of the paper = exit).

## The problem

The half-page fit (`HALF_PAGE_FRACTION = 0.5`) turns at a fixed line, and that line falls wherever
the screen ends, not between systems. With two stops per page (top, bottom — what `turnPage` does
once the rest of the page fits one screen) the reader sees the windows `[0, f]` and `[1 − f, 1]`
of the page height. At `f = ½` the windows do not overlap, so any system crossing the middle is
cut on both screens. The developer's pass over the current repertoire: 3 of 10 pieces break at ½.
At `f = ⅔` only one does — *The Lark Ascending* ("Ptak"), where one nine-staff system fills the
page and no partial view can ever show it whole.

## Decisions

- **Fraction ⅔, not 60%.** On a page of three systems the middle one spans roughly 36–64% of the
  page height. At 60% the top window ends at 60% and the bottom window starts at 40%, so that
  system is cut on both screens — the "Stoi" case this change exists to fix. ⅔ clears it with a
  ~3% margin; 60% would buy music only 11% larger. It stays one constant if measurement ever
  says otherwise.
- **Accepted cost of ⅔:** the middle third of the page is seen twice, and after a turn the line
  being read moves from the bottom of the screen to the middle. Music is 25% smaller than at ½
  (landscape iPad ≈ 80% of print size, whole page ≈ 53%).
- **Whole-page pages are a property of the edition**, set once by the librarian, never discovered
  by each chorister on stage.
- **No instruction bubble.** A text hint on entering performance mode is a coach mark, excluded by
  the no-tours decision. The zones show themselves instead (stage 3).
- **System detection is shelved.** Engraved choir scores with soloists defeat the simple signals
  (equal staff gaps; the left system line may not join groups); the only robust signal is shared
  barline x-positions, a larger job that ⅔ + the edition flag make unnecessary for now.
- **Out of scope:** the concert book (`ScoreBookModal`) — a binder mixes editions, so a per-edition
  fit has no single answer there. A "choir staves only" crop view is the later answer for full
  scores; not part of this plan.

## Stage 1 — two-thirds fit (frontend only)

`frontend/src/shared/ui/composites/PdfViewer/`:
- `constants.ts` — `HALF_PAGE_FRACTION` → `PARTIAL_PAGE_FRACTION = 2 / 3`; `AUTO_HALF_GAIN_RATIO`
  → `AUTO_PARTIAL_GAIN_RATIO` (value unchanged; ⅔ still gains 1.5× on landscape, so `auto` keeps
  choosing it there and whole page in portrait).
- `types.ts` — `FitMode` value `"half"` → `"two-thirds"`.
- `hooks/usePdfState.ts` — `isFitMode` accepts the new value; `readStoredFit` maps a stored legacy
  `"half"` to `"two-thirds"` so every reader who picked half lands on its successor, not on `auto`.
- `fit.ts`, `components/PdfBottomNav.tsx` (the `FIT_ICONS` key and the option at the `"half"` entry,
  label key) — follow the rename.
- Extract the step arithmetic from `PdfViewer.tsx` `turnPage` into a pure `planScrollTurn(remaining,
  clientHeight)` next to `fit.ts` and test it: a page 1.5 screens tall must take exactly two stops,
  a page exactly two screens tall must take two, a longer rest splits into equal turns.
- `fit.test.ts` — update the `"half"` expectations and the widths they pin.
- Locales (`pl/en/fr`): replace `pdf_viewer.fit_half` with `pdf_viewer.fit_two_thirds` —
  „⅔ strony” / "⅔ page" / « ⅔ de page ».
- Check: the draw gate (`DRAW_MIN_PAGE_WIDTH = 520`) now meets a narrower page than at ½ on a
  landscape phone; confirm the pencil still appears where it did on a landscape tablet.

Verify: `npm run typecheck`, `npx vitest run src/shared/ui/composites/PdfViewer`.

## Stage 2 — whole-page flag on the edition (backend + frontend)

Backend (`backend/archive/`):
- `models.py` `ScoreEdition` — `stand_whole_page = BooleanField(default=False)`, verbose name
  "Whole pages on the stand", help text: the score sets one system per page, so partial views
  would cut it. `makemigrations archive` — it chains after the unapplied `0032` (tempo giusto);
  `make migrate` on every environment.
- Serializers exposing it: `archive/serializers.py` `PieceEditionSummarySerializer`,
  `ScoreEditionListSerializer`, `ScoreEditionDetailSerializer` (writable for managers only, like
  the other edition metadata); `roster/dashboard_serializers.py` `EditionSnippetSerializer` (the
  songbook read, read-only).
- Tests: the songbook payload carries the flag; a manager can PATCH it; a chorister cannot.

Frontend:
- DTOs: `features/archive/types/archive.dto.ts`, `features/materials/types/materials.dto.ts`.
- `features/archive/constants/piecePdfs.ts` — `PiecePdfLink.wholePage` from the edition.
- `features/annotations/components/ScoreStandModal.tsx` → `shared/ui/composites/PdfViewerModal.tsx`
  → `PdfViewer` → `usePdfState`: a new `preferredFit?: FitMode`. Precedence when a document opens:
  `preferredFit` (edition says whole page) over the stored reader habit over `auto`. A change made
  in the open viewer behaves as today (applies and persists the reader's habit). The modal is
  reused across editions on the piece page, so the initial fit must re-derive when the edition
  changes — key the viewer on the edition id rather than syncing state in an effect.
- Callers passing `preferredFit={link.wholePage ? "page" : undefined}`: `materials/components/
  PieceRow.tsx`, `materials/PiecePage.tsx`, `archive/components/EditionsList.tsx`,
  `archive/components/PieceRowExpanded.tsx`, `archive/ArchivePieceCardPage.tsx`.
- Editing: a toggle in `archive/components/EditionsList.tsx` beside the other edition metadata,
  managers only. Copy in all three locales; Polish first („Cała strona w trybie występu”, hint:
  „Jeden system na stronę — połowa by go przecięła”).
- `shared/api/queryPersistence.ts` — bump `QUERY_CACHE_BUSTER` (DTO change).

Verify: ruff + mypy on `archive` and `roster`, `manage.py test archive roster
--settings=config.test_settings_sqlite`, `npm run typecheck`, `npm run build`.

## Stage 2b — the ingestion model proposes the flag (awaits the developer's go)

`analyze_score` already reads every page of the PDF visually in one call
(`docs/archive-ai-ingestion-pipeline.md` §4.2), so the layout question costs a few output tokens,
not a second call. Ask for a **coarse category, never geometry**: whether any page of music
carries a single system that fills most of the page. Vision models read staff names and count
systems well; they place lines on a page poorly, and a turn point a few percent off cuts a staff
on stage — so system coordinates for turning stay out of the prompt.

- Extend the structured output and bump the prompt version (§5.2, §5.3). The answer follows the
  other extracted fields: payload → verification → `ScoreEdition.stand_whole_page` as a
  suggestion the manager confirms, never a silent write.
- Label the new field in the golden set and run the harness (§5.7) before trusting it; the
  pipeline rule is that a model-side change is backed by a run, not an argument.
- Editions ingested before this stage are not backfilled — a re-run costs a full vision call per
  PDF. The librarian sets the flag by hand on the few that need it.

## Stage 3 — the zones show themselves (frontend only)

- `PdfViewer/tapZone.ts` — expose the band extents (`tapZoneBands(viewport, page)` → left and right
  band in client px) and build `resolveTapZone` on it, so the drawn bands and the hit test cannot
  drift apart.
- Fine pointer (`any-pointer: fine`), performance mode only: hovering a turn band shows a faint
  chevron at that edge of the visible page and a pointer cursor; the middle third shows nothing.
- Touch-only devices: on entering performance mode both bands light up once for about a second
  (fade in, hold, fade out), chevrons only, no text. `prefers-reduced-motion`: shown and removed
  without the fade.
- Ethereal tokens only; framer-motion on `opacity` only; the overlay is `pointer-events-none` and
  must not intercept the taps it illustrates.

Verify: `npm run typecheck`, `npm run build`. The developer checks it in the browser.
