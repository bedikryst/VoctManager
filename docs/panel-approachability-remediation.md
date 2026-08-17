# Panel approachability — remediation — **OPEN**

Written 2026-08-17 from a full audit of `frontend/` + `backend/`. Four stages, each sized to one
session. Surface: the command palette (`widgets/panel-shell/command`), a new glossary layer in
`shared/ui`, the frontend test harness, and the chorister's absence report. A fifth stage was added
afterwards, from what Stage 4 found on its way through the attendance paths.

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

### Stage 3 — landed (2026-08-17)

**Shipped — the harness, three files in `src/test/`.** It lives at the top level beside
`app / pages / widgets / features / shared` rather than inside `shared/`, because it imports the auth
provider from `app/` and `shared/` stays domain-free.

- `harness.tsx` — the one render entry. `renderWithPanel` for components, `renderHookWithPanel` for
  the flows whose irreversible step is a hook rather than a button; both wrap the same `PanelHarness`
  (`QueryClient` with retries off → `AuthContext.Provider` → `MemoryRouter`) and both hand the test
  back the `QueryClient`, so an optimistic patch can be read out of the cache. Two seated identities,
  `TEST_MANAGER` and `TEST_ARTIST`. Extend this file; the plan's warning about a second harness is
  the reason it also carries the fixtures.
- `setup.ts` — the browser APIs jsdom omits (`matchMedia` for framer-motion's reduced-motion query,
  `ResizeObserver`), the msw lifecycle, and the language pin.
- `server.ts` — one msw server with **no default handlers**, run as
  `onUnhandledRequest: "error"`. In a suite whose whole subject is writes that cannot be undone, a
  request nobody stubbed is the finding.

One app-code change: `AuthContext` and `AuthContextType` are now exported from `AuthProvider.tsx`.
`useAuth` resolves the context by identity, so a look-alike provider cannot seat a session, and
`vi.mock` on the module would have hidden the real provider from every suite at once.

**The vitest split.** `test.projects` with `extends: true` (so both inherit the path aliases and the
`__APP_BUILD__` define): `logic` — node, `src/**/*.test.ts`, no setup file; and `flows` — jsdom,
`src/**/*.test.tsx`, `setupFiles: ["./src/test/setup.ts"]`. The six existing files did not move and
did not slow down (71 tests in ~180 ms); the jsdom environment alone costs seconds to stand up on
Windows, which is the whole argument for the split rather than one DOM project.

**The scope ceiling is written into the config header**, at length, so a later pass reads the
untested remainder as a decision: these four flows are where a regression sends mail, marks the wrong
person absent, or burns a single-use invitation link — the places where `tsc`, a build and a look at
the screen genuinely are not evidence.

