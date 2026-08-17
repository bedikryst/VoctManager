# Panel approachability — remediation — **OPEN**

Written 2026-08-17 from a full audit of `frontend/` + `backend/`. Four stages, each sized to one
session. Surface: the command palette (`widgets/panel-shell/command`), a new glossary layer in
`shared/ui`, the frontend test harness, and the chorister's absence report.

The audit's finding was that the hygiene layer is closed — zero locale drift (3396 base keys × 3),
zero TODOs in own code, 13 475 lines of backend tests, ruff + mypy clean. Everything below is
product work, not cleanup. **Do not open a design pass off the back of this file**; the design canon
is `.ai/04_design_system.md` and it is settled.

## How to read this file

- **Starting a stage?** Read "Protocol" and your stage's section. Nothing else.
- **Finishing a stage?** Append a `landed` block to it (what shipped, what you declined and why).
- **Tempted to add scope?** Read "Decisions, settled" first — most of it is already answered there,
  including five capabilities that already exist and must not be rebuilt.

## Protocol — how the stages hand off

Each session begins by running the **previous** stage's acceptance check and ends by writing its
own `landed` block. The check is deliberately a command plus one observable, not a review: an
open-ended "audit the last session" costs half a session and re-litigates settled decisions.
Budget five minutes. If the check fails, fix it before starting new work — a failed check is the
previous stage not being done, not a new finding.

Baseline that every stage keeps green, no exceptions:

```
cd frontend && npm run typecheck && npm run build        # frontend stages
& .venv\Scripts\python.exe -m ruff check backend\roster  # backend stages
& .venv\Scripts\python.exe -m mypy backend\roster
& .venv\Scripts\python.exe backend\manage.py test roster --settings=config.test_settings_sqlite
```

Any new or changed user-facing string lands in **all three** locales
(`shared/config/locales/{pl,en,fr}/translation.json`) in the same commit. Polish is primary and
must read natively; the locales are at zero drift today and that is worth keeping.

---

## Stage 1 — the command palette learns the content

**Why first:** highest value per unit of work, one file, verifiable by hand in two minutes.

Two audit findings, one change. They are not split, because both edit the same section-assembly
`useMemo` in `useCommandItems.ts` and splitting them means a second pass re-deriving the first
pass's ordering decisions.

**1a — the chorister's palette is six rows.** `useCommandItems.ts:74` reads
`const enabled = isOpen && isManager`, so project and artist search is manager-only — correct, and
it stays. The consequence is that an artist's palette is five nav links plus one action. On desktop
that is a detail; on a phone `MobileNavSheet` *is* the navigation surface and it opens with a search
field over six items.

Wire in the three read-models the chorister is already permitted and that are already in their
cache: their repertoire (`PERSONAL_READMODEL_KEYS.materialsDashboard`), their schedule
(`…scheduleDashboard`), and their section (`/api/documents/my-ensemble/`). No new endpoint.

**1b — nobody can search the repertoire.** Sections are `actions · pinned · recent · nav ·
projects · artists`. Pieces and composers — the largest dataset in the system — are absent, so a
conductor typing "Mozart" gets nothing. Add a repertoire section on the existing `/api/pieces/`,
same shape as the projects and artists sections, manager-scoped like them.

Constraints:
- Fold diacritics with `shared/lib/text.ts` on **both** sides of the comparison. Do not reimplement
  the fold — `ł` has no NFD decomposition and a hand-rolled version silently fails half the Polish
  surnames in the roster. `text.test.ts` pins this.
- Keep `SEARCH_RESULT_CAP`. A capped list under its own census states `{{visible}} z {{total}}`.
- New sections are lazy and gated on `isOpen`, like the existing two — the palette is always
  mounted and must never suspend the shell.

**Acceptance check:** open the palette as a chorister on a narrow viewport and type three letters of
a piece in your own programme, and of its composer's surname (use one with a diacritic) — a
**Repertuar** section returns rows that open the practice page for that piece in that project. As a
manager, type a composer's surname or a catalogue number (`BWV`, `KV`) and get the same section,
landing on the Piece Card.

