# Score book remediation — audit, repairs, and the markings feature

Status: **STAGE 1 BUILT** (2026-08-25) · Stages 2-5 READY TO IMPLEMENT · Backend-heavy
(`backend/roster/infrastructure/`, `backend/roster/score_package_*.py`), moderate frontend
surface (cockpit panel + annotation toolbar), one new serve-time path.

Stage 1 shipped D1-D8 plus the concurrency guard, with 21 new tests (155 green across
`test_score_package_cockpit`, `test_score_protection`, `test_score_source_numbering`), ruff +
mypy clean, frontend typecheck + lint clean. Migration `roster/0044_score_package_build_started_at`
**still needs applying** (`make migrate`); the host has no Postgres, so it was validated on the
sqlite test DB. The two NEEDS RENDER CHECK items below are still outstanding — they need a
container.

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
derived from the same box the detector measured. NEEDS RENDER CHECK for the visual.

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

**Outstanding for Stage 1:** apply migration 0044, and confirm in the container the two
NEEDS RENDER CHECK items (D2's knockout placement on a rotated edition, D6's Mass entry preview).

### Also found, deliberately deferred out of Stage 1

* **One WeasyPrint invocation per piece.** A 20-piece programme pays 20 process-level renders.
  Reducible to two passes (count pages, then render with folios) using `bookmark-level` to find
  card boundaries. Real win, but it changes the render path and must not ride alongside
  correctness fixes.
* **`overlay_pages[:body_count]`** truncates silently where a plan/reality mismatch should shout.
* **No outline entry for the Mass "Teksty i tłumaczenia" section**, and the TOC is a flat list
  even for a Mass, although `build_program_presentation` knows the parts of the rite.

---

## 3. Stage 2 — the page map (prerequisite, no user-visible change)

Annotations are stored against `(edition, page_number)` in normalized 0..1 coordinates. The book
trims pages, scales and re-centres them onto A4, and interleaves cards. The transform that maps
one to the other (`scale`, `tx`, `ty`) is computed inside the builder and thrown away.

**Persist it.** `ScorePackage.page_map` (JSON), written on every successful build:

```
[{ phys: 0, kind: "front"|"card"|"music"|"spacer", folio: 1|null,
   item_id: "…", edition_id: "…", source_page: 3,
   scale: 0.94, tx: 14.0, ty: 42.5 }, …]
```

A few hundred rows for a large book. It is what makes serve-time composition possible **and**
honest: the overlay is placed against the geometry the stored PDF actually has, not against a plan
re-derived from data that may have moved since.

It pays for itself beyond markings: "this book page is this piece", per-page provenance, and a
future incremental rebuild of one changed item.

---

## 4. Stage 3 — the conductor's markings in the book (`shared`, build time)

One toggle in the cockpit's "Struktura książki" tier: **"Wpisz moje oznaczenia w książkę"**.

* Rendering: one overlay document for the whole book (same trick as the numbering overlay), pages
  merged onto the body. Coordinates come from the page map.
* **Staleness must cover it.** `_item_signature` gains a markings fingerprint — count plus
  `max(updated_at)` of `shared` annotations on the bound edition **within the trimmed page
  window**. Draw a new mark and the book reads "Program zmieniony", as it should.
* **Readiness gains an element.** Per item: 🟢 markings present and inside the bound range ·
  🟡 some fall outside the trim (they will silently not print) · ⚪ none ·
  **alarm** when the pinned edition is not the annotated one — pinning a different edition
  discards every mark, and today nothing says so.
* **Print, not screen.** Highlighter is `mixBlendMode: multiply` at 0.42 opacity; on a mono
  printer that is grey mush over the noteheads. In the print path a highlight becomes an outline
  or an underline, never a fill. Verify on a monochrome printout (print canon).

---

## 5. Stage 4 — the reader's own marks at download (`personal`, serve time)

`ProjectViewSet.score_pdf` GET gains `?marks=1`. When set, the served bytes are the stored book
plus that user's `personal` overlay — composed **before** the licence watermark, cached under a
key that includes the user's markings fingerprint so a new pencil mark invalidates it. Everything
else about the path (protection decision, copy number, audit row, `mark_distributed`) is unchanged.

Frontend: one switch where a singer opens or downloads the score. Default off. The switch appears
regardless of whether the book already carries the conductor's markings — the two compose, which
is the point.

---

## 6. Stage 5 — the conductor's copy

A manager-only export: the book plus the `conductor` layer (and, if he wants, his own `personal`).
A button, not a config field: it is unversioned, never counts as distribution, and must never be
confusable with what the choir receives.

---

## 7. Annotation-system hardening (runs alongside Stages 3-5)

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