**The i18n decision: the application's own instance, not a test copy.** `setup.ts` seeds
`localStorage.voctmanager_lang = "pl"` *before* importing `shared/config/i18n` (the detector reads
that key first, and jsdom's navigator reports en-US), then awaits `i18nReady`. So the tests find
controls by the Polish words a chorister actually reads — `Opublikuj i wyślij`, `Aktywuj konto`,
`Zaznacz akceptację regulaminu…` — and `pl/translation.json` is now load-bearing for the suite. A
second instance seeded with test strings would have let the locale files rot while the suite stayed
green, and react-i18next keeps one default instance anyway, so two `initReactI18next` calls would
race.

**Twelve tests, four flows.**

| flow | file | what is asserted |
| --- | --- | --- |
| publication (4) | `PublishProjectModal.test.tsx` | the recipient count and every warning are stated before the act; confirming sends **exactly one** POST to `publish/` and reports back; an unpublishable project cannot be sent; the dialog resists Escape, cancel and close while the write is in flight |
| RSVP (4) | `useScheduleData.test.tsx` | confirming presence POSTs `PRESENT` with the artist's own participation and **no invented excuse note**; editing an existing report PATCHes that row instead of filing a second; a refused write leaves no confirmation in the cache; a rehearsal the artist is not cast in produces no request at all |
| roll-call (2) | `rehearsals.queries.test.tsx` | a tap lands on the roster before the server answers and sends one record, leaving neighbouring rows alone; "mark the rest present" writes one request per singer — PATCH for those who have a row, POST for those who do not |
| activation (2) | `ActivatePage.test.tsx` | an unticked consent box does not spend the invitation, and the form names the rule it is holding on; the happy path POSTs `terms_version` equal to the `LEGAL_DOCS_VERSION` the screen displayed |

Publication and activation are driven through the real components with `user-event`; RSVP and
roll-call through `renderHookWithPanel`, because that is where their irreversible half lives.

**One harness bug the tests found.** `gcTime: 0` in the test `QueryClient` — it looks like hygiene
and it evicts any cache with no observer, which is exactly the shape of the roll-call roster
(`["attendances"]`, patched optimistically, read by an assertion rather than by a component). The
roll-call test failed as *expected undefined to be 'PRESENT'*: an eviction dressed as a missing
write. Removed, with the reasoning recorded in `createTestQueryClient` so nobody re-adds it.

**Declined, and why.**
- **`@testing-library/jest-dom`.** Not among the four dependencies the plan named, and every
  assertion here reads fine without it (`expect((confirm as HTMLButtonElement).disabled).toBe(true)`).
  Adding a matcher library to make four `.disabled` checks prettier is not worth widening the stated
  dependency set.
- **Mocking `axios` or the service layer instead of msw.** The value of these tests *is* the request
  — method, URL, body. A stubbed `ProjectService.publish` proves the component calls a function; the
  msw handler proves the choir is mailed once, at the right URL, with the right payload.
- **`TimelineRehearsalCard` as the RSVP entry point.** The card receives `onSubmitReport` as a prop,
  so a test through it proves prop wiring and stops short of the network. The parts that can mark the
  wrong person — the participation lookup and the create-vs-edit decision — are in
  `useScheduleData.handleAbsenceSubmit`, and that is what is tested.
- **Rendering `Schedule` or `Rehearsals` whole.** Both pull in map, audio and scroll surfaces with no
  bearing on the write, and would make the suite fail for reasons that are not the flow.
- **A coverage threshold or a `--coverage` gate.** A percentage measured over 569 sources would
  report this deliberate ceiling as a failure, and the cure would be tests written to move a number.

**Verification.** `npm run test` → 10 files, 83 tests, both projects green (`logic` 71 / `flows` 12).
`npm run build` clean — and note that it was the build, not vitest, that caught three type errors in
the new test files: vitest transpiles without checking, while `tsconfig.app.json` includes
`src/**/*`, so the tests are inside `tsc -b` and stay there. `npm run lint` clean. No new
user-facing strings, so no locale change this stage.

**Proof the suite can fail.** In *"sends exactly one publish request"*,
`expect(publish.count()).toBe(1)` → `toBe(2)`. Result: `1 failed | 82 passed`, reported as
`AssertionError: expected 1 to be 2` at `PublishProjectModal.test.tsx:134` — the assertion reads the
count of requests that actually reached the msw handler, not a value the test set itself. Reverted;
re-run green at 83.

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

### Stage 4 — landed (2026-08-17)

**No schema change, no migration** — as planned. `Attendance` is still unique on
`(rehearsal, participation)`, and the range is `update_or_create` in a loop.

**Backend — one query decides the set, and both sides read it.** The seat filter that
`get_artist_schedule` used inline (not deleted, not declined, project not DRAFT) is now
`_schedule_seats(**artist_lookup)` in `roster/queries/schedule_queries.py`, called by the dashboard
*and* by the new `get_artist_rehearsals_in_window(artist_id, start, end)`. That shared predicate is
what makes the count the singer is shown equal the rows the write produces; two copies of the rule
would have drifted the first time either was touched.

- **The window is wall-clock, judged on each rehearsal's own venue clock.** SQL narrows on UTC with a
  day of slack either side (every zone on earth fits inside that), then `localize()` — the helper
  `day_timeline` already had — decides the exact edges. "Away until the 21st" is a calendar fact; a
  tour crossing timezones must not move it.
- `AttendanceRangeDTO` (`roster/dtos.py`): `artist`, `starts_at`, `ends_at` as **naive** wall-clock
  datetimes (a payload carrying an offset is refused), `status`, `excuse_note`. Two guards beyond the
  obvious: `ends_at` may not precede `starts_at`, and the span may not exceed 366 days — a mistyped
  year would otherwise reach back over a singer's whole history in one request.
- `RehearsalOperationsService.record_attendance_range` gates exactly like `record_attendance` does,
  one line moved from participation to artist: `artist.user_id != dto.requesting_user_id` unless
  `is_manager`.
- `POST /api/attendances/range/` (an action on `AttendanceViewSet`) answers
  `{updated, attendances}`. The payload is **whitelisted, not splatted** — the existing `create`
  does `**request.data`, which means a caller naming `requesting_user_id` raises `TypeError` and
  returns 500. The new path does not inherit that.

**Rejected: LATE over a span.** The range accepts `ABSENT` and `EXCUSED` only. Three weeks of
"I'll be a little late" is not a statement anyone can act on, and `minutes_late` has no meaning
spread over a fortnight (range writes set it to `None`). The form's status select is disabled while
the span is on, so the narrowing is visible rather than a validation surprise.

**Rejected: one notification per rehearsal.** A fortnight away would have pushed six identical
ABSENCE_REQUESTED alerts. It sends **one per production** instead — grouped by project, because a
span reaching across two of them cannot name one project truthfully. `ManagerActionMetadata` and
`AbsenceStatusMetadata` gained `ends_at` / `ends_at_display` / `rehearsal_count`; `display_event_end`
resolves the closing moment the same way `display_event_time` resolves the opening one (both now
share `_display_moment`, which is what that function's docstring already anticipated). The three
absence composers swap the single `Rehearsal` detail row for `From` / `Until` / `Rehearsals covered`
when the count is above one — **no new `NotificationType`**, which would have cost eight layers.

**Frontend — the count is stated before the send, from the data already on the client.**
`useScheduleData` exposes `absenceRange = { resolve, submit }`. `resolve(from, to)` walks the
schedule dashboard, converts each rehearsal to its venue-local wall clock via the new
`toZonedWallClock` (`shared/lib/time/timezone.ts`, built from `formatToParts`), and returns
`{count, inWindow, rehearsalIds}`. `inWindow` is deliberately separate from `count`: a range covering
seven rehearsals of which four are the singer's says **four**, and the difference is the rehearsals
they were never invited to plus any they only conduct (no participation, no seat).

- No preview endpoint. The dashboard is already the complete set of rehearsals the artist takes part
  in, all time, and it is resolved by the same predicate the server writes against — so a round trip
  per keystroke would buy nothing and would go silent offline.
- `useReportAbsenceRange` is **not optimistic**, unlike the single-event RSVP. One tap and one card
  are the same object; a span rewrites a fortnight of them and the server decides which. Guessing the
  set on the client would paint rows the write may never reach; the invalidate on settle is honest
  and costs the same one request.
- `AbsenceReportForm` grows an optional `range` prop: a checkbox, two `DateTimeField`s (`00:00` and
  `23:59` defaults, wall-clock strings — no native `type="date"` was added), and one live line that
  reads *"Zgłoszenie obejmie 4 Twoje próby w tym zakresie"*, *"…nie ma żadnej Twojej próby"*, or a
  prompt to pick the return day. Both existing mounts (timeline card, next-event hero) pass it
  through `useTimelineRehearsalCard`, which owns the span state per card — so two open cards cannot
  share one half-typed range. The span starts on the opened rehearsal's own day.

**Verified.** `ruff` + `mypy` clean on `roster` and `notifications`; **567 backend tests OK**
(`config.test_settings_sqlite`), including ten new ones in `roster/test_absence_range.py` and two
composer tests in `notifications/tests.py`. Frontend: `npm run test` **86 tests** (logic 71 /
flows 15 — three new range tests in `useScheduleData.test.tsx`, through the Stage 3 harness, no
second wrapper), `npm run lint` and `npm run build` clean.

The two acceptance checks are tests, not prose:
`test_range_writes_only_rehearsals_the_artist_takes_part_in` builds seven rehearsals in the window
across two live productions, a draft and a declined project, and asserts the four the singer holds a
seat at; `test_the_same_range_twice_leaves_the_same_rows` sends the same window twice and asserts the
row count is unchanged and the second note is the one that stands.

Strings landed in all three locales (`schedule.rehearsal.range.*`, with the four Polish plural forms)
and six new msgids in `pl` / `fr` / `en` `django.po` + recompiled `.mo`.

---

## Stage 5 — the four things Stage 4 found

**Why a fifth stage:** three defects and one missing door, all surfaced by Stage 4 and none of
them belonging inside it. Three are rule changes on paths Stage 4 only *read*; the fourth is a UI
for an endpoint that already existed. Written up after the fact — this stage was not in the plan.

### Stage 5 — landed (2026-08-17)

**1. A self-report can no longer rewrite the past.** The rule now exists and has one home:
`roster/domain/attendance_window.py` → `is_open_to_self_report(rehearsal)`.

- **The line is the rehearsal's own calendar day, read on the venue clock** — not "in the future".
  Two things depend on that choice: *"I'm running late"* and *"I never made it tonight"* are both
  reports a singer files **after** the downbeat, and a stricter gate would have refused the very
  message the feature exists to carry. Yesterday's evening is closed to them. The same wall-clock
  reading a span of days is judged by, so the two cannot disagree about which day an evening is on.
- **A manager is never asked the question.** Correcting the record after the fact is the whole of
  their job, and the roll call is the record.
- **The create path was never where the hole was.** `AttendanceViewSet` had no `update` of its own,
  so a singer could PATCH a row of theirs straight through the serializer — which is also how the
  panel's own RSVP edits an existing report. Gating `record_attendance` alone would have been
  theatre. `update` and `destroy` now carry the same gate, answered by `_refuse_closed_row`.
- **One further hole, found while fixing that one.** `AttendanceSerializer` is `fields = "__all__"`,
  so `participation` was writable: the queryset scoped a singer to rows of their own, and one of
  those rows was a pointer they could re-aim at any seat in the choir. The edit path now whitelists
  `status · minutes_late · excuse_note` — the row's identity is not editable. PUT is served with
  the same partial semantics rather than failing on two fields it is no longer allowed to set; both
  clients already re-send exactly the values they read.
- **One refusal, whichever door.** All three paths answer with a 403 carrying the stable code
  `attendance_window_closed` and curated copy in the three locales — a bare 403 renders as "Nie masz
  dostępu do tej operacji", which is not the reason (the row is not out of bounds; the evening is
  over). The create path gets there through `SelfReportWindowClosedException`, so the *rule* stays
  in the service and only its wire shape is decided in the view.
- **The range inherits it through the resolver, not through a second rule.**
  `RehearsalOperationsService.resolve_attendance_range` is what both the write and the new preview
  call; a singer's span drops the evenings already held there, before the loop, so the count they
  are promised is the count they get.
- The chorister's client mirrors it in `features/schedule/lib/absenceWindow.ts` for one purpose:
  the count stated before sending. A span reaching backwards is a normal thing to type — it is the
  day you fell ill — so the form now **names what it will leave alone** ("3 próby z tego zakresu już
  się odbyły — ich wpisy zostają bez zmian.") instead of quietly returning a smaller number than the
  dates on screen imply.

**2. `**request.data` — swept, in one helper.** `core/request_utils.client_payload(source, only=…)`,
at all 13 sites across `core/views.py` and `roster/views.py`. It closes two crashes a stranger can
reach with one curl: a body that is not a JSON object (`**` on a list raises before any validator
runs) and, where the view supplies its own arguments beside the payload, a caller naming
`requesting_user_id` or `is_manager` and hitting the duplicate keyword. Unpacking semantics are
preserved exactly, form-encoded case included — `{**QueryDict}` yields lists, and a DTO refusing a
list is the same 400 it always was. Query strings are the exception and say so at the call site:
`request.query_params.dict()` first, or every field arrives as a one-item list.

**3. A cancelled project takes its rehearsals with it.** One predicate, as predicted:
`_schedule_seats` now excludes `CANCELLED` alongside `DRAFT`, and the conductor's own id set
excludes it too (their drafts stay — they are the one planning them). `projects_qs`'s own
`.exclude(CANCELLED)` went with it: cancellation is decided upstream now, on both id sets, which is
exactly what stops the concert row and its evenings from parting company again. The range agreed
with the dashboard before this change and still does, for free.

**4. The manager's door onto the range.** `AbsenceSpanSheet`, mounted **once** by
`RehearsalInspector` and opened from a roster row.

- **The trigger appears only once tonight is already settled as an absence** (`ABSENT`/`EXCUSED`) —
  which is the moment the thought occurs, and keeps the action off the other thirty-nine rows.
- **A preview endpoint after all** — `GET /api/attendances/range-preview/`. This does not contradict
  Stage 4's "no preview endpoint": that was about the *chorister*, whose own schedule read-model
  already **is** the set and stays honest offline. A manager excusing somebody else holds no such
  list, and rebuilding the seat rule (declined · draft · cancelled · invited-or-tutti) in the browser
  is precisely how the number shown and the rows written begin to disagree. It resolves through the
  same `resolve_attendance_range` the write uses.
- The sheet **lists the evenings by name and by production**, because a span opened from one
  production reaches into every other the singer sits in — and it names how many of them already
  carry a record, since a manager's span can overwrite a roll call that was actually taken.

**Declined, and why.**
- **Notifying on an edit.** A manager PATCHing a row still sends nothing, as before. Unifying
  `update` into `record_attendance` would have been tidier and would have put the singer's phone in
  the path of a roll call: tap ABSENT, correct to PRESENT, correct back — three messages about one
  person. The inconsistency (create notifies, edit does not) is now recorded under "Still open"
  rather than fixed by accident inside a security pass.
- **Clamping the singer's span to today on the client.** Silently moving a date the singer typed is
  a worse answer than counting honestly and saying what is left alone.
- **`freezegun` / `time-machine`.** The rule is about the clock, so the fixtures had to stop being
  written in fixed dates — but that is a fixture problem, not a dependency problem. Both suites now
  build every date as an offset from the run. (This was not optional: `test_absence_range`'s August
  2026 fixture had already drifted into the past, and three of its tests failed the moment the gate
  landed — they were asserting the rule this stage forbids.)
- **A project-scoped span for the manager.** The endpoint is per artist across productions, and
  pretending otherwise in the UI would have written rows the sheet never mentioned.
- **A day of grace on top of the boundary.** Tempting, because of one case: an RSVP made offline in
  a church basement and replayed after midnight is now refused, and `flushOfflineQueue` drops a 4xx
  rather than retrying it forever (the member is told — `offline.sync.rejected` — and the refusal
  copy names the manager as the way back). A grace would also cover "I forgot last night, I'll say
  so at breakfast". Both were declined: the ask was that a singer gets the future, a grace buys
  back precisely the ability to rewrite an evening the roll call has just settled, and the timeline
  already withholds the RSVP controls four hours after a start — so the second case cannot be
  reached through the UI anyway, with or without this rule.

**Verification.** `ruff` + `mypy` clean on `roster` and `core`; **678 backend tests OK** across
`roster · notifications · core` (`config.test_settings_sqlite`), including the new
`roster/test_self_report_window.py` (9) and five new range/preview tests. Frontend: `npm run test`
**87 tests** (logic 71 / flows 16), `npm run lint` and `npm run build` clean. Strings landed in all
three locales.

One pre-existing failure, untouched and unrelated: `documents.tests.DocumentCategoryTests.
test_artist_cannot_see_manager_category` raises `NotSupportedError: contains lookup is not supported`
— a JSONField `contains` that only Postgres implements, so it fails under the sqlite settings and
passes in the container. Not this stage's, and not a regression.

### Stage 5 — review pass, before the commit (2026-08-17)

A second read of the whole uncommitted stage. The rules held — the window gate, the `client_payload`
sweep and the cancelled-project predicate were all sound, and their tests assert the right things.
What did not hold was what three surfaces *said*, in each case where a count is nil for a reason the
copy does not name.

- **A crossed range left the sheet on a sentence that was no longer true.** `AbsenceSpanSheet` gated
  its preview query on `from <= to` and then read `preview.isPending` — which a disabled query
  reports as `true` forever, so picking an end before the start parked the box on *"Sprawdzam
  kalendarz…"* while nothing was being asked of anything. It now names the crossed dates
  (`rehearsals.span.range_inverted`). `isPending` was left alone deliberately for the live case: it
  is the one that also covers the first fetch of a new window. The singer's own form had the same
  typo reading as an answer — it resolves a crossed pair to nought and printed *"nie ma żadnej Twojej
  próby"* — so it gained the matching line, in its own vocabulary (*dzień powrotu*), on the summary
  and on the toast that refuses the write.
- **"W tym zakresie nie ma żadnej Twojej próby" was a lie whenever the whole span was behind.** The
  singer's form printed it in crimson and then, one line down, "3 próby z tego zakresu już się
  odbyły" — two statements that cannot both be true, and the same wrong sentence went out as the
  toast that refuses the write. Both now branch on `preview.past`
  (`schedule.rehearsal.range.preview_all_past`), and the `past_untouched` line stands down when it
  would only repeat it.
- **Plural agreement in the overwrite warning.** `overwrites_*` counted the entries and then
  referred to them in the singular in all three locales ("5 z nich ma już wpis — zostanie
  nadpisany"; "…it will be overwritten"; "…elle sera écrasée").

**And one rule finished, on the product owner's call: a chorister's own projects are decided by one
predicate.** Stage 5 took a cancelled concert's rehearsals off the schedule and stopped there, which
left the singer being told two things — no concert on the timeline, its programme still open in the
Songbook. Pulling that thread found the same rule copied into six places, disagreeing in three
different ways. It is now `Participation.live_seats(**artist_lookup)` on the model, and everything a
chorister is offered about their own projects goes through it.

**The seat, stated once.** Not deleted, not declined, and in a project the cast may see at all
(`Project.HIDDEN_FROM_CAST_STATUSES` — `DRAFT`, `CANCELLED`). Callers: `_schedule_seats` (so the
schedule and the absence range are unchanged in behaviour and shorter in code),
`get_artist_materials_queryset`, `artist_has_live_access_to_piece` and `artist_live_piece_ids` (the
score and shared-annotation gate), and the non-manager branch of the five plain endpoints —
`projects`, `rehearsals`, `program-items`, `project-piece-castings`, `crew-assignments`. Score access
composes **on top**: `CLOSED_PROJECT_STATUSES` narrows it further once the concert is over, and never
widens it.

Three holes closed by saying it once:

- **A cancelled concert now leaves entire.** The card goes with the score the gate was already
  refusing. The *pieces* stay in the archive — they belong to the choir, not to any one project, and
  a test asserts it.
- **A draft is no longer served underneath the silence.** It was hidden from both read-models and
  handed over by `GET /api/projects/`, `/api/rehearsals/` and — the one that mattered — the score
  endpoint, because `artist_has_live_access_to_piece` asked only whether a project had *closed*. The
  earlier reasoning for leaving it (a draft is "live", so a cast could rehearse from real scores
  before announcement) does not survive contact with the announcement queue: DRAFT is silence, the
  cast has not been told, so there is nobody to rehearse.
- **Declining a project hands back its music.** The schedule understood this from the start; the
  songbook and the score gate never asked about the seat's status at all.

**Three fixtures changed, and that is the finding underneath.** `Project.status` defaults to `DRAFT`,
so `_ServeBase` and `ContractsSettlementTests` were quietly proving chorister access *on unannounced
projects*. They now say `status=ACTIVE`, which is what they always meant. Whenever a project fixture
omits the status, check which rule it is actually exercising.

Pinned by `DraftInvisibleToCastTests` (extended), `DeclinedSeatKeepsNothingTests`,
`CancelledInvisibleToCastTests` and `SeatBoundScoreAccessTests` — every one of them carrying a
control (a live concert, a colleague who kept their seat, a manager) so an assertion cannot pass
against a query that has simply stopped answering.

Re-verified whole: ruff + mypy clean, **803 backend tests OK** across `roster · notifications · core ·
archive · messaging · payments · logistics`, `npm run typecheck / lint / test` (87) `/ build` clean,
locales at zero drift (3437 base keys × 3, diacritics checked by codepoint),
`makemigrations --check` clean — `live_seats` is a classmethod and `HIDDEN_FROM_CAST_STATUSES` a
class attribute, so neither is a schema change.

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
- Nothing owed from Stage 1, 2 or 3 — every stage's gates are green.

**Found by Stage 4 — all four closed in Stage 5.** The self-report time gate, the `**request.data`
sweep, the cancelled project's orphaned rehearsals, and the manager's UI for the range. Read that
stage's landed block for the rules that came out of it; do not re-derive them here.

**Found by Stage 5, left deliberately.**

- **An edit notifies nobody.** A singer changing an existing report (ABSENT → PRESENT, or a new
  reason) sends no message, while filing the first one does — the difference is only whether a row
  happened to exist already, which nobody chose. The same asymmetry runs on the manager's side: they
  are told when a singer files, not when they change their mind. The fix is not "notify on PATCH" —
  a roll call taken on a tablet would put three messages on one singer's phone for one person's
  correction. It needs a rule about *what changed* (status crossed between present and absent) and
  probably a debounce, which is a notifications question, not an attendance one.
- **The rest of the panel has not been read against `Participation.live_seats`.** The rule is now
  stated once and every door in `roster` calls it, but the sweep went as far as the surfaces the
  cancellation thread ran through. `documents`, `messaging`, `payments` and `notifications` each
  decide for themselves what a chorister's project is; none was found wrong, none was audited. If a
  fifth disagreement turns up, that is where.
- **`Attendance` has no author and no timestamp.** Nothing on the row records who wrote it or when,
  so "the manager marked me absent" and "I marked myself absent" are indistinguishable after the
  fact, and the new time gate is enforced only at the moment of writing. Fine for a choir of this
  size; the first thing to add if attendance ever becomes contested.

**What Stage 3's harness does not reach.** Not a to-do list — the ceiling was deliberate — but these
are the specific things a later pass should not assume are covered:

- **Everything the server decides.** msw answers whatever the test tells it to, so the suite proves
  the panel *sends* the right request and never that the backend accepts it. Publication's real
  contract — one `Announcement` per awaiting participation, none for those who already replied, the
  `is_publishable` verdict itself — is backend behaviour and belongs in `backend/projects` tests
  (`--settings=config.test_settings_sqlite`). If those tests do not exist, that is the larger gap,
  and it is a backend stage.
- **The activation link's dead states.** `linkStatus` (`checking` / `expired` / `invalid`) gates the
  whole password form, and only the live `ok` path is tested. Reaching the others means driving
  `parseApiError` off a stubbed error code — cheap, and worth adding next time this file is opened.
- **The offline RSVP branch.** `useUpsertScheduleAttendance` treats an error with no `response` as
  "still offline" and enqueues the write in `useOfflineStore` instead of rolling back. That branch —
  the one that decides whether a POST replays as a POST — is untested; it needs a network-level
  failure plus the zustand store, not just a 500.
- **Optimistic reconciliation after settle.** The roll-call test asserts the optimistic patch and the
  requests, then stops. `settleOptimistic`'s "only the *last* in-flight write reconciles" rule — the
  thing that stops a rapid roll-call from overwriting taps still in the air — would need several
  concurrent mutations with independently released responses. It is the subtlest logic in the file and
  has no test.
- **Whole pages.** `Schedule`, `Rehearsals` and the project hub are not rendered anywhere in the
  suite; the flows enter through one component or one hook. Anything that only breaks when a page
  wires its parts together is still eye-only.
- **`ActivatePage`'s success panel** renders `useWelcomeTone` (Web Audio) and `navigator.clipboard`,
  neither of which jsdom provides. The two activation tests stop at the request; the screen the member
  sees afterwards is unasserted.