### Stage 1 — landed (2026-08-17)

**Shipped.** One repertoire section, two role-scoped sources, in `useCommandItems.ts`:
- Manager → the whole archive (`archiveKeys.pieces.all` / `ArchiveService.getPieces`), row opens
  `/panel/archive-management/:id`. Keywords fold title + composer + `opus_catalog`, so `BWV 232`
  finds the work.
- Chorister → their own materials read-model (`materialsKeys.dashboard`), row opens
  `/panel/materials/:projectId/:pieceId`. A piece sung in two concerts is deliberately two rows —
  different divisi, different readiness, different destination — and the hint names the project that
  tells them apart. The query is plain `useQuery`, gated on `isOpen && !isManager`, **without**
  `RECONCILING_REFETCH`: the palette is a reader and is mounted all session, so forcing a refetch
  belongs to the page that owns the read-model.

A manager who also sings gets the archive source only. Wiring both would double every row, and the
Piece Card reaches everything the practice page does.

**One design fix this forced.** The desktop palette rendered *every* `hint` as an `Eyebrow` —
uppercase at 0.14em with `tabular-nums`, `shrink-0`, no truncation. That slot was built for a date
or a voice type; a composer's name in it would have been a person's name set as a machine label,
which the canon forbids in every view. `CommandItem` now carries `hintCasing: "overline" |
"natural"` (same axis and same reason as `Badge`'s `casing`), and a natural hint renders as a
truncating `Caption` that yields width to the label it qualifies. Default is unchanged, so dates and
voice types render exactly as before. The mobile sheet already rendered hints as a plain truncating
span and needed no change — the two renderers had quietly disagreed about hint casing before this.

**Declined, and why.** The plan named three chorister read-models; only repertoire had somewhere to
go.
- **Schedule events** — `/panel/schedule` has no URL-addressable event. The anchors exist
  (`schedule-day-*`, `schedule-hero`) but are reachable only through the page's internal
  `scrollToDay`, and `TimelineEvent.id` (`PROJ-*` / `REH-*`) is derived inside `useScheduleData`, so
  the palette would need a second copy of that id scheme. Six rows all landing on the same
  undifferentiated page is a promise a row cannot keep. Doing it honestly means adding `?event=` to
  the Schedule page plus a shared id helper — real work in another feature, and the chorister's
  schedule is a short list one tap away. Not worth expanding this stage.
- **Section directory (`my-ensemble`)** — a chorister has no per-person destination at all;
  `/panel/artists` is manager-only, so every row would land on the hub. No finer granularity exists
  in the product to link to.

Both are recorded under "Still open" as candidates, not omissions.

**Verification.** `npm run typecheck` clean, `npm run build` green, `npx eslint` clean on both
changed files, all 71 tests pass, locales at zero drift (3396 base keys × 3) with the French `é`
verified by codepoint.

Note for whoever reads the git history: an **unrelated archive refactor was in flight in the working
tree** while this stage ran (`ArchivePieceCardPage`, `AIHallucinationWarning`, `PieceMetadataForm`,
`PieceFactStrip`, …). It briefly held three type errors that were never this stage's, and resolved
on its own. Nothing here touched those files, and this stage's commit must not carry them — check
`git status` and stage only the four files listed above.

---

## Stage 2 — the glossary layer

**Why second:** it is the most direct answer to the question that started this ("more approachable,
more intuitive"), and it is independent of everything else.

There is no help, glossary or definition anywhere in the panel — a grep for help/tutorial/onboarding
returns only `WelcomeMoment` (once, on first entry) and the feedback widget. Meanwhile the
vocabulary is specialist and mixed in origin: *divisi*, *TUTTI*, *gotowość partii*, *proweniencja*,
*epoka*, *gęstość CONCERT / MASS*. Some is choral jargon a new chorister has never met; some is
named by the system itself. A person sees the **Divisi** tab and has nowhere to find out what it is.

Shape: a micro-definition at the term itself — one sentence in a `Tooltip` (the primitive exists) on
the term's **first occurrence in a view**. Not a tour and not a carousel; both were rejected before,
correctly, and this file does not reopen them.

The code here is trivial and the work is editorial. That is the whole point of giving it its own
session: a bad one-line definition is worse than none, and each line must read natively in Polish
before it is translated. Budget the session for the writing, not the wrapper.

Constraints:
- One SSOT dictionary of term → definition. A second copy of a definition is the bug this stage
  would otherwise create.
- A definition is one sentence. If it needs two, the term needs renaming instead — record that under
  "Still open" rather than writing a paragraph.
- Do not mark every occurrence. A term glossed on every row is the "never state the resting default"
  bug in a new costume.

**Acceptance check:** `npm run typecheck && npm run build`; the three locale files hold the same
base keys (the audit's diff script, or any flat-key comparison ignoring plural suffixes); and a term
that appears eight times on one screen is glossed once.

### Stage 2 — landed (2026-08-17)

**Shipped.** `shared/ui/composites/glossary/` — `glossaryTerms.ts` (the closed set of term ids and
the one rule for finding a sentence: `glossary.<id>`) and `GlossaryTerm.tsx` (the mark). Five terms,
six mounts, each on the label slot where that reader first meets the word:

| term | mount | reader |
| --- | --- | --- |
| `divisi` | `DivisiEditor` — *Divisi (opcjonalnie)* | conductor, where divisi is defined |
| `divisi` | `PieceDivisiRoster` — *Obsada (Divisi)* | chorister, Songbook piece page |
| `epoch` | `ArchiveSearchBar` — *Epoka* | conductor, archive filters |
| `edition` | `PieceRowExpanded` — *Wydania (n)* | conductor, archive row |
| `license` | `EditionsList` — *Licencja* | conductor, per edition |
| `density` | `ScorePackagePanel` — *Układ* | conductor, score-book cockpit |

The sentence lives in `glossary.*` in the three locale files and **nowhere else** — the module
carries no `t()` fallback string, deliberately breaking the house `t(key, "Polish default")` style,
because that fallback would be the second copy of the definition this stage exists to avoid. The
term text stays whatever the surface already wrote; the mark only underlines it.

**One design decision this forced: a Popover, not the `Tooltip` primitive.** The plan named
`Tooltip`, and it is the wrong instrument twice over. Radix suppresses a tooltip on touch (the
trigger's `pointerdown` closes it and the focus-open is then ignored), so on a phone — where a
chorister meets most of this vocabulary — the definition would not exist at all, which is the
touch-first rule in the canon. And its content is a `whitespace-nowrap` `Label` sized for a two-word
chrome hint. `GlossaryTerm` is a Radix Popover: tap, click and Enter all open it. Its surface is
composed (`GlassCard variant="solid"` inside a `popover-motion` content at `z-popover`) rather than a
third private copy of the dropdown/select popover skin.

**Declined, and why.**
- **TUTTI — needs renaming, not defining.** The panel spends the word on three different things: a
  rehearsal the whole cast is called to (`projects.rehearsals.form.type_tutti`), an audio track
  carrying all voices (`archive.row_tracks.tutti`), and "all sections / clear the filter" on the
  roster (`artists.filters.all` is literally *Tutti*). One sentence cannot hold three meanings, so
  by this stage's own rule it goes to "Still open". Mechanically it is also unmountable today —
  `SegmentedTabs` takes `label: string` — and the rehearsal form already answers it in context
  (*Kto jest wezwany?* over *Tutti · Sekcyjna · Wybrani*).
- **Proweniencja — the word is not on screen.** Zero hits for `prowenienc` in all three locales:
  what the reader sees is `ProvenanceChip`'s dot, which already states its own sentence per state
  ("Wyciągnięte przez AI (…), niezweryfikowane…", "Potwierdzone przez kanoniczne źródło: …").
  Glossing a term the product never prints would mean inventing the vocabulary in order to explain
  it.
- **Gotowość partii — no honest single mount.** For the singer, `ReadinessControl` spells its three
  states in plain Polish (*Nie zaczęte · Ćwiczę · Znam partię*) and `materials.piece_page.readiness_hint`
  already says who reads it. For the conductor — who is the one who could mistake a self-report for
  an assessment — the figure sits in `SetlistRow`'s per-row readiness line, and the setlist card's
  header and footer name no readiness at all, so the only available mounts are *every row* (exactly
  the bug this stage forbids) or a label that does not exist. Recorded in "Still open" as a mount
  problem, not a definition problem. (`ReadinessRing`, the chorister's other readiness surface, is
  wrapped in a `<Link>`; a button inside it is invalid nesting and would swallow the tap.)

**Verification.** `npm run typecheck` clean, `npm run build` green, 71 tests pass, `npx eslint` clean
on all eight changed/added files. Locales at zero drift — 3406 base keys in each of pl/en/fr after
this stage's five, compared with plural suffixes stripped — each locale file `+7` lines and nothing
else, with the Polish and French diacritics (`ł ó ą ż ę „ ”`, `é œ Â à`) verified by codepoint rather
than by eye.

Same note as Stage 1 for whoever reads the history: the **archive refactor is still in flight** in
the working tree (`ArchivePieceCardPage`, `PieceMetadataForm`, `PieceFactStrip`,
`ReviewArtifactsEditors`, `AIHallucinationWarning`, `archiveLanguages`). Nothing here touched those
files — the mounts were deliberately chosen in archive files the other session does not hold. This
stage's commit is the two new `glossary/` files, six mount files and the three locales.

---

## Stage 3 — the frontend test harness, then the flow tests

**Why third:** it is the largest stage and the only one that needs infrastructure before it can
produce anything. Stages 1 and 2 are hand-verifiable, so they do not wait on it.

The audit's top risk: the frontend has **6 test files against 569 sources**, all pure-logic
(diacritic fold, field shell, `InlineEditable`, preference groups, day timeline). The backend has
13 475 lines. Publishing a project mails the entire choir and is irreversible, and today the only
evidence it still works after a change is `tsc`, `build` and eye.

There is no component-testing stack at all. Confirmed against `package.json` and
`vitest.config.ts`: only bare `vitest`, `environment: "node"`, and `include: ["src/**/*.test.ts"]`
— the glob does not even admit `.tsx`. So this stage is, in order:

1. Add `@testing-library/react`, `@testing-library/user-event`, a DOM environment, and `msw`.
2. Split the vitest config so the existing pure-logic suites **stay in node** and stay fast; the new
   component suites get the DOM environment and a `.test.tsx` glob. Do not move the six existing
   files.
3. Build one render harness: `QueryClient` with retries off, the i18n instance, `MemoryRouter`, a
   mocked auth context. Every later test imports this — a second harness is the failure mode.
4. Only then write tests.

Scope of the tests themselves: **8–12, exclusively on irreversible flows** — the ones that send a
message or change state for forty people. Project publication, RSVP, attendance marking, account
activation. This is not a coverage target and the rest of the panel is deliberately left untested;
say so in the config comment so a later pass does not read the gap as an oversight.

**Acceptance check:** `npm run test` runs both projects green; deliberately break one assertion in a
publication test and confirm it fails (a suite that cannot fail is not a suite); `npm run build`
still clean.

---

## Stage 4 — absence over a date range

**Why last:** it touches both sides, and it lands in a repo that Stage 3 has made testable.

`AbsenceReportForm` is used in exactly two places and both are single-event: the timeline rehearsal
card and the next-event hero. A chorister away for three weeks opens every rehearsal separately and
fills the same form each time.

**No schema change and no migration.** `Attendance` is unique on `(rehearsal, participation)`, so a
range is a bulk upsert of N rows — one per rehearsal the artist is a participant of, inside the
dates, each carrying the chosen status and the same `excuse_note`.

Constraints:
- Reuse `DateTimeField` for the range. Its value is a wall-clock **string**, never a `Date`, and no
  native `type="date"` exists in the tree.
- The self-report path must stay self-scoped: the existing pattern gates on
  `participation.artist.user_id != request.user.id` unless `user_is_manager`. Match it.
- Report what happened. A range covering seven rehearsals of which the artist participates in four
  states four, not seven — and states it before submitting, not after.
- Idempotent: re-submitting an overlapping range updates rather than duplicating.

**Acceptance check:** ruff + mypy + `roster` tests green; a range across a project boundary writes
rows only for rehearsals the artist actually participates in; submitting the same range twice leaves
the same number of rows.

---

## Decisions, settled

Do not reopen these without a reason that is new.

- **Section-leader role — REJECTED (2026-08-17, by the product owner).** The audit proposed an
  intermediate role because delegating attendance today requires full manager rights, which exposes
  budgets, contracts and other singers' vocal assessments. Declined: the choir is small enough that
  the exposure is theoretical. If the ensemble grows, this is the first thing to revisit — the
  reasoning is in the audit, not lost.
- **Manager nav carries the artist zone — NOT a defect.** The audit's weakest finding. The
  conductor sings too, so schedule/materials/hub belong there. A "view as chorister" switch is an
  idea, not a task; it is not in this plan.
- **These five already exist. Do not rebuild them.** Every one was hypothesised as a gap during the
  audit and found already shipped: offline (whole query cache persisted 24h + per-concert material
  download), pitch-preserving slow practice (`practicePlayerEngine`, `preservesPitch`, remembered
  per piece), large tap targets for roll-call (`ArtistRow` density `rollcall`, built for a tablet
  held in front of the choir), onboarding (`SeasonSetupConcierge` + `WelcomeMoment`), and the
  palette / notification centre / feedback widget / PWA.
- **No tour, no carousel, no onboarding takeover.** Rejected previously; Stage 2 does not revive
  them under another name.
- **No design pass.** `.ai/04_design_system.md` is canon and closed. If a stage finds a genuine
  design defect, fix it in place and record it under "Still open" — do not replace a composition.

## Still open

- Dead `archive.*` i18n keys — inherited from the i18n remediation's dead-key sweep, unrelated to
  this plan, still unswept.
- Stage 2 may surface terms that need **renaming** rather than defining. Record them here as they
  are found; renaming is not in scope for this plan.
  - **TUTTI, found in Stage 2.** Three meanings under one word: the rehearsal the whole cast is
    called to, an audio track carrying all voices, and the roster filter's "all sections" reset
    (`artists.filters.all` = *Tutti*, whose siblings are voice sections — the odd one out, and the
    cheapest to rename). A definition would have to say three things, so it gets none until the
    third meaning is renamed.
- **`Tooltip`'s content cannot wrap.** The primitive sets `whitespace-nowrap` on a `Label` sized for
  a two-word chrome hint, but `ProvenanceChip` already passes sentence-length copy into it
  ("Wyciągnięte przez AI (…), niezweryfikowane — sprawdź z PDF i popraw w razie potrzeby."), which
  renders as one unwrappable line. Stage 2 routed around it (its own mark is a Popover) rather than
  fixing it, because the fix belongs with the archive files another session is holding. A `max-w` +
  wrapping content, checked against the sidebar's short labels, is a small pass for whoever gets
  there next.
- **A mount for "gotowość partii".** The conductor's readiness figure lives per row in `SetlistRow`
  with no column header or legend to hold a definition, so the term cannot be glossed without
  marking every row. Whichever surface grows a header that owns that figure is where the gloss goes;
  the sentence itself is a five-minute job once the slot exists.
- **Schedule events in the palette** — blocked on `/panel/schedule` gaining a URL-addressable event
  (`?event=`) plus a shared `PROJ-*`/`REH-*` id helper so the palette does not retype the scheme.
  Declined in Stage 1; a candidate, not an omission.
- **Section-mates in the palette** — blocked on a chorister having any per-person destination.
  Would need an anchor in the Chorister Hub, or a "message this person" route that does not require
  an existing thread id. Declined in Stage 1.
- Nothing owed from Stage 1 or Stage 2 — both stages' gates are green.
