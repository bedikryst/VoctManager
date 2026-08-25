# Score book remediation — audit, repairs, and the markings feature

Status: **STAGES 1-5 AND §7 BUILT** (2026-08-25) · Backend-heavy
(`backend/roster/infrastructure/`, `backend/roster/score_package_*.py`), moderate frontend
surface (cockpit panel + annotation toolbar + the score viewer's toolbar), one serve-time path
that now composes two things instead of one.

Stage 1 shipped D1-D8 plus the concurrency guard. **Re-audited against the source on 2026-08-25**
(not against this file's own claims): every one of D1-D8 is present in the code as described,
and its 155 tests are green. Stage 1's code and migration 0044 are committed (`421c5d2`).

Stages 2-3 then shipped the page map and the conductor's markings in the book (committed in
`c4e0e64`). Stages 4-5 and §7 followed: the reader's own marks at download, the conductor's
copy, and the ink palette with its reservation. 727 tests green across `roster` + `archive`,
ruff + mypy clean, frontend typecheck + lint + build clean.

**Three migrations need applying** (`make migrate`) — `roster.0044_score_package_build_started_at`,
`roster.0047_scorepackage_include_markings_scorepackage_page_map` and
`archive.0027_alter_annotation_color`. The host has no Postgres, so all three were validated on
the sqlite test DB only.

### What the overlay has and has not met

The markings overlay HAS now been through a real WeasyPrint: the owner built a book with
`include_markings` on and sent the rendered page. Freehand strokes, the highlighter's underline
translation and a text chip all drew, on the right page, at the right bar. That render is also
where two defects showed up, both since fixed (see §4).

The two remaining NEEDS RENDER CHECK items are D2's knockout and D6's Mass preview. **D2 is now
closed without a renderer** — see below. D6's is a visual check that still needs a container.

Audited artifact: the concert score-book generator ("książka nutowa") and its Mass variant —
the whole chain `builder → layout → config → readiness → service → views → watermark →
source-numbering → cockpit panel`. 134 tests in `roster.test_score_package_cockpit`,
`roster.test_score_protection`, `roster.test_score_source_numbering` were green before any
change here.

**What was verified how.** Docker was down during the audit, so no real WeasyPrint render was
produced. Every defect in §2 is a code-path finding; D2 was additionally reproduced on the host
with a pypdf probe (output quoted inline). Defects whose only proof would be a rendered page are
marked NEEDS RENDER CHECK and must be confirmed in the container before Stage 1 is called done.

Source of truth for the current implementation:
`backend/roster/infrastructure/score_package_builder.py` (assembly) ·
`backend/roster/score_package_layout.py` (pagination planner) ·
`backend/roster/score_package_config.py` (per-item resolution SSOT) ·
`backend/roster/score_package_service.py` (state, staleness, lifecycle) ·
`backend/roster/infrastructure/score_source_numbering.py` (folio detection) ·
`backend/roster/views.py:573-808` (endpoints, watermark choke point) ·
`backend/archive/models.py:559-624` + `backend/archive/views.py:818-942` (annotations).

---

### Locked with the owner (do not re-litigate)

1. **The book is a BINDER, not a compositor.** Engraved pages are never re-typeset. The only
   things drawn onto music are the book's own folio, the licence watermark, and — from Stage 3 —
   markings the choir already sees on screen.
2. **The score book keeps Gentium Plus + oldstyle figures.** It is the named exception to the
   print canon's two-voice rule (`.ai/04_design_system.md` § Print artifacts). Do not "fix" it.
3. **One book per project.** `Project.score_pdf` stays a single generated file. Anything
   per-recipient is composed at serve time, never baked into the stored artifact.
4. **The conductor never sees anyone's `personal` layer**, and no feature may change that.
5. **Warn, never block.** A missing element is omitted from the card; a low-confidence one is
   flagged. No modal confirmations on rebuild.

---

## 0. Verdict

**The generator is sound and does not need rebuilding.** The architecture that matters — binder
over compositor, a pure pagination planner, a per-item override SSOT, evidence-based folio
detection, provenance-driven readiness — is right, and the parts that could not be tested on a
host without WeasyPrint were deliberately isolated so they could be. That judgement has not
changed.

What it has is **seven defects that are invisible until the book is printed or until a build
dies**, and **one unkept promise**: `Annotation`'s docstring has said since migration 0012 that
markings are *"flattened into the final concert binder at compile time"*. They are not. There is
no reference to `Annotation` anywhere in `roster/`. The conductor draws, the choir sees it on
screen, and the printed book — the thing that actually stands on the music desk — is blank.

Closing that gap is the feature. The defects are what has to be true first, because two of them
(D1, D2) already put wrong ink on the page, and a markings overlay would sit on the exact same
coordinate machinery.

---

## 1. What the reader actually needs

Three readers, three artifacts, and they are **not** three checkboxes in one panel:

| Artifact | Carries | Composed | Copies |
| --- | --- | --- | --- |
| **Choir book** | music + cards + (opt.) conductor's `shared` markings | build time | one, versioned |
| **Singer's printout** | the choir book + (opt.) that singer's `personal` marks | serve time | one per person |
| **Conductor's copy** | the choir book + `conductor` cues (+ optionally his own `personal`) | serve time | one, unversioned |

The decisive fact is ownership. `shared` is the conductor's message to the choir and belongs in
the build. `personal` is the reader's own pencil — the conductor cannot switch it on for someone
else, because he cannot see it and because doing so would make `score_pdf` stop being one file.
So the layer choice is not one control: it is **one build-time toggle plus one reader-side
toggle**, and they compose additively. A singer opening the download dialog on a book that
already carries the conductor's markings still gets their own switch for their own marks; both on
means both layers overlaid, both off means clean engraving.

That composition is also why the reader-side switch belongs on the **existing per-recipient serve
path** (`ProjectViewSet.score_pdf` GET), which already renders a personal artifact per download
for the licence watermark. Nothing new architecturally — a second overlay in a pipeline that
exists.

---

## 2. Stage 1 — defects and repairs

Ordered by how quietly they fail.

### D1 · A book with no page numbers at all

**Symptom.** Turn off "Numeracja stron" and the printed book has no page numbers anywhere — not
the book's, and not the publisher's either.

**Cause.** `build_score_package` runs the source-folio knockout unconditionally
(`score_package_builder.py`, step 1), while `hide_source_page_numbers` defaults to `True`.
Covering the publisher's folio is only ever justified *because* the book stamps its own; with the
book's numbering off, the knockout erases the only numbering left.

**Fix.** Make the gate part of the resolution SSOT rather than a second condition in the builder:
`resolve_source_numbering()` returns `False` whenever `package.include_page_numbers` is off. The
builder, the cockpit's `hide_source_page_numbers_effective` and the readiness engine then all
agree by construction. The cockpit disables the "Ukryj numery wydań" pill while numbering is off,
with a one-line reason.

**Verification.** Unit test on `resolve_source_numbering` (gate wins over both the package flag
and a per-item pin) + an assembly test asserting no knockout is painted when numbering is off.

---

### D2 · Rotated source pages get a white rectangle over the music

**Symptom.** On editions whose pages carry `/Rotate` (landscape scans, image-assembled PDFs), an
opaque white box lands somewhere over the engraving. Silent — nothing logs, nothing fails.

**Cause.** Two coordinate spaces. `detect_source_folios` measures glyph boxes off the page's raw
mediabox; `_place_on_a4` bakes `/Rotate` into the content *first*
(`source_page.transfer_rotation_to_content()`) and then computes `scale/tx/ty` off the **new**
box. Masks measured in the pre-bake space are applied with a post-bake transform. The detector's
14 %-of-height band is also measured on the wrong axis for the same reason, so what little it
finds on a rotated page is not the folio.

**Evidence** (host probe, pypdf 6.11):

```
before bake: mediabox [0, 0, 595, 842]  rotation 90
after  bake: mediabox [0, 0, 842, 595]  rotation 0
```

**Fix.** Bake rotation **once, at read time**, in `_read_edition_pdf` — before anything measures
anything — and only for pages that actually carry a rotation (a no-op bake still prepends a `cm`
to every content stream, which is not free and not wanted). `_place_on_a4` keeps a guarded call so
it stays correct as a standalone helper; on an already-baked page it costs one integer check.

**Verification.** A test binding a `/Rotate 90` page and asserting the placement transform is
derived from the same box the detector measured.

**Closed on the host, no renderer needed** (`RotatedKnockoutTests`, 2026-08-25). The visual check
turned out to be reducible to an arithmetic one: bind a page carrying a real folio glyph at 0°,
90°, 180° and 270°, then read the glyph's position back **off the finished sheet** with a pypdf
text visitor (`tm × cm`, so both the rotation bake and the placement transform are in it) and
assert the painted rectangle brackets it. That is the actual claim — "the white box is over the
NUMBER" — rather than "over where we believe the number to be", and it needs no eyes.

---

### D3 · A dead build locks the conductor out permanently

**Symptom.** The panel shows "Składanie…" forever, polls every 2.5 s forever, and the
"Wygeneruj ponownie" button stays disabled. There is no way back — not in the UI, not through the
API.

**Cause.** Three gaps compounding:
* `run_build` guards only `build_score_package`. A failure in the *persistence* step (storage
  full, permission, DB) escapes the handler, so the docstring's promise — "always leaves the
  package in a terminal state" — is false.
* A killed worker, an OOM or a broker outage leaves `BLDG`/`QUED` with nothing to reset it.
  There is no `task_time_limit`, no `acks_late`, no failure handler on
  `generate_score_package_task`.
* `request_generation` refuses to re-queue anything in `_IN_FLIGHT_STATUSES`, and the panel
  disables its own button while `busy`.

**Fix.** A timestamp and a reclaim window.
* New field `ScorePackage.build_started_at` — set when the build is **queued** and refreshed when
  it actually **starts**, so both "never picked up" and "died mid-build" are covered.
* `SCORE_PACKAGE_BUILD_TIMEOUT` (default 15 min; a real build is tens of seconds). Past it, an
  in-flight package is *abandoned*: `request_generation` re-queues it and `compute_state` reports
  `build_stalled: true`.
* Wrap the persistence step so a storage failure ends in `FAILED` with a readable message.
* Panel: `build_stalled` reads as a named problem, re-enables the CTA, and stops the poll.

**Verification.** Tests: persistence failure ends `FAILED`; an in-flight package older than the
window is re-queued; a fresh one is not; `compute_state` reports the flag.

---

### D4 · A stale book wearing a fresh stamp

**Symptom.** The conductor presses "Złóż partyturę", keeps editing page ranges while it runs, and
the finished book reads "Gotowa" — not "Program zmieniony" — although it does not contain those
edits.

**Cause.** `run_build` computes `source_hash` **after** assembly, from live DB state. Anything
changed during the build (tens of seconds) is recorded against a PDF that predates it.

**Fix.** Snapshot the hash immediately before `build_score_package` and store *that*. An edit made
mid-build then correctly leaves the finished book flagged stale — which is the truth.

**Verification.** A test that mutates the programme between the hash snapshot and the store, and
asserts `is_stale` is `True` afterwards.

---

### D5 · The watermark cache outlives the file it stamped

**Symptom.** Manager replaces the book by hand; a singer who downloaded within the last 30 minutes
re-downloads and gets **the previous book**, watermarked and looking authoritative.

**Cause.** The cache key is `binder:{project}:{build_version}:{user}:{copy}`, but
`mark_manual_upload` deliberately does not bump `build_version` (the panel hides version for hand
uploads). The key therefore does not identify the bytes.

**Fix.** Put `generated_at` in the key — every producer already stamps it (`run_build`,
`mark_manual_upload`), and `mark_score_cleared` nulls it. One `.values()` call fetches both fields.

**Verification.** A test that stamps, re-uploads, and asserts the second serve is not the cached
first.

---

### D6 · The card preview lies in Mass density

**Symptom.** In `MASS` density the cockpit's "Podgląd karty" shows a full-page frontispiece. The
book will never print one — Mass texts go into a consolidated, flowing "Teksty i tłumaczenia"
section in the unnumbered front matter.

**Cause.** `render_item_card_preview` always calls `_render_cards(..., section_header=None)`,
which is frontispiece mode, contradicting its own docstring ("what the conductor sees is what the
book gets").

**Fix.** Resolve the mode from the package: Mass + a bound piece → entry mode under the section
header; a placeholder keeps the frontispiece, because a placeholder divider **is** what Mass
prints for missing music.

**Verification.** A test asserting the two modes; NEEDS RENDER CHECK for the visual.

---

### D7 · The preview speaks the reader's language, the book speaks its own

**Symptom.** A francophone manager previews a Mass card and reads "À la communion:"; the printed
book says "Na Komunię:".

**Cause.** Liturgical labels are lazy gettext. In the Celery worker they resolve under
`LANGUAGE_CODE`; in the cockpit's live preview they resolve under the requester's
`Accept-Language` (LocaleMiddleware is active). `SCORE_BOOK_LANG` exists but drives only the
`<html lang>` attribute.

**Fix.** Both artifact producers — `build_score_package` and `render_item_card_preview` — render
inside `translation.override(_doc_lang())`. Today `SCORE_BOOK_LANG == LANGUAGE_CODE == 'pl'`, so
this changes only the request-time path, which is exactly where the lie is.

**Note.** This does *not* translate the print chrome still hardcoded in the templates
("Repertuar", "Wymowa (IPA)", "tłum.", "oprac.", "Nuty w przygotowaniu", "godz.", the outline's
"Strona tytułowa"). That is a separate piece of work — see §8.

---

### D8 · Two silent failures on the frontend

* `useGenerateScorePackage` is the only one of the three cockpit mutations without an
  `onError → toastApiError`. A refused queue attempt vanishes.
* `ScorePackagePanel.handleDownload` has no `try/catch` and is invoked through `void`. A 403
  (project closed) or a 503 (`PdfRenderUnavailable`) becomes an unhandled rejection with no toast.
  It also duplicates `shared/lib/io/downloadFile.ts`.

**Fix.** Add the error handler; wrap the download and surface the reason.

---

### What Stage 1 actually shipped

| # | Landed in | Proof |
| --- | --- | --- |
| D1 | `score_package_config.resolve_source_numbering` (gate in the SSOT, not the builder) | 4 tests incl. the cockpit's effective value |
| D2 | `score_package_builder._read_edition_pdf` bakes `/Rotate` at read time; `_place_on_a4` keeps a guarded call | 3 tests; the box no longer moves between detection and placement |
| D3 | `ScorePackage.build_started_at` (migration 0044) · `build_is_abandoned()` · `SCORE_PACKAGE_BUILD_TIMEOUT_MINUTES` · guarded persistence · `build_stalled` in the read model · panel re-enables the CTA and stops polling | 6 tests |
| D4 | hash snapshotted before `build_score_package` | 2 tests, incl. an edit landing mid-build |
| D5 | watermark cache key carries `generated_at` | 1 test (hand replacement is not served from cache) |
| D6 | preview resolves density; placeholders keep the divider | 3 tests |
| D7 | `_book_language()` wraps both artifact producers | 2 tests (assembly + preview pin `pl` under an `fr` request) |
| D8 | `onError` on the generate mutation; `handleDownload` surfaces its reason | — |
| bonus | `request_generation` takes a row lock, so two simultaneous presses cannot both dispatch | covered by the D3 lifecycle tests |

**Outstanding for Stage 1:** confirm in the container the two NEEDS RENDER CHECK items (D2's
knockout placement on a rotated edition, D6's Mass entry preview). The code and migration 0044 are
committed; whether 0044 is *applied* on a given environment is a `make migrate` question, and this
file cannot answer it.

### Also found, deliberately deferred out of Stage 1

* **One WeasyPrint invocation per piece.** A 20-piece programme pays 20 process-level renders.
  Reducible to two passes (count pages, then render with folios) using `bookmark-level` to find
  card boundaries. Real win, but it changes the render path and must not ride alongside
  correctness fixes.
* **`overlay_pages[:body_count]`** truncates silently where a plan/reality mismatch should shout.
* **No outline entry for the Mass "Teksty i tłumaczenia" section**, and the TOC is a flat list
  even for a Mass, although `build_program_presentation` knows the parts of the rite.

---

## 3. Stage 2 — the page map · **BUILT**

Annotations are stored against `(edition, page_number)` in normalized 0..1 coordinates. The book
trims pages, scales and re-centres them onto A4, and interleaves cards. The transform that maps
one to the other was computed inside the builder and thrown away.

**Now persisted.** `ScorePackage.page_map` (JSON), written on every successful build, one row per
page of the stored PDF, in order:

```
{ phys: 12, kind: "front"|"pad"|"spacer"|"card"|"music", folio: 7|null,
  item: "…", edition: "…", src_page: 3, box: [x, y, w, h] }
```

**Deviation from the original spec, deliberate:** the row stores the *placed box* — where the
source page landed on the sheet, in A4 points from the bottom-left — instead of `scale/tx/ty`.
The box is what every consumer actually needs (`scale` is just `w / src_w`), and crucially it
carries the source page's *size* implicitly, so an overlay can position a mark without reopening
the edition PDF to measure it. `roster/score_page_map.py` owns the vocabulary and is PDF-free, so
the service and any read path can import it without dragging in pypdf; it is also now the SSOT for
the A4 dimensions the builder used to define itself.

The map dies with the file it describes: `mark_manual_upload` and `mark_score_cleared` both empty
it. A hand-uploaded book has different geometry, and drawing marks onto it at positions measured
from the generated one would put ink in arbitrary places.

It pays for itself beyond markings: "this book page is this piece", per-page provenance, and a
future incremental rebuild of one changed item.

---

## 4. Stage 3 — the conductor's markings in the book (`shared`, build time) · **BUILT**

`ScorePackage.include_markings`, one pill in the cockpit's "Struktura książki" tier
("Wpisz moje oznaczenia"). Off by default.

* **Renderer:** `roster/infrastructure/score_markings.py`. One WeasyPrint document for the whole
  book, and only pages that actually carry marks become sheets — a 200-page book with three marked
  bars renders three. Strokes and geometric stamps go into a page-sized SVG in A4 points; text
  (dynamics, note chips) is positioned HTML above it, centred by plain block layout rather than a
  percentage transform, so nothing depends on renderer-specific transform support.
* **Selection is the page map's job, not the query's.** The build fetches every `shared` mark on a
  bound edition and lets the map decide what lands, because the map holds a row only for a source
  page the book really contains. The trim window is therefore implemented once.
* **Staleness covers it.** `_item_signature` carries a markings fingerprint and the config hash
  carries the toggle. Only marks that *print* are in the fingerprint: a mark outside the trim
  changes nothing about the book, so it must not flag a current book as stale. With the toggle off
  the fingerprint is empty — drawing must not age a book that was never going to carry the drawing.
* **Print translation** (`score_markings` docstring is the canon):
  * A highlighter band becomes an **underline** — the same gesture, dropped by half the band width
    and stroked as a hairline. A filled band over noteheads is grey mush on a mono printer.
  * A **pinned** comment prints its text too, in a smaller chip. Paper has no tap target; a pin
    that printed only a dot would say nothing.
  * The conductor's ink prints **heavier** (×1.4) than a personal mark, so the layers stay
    separable with no toner colours.
* **Stamp catalogue mirrored** in `archive/annotation_stamps.py`, with a parity test that reads the
  ids straight out of `stamps.tsx`. A symbol the editor can place but the printer cannot draw
  prints nothing where a mark was expected.

**Deviation from the original spec, deliberate:** markings are **not** a card element. They say
nothing about the frontispiece, so they live in a sibling `markings` object on the item read model
(`status` / `printed` / `outside_range` / `other_edition`) and can never drag the card's roll-up
light down. And the cockpit row speaks only when something would *silently not print* —
`wrong_edition` or `partial` — instead of showing a four-state light on every item, which is that
row's own documented rule ("a label on every row would bury the one piece that needs the eye").

### What the first real render showed (2026-08-25)

A book built with the toggle on, against a live edition carrying a freehand stroke, a highlighter
sweep and an inline note. **The overlay works**: the SVG paths draw, the chip's text draws with its
Polish diacritics intact, and both land on the page and in the bar the editor showed them in. Two
things were wrong, and one thing was right but unrecognisable:

* **The chip printed ~7pt low.** "Centred by plain block layout" was not: the anchor box inherited
  a 12pt font from the body, and its strut — not the chip — decided where the first line box sat,
  so the negative `margin-top` was compensating for a number it did not know. The box now carries
  `font-size: 0; line-height: 0`, which makes the chip's top edge land on the box's top edge, and
  the vertical centring became arithmetic: `top = y − height/2`, with the height derived from the
  same constants the CSS uses. Single-line chips are exact; a comment long enough to wrap is
  estimated from the average advance, worst case half a line.
* **A bold sweep printed a bar, not a hairline.** `band × 0.16` is right at medium and too heavy at
  the top of the range. Capped at 2pt **before** the layer weight, so a conductor's underline still
  prints heavier than a reader's on the same passage.
* **The highlighter looked absent.** It was not: it printed as the underline this feature always
  intended, in full-strength ink rather than the screen's translucent band, and it reads as another
  pen stroke unless you know to look for it. Working as designed — the cockpit even says so in its
  own helper text — but worth stating plainly, because "the highlighter doesn't draw" is what it
  looks like the first time.

Also hardened while in there: `merge_overlay` now refuses to draw at all if the renderer hands back
a different number of sheets than the plan asked for. The overlay is matched to the book by order,
so one stray sheet would put every later mark on the wrong page; a book missing its markings is a
re-run, a book with a cue over the wrong bar is a rehearsal going wrong.

**Still NEEDS RENDER CHECK:** the print-canon test — that the underline and the ×1.4 weight read as
two distinct hands on a *monochrome* printout. That needs paper, not a container.

---

## 5. Stage 4 — the reader's own marks at download (`personal`, serve time) · **BUILT**

The machinery already exists and is tested: `apply_markings(pdf_bytes, page_map, marks)` takes the
stored book and returns it with ink on it, returning the input untouched when there is nothing to
draw. What is left is the wiring.

`ProjectViewSet.score_pdf` GET gains `?marks=1`. When set, the served bytes are the stored book
plus that user's `personal` overlay — composed **before** the licence watermark, cached under a
key that includes the user's markings fingerprint so a new pencil mark invalidates it. Everything
else about the path (protection decision, copy number, audit row, `mark_distributed`) is unchanged.
Note the unwatermarked branch currently streams the file handle straight through; with `?marks=1`
it has to read bytes and go through `_pdf_bytes_response` like the stamped branch does.

An empty `page_map` (a hand-uploaded book) means no mark can be placed. The switch must not be
offered there rather than silently doing nothing.

Frontend: one switch where a singer opens or downloads the score. Default off. The switch appears
regardless of whether the book already carries the conductor's markings — the two compose, which
is the point. Three surfaces reach the binder — `NextEventHero`, `TimelineProjectCard` and the
`project-score` full view in `DocumentViewerPage` — all through the shared `PdfViewerModal`, which
is why this is its own stage rather than a tail on Stage 3.

### What shipped

* **`?marks=`** on `ProjectViewSet.score_pdf` GET. `1` means the caller's own pencil; a layer may
  also be named outright, which is what Stage 5 uses. Composition happens **before** the licence
  watermark, and the unwatermarked branch now reads bytes instead of streaming the handle — but
  only when there is something to compose, so a plain download is still a stream off disk.
* **Two caches, two identities.** The composed bytes are memoised under the reader's markings
  fingerprint (count + newest `updated_at`), and that fingerprint is also part of the *watermark*
  cache key, because the marks are part of the bytes being stamped. A pencil mark made a second
  ago cannot be served from a copy composed a minute ago.
* **`GET score_marks/`** answers whether a control should exist at all: it counts only the marks
  that would actually LAND (`plan_markings` over the stored page map). A hand-uploaded book (no
  page map) and a reader whose marks all sit on trimmed pages both return `available: false`, so
  neither gets a switch that hands back an identical file.
* **`useScoreMarks`** owns the switch, the availability query and the blob fetcher together, and
  hands back a `docKeySuffix` — the composed book is different bytes at the same URL, so without
  it the viewer would keep showing the copy it cached before the switch was thrown. All three
  surfaces wire the same control; the toggle rides in the viewer's existing `toolbarSlot`.
* **Per-viewer, not a preference.** The switch resets on close. Remembering "on" would quietly
  make every casual open — checking a page number on a train — pay for a render.
* If WeasyPrint is unavailable the marked download **fails** (503) rather than falling back to the
  clean book: serving unmarked bytes under a switch that says "with my marks" is a quiet lie.

---

## 6. Stage 5 — the conductor's copy · **BUILT**

A manager-only export: the book plus the `conductor` layer. A button in the cockpit, not a config
field — it is unversioned, never counts as distribution (a manager download never did), and names
itself `…_dyrygencka.pdf`, because once it is a file in a downloads folder nothing else says it is
not the choir's book.

It is the same serve path as Stage 4 with a different layer named (`?marks=conductor`, and
`conductor,personal` if he wants his own pencil too), so the watermark ordering, the cache identity
and the page-map placement are implemented once. A non-manager naming that layer is **refused**,
not silently downgraded: a copy that quietly lacks the cues it was asked for is worse than an
error. The button appears only where he actually has cues — `score_marks/?layers=conductor` — since
otherwise it would produce the choir's book under a name claiming otherwise.

---

## 7. Annotation-system hardening (runs alongside Stages 3-5) · **BUILT**

**The conductor's colour is reserved.** Today `ANNOTATION_COLORS[0]` is crimson `#DC2626` and it
is the default for *everyone*, including choristers, and `AnnotationSerializer` does not validate
`color` at all — any 9-character string persists. Once two layers can print on one page, the
colour has to carry meaning.

* A palette SSOT in Python (`archive/annotation_palette.py`): the five inks, each flagged
  `manager_only` or not. Crimson becomes manager-only; the chorister default moves to graphite.
* `AnnotationSerializer` validates `color` against the palette and rejects a reserved ink from a
  non-manager — the same shape as the existing layer gate in `_assert_can_write`.
* The toolbar hides reserved swatches for choristers and explains the reservation once.
* Existing rows are left alone (a chorister's old crimson mark stays crimson; it is their own
  private layer and rewriting history buys nothing).

**Colour cannot be the only signal.** Mono printouts are the canon's test. In the print overlay the
conductor's ink also prints heavier than a personal mark, so the distinction survives a laser
printer with no toner colours.

**Stamp catalogue.** `frontend/src/features/annotations/lib/stamps.tsx` is a TSX catalogue; the
server-side print overlay needs the same vocabulary. Either derive both from one data file or
duplicate with a parity test on the ids — an undetected divergence prints nothing where a symbol
was expected.

### What shipped

* `archive/annotation_palette.py` — the five inks and their reservation, mirrored by
  `frontend/src/features/annotations/lib/palette.ts` with a parity test over both values and flags
  (`archive.test_annotation_palette`). A swatch offered on screen and refused by the server is a
  mark a chorister cannot make and is never told why.
* **The rule is split where the knowledge is.** `AnnotationSerializer.validate_color` enforces
  "this is a palette ink" (a fact about the data) and normalises the casing;
  `AnnotationViewSet._assert_can_write` enforces "this ink is not yours" (a fact about the
  requester), beside the layer gate it belongs with.
* The model default moved from `#FFD700FF` — a colour outside the palette, and therefore
  unvalidatable — to graphite (`archive.0027`). An unnamed ink must never be an authority one.
* Existing rows are untouched, and only a patch that RECOLOURS is judged, so the owner of a mark
  written in a retired ink can still move or erase it.
* Toolbar: a chorister sees four swatches, starts in graphite, and is told once — in the ink panel,
  where the missing swatch is — that red belongs to the conductor.

---

## 8. Rejected

* **Real PDF annotations (`/Ink`, `/FreeText`) instead of flattened ink.** Toggleable in a viewer,
  but print fidelity varies per reader, and the artifact here is a printed book on a music desk.
* **Baking `personal` marks into `Project.score_pdf`.** It ends "one book, one version, one
  distribution stamp" and hands the conductor data he is not allowed to see.
* **A conductor-side switch for other people's private marks.** Not his data; see §1.
* **A third "no markings" checkbox.** Both toggles off already says it.

---

## 9. Still open

* **D6's Mass entry preview** is the last item whose only proof is a rendered page, and it needs a
  container. (D2 is closed on the host; the markings overlay met a real WeasyPrint — see §4.)
* **The print-canon test on paper:** that a conductor's underline and a singer's read as two hands
  on a monochrome printout. Nothing in code can answer that one.
* **The reader's switch is not offered on `ScoreStandModal`** (the annotating view). It would be
  redundant there — that surface already draws the live layers on screen — but if the score stand
  ever gains a "print what I see" affordance, this is where it hangs.
* **The cockpit's `section_effective` / `role_prefix_effective` follow the reader's language while
  the card follows the book's.** D7 fixes the artifacts; the read model still resolves under
  `Accept-Language`. Doing it properly means splitting `build_program_presentation` into a
  UI-language pass (`slot_label`, which *should* follow the reader) and a book-language pass (the
  `*_effective` fields, which describe print). Not worth it while `SCORE_BOOK_LANG ==
  LANGUAGE_CODE == 'pl'`; revisit if the book is ever printed in another language.
* **Print-chrome i18n (the old T4 backlog).** Now a real defect rather than a nicety, because
  `SCORE_BOOK_LANG` is configurable and nothing honours it.
* **Two-pass card rendering** (see §2, deferred).
* **Audience programme** (the "second product": no music, pure WeasyPrint) — untouched by this
  spec.
