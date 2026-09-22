# Rehearsal planning — sectional calls, ordered plan, time slots

Status: **All five stages implemented (1–3 on 2026-09-21, Stages 4 and 5 on 2026-09-22), seen
in the browser and committed; migrated on the dev stack only (`roster/0057`, `roster/0058` still
wait for `make migrate` on prod); Stages 4 and 5 emitted NO migration. Both audits are closed:
Stages 1–3 (fixes F1–F5 and the decision that a sectional CAN call the players) and Stages 4–5
(the four "Fix next" items, all applied 2026-09-22) — see "Audit" at the end. A follow-up round on
2026-09-22 reworked the ways INTO the rehearsal page (see "Entry points" at the end); that round
is implemented but not yet seen in the browser. Round 2 (decisions 14–23, Stages 6–10) was
decided on 2026-09-22 after a conductor-side audit — see "Round 2" at the very end. Stage 6
(backend) implemented 2026-09-22 — NOT committed; its migration is
`roster/0060` (`0059` was already the voice-line choices), applied nowhere yet. Stage 7
(frontend) implemented 2026-09-22 — NOT committed, NOT seen in the browser (needs `0060` on dev
first); see its "As landed". Stage 8 (minutes, backend and frontend) implemented 2026-09-22 —
NOT committed, NOT seen in the browser; migration `roster/0061`, applied nowhere yet. Stages
9–10 NOT started.**
One stage per session; move this line when a stage lands and say whether it is committed,
migrated and seen in the browser.

## Context

Three asks land on the same surface — the rehearsal card:

- **Developer:** the conductor lays out the pieces in the order they will be rehearsed; the
  conductor and the choristers open the rehearsal and see the materials in that order, and can
  tick off what is done.
- **Florent 1 (sectionals, 2026-09-21):** a sectional booked as "Soprany & Alty" is a *frozen
  list* of participations. Every singer who joins the cast later has to be added to every
  sectional by hand. He wants the sectional to call the *section*, so joiners are called
  automatically. He also asked whether a baritone counts as a bass and a mezzo as a soprano.
- **Florent 2 (timetable, 2026-09-21):** a sectional and a tutti on the same evening should be
  ONE rehearsal with time slots; each slot names pieces from the repertoire and can *exclude*
  voices ("B2 and the altos are not needed for the first reading of Orff's *Laudes
  creaturarum*"; "Lumen is ladies only — I'll open or close the evening with it"). He calls it
  respect for people's time.

What the code says (survey 2026-09-21):

- `Rehearsal` (`backend/roster/models.py`) has `invited_participations` (M2M, frozen ids),
  `focus` (free `CharField(200)`, labelled "Plan próby / repertuar" in the form),
  `duration_minutes`, `led_by`, `debrief`. **No link to pieces, no slots.**
  `called_participations()`, `calling_q()`, `calls_seat()` are the three readings of "who is
  called"; ~17 readers: reminder task, ICS feed, roll-call/lead sheet, printed day sheet,
  invitation e-mail, schedule endpoint, absence window, dossier, announcement recipients,
  duplicate merge, seed.
- The "sectional" is a **frontend accident**: `useRehearsalsTab.ts` (`resolveCalledParticipations`)
  filters the cast by `voice_type.startsWith("S"|"A"|"T"|"B")` and stores the resulting ids. So
  `BAR` is folded into basses by prefix, `MEZ` and `CT` match nothing, nothing about the section
  is stored, and `handleEditClick` reopens every sectional as CUSTOM. Backend push copy
  (`services.py`, `_announce_lead_assigned`) derives sections the same way.
- Repertoire per project = `ProgramItem` (`order` unique per project); casting per piece =
  `ProjectPieceCasting.voice_line`; a piece's divisi = `PieceVoiceRequirement`, resolved by
  `archive/services/voice_scope.py` (`requirements_for_edition`, `voice_labels_for_pieces`).
  `core/voice_labels.py:voice_family_of` maps a **line** code to S/A/T/B and returns None for
  MS/CT/BAR.
- Concert run sheet = `Project.run_sheet` JSON, `RunSheetPoint(time, title, …)`, editor
  `DetailsTab → DayTimeline → RunSheetRow` (inline `TimeField` + `Input`, commit on blur),
  chorister view `ConcertDayPlan`. Design rule (`.ai/04_design_system.md`): *ordering carries
  the warning* — a point outside its anchors renders outside them; no validation copy.
- Ordered, draggable list with a save bar exists on the Program tab (`useProgramTab.ts`,
  `SetlistRow.tsx` with `@dnd-kit/sortable` grip, `arrayMove`).
- The chorister has **no rehearsal detail**: `Schedule.tsx` accordion (`TimelineRehearsalCard`
  expanded shows `focus` + a generic "Twoje Nuty" CTA to `/panel/materials`); `NextEventHero`
  shows `focus` as "Plan Pracy". Routes: `/panel/schedule`, `/panel/schedule/lead/:rehearsalId`
  (assistant's lead sheet = the manager's `RehearsalInspector` with `allowManagerActions=false`),
  `/panel/rehearsals?rehearsal=<id>` (manager deep link).
- Notification diff whitelist `_REHEARSAL_CHANGE_KEYS` (`services.py`): date_time, location,
  focus, duration; `is_mandatory` self-describing; invited list / instrumentalists / led_by
  **deliberately silent**. Manager-only serializer fields must be listed in `DEBRIEF_FIELDS` or
  they leak to the cast.
- Frontend `Rehearsal` type in `shared/types/index.ts`; write DTOs in
  `features/projects/types/project.dto.ts` (`duration_minutes` is missing from the type and
  compiles via spread); mutations `project.rehearsal.mutations.ts` (optimistic pattern);
  `QUERY_CACHE_BUSTER` in `shared/api/queryPersistence.ts`.

## Decisions (settled 2026-09-21)

1. **One entity for "ordered pieces" and "time slots": `RehearsalPlanItem`.** A row = position +
   optional clock + a piece *or* a free label + **a one-line note** ("od t. 40 do końca, pierwsze
   czytanie"; "tylko fuga, z pamięci") + optional voice exclusions + done stamp. Without the
   note the plan is a list of titles — enough for order, not enough for a chorister to prepare.
   Rows without a clock flow under the last clocked row, so "18:15 Orff / Lumen / Bach" is three
   rows and one time. Rejected: a two-level Slot→Pieces model (nested drag, two editors); reusing
   the `run_sheet` JSON shape (no FK to the piece, no per-row done stamp an assistant can write
   without racing the conductor's edit, no "rehearsed N×" query).
2. **A sectional stores the RULE, not the people: `Rehearsal.called_sections`** — a `CharField`
   of SATB letters in canonical order (`"SA"`, `"TB"`, `""` = everyone). Florent: "sekcyjne mają
   podział SATB i to na ten moment starczy." The four pills stay; the letters are saved and
   resolved on every read. `CharField` + `__contains` works on Postgres and on the sqlite test
   settings (an `ArrayField` would not). `invited_participations` stays for the genuinely
   hand-picked call (soloists, a quartet).
3. **Intermediate voices get a declared mapping, in ONE place, mirrored FE/BE:**
   `section_letters_of_seat(participation)` in `backend/core/voice_labels.py` and
   `sectionLettersOfSeat` in `features/projects/lib/voiceFamilies.ts`:
   - `Participation.default_voice_line` set → the family of that line (`S2`→S, `A1`→A, `BAR`→B,
     `MS`→S+A, `CT`→A);
   - else by `Artist.voice_type`: SOP→S, ALT→A, TEN→T, BAS→B, **MEZ→S+A, CT→A, BAR→T+B**;
   - DIR/INS → none (instrumentalists keep the `calls_instrumentalists` rule).
   A seat is called by a sectional when *any* of its letters is in `called_sections`.
   Over-calling a baritone to a tenor sectional is the chosen failure mode; forgetting him is not.
4. **Slot exclusions are voice LINES (`excluded_voice_lines: list[VoiceLine code]`), resolved
   through casting** — Florent's example is `B2`, which exists only per piece. Rule
   `item_calls_seat(item, seat)` in `backend/roster/domain/rehearsal_plan.py` (pure, golden-case
   tested like `day_timeline_cases.json`):
   - the seat has a `ProjectPieceCasting` on the row's piece → called iff its line ∉ excluded;
   - otherwise → called iff at least one of the seat's section letters has a declared line
     (the piece's lines via `voice_labels_for_pieces`; canonical S1..B3 for a row without a
     piece) that is not excluded.
   The chips the manager sees are exactly those declared lines, grouped by family with a family
   toggle ("Alty" = all A-lines), so "B2 i alty" is two taps. Known cost: a singer without a
   casting on the piece is called conservatively, so "bez B2" only bites when the basses are cast.
5. **Editing lives on the saved rehearsal, never in the create/edit form.** One component
   `RehearsalPlanEditor`, mounted (a) as a band in `RehearsalInspector` for managers and (b) in a
   `BottomSheet` opened from `RehearsalTimelineRow` on the project's Rehearsals tab (the phone
   flow Florent uses). The assistant's lead sheet mounts it with done-only rights. `focus` stays
   as the one-line headline and is relabelled "Temat próby" once the plan ships.
6. **Plan edits are silent; the conductor announces the plan himself.** No `REHEARSAL_UPDATED`
   on save (the same policy as the invited list and `led_by`): the conductor edits the plan a
   dozen times the day before and each save would queue a notice. Instead the editor has one
   button, **"Wyślij plan"** → `POST rehearsals/<id>/plan/announce/` → `queue_broadcast`
   (`REHEARSAL_UPDATED`, change key `plan`, WARNING; DRAFT projects stay silent as always). The
   push says the plan is up and deep-links to the rehearsal page, where the reader's own window
   is exact; a broadcast cannot personalise, so the window itself travels only in the reminder
   (Stage 5). `Rehearsal.plan_announced_at` records the send; the editor shows "wysłano 14:02"
   and, when any row's `updated_at` is later, "zmieniony po wysłaniu" — a caption, never an
   automatic send. This is the answer to the one dangerous case: a window changed after
   `reminder_sent_at`. Rejected: change detection deciding when to notify.
7. **"Done" is written after the fact, not live.** Nobody ticks rows mid-rehearsal — the
   conductor conducts, the assistant leads. Ticking is the first step of the debrief: the
   "Po próbie" block (shown once the rehearsal has started, on the inspector and the lead sheet)
   opens with the plan rows as checkboxes ("Co zrobiliście?") above the text. Same write gate
   as the debrief (manager or `roll_call` scope). `done_at` only — nobody will audit who ticked,
   and `debrief_by` already stamps the author. Choristers read it, chiefly the absent one
   catching up ("co przerobiliście w środę?"). Not `PieceReadiness` (the singer's own "I've
   learnt it"). No live refresh on the chorister's side — whoever is at the rehearsal knows.
8. **The rehearsal keeps one end time; the reader's window is derived, per reader.** A row
   never changes `end_date_time`, the ICS VEVENT or the roll-call window. `my_plan_window`:
   - group rows into *blocks* by effective clock (a row without a clock takes the clock of the
     last clocked row before it; rows before the first clock take the rehearsal start);
   - *my blocks* = blocks with at least one row that calls my seat;
   - none → `calls_me = false`; the page says "plan nie przewiduje Twojego głosu". The **call
     is unchanged** — attendance, reminder and calendar still count this seat; a conductor who
     means to release a section changes `called_sections`, not the plan;
   - start = clock of my first block; end = clock of the first block *after my last block*,
     else the rehearsal end (None when `duration_minutes` is null → "od 19:00");
   - a gap in the middle is not an end (nobody leaves and comes back);
   - window equal to the whole rehearsal → None (nothing to say).
   So "Lumen closes the evening, ladies only" gives the men 19:00–20:30, not 19:00–21:00.
9. **Existing sectionals are not migrated.** They stay CUSTOM (frozen lists); Florent re-saves
   the ones that matter as SECTIONAL once. A data migration guessing intent from ids would be
   wrong exactly for the rehearsals it matters for.
10. **The chorister opens a rehearsal on its own page: `/panel/schedule/rehearsal/:id`** — the
    reminder deep-links there; the hero and the timeline card link there. Rejected: rendering
    the plan only inside the schedule accordion.
11. **Two parallel sectionals stay two rehearsals** (two `led_by`). One rehearsal with slots
    covers the *sequential* case only (18:00 S+A, 19:00 everyone). A soloists' slot before the
    tutti ("17:30 soliści") is a separate CUSTOM rehearsal — enough; nothing to add.
12. **Instrumentalists are excluded per row by a flag, not a line.** `calls_instrumentalists`
    sits on the whole rehearsal and a player is not a voice line, yet "Lumen a cappella, the
    organist from 19:30" is exactly the respect-for-time case — and the organist's time is the
    dearest (external, paid). `RehearsalPlanItem.excludes_instrumentalists` (default False);
    `item_calls_seat` for an `INS` seat = the rehearsal calls players and the row does not
    exclude them. The chip sits beside the voice families ("bez instrumentalistów"). The
    organist's window comes out of the same rule as everyone's.
13. **One project per rehearsal — Florent, 2026-09-21:** "always one project per rehearsal, and
    per evening; but there can be two rehearsals in one evening (one led by the assistant, one
    by me)." So the row's piece is validated against the rehearsal's project programme, and a
    shared Tuesday for two overlapping projects is two rehearsals.

## Stages

One stage per session. Automated checks once at the end of each session (never one sweep at
the very end: Stage 3 consumes Stage 2's API and Stages 1–2 emit migrations). Browser
checkpoints for the developer: after Stage 1, after Stage 3 (Stage 2 has no visible surface),
after Stage 4; Stage 5 after the first real reminder goes out. Stages 1–2 warrant high effort.

### Stage 1 — Section-based call (`called_sections`)

Backend (`backend/roster`, `backend/core`):
- `Rehearsal.called_sections = CharField(max_length=4, blank=True)` + validator (subset of
  `SATB`, canonical order) → `makemigrations`.
- `core/voice_labels.py`: `section_letters_of_voice_type()`, `section_letters_of_seat()` next
  to `voice_family_of` (decision 3). Unit-test all 7 voice types × with/without a lineup seat.
- `called_participations()`: invited list → else cast filtered by letters (Python-side filter,
  since letters come from seat + voice type) → else whole cast. `calling_q(seat_ids, *,
  instrumentalist, section_letters)`: the tutti branch becomes
  `Q(called_sections="") | OR(Q(called_sections__contains=l) for l in letters)`. `calls_seat()`
  mirrors. (Players: originally "rule unchanged", i.e. dropped by a sectional. Reversed
  2026-09-22 — they answer to `calls_instrumentalists` alone, through `calls_voice`, and the
  section clause is skipped for them entirely. See the decision at the end.) Callers that build the Q pass the reader's letters (union over their seats):
  `RehearsalViewSet.get_queryset`, `queries/schedule_queries.py` (absence window + artist
  schedule), `queries/dossier_queries.py`, `core/ical_service.py`.
- Serializer field, `RehearsalCreateDTO`/`RehearsalUpdateDTO`, **both**
  `_build_create_dto_payload` / `_build_update_dto_payload` in `views.py` (hand-mapped DTO —
  the trap recorded in the duration work). No diff entry (decision 6).
- Labels: `_announce_lead_assigned` reads `called_sections`;
  `document_generator._build_rehearsal_item` prints "Sekcyjna: Soprany, Alty" instead of
  "Selected artists (n)"; `invitations.build_invitation_context` treats a sections call as a
  choir call with a section label. `.po/.mo` via polib.
- Tests: new `roster/test_sectional_call.py` (joiner auto-called; MEZ/CT/BAR with and without a
  seat; `calling_q` ≡ `called_participations`; ICS feed; reminder recipients); extend
  `TuttiRehearsalIsAStandingCallTests` in `roster/tests.py`.

Frontend:
- `RehearsalFormData.called_sections`; SECTIONAL sends `called_sections` + an empty invited
  list; `handleEditClick` rehydrates SECTIONAL from the letters; `resolveCalledParticipations`
  uses `sectionLettersOfSeat` so the count preview matches the server.
- `Rehearsal` type + write DTOs (add `called_sections`, add the missing `duration_minutes`);
  `RehearsalInspector` badge "Tylko: …", `RehearsalTimelineRow`, `RehearsalsWidget`,
  `TimelineRehearsalCard` read the label from letters (`rehearsals.voices.*` keys exist).
- Bump `QUERY_CACHE_BUSTER` only if the current value is already committed; i18n ×3.

As landed (2026-09-21), where the shape differs from the plan above:
- `section_letters_of_seat(voice_type, voice_line)` takes two codes, not a `Participation` —
  `core` cannot import `roster`, and `schedule_queries` reads both off one `values_list`.
  `Participation.section_letters` (property) and `Participation.section_letters_of_seats(seats)`
  (union, canonical) are the model-side readers.
- The section names live in `core.voice_labels` (`section_names_label`, `sectional_call_label`);
  `notifications.message_content._section_list` delegates there. `InvitationRehearsalMetadata`
  gained `sections` and the invitation line reads "… · Sekcyjna: soprany, alty · …".
- No `RehearsalFormData.called_sections`: the pills' `selectedSections` stays the one state and
  the letters are derived on submit (`canonicalSectionLetters`). `called_sections` is ALWAYS sent
  (`""` under tutti/custom) so an edit drops stale letters.
- `resolveInvited` (client mirror of the rule) and `attendanceMatrix.isCalled` read the letters
  too — every roll-call count, the matrix and the analytics follow, not only the four labels.
- A sectional with a section nobody holds YET saves (it is a rule, like tutti); only an empty
  pill set is refused.

### Stage 2 — Plan items backend

- `RehearsalPlanItem(EnterpriseBaseModel)`: `rehearsal` FK CASCADE, `position`
  PositiveInteger (unique with rehearsal), `piece` FK `archive.Piece` null/RESTRICT (validated
  ∈ project programme at write — decision 13), `label` CharField(120, blank; the title of a
  non-piece row), `note` CharField(200, blank; decision 1), `starts_at` TimeField null (wall
  clock in the rehearsal's tz; never validated against the window — ordering carries the
  warning), `excluded_voice_lines` JSONField(list, default list, validated against `VoiceLine`),
  `excludes_instrumentalists` BooleanField(default False; decision 12), `done_at` DateTimeField
  null. `Rehearsal.plan_announced_at` DateTimeField null (decision 6). Migration.
- `roster/domain/rehearsal_plan.py`: `item_calls_seat()`, `plan_blocks()`,
  `plan_window_for_seat()` exactly as decision 8 states; golden cases JSON beside
  `day_timeline_cases.json` (men vs ladies-only closer; gap in the middle; no clocks; no
  duration; organist with `excludes_instrumentalists`; uncast bass with "bez B2").
- API on `RehearsalViewSet`: `GET/PUT rehearsals/<id>/plan/` declarative whole-list (pattern:
  `piece-castings/boards/`); rows carry `id` for existing ones so `done_at` survives a
  re-save. `PATCH rehearsals/<id>/plan/<uuid>/done/ {done}` gated like the debrief (manager or
  `roll_call` scope holder). `POST rehearsals/<id>/plan/announce/` (manager only) → decision 6.
  Regex `[0-9a-f-]{36}` on the sub-route (DRF registers actions alphabetically — the trap from
  the delegates work).
- Read side: `RehearsalSerializer.plan` (nested, read-only, ordered) plus per-reader
  `my_plan_window` and `plan[].calls_me`, computed by ONE domain function from prefetched
  castings at two call sites: the schedule read model (`schedule_queries.py`, batched over the
  list) and `retrieve` (single, for the rehearsal page — past rehearsals included, since
  `get_queryset` already narrows to rehearsals calling the reader). `lead_sheet` returns the
  plan without per-reader fields. Nothing here is manager-only (no `DEBRIEF_FIELDS` change).
- Service: `RehearsalOperationsService.replace_plan()` / `mark_plan_item()` / `announce_plan()`;
  the first two silent.
- Tests: `roster/test_rehearsal_plan.py` (PUT keeps done stamps; position uniqueness; piece
  outside the programme rejected; exclusions with/without casting; instrumentalist flag; window
  derivation per golden cases; done gate; announce queues once and stamps).

As landed (2026-09-21), where the shape differs from the plan above:
- `RehearsalPlanItem` is a plain model (uuid + `created_at`/`updated_at`), not
  `EnterpriseBaseModel`: a soft-deleted row would keep its `(rehearsal, position)` slot and
  collide with the next declarative save. Shaped like `ProgramItem` / `ProjectPieceCasting`.
- Positions are unique per rehearsal and the constraint is checked row by row (Postgres, sqlite
  alike), so `replace_plan` parks the kept rows beyond every position in play and then walks
  them into place. A row that comes back unchanged is NOT re-saved — its `updated_at` is what
  "zmieniony po wysłaniu" compares against `plan_announced_at`; a pure move counts as a change;
  ticking `done` writes `done_at` alone and leaves `updated_at` untouched.
- `PUT plan/` answers `{rehearsal, plan_announced_at, rows}` (not a bare list); `GET plan/` is
  for a manager, the project's roll-call holder or a called member; PUT is manager-only (403).
- `RehearsalSerializer.plan[]` rows carry `calls_me: bool | null` and the rehearsal
  `my_plan_window: null | {calls_me, start, end}` (`"HH:MM"` wall clock, `end` null = open).
  `null` = nothing to say (empty plan, or the whole rehearsal); `{calls_me: false}` = no row
  calls this seat. Per-reader values exist only on `retrieve` and `schedule-dashboard`
  (`queries/plan_queries.py:plan_readings_for_user`); the list and the lead sheet emit null.
- A player NAMED on the invited list reads the rows as if `calls_instrumentalists` were set —
  the list is the call. A row's offered lines are the piece's declared divisi read through the
  programme item's explicit `score_edition` (the auto-selected default edition is not
  consulted), or `CANONICAL_LINES` (S1–B3) when nothing is declared / for a free row.
- `done` is refused before `date_time` — the debrief's own clock, since ticking is its first
  step. `announce` refuses an empty plan (400).
- The announcement travels as `REHEARSAL_UPDATED` with `changes=[{field: "plan"}]`;
  `message_content._compose_rehearsal_updated` branches on that diff to
  `_compose_rehearsal_plan_announced` ("Plan próby — jutro o 19:00"), because the generic copy
  says the evening moved. Its CTA still lands on `/panel/schedule` — **Stage 4 must repoint it
  to `/panel/schedule/rehearsal/:id`** once the page exists.
- Golden cases: `roster/domain/rehearsal_plan_cases.json` (12 cases, seats and pieces shared
  across cases); the client mirror for the chip counts is Stage 3's to write against it.

### Stage 3 — Manager and assistant UI

- `features/rehearsals/components/plan/RehearsalPlanEditor.tsx` (+ `usePlanEditor.ts`,
  `RehearsalPlanRow.tsx`, `VoiceExclusionChips.tsx`): `@dnd-kit` sortable rows with the
  `SetlistRow` grip; row = grip · `TimeField` (optional, `w-28` like `RunSheetRow`) · piece
  `Select` over the programme in programme order, or an `Input` label for a non-piece point ·
  ghost `Input` note under the title (like `RunSheetRow`'s description) · exclusions (resting
  state shows nothing — "never state the resting default"; a ghost "Wszyscy" opens the
  family/line chips + "bez instrumentalistów" when the rehearsal calls them) · remove. No done
  checkbox here (decision 7). Explicit save bar like the Programme tab.
- **The exclusion shows its effect**, or Florent's first report will read "exclusions don't
  work": each chip carries the count of seats it removes ("bez B2 · 3 osoby") and the row a
  caption "woła 14 z 22", both computed client-side from the project's castings
  (`piece-castings` boards query) and voice types with the same rule as the server. An uncast
  bass staying called under "bez B2" is then visible, not mysterious.
- **Three fills, not one**: "Dodaj cały program" (programme order); **"Dodaj niezrobione z
  ostatniej próby"** (rows with `done_at` null from the project's previous rehearsal by
  `date_time`, clocks dropped, notes and exclusions kept); **"Skopiuj plan z…"** (any rehearsal
  of the project, all rows, clocks dropped, done cleared). Without carry-over the conductor
  lays the plan out from zero every week and goes back to `focus`.
- "Wyślij plan" button + "wysłano … / zmieniony po wysłaniu" caption (decision 6).
- Read-only `RehearsalPlanTimeline.tsx` (gold spine, times rubric `tabular-nums`, done rows
  ticked, rows that don't call the reader dimmed, notes under titles) with a `size="stand"`
  variant: reading size at arm's length, for the lead sheet — nobody drags rows at the music
  stand. Shared with Stage 4.
- `RehearsalDebrief` opens with the plan rows as checkboxes ("Co zrobiliście?") above the text
  (decision 7); on the lead sheet too.
- Mounts: `RehearsalInspector` band between header and toolbar (manager: editor; lead sheet:
  stand-size timeline); `RehearsalTimelineRow` "Plan" → `BottomSheet` (portal to body,
  `bottom-dock`). Form field `focus` relabelled "Temat próby".
- Query: `rehearsalKeys.plan(id)`; mutation with optimistic reorder and `onSettled`
  invalidating `rehearsals.all` + `scheduleDashboard`. i18n ×3 (`rehearsals.plan.*`).

As landed (2026-09-21), where the shape differs from the plan above:
- Files: `features/rehearsals/components/plan/{RehearsalPlanEditor,RehearsalPlanRow,
  VoiceExclusionChips,RehearsalPlanTimeline}.tsx`, `usePlanEditor.ts`, `usePlanEditorData.ts`;
  `api/plan.queries.ts`; `types/rehearsalPlan.dto.ts`; the rule mirror `lib/rehearsalPlan.ts` +
  `lib/rehearsalPlan.test.ts` (reads `backend/roster/domain/rehearsal_plan_cases.json` the way
  `dayTimeline.test.ts` reads its fixture; 12/12 pass). `Rehearsal` in `shared/types` gained
  `plan`, `plan_announced_at`, `my_plan_window` and the `RehearsalPlanItem` / `RehearsalPlanWindow`
  types.
- The plan query key is its own root, `["rehearsal-plan", id]`, NOT under `["rehearsals"]`:
  every roll-call tap invalidates that prefix and a refetch must not land under a half-built
  draft. The draft re-baselines on a server answer only when it is clean or says the same thing
  content-wise (ids ignored) — that is how rows a save just created pick up their ids.
- The editor fetches the project data itself (`usePlanEditorData`: programme, casting board,
  cast, piece dictionary, the project's rehearsals) under the hub's own query keys, non-suspense,
  so both mounts pass only `rehearsal`. A row's offered lines mirror the server exactly:
  `scopedToEdition(voice_requirements_read, programItem.score_edition ?? null)` — the explicit
  edition only, never `resolveBoundEditionId`'s auto-pick.
- Chip counts: every chip (line, family, instrumentalists) carries the seats it removes or would
  remove given the row's other exclusions; the row caption "woła N z M" appears only once the
  row excludes something (M = seats the rehearsal calls, `resolveInvited`). A player named on
  the invited list counts as called by the flag, as on the server. Chips draw through `Badge`
  inside a bare `<button aria-pressed>` (the `FilterTokens` recipe); the closed face lists the
  exclusions as removable "bez B2 · 3 os." chips plus a ghost "Wszyscy"/"Zmień".
- The fills live in one "Wypełnij" `DropdownMenu` (whole programme · undone from the previous
  rehearsal, with its date · "Skopiuj plan z…" listing every other rehearsal of the project
  with a plan). Copied rows lose clocks, done stamps and identity; rows whose piece left the
  programme are dropped before the save, since the server refuses the whole list for one.
- Mounts: manager's `RehearsalInspector` (`canEditPlan`) as a band between header and toolbar
  with the docked `EditorActionBar`; the hub's `RehearsalTimelineRow` gained a plan button
  (`ListMusic`) and a "Plan: N pkt" caption, opening a `BottomSheet` where the editor renders
  its save buttons inline (`actions="inline"`) because the docked bar sits under the sheet's
  scrim. The lead sheet mounts `RehearsalPlanTimeline size="stand"` (never the editor, even for
  a manager — nobody drags rows at the stand).
- "Wyślij plan" is enabled only on a saved, clean, non-empty plan; the caption reads "Wysłano
  {when}" / "Wysłano {when} · zmieniony po wysłaniu" (gold) from `rows[].updated_at` vs
  `plan_announced_at`.
- `RehearsalDebrief` opens with the checklist once the rehearsal has started and a plan exists,
  editable through `onMarkPlanItem` (wired on both the lead sheet and the manager's workspace;
  `useMarkPlanItem` is optimistic on the plan query, the checklist keeps a local override until
  the read model catches up). The block now renders for a checklist alone, without debrief text.
- `focus` relabelled "Temat próby" in the form and in the notification change label
  (`changes.focus`), all three locales.

### Stage 4 — Chorister: opening the rehearsal

- New route `/panel/schedule/rehearsal/:id` → `features/rehearsals/RehearsalPage.tsx` (lazy,
  `PageTransition`), data from `GET /api/rehearsals/<id>/` (per-reader fields from Stage 2;
  404 → `StatePanel`). **Works for past rehearsals** — that is where "co przerobiliście w
  środę?" lives: the schedule's `PAST` view (`useScheduleData`, paged by 30) renders the same
  card, and the card links here. Content: date / time range / place / led-by / mandatory;
  **"Twoja część: 19:00–21:00"** when `my_plan_window` is set, "plan nie przewiduje Twojego
  głosu" when `calls_me` is false (decision 8); `RehearsalPlanTimeline` with notes and each
  piece row linking to `/panel/materials/:projectId/:pieceId`; rows not calling the reader
  dimmed with "bez Twojego głosu"; done ticks as saved (no live refresh — decision 7); RSVP /
  absence and `AddToCalendar` as on the card today. `@media print` stylesheet: header + plan on
  one sheet — the stand copy for whoever wants paper; no WeasyPrint.
- **The window sits on the collapsed card**, not behind the expand: `TimelineRehearsalCard`
  shows "Twoja część 19:00–21:00" beside the rehearsal's own range — it is the number a person
  plans the evening around. `NextEventHero` "Plan Pracy" block → focus line + first rows of the
  plan + own window + link; expanded card panel → plan summary + link (replaces the generic
  "Twoje Nuty" CTA with the first piece's link). `led_by` line added to the hero (missing today).
- i18n ×3 (`schedule.rehearsal.plan.*`).

As landed (2026-09-22), where the shape differs from the plan above:
- Files: `features/rehearsals/RehearsalPage.tsx` (default export, lazy, preloaded with the
  member routes) and `features/rehearsals/lib/planWindow.ts` — the one phrasing of "which part
  of the evening is mine", so the page, the card and the spotlight cannot word it differently.
  `useRehearsal(id)` + `RehearsalsService.getRehearsal` on the key
  `["rehearsals", "detail", <id>]`; under the `["rehearsals"]` root on purpose, unlike the
  editor's plan query — nothing on this page is a draft, so a plan save or a done tick should
  bring it back with everything else it invalidates.
- **`RehearsalSerializer` gained `project_title`** (`source='project.title'`, read-only, both
  call sites already `select_related('project')`). A rehearsal read on its own has no list
  around it to borrow a title from, and "Próba" naming no programme names nothing.
- **Two sources on the page, deliberately.** The rehearsal itself comes from
  `GET /api/rehearsals/<id>/` — the only read carrying this reader's `calls_me` rows and
  `my_plan_window`. The seat, the existing answer and the span writer come from the schedule
  dashboard beside it (`useScheduleData`, which gained `allEvents`: every event, past and
  future, since the page looks one evening up by id and has no view mode to filter by), so the
  RSVP written here is the same write as the one on the card. A reader with no seat — a manager
  following the link — gets the evening without the RSVP, which is the truth about them.
- The window is stated even when the plan leaves the reader out: `calls_me: false` renders
  "Plan nie przewiduje Twojego głosu" with the caption "Wezwanie zostaje w mocy". Silence there
  would read as "you are not needed at all", which is the one thing decision 8 says it is not.
- Past evenings: the page renders in full, the RSVP block does not (`PAST_GRACE_MS`, the same
  four hours the schedule's two tabs divide on — the server refuses a singer's own edit to a
  held evening anyway).
- **The notification CTA is repointed** by `_rehearsal_page_url(ctx)` in `message_content.py`:
  a member lands on `/panel/schedule/rehearsal/<id>`, a manager keeps `/panel/rehearsals`. Only
  the plan diff is redirected — an evening that actually moved is about a date, and a date is
  read against every other one. `cta_label` is a new msgid, `"Open the plan"` (pl/fr/en). The
  bell's `NotificationItem` gained the mirror branch, ahead of the `type.includes("REHEARSAL")`
  chain that would otherwise swallow it.
- `TimelineRehearsalCard`: the window sits in the collapsed card's meta row; the expanded panel
  shows the first four plan rows (`RehearsalPlanTimeline`, no `hrefOf` — the page is the place
  to open a piece from) plus "Otwórz próbę", which is how the PAST view reaches here; the
  materials tile links to the plan's FIRST PIECE when there is one, captioned "Zaczynacie od: …",
  instead of the generic jump to the shelf.
- `NextEventHero`: `led_by` line added (it was missing), the window as a gold band, and the
  "Plan Pracy" block now renders for a plan alone — focus line, first three rows, then "Cały
  plan (N pkt)". The block used to render only when `focus` was set.
- Print: `@media print` in `panel.css`, not a page-local stylesheet — the sheet sits deep inside
  the shell and the rule has to reach the shell. `.print-sheet` is pulled out with the classic
  visibility pass, `.print-hidden` drops the page header, the print button and the RSVP. Two
  things are load-bearing there: the colours are literals, because the panel may be in its dark
  theme when the sheet goes to the printer and a token would print parchment-on-ink; and
  `transform: none` on everything, because the page transition and the bento stagger leave
  transforms on ancestors, and a transformed ancestor becomes the containing block the absolute
  sheet resolves against. The literal-colour guard reads only `.ts`/`.tsx`, so this CSS is on
  its own comment for a record.
- Tests: `test_rehearsal_plan.py` gained the CTA pair (member → the page, manager → the
  workspace), "a move still lands on the schedule", and the retrieve contract
  (`project_title` + `calls_me` + the tenor's derived 18:00–20:30).

### Stage 5 — Reminder, calendar, statistics

- `_dispatch_rehearsal_reminders` → `rehearsal_notification_context()` gains `plan` lines
  (time · title · note) and per-recipient `my_window`; e-mail/push copy in `message_content.py`
  (push stays short: title unchanged, one line "Twoja część 19:00–21:00" when set). The
  reminder is the one per-recipient message, so it is the one place the window travels.
- ICS: **no plan in the description** — calendars refresh a feed every few hours, so the text
  would be stale exactly when read. The VEVENT stays the rehearsal's window.
- Programme tab: `SetlistRow` caption from `done_at` — "ćwiczone 3× · ostatnio 14.09", and
  **"nie ćwiczone" when the count is 0**: the real value of the figure is the zero a week before
  the concert. Shown only once the project has at least one ticked row anywhere (before the
  first debrief every piece is at zero and the caption would be noise). One aggregate query in
  the programme endpoint.

As landed (2026-09-22), where the shape differs from the plan above:
- **The plan lines do NOT go into `rehearsal_notification_context`.** That context is shared by
  every rehearsal notice, and a cancellation or a change of date listing what was going to be
  rehearsed buries the one fact it is sent for. `roster.services.rehearsal_plan_lines(rehearsal)`
  is its own builder and only `_dispatch_rehearsal_reminders` calls it; the metadata carries
  `plan: [{time, title, note}]` (structured, never prose) and `message_content._plan_lines`
  renders "18:00 · Orff · od t. 40" into one newline-joined "Plan" detail row.
- **The sweep fans out per distinct window, not per person.** `send_bulk_notifications_task` takes
  one metadata for the whole group, so `_reminder_groups_by_window` groups the call by
  `window_payload(...)` and sends once per distinct answer — an evening whose plan calls everybody
  throughout stays a single dispatch, and the fixture's six seats come out as four. Every seat
  still goes through `NotificationRecipientPolicy` (one at a time) so who hears about an evening
  is decided in exactly one place. The window itself comes from
  `plan_queries.plan_windows_for_seats(rehearsal, seats)` — the batched sibling of
  `plan_readings_for_user` (one reader, many evenings), which would have cost a round of queries
  per recipient.
- `PlanWindow` → wire shape now lives in ONE function, `domain.rehearsal_plan.window_payload`; the
  serializer's `my_plan_window` and the reminder's `my_window` are the same dict by construction.
- Copy: the push/bell body gains one sentence, "Twoja część: 19:00–21:00." (`from %(start)s` for an
  untimed end). The e-mail gains two detail rows — "Twoja część" and "Plan". The row label is a
  `pgettext("rehearsal plan", "Your part")`, **never the invitation's `_("Your part")`**, which is
  translated "Twoja partia" and names the voice somebody sings, not the hours they are needed.
  `calls_me: false` renders "Plan nie przewiduje Twojego głosu — wezwanie zostaje w mocy" rather
  than falling silent (decision 8); the push body stays silent on that case.
- **The reminder's CTA is repointed to the evening's page** (decision 10 says it deep-links there,
  and it now carries a window only that page states in full). `NotificationItem` gained the mirror
  branch ahead of the `type.includes("REHEARSAL")` chain, and the bell row shows the window in its
  meta line through `planWindowLabel` — the same phrasing function the card and the page use.
  A manager keeps `/panel/rehearsals` and the "View schedule" label.
- ICS: nothing to write, so the decision is recorded as a comment beside the DESCRIPTION line in
  `core/ical_service.py` and pinned by a test that asserts no piece title reaches the feed.
- **The focus was renamed in the e-mail copy, pl and fr.** `_("Focus")` was translated "Plan
  próby" / "Au programme", which in a reminder now stands next to a row that IS the plan. The
  panel has called it "Temat próby" / "Thème" since Stage 3 (decision 5), so the `.po` follows:
  "Temat próby" / "Thème" for the row, "Temat: …" / "Thème : …" for the push sentence. A locale
  change only — no msgid moved — and it reaches the ICS description too, which shares the msgid.
- Statistics: `ProgramItemSerializer.rehearsed_count` / `last_rehearsed_on`, memoized per project
  exactly like the liturgical labels — one query for a whole setlist. `rehearsed_count` is `null`
  until the project has ticked a row ANYWHERE, so the "shown only once" rule lives on the server
  and the client just renders what it is given. **Dated by the rehearsal, not by the tick**: a
  conductor who writes the debrief on Sunday still rehearsed the piece on Wednesday, and the
  caption is read as "when we last sang it". `SetlistRow` renders it on the meta line, gold when
  the count is zero, and the interpolation uses `times`, not `count` — i18next reads `count` as a
  plural selector.

## Found along the way

- Sectional push/label derivation by first letter (`_announce_lead_assigned`) — Stage 1.
- A sectional reopens as CUSTOM — Stage 1.
- `duration_minutes` absent from the `RehearsalCreateDTO`/`UpdateDTO` TS types — Stage 1.
- `NextEventHero` shows no `led_by` — Stage 4.
- Widening a call (new section, new invitee) still sends nobody a `SCHEDULED` — a pre-existing
  hole in the announcement queue's `recipients_for`; out of scope, recorded under Traps.
- The rehearsal focus was labelled "Plan próby" in every e-mail and in the calendar description —
  the panel's own word for it has been "Temat próby" since Stage 3. Fixed in the `.po`, Stage 5.

## Verification (per stage)

- Backend: ruff + mypy on `backend/roster`, `backend/core`, `backend/notifications`; tests
  `& .venv\Scripts\python.exe backend\manage.py test roster --settings=config.test_settings_sqlite`
  (new modules + `TuttiRehearsalIsAStandingCallTests`, `test_instrumentalist`,
  `test_absence_range`, `ConcertDaySheetTests`). `manage.py check`, `makemigrations --check`.
- Frontend: `npm run typecheck` then `npm run build` in `frontend/`; all three locales carry
  every new key.
- Browser (developer): (1) book a sectional S+A, add a mezzo to the cast → she is on the roll
  call without re-saving; (2) one rehearsal 18:00–21:00 with "Orff — bez A, B2" at 18:00, tutti
  at 19:00 and "Lumen — tylko S, A" at 20:30 → an alto's collapsed card says "Twoja część
  19:00–21:00", a tenor's "18:00–20:30", the organist's (rehearsal calls players, Lumen
  a cappella) "18:00–20:30"; (2b) the same evening's reminder, 24 h out: each of those three gets
  the SAME hours in the push and in the e-mail as on their card, the e-mail lists the plan, and
  the push lands on `/panel/schedule/rehearsal/:id`; (2c) the programme tab shows nothing under
  the titles until the first row is ticked anywhere in the project, then "Ćwiczone 1× · ostatnio
  …" on that piece and a gold "Nie ćwiczone" on the others; (3) after the rehearsal tick two rows
  in the debrief on the lead
  sheet → the absent alto opens the rehearsal from the schedule's PAST view and sees the ticks
  and the notes; (4) "Wyślij plan" → one push per called seat, deep link lands on the page, and
  the button is dead on an evening that has already started; (5) book a sectional S+A and tick
  "Wezwij także instrumentalistów" (the switch now shows under SECTIONAL) → the organist is on
  the roll call and in the plan's per-row counts; untick it and he is gone.
- Dev and prod: `make migrate` after Stages 1 and 2 (on top of the already queued
  roster/0055–0056, archive/0029, notifications/0022, messaging/0005).

## Traps

- `RehearsalViewSet._build_create_dto_payload` / `_build_update_dto_payload` enumerate DTO
  fields by hand — a new `Rehearsal` column that is not added there is writable only from a
  shell (the duration column shipped that way once).
- Any manager-only field on `RehearsalSerializer` must be in `DEBRIEF_FIELDS` or the cast
  reads it.
- `calling_q` and `called_participations` are two implementations of one rule; a test must
  assert they agree for every voice type, with and without a lineup seat.
- The announcement queue resolves recipients at publish time from `called_participations()`;
  widening a call after `SCHEDULED` went out reaches the new people only with whatever is
  announced next. Pre-existing; not fixed here.
- `ArrayField` is Postgres-only and the test suite runs on sqlite — hence letters in a
  `CharField`.

## Audit of Stages 1–3 (2026-09-21, second session)

Automated checks on the uncommitted tree: ruff, mypy, `makemigrations --check` clean; 426
roster tests pass; `npm run typecheck` clean; 21 vitest tests pass (the 12 golden cases on both
sides); every new i18n key present in pl/en/fr; `QUERY_CACHE_BUSTER` bump is right (the previous
value was committed). Read in full: `domain/rehearsal_plan.py`, `queries/plan_queries.py`,
`models.py` / `dtos.py` / `serializers.py` / `services.py` / `views.py` diffs, invitations, ICS,
dossier and schedule queries, `message_content.py`, the six new plan components and hooks,
`lib/rehearsalPlan.ts`, `useRehearsalsTab.ts`, `attendanceMatrix.ts`, `attendanceStats.ts`, the
inspector / debrief / lead sheet / timeline row / widget / schedule card diffs.

Verified sound, no action: `replace_plan`'s parking of kept rows past every position in play;
`plan_items__piece` prefetched on every list path (viewset, schedule dashboard, lead sheet);
`calling_q` / `called_participations` / `calls_seat` / `resolveInvited` / `attendanceMatrix.isCalled`
agree (on "a sectional never calls a player" — the rule reversed on 2026-09-22, see below, and the
five still agree); `Rehearsal.objects` is the active manager,
so `_plan_rehearsal_or_404` cannot reach a soft-deleted rehearsal; the announcement queue folds a
plan announce into a still-pending `SCHEDULED` (the cast gets one creation notice — acceptable)
and into another pending change as a "Rehearsal plan" diff line.

### Fixes — all applied 2026-09-22

- **F1 — draft can wipe the stored plan.** `components/plan/usePlanEditor.ts`: the re-baseline
  effect replaces the draft only when it is clean or says the same thing; a row added before the
  first `GET plan/` answer (slow network, fast tap on "Wypełnij") leaves the draft dirty, the
  server rows never enter it, and the next save deletes them. Fix: a `baselined` ref that is
  false until `serverPlan !== undefined` — until then the effect always replaces the draft. And in
  `RehearsalPlanEditor.tsx` disable the "Wypełnij" menu, the add `Select` and "Punkt bez utworu"
  while `planQuery.isLoading || data.isLoading` (today only the rows area shows the loader; the
  header and the add row stay live).
- **F2 — untitled free row saves as a 400 in English.** `RehearsalPlanEditor.tsx:handleSave`
  sends a free row with an empty label; the server refuses the whole list with pydantic's
  "A row needs a piece or a label." through `toastApiError`. Refuse client-side before the
  request: `toast.warning(t("rehearsals.plan.toast.untitled", "Nadaj nazwę każdemu punktowi bez
  utworu."))` — i18n ×3.
- **F3 — "Wyślij plan" for an evening already under way.** `services.py:announce_plan` accepts a
  started or finished rehearsal and queues "Plan próby — dziś o 19:00" to the whole cast; the
  editor keeps the button enabled on a saved, clean plan whatever the clock. Mirror
  `mark_plan_item`'s gate the other way: refuse when `timezone.now() >= rehearsal.date_time`
  (new gettext msgid → pl/fr `.po` + `.mo` via polib, en empty), extend
  `test_announce_refuses_an_empty_plan_and_a_non_manager` in `test_rehearsal_plan.py` with the
  `_start_the_evening()` case; client `canAnnounce` also requires `!hasStarted`
  (`new Date(rehearsal.date_time) > Date.now()`).
- **F4 — missing translation.** msgid `Rehearsal plan` (`message_content._change_field_label`,
  the diff label used when the plan announce collapses with another change) is absent from
  `backend/locale/pl` and `fr` `django.po` — renders in English. Add pl "Plan próby", fr "Plan de
  répétition", en with empty msgstr; recompile all three `.mo`.
  *Confirmed with a twist: the string WAS in all three files, but only under
  `msgctxt "call sheet"` (a `pgettext` for the printed sheet, pl "Plan prób"). gettext keys on
  (context, msgid), so the bare `_()` in `message_content` found nothing. A second, context-free
  entry was added; `_change_field_label("plan")` now renders "Plan próby" / "Plan de répétition".*
- **F5 — optimistic row reads a sectional as tutti.** `features/projects/api/project.optimistic.ts:
  buildOptimisticRehearsal` copies `calls_instrumentalists` but not `called_sections`, so a
  freshly booked sectional shows "Tutti" on the Rehearsals tab until the refetch. Add
  `called_sections: data.called_sections ?? ""`.

### Decided 2026-09-22 — a sectional CAN call the players

**Decision: yes.** The deciding fact is that the workaround was worse than it looked:
`invited_participations` *replaces* the section rule rather than adding to it, so expressing
"sopranos, altos and the pianist" as a CUSTOM list gave up the one thing Stage 1 was built for —
an alto who joins next week walks into the sectional by herself.

The rule is now **two independent axes**: a section names singers, so it says nothing about the
players; `calls_instrumentalists` is their whole call, sectional or tutti. Implemented as
`Rehearsal.calls_voice(letters, *, instrumentalist)` — the one statement of it — read by
`called_participations` and `calls_seat`; `calling_q` mirrors it on the member's side (the
section clause is now skipped entirely for a player instead of being ANDed in). The client's two
readers (`resolveInvited`, `attendanceMatrix.isCalled`) drop the `calledSections === ""` guard.
`build_invitation_context` gained a fifth bucket, `rehearsals_for_players`: a player has no letter
to be filed under, so the sectionals that call them are listed for them directly. The form shows
the players' toggle under SECTIONAL as well as TUTTI (one `playersToggle` element used by both
branches — `AnimatePresence mode="wait"` still gets a single child per target).

Covered by `test_a_player_answers_to_the_flag_alone` (all 9 calls × the flag both ways, through
`called_participations` and `calls_seat`), `test_the_pianist_is_invited_to_a_sectional_that_calls_the_players`,
and the agreement harness itself: `_expected` now restates both axes, so all three server readings
are re-checked against the spec for the organist at every call.

Still open, low priority: closing the plan `BottomSheet` on the Rehearsals tab with a dirty draft
discards it silently (`RehearsalsTab.tsx`); a confirm would match `ConfirmModal` elsewhere.

### Audited 2026-09-22 — sound, no action

- **`test_sectional_call.py` meets the Traps demand.** 15 seats (all seven voice types with and
  without a lineup seat, plus the organist) × 9 calls, driven through all three readings and
  compared against `_expected`, the rule restated by hand — not against one another.
  `test_rehearsal_plan.py` is likewise substantive: a shared JSON fixture
  (`domain/rehearsal_plan_cases.json`) pins per-row `calls` and the derived window on both sides.
- **`document_generator` has no N+1.** `recipient` is resolved once, in
  `_resolve_day_sheet_audience`, with `.select_related('artist', 'artist__user__profile')`, and
  the same instance is reused for every rehearsal in the loop — so `calls_seat` reading
  `seat.artist.voice_type` costs nothing. `resolve_document_language` touches `recipient.artist`
  before the build anyway, so the FK cache is warm regardless.
- **`services.update_rehearsal` handles SECTIONAL → TUTTI.** `called_sections: ""` goes through
  `update_data`/`setattr`; the view reads `validated_data.get('invited_participations', None)`,
  so an explicit `[]` stays `[]` (not `None`) and `.set([])` clears the M2M.
- **No client reader bypasses the rule.** Every other use of `called_sections` /
  `invited_participations` builds a label (`RehearsalTimelineRow`, `RehearsalsWidget`,
  `useScheduleData`, `RehearsalInspector`) or form state (`useRehearsalsTab`).
- **`RehearsalInspector`'s `invitedCount > 0` gate is right.** A sectional whose section is still
  empty falls through to the "Nikogo nie wezwano" panel, whose copy already points at the cast —
  the correct next step. The plan editor sits outside that gate (`canEditPlan`), so the evening
  can still be laid out.
- **Design system, static pass:** no stock-palette colours, no arbitrary values, no raw text tags,
  no dead `animate-*` classes, `@file` header on all six new files.

### Still open

- The reminder carries the plan whether or not it was announced. Deliberate: the plan is already
  readable by every called member on the rehearsal page from the moment it is saved (Stage 2 made
  none of it manager-only), so "Wyślij plan" is the push, not the permission. Worth a second look
  only if the conductor starts drafting plans inside the 24 h lead window.
- The reminder's fan-out is per distinct window. On an evening where the plan slices the call into
  many different windows this is several `send_bulk_notifications` dispatches instead of one; for
  a 40-voice choir it is at most a handful. If a plan ever produces a window per person, this
  degrades to one dispatch per person.
- `schedule.service.getRehearsalsByArtist` queries `?invited_participations__artist=` — it can
  only ever find hand-picked calls, so it would silently drop every tutti and sectional. It has
  **no callers**; left in place rather than deleted unilaterally, but it is a live trap for
  whoever reaches for it next. Delete it or route it through `calling_q`.
- The four browser checkpoints under Verification — none done; the developer verifies UI himself.
- The bell's eyebrow for a plan announcement still reads "Zmiana próby"
  (`notifications.types.REHEARSAL_UPDATED`), because the type IS `REHEARSAL_UPDATED`. The row's
  change chip says "Plan próby" and the push/e-mail titles were fixed in Stage 2, so nothing
  states anything false — but the eyebrow is the last surface that has not caught up. Left
  alone: it needs either a branch in `describe()` or a notification type of its own, and the
  second is the real answer.
- Closing the plan's `BottomSheet` with a dirty draft still discards it without asking (found
  in the Stage 1–3 audit, still true).

## Audit of Stages 4–5 (2026-09-22, third session)

Automated checks on the uncommitted tree: ruff, mypy, `makemigrations --check` clean; 818
roster tests pass; `npm run typecheck` clean; every `t("…")` key in the touched frontend files is
present in pl/en/fr (plural forms included); `REHEARSAL_REMINDER` and the plan announcement were
rendered from the compiled `.mo` in all three languages — window sentence, "Twoja część" row,
plan rows, CTA pair and deep link all as specified.

Verified sound, no action: every surface that states a window (reminder metadata, bell meta line,
timeline card, spotlight, rehearsal page) gets it from `plan_window_for_seat` → `window_payload`;
`plan_windows_for_seats` and `plan_readings_for_user` resolve the seat, the castings and the named
player identically; the group split in `_reminder_groups_by_window` cannot drop or double a
recipient (one seat per artist per project, `Artist.user` is one-to-one, a DEC/INV seat or a seat
without a user is dropped by the policy exactly as before); `_rehearsed` is one query per project
for a whole setlist, skips soft-deleted evenings and free rows, never counts another project's
tick, and localises each evening in its own zone; push, e-mail CTA and bell land on one address
per reader (`_rehearsal_page_url` ↔ `NotificationItem`, manager stays on `/panel/rehearsals`);
the page's 4 h "past" grace equals the schedule's split.

### Fixed in this session

- **The stand copy was not pulled out of the shell.** `.print-sheet` is `position: absolute`,
  but `main`, its centring column and the page's own wrapper are all `position: relative`, so
  the sheet resolved against the page wrapper — inside the sidebar padding and the centred
  column — and the shell's `min-h-screen` box still paginated. `panel.css` now sets
  `position: static; min-height: 0` on everything outside the sheet's subtree in `@media print`.
  Unverified in a browser.

### Fixed 2026-09-22 (fourth session) — the four "Fix next" items

1. **A plan row reopened the path a6c5920 closed.** Decided for the server: `PlanReading` gained
   `opens` beside `calls`, emitted as `plan[].piece_open` by `RehearsalSerializer.get_plan`. Computed
   in `plan_readings_for_user` by `_withheld_pieces` — one `ProgramItem` query annotated with
   `instrumental_item_exists()` over every project at once, plus the `materials` delegation lookup;
   the same three exemptions as `user_is_refused_instrumental`. False also for a free row and for a
   piece the programme does not carry (the address would 404 either way). Null when no reading was
   computed — a manager or a stand-in without a seat — and the clients then link as before, because
   those are the readers nothing is withheld from. `RehearsalPage.hrefOf` returns null on
   `piece_open === false`, so the row reads like a free row; the timeline tile still NAMES the
   plan's first piece ("Zaczynacie od") but links it only when it opens, otherwise "Materiały" →
   the shelf. Rejected: the page reading the songbook — a page opened from a push would pay for
   the whole materials tree to answer one boolean per row. Still true and still not a defect: a
   piece declaring no voice requirement falls back to `CANONICAL_LINES`, so an instrumental row
   keeps every singer in the room and in the window unless the conductor excludes all four
   families.
2. **FR reminder row collided with the invitation's.** The plan row is now "Votre créneau"; the
   invitation's bare `_("Your part")` moved from "Ta partie" to "Votre partie" — it was the ONLY
   tu-form among ~70 vous-forms in `fr/django.po`, so the split was the invitation's, not the
   reminder's. `.po` and `.mo` rewritten through polib.
3. **Fan-out amplified a partial failure.** Each group's `.delay` sits in its own try/except in
   `_dispatch_rehearsal_reminders`: a refused hand-off is logged (`logger.exception`, with the
   rehearsal id, the window and the recipient count) and the loop continues to the next group and
   the next rehearsal. The rehearsal counts as `sent` when at least one group went out. The lost
   group is NOT retried — `reminder_sent_at` is already claimed — which is the at-most-once trade
   the claim was built on; the log line is what says who was missed.
4. **Preview showed two answers.** `RehearsalViewSet.retrieve` reads the plan through
   `resolve_preview_target(request).user` (the queryset stays the caller's own — the preview changes
   whose seat, not which evenings exist); `RehearsalsService.getRehearsal` takes `previewArtistId`
   and `useRehearsal` switches to `rehearsalKeys.rehearsals.detailPreview` + `PREVIEW_QUERY_OPTIONS`
   inside a preview, exactly as `useScheduleDashboard` does.

Tests added in `test_rehearsal_plan.py`: `piece_open` for the tenor, the organist and the manager;
the preview read (manager with and without `?artist=`, a member refused with 403); the flaky
broker (five dispatches attempted, one lost and logged, both rehearsals claimed and counted).

### Browser checks still owed

The four under Verification, plus: print the page from the desktop shell and confirm the sheet
fills the A4 width with no trailing blank page; print a plan longer than one page (the sheet is
`overflow-hidden`).

## Entry points (round of 2026-09-22, fifth session)

The plan shipped, and the question that followed was whether choristers need a separate
**"Rehearsals" tab**. Rejected, and the reasons are the decision:

- The schedule is ONE axis of the day, rehearsals and concerts interleaved. A second list of the
  same objects means the question a singer actually asks — "is Saturday free?" — has to be asked
  in two places.
- "What did we get through on Wednesday" is already the History tab.
- The mobile dock holds four slots plus "More"; a fifth entry displaces Materials or Messages,
  both used more often than a list of rehearsals.

What was missing was not a tab but a **way in**. The rehearsal page is the address of ONE evening:
it is reached from a notice, from a card, from the dashboard — it is not browsed like a list.

### What changed

**A rehearsal with no plan had no way in at all.** In `NextEventHero` the "Otwórz próbę" button
sat inside `planRows.length > 0`, itself nested in `(event.focus || planRows.length > 0)`, so the
dashboard offered no entry to exactly the evenings the conductor had not laid out yet — the
commonest case. The button now lives in the hero's action row, always present, `primary`; while
the rehearsal runs it takes the full width under its own label (`plan.open_live`).

**On the schedule card the entry led the expansion instead of trailing it.** It had been sitting
under the plan box, so the first thing to open was the empty-state line "brak szczegółowego
planu". It is now the first row of the expansion, `primary`, and its label follows `viewMode`
(`plan.open_past` — "Zobacz przebieg próby" — under History, where "open" promises something still
to come). The "Twoje Nuty" panel beside it dropped from `variant="solid"` to `"light"`: an opaque
surface next to a translucent one read as the card's main offer, and the shelf is the weaker
destination now that the page leads to the same scores in rehearsal order. `plan.open_rest` was
deleted from all three locales — a count of plan items on the primary CTA reframes the page as
"the rest of the list".

**The deep-link contract, split by what the notice is about.** A notice about the CONTENT of one
evening (a `plan`-only diff, the reminder) lands on that evening's page. A notice about WHEN an
evening happens (`REHEARSAL_SCHEDULED`, a move) stays on the schedule, because a date means
something only read against the other dates — `test_a_move_still_lands_on_the_schedule` encodes
that and it is right. The complaint it did not answer was the hunt for the card, so the schedule
now takes `?rehearsal=<id>`: it opens the correct tab, expands that card, scrolls to it, and
spends the parameter (`setSearchParams(..., { replace: true })`) so a later tab change does not
drag the reader back and a reload does not re-open what they closed. An id matching nothing —
a cancelled evening, a reader dropped from the cast — falls back to the plain schedule, which is
the truthful answer. Backend: `_schedule_card_url`. Cancellation keeps the bare schedule; its
card is gone.

The scroll anchor is a wrapper `#schedule-event-<eventId>` rather than the card itself, so the
card keeps its own motion root. The spotlit evening has no card in the feed — it IS the hero — so
that one resolves to `#schedule-hero`.

**`/panel/schedule/next`** (`NextRehearsalRoute`) is a stable address for the home-screen
shortcut, since a rehearsal's own URL carries an id that changes every week. It resolves and steps
aside (`<Navigate replace>`), falling back to the schedule when nothing is ahead, and it is left
out of the preload set — readers who never installed the app should not pay for it. The manifest
is `frontend/public/manifest.webmanifest`, not the plugin config: `vite.config.ts` sets
`manifest: false`. Three shortcuts: the next rehearsal, the schedule, materials.

### Considered and not done

**"Rehearsal mode" as a real state of the screen.** When a rehearsal is live the hero shows a
pulsing badge and nothing else changes. The entry button now goes full-width there, but the rest
of the surface was left alone: hiding the RSVP pair during the live window would strand the singer
who is running late and wants to say so.

### Browser checks owed for this round

- Dashboard, a rehearsal with NO plan: the gold "Otwórz próbę" is present.
- Schedule → History: an expanded past rehearsal reads "Zobacz przebieg próby".
- A rehearsal-moved notice from the bell: the schedule opens scrolled to that card, expanded, and
  the URL no longer carries `?rehearsal=`.
- Installed PWA: long-press the icon, "Najbliższa próba" lands on the evening.

## Round 2 — the conductor's side (decided 2026-09-22)

A conductor-side audit of Stages 1–5 found the plan strong on "who is needed when" and weak on
the planning loop itself: the choir reads drafts, a missed debrief turns the statistics into gold
false alarms, there is no "if time allows", and the editor makes the conductor type what he
thinks in blocks. The developer took every item; Florent's answer on minutes added decision 23.
Stages 6–7 are structural and land before Florent plans his first real evenings; Stage 8 gives
him the minutes he asked for; 9–10 are ergonomics and come last, so what he says after his first
weeks can still redirect them.

### Decisions (continuing the numbering above)

14. **The plan is public once published, or once the evening has started.** Today `plan` and
    `my_plan_window` reach a member from the first save — a half-laid plan saved on Sunday puts
    "Twoja część 18:00–20:30" on a tenor's card. One predicate, `Rehearsal.plan_is_public(now)`
    = `plan_announced_at is not None or now >= date_time` (after the start the plan is history
    and the ticks are the truth). Drafts are visible to a manager reading as themselves and on
    the lead sheet (the `roll_call` gate); every other reader — a member, a manager in preview
    (`?artist=`) — gets `plan: []` and `my_plan_window: null`, and `GET plan/` answers a member
    `rows: []`. The reminder carries no plan lines and no window for an unpublished plan (one
    group). The button reads "Opublikuj plan" until the first announce, then "Wyślij zmiany",
    enabled only when the plan changed after `plan_announced_at` — today it re-sends an
    identical plan. A re-send's copy says the plan CHANGED (metadata flag, new msgids). No
    unpublish. Plans on the dev stack become drafts; nothing is on prod, so no data migration.
    **`Rehearsal.plan_changed_at`**, stamped by `replace_plan` whenever a row is created, changed,
    moved or DELETED, replaces the per-row `updated_at` comparison behind "zmieniony po
    wysłaniu": deleting the last row changes no surviving row, so the caption misses it today.
15. **Reserve — "Jeśli starczy czasu".** `RehearsalPlanItem.is_reserve`. Reserve rows form a
    suffix of the plan; the plan DTO refuses a main row after a reserve row. The editor draws a
    sortable divider; rows under it are reserve, derived from the divider's position at save
    (never stored per row in the draft). The divider is present once the plan has a row, a quiet
    line while nothing sits under it. Every read surface (page, lead sheet, print, debrief) shows
    the same divider; the card and hero previews stop at it. Reminder lines carry `reserve`, and
    the e-mail prints a "Jeśli starczy czasu" line before them. **The window is unchanged**: a
    reserve row counts, since the window promises the worst case — pinned by a golden case.
    Fills: "Dodaj cały program" appends above the divider; "Niezrobione z ostatniej próby" lands
    everything above it (last week's reserve is this week's due); "Skopiuj plan z…" keeps the
    flag.
16. **Break — a row that calls nobody.** `RehearsalPlanItem.is_break`: a free row (no piece; the
    label stays required, and the editor prefills "Przerwa"), no exclusions (the DTO refuses
    them), and `item_calls_seat` answers False for every seat, players included. A labelled break
    today calls everyone, so "20:00 przerwa, 20:15 Lumen same panie" gives the men 19:00–20:15
    instead of 19:00–20:00. Never in the debrief checklist, the carry-over or the statistics;
    muted on every timeline. Golden cases: a break before a ladies-only closer ends the men's
    window at the break; a break mid-evening is a gap, not an end.
17. **Done defaults to the plan.** Every missed debrief today reads as "nothing happened": once
    one row is ticked anywhere, every untouched piece turns gold, and the carry-over brings the
    whole plan back. `RehearsalPlanItem.skipped_at` beside `done_at`, mutually exclusive, written
    only by the tick endpoint (`done: true` → `done_at`, `false` → `skipped_at`). One pure
    function in `domain/rehearsal_plan.py`: an explicit stamp wins; otherwise, once the evening
    is over, a main row is done and a reserve row is not; before that, `null`. A break is always
    `null`. "Over" = `end_date_time`, else `date_time` + four hours — one named constant, the twin
    of the frontend's `PAST_GRACE_MS`. The wire gains `plan[].done: bool | null`, and EVERY client
    reads `done`, never the stamps. The debrief checklist opens pre-ticked (`done ?? !is_reserve`,
    so it reads right even when opened before the end), headed "Odznacz, czego nie zrobiliście";
    a tap writes explicitly. Statistics: `_rehearsed` counts DISTINCT rehearsals per piece off
    `done` (it counts rows today: a piece worked in the sectional and again in the tutti reads
    "ćwiczone 2×"), and stays `null` until one rehearsal of the project with a plan is over.
    Carry-over takes the rows with `done === false` from the previous rehearsal that is over; an
    evening not held yet offers nothing.
18. **The clock waits to be asked.** `RehearsalPlanRow` keeps the `w-28` slot (the note indent
    and the column alignment depend on it); an empty clock is a ghost "+ godz." that opens the
    `TimeField` on tap; a clock cleared on blur collapses back. Rule for Florent: a clock where
    somebody arrives or leaves. *The "no duration field" clause is superseded by decision 23; the
    slot's final behaviour is described there.*
19. **Block header in the editor.** Once the plan has two blocks or more (blocks as
    `planBlocks` groups them), the first row of each block carries a header: the span and length
    ("18:00–19:00 · 60 min"; the last block runs to the rehearsal end, or reads "od 20:30" with no
    duration; a block starting past the end shows no length — ordering carries the warning), and
    block call chips — the four families plus players — tri-state over the block's non-break rows
    (all / some / none excluded). A tap SETS the family on every row of the block, each through
    its own declared lines. No inheritance on drag: a row moved into a block keeps its
    exclusions, and the header reads "some". Lines ("bez B2") stay per row. Editor only; nothing
    here reaches the choir.
20. **Who is actually coming.** A strip over the editor, per section letter "expected / called":
    the seats the rehearsal calls (`resolveInvited`) minus those holding an `ABSENT` `Attendance`
    for this rehearsal (`LATE` counts as coming). A seat counts toward each of its letters, as
    the call does (a mezzo counts in S and in A); players are a fifth figure when called. Read
    from the flat `["attendances"]` cache, read-only.
21. **The project grid — pieces × rehearsals.** A second view on the Rehearsals hub tab
    (`SegmentedTabs`: "Oś" / "Utwory"). Rows = programme in programme order; columns = the
    project's rehearsals by date. A cell shows planned / reserve / done / not done, "×2" when a
    piece sits twice on one evening — a glyph per state, never colour alone. A right-hand column
    repeats the programme statistics (count, gold zero). Past columns are read-only; a tap on a
    future cell adds the piece to that plan (above the divider, no clock) or removes it, through
    the existing whole-list `PUT plan/` built from the list payload's rows. Accepted race: an
    editor draft of the same rehearsal wins on its next save — the editor is a modal sheet, so
    the two are never open side by side.
22. **Closing the plan sheet with a dirty draft asks first** (`ConfirmModal`); the editor
    exposes `onDirtyChange`.
23. **Minutes per row; the clocks follow from them** (2026-09-22, Florent: "jeżeli ktoś nie
    śpiewa w danym utworze, będzie mógł przyjść na próbę później"). His motive is decision 8's
    window, which already exists. What minutes add is an INPUT that survives reordering: a dragged
    row keeps a typed clock and every time after it goes wrong, while minutes recompute.
    - `RehearsalPlanItem.minutes` (positive small integer, null) — the conductor's estimate.
    - Effective clock, one pure function in `domain/rehearsal_plan.py` and its TS mirror,
      golden-cased: an explicit `starts_at` is an ANCHOR and wins; otherwise the previous row's
      effective clock plus the previous row's minutes, when both are known; otherwise the row
      flows under the last clock, as today. The first row without an anchor starts at the
      rehearsal start. `plan_blocks` and the window read effective clocks — decision 8's rule is
      unchanged, only its input.
    - The choir sees promises, not the budget. The chorister's timeline, page and print show a
      clock on an anchored row and where the reader's own `calls_me` flips (their arrival, their
      release); the reminder's plan lines show anchors only, beside the "Twoja część" row. The
      window itself is computed from every effective clock. The editor and the lead sheet (staff)
      show every effective clock; a reader with `calls_me: null` (staff) sees all of them too.
    - Wire: `plan[].clock` ("HH:MM" | null, effective) and `plan[].clock_derived`; the raw
      `starts_at` stays for the editor.
    - Editor: a minutes field per row, stepping by 5 (a round start then gives round clocks — no
      rounding rule anywhere). The `w-28` slot shows the effective clock, muted when derived and
      in ink when anchored; a tap on a derived clock anchors it, and clearing an anchor returns
      it to derived; "+ godz." only when nothing is known. With a `duration_minutes`, an "end of
      rehearsal" line is drawn between the rows where the running time passes the end — the rows
      under it are what the evening cannot fit, next to the reserve divider. Editor only;
      ordering carries the warning, no validation copy.
    - An anchor earlier than the minutes before it add up to: the anchor wins (it is the
      promise); decision 19's block header states planned minutes against the span, as facts.
    - Minutes supply WHEN, never WHO. Who is released still comes from casting and declared
      voicing (decision 4): a piece whose edition declares only S/A lines releases the men by
      itself; a piece with nothing declared calls everyone until the conductor excludes families.

Rejected: a "partly done" state (the note plus the carry-over covers it), a leader per row,
soloist-only rows, a live mode counting down to a section's release, unpublishing a plan.

### Stage 6 — Backend: publish gate, reserve, break, done, statistics (high effort)

- `roster/models.py`: `RehearsalPlanItem.is_reserve`, `is_break`, `skipped_at`;
  `Rehearsal.plan_changed_at`; `Rehearsal.plan_is_public()` → `makemigrations` (`roster/0059`,
  one migration for all four fields).
- `roster/dtos.py`: `RehearsalPlanRowDTO` gains `is_reserve`, `is_break` (a break: no piece, no
  exclusions, no players flag); `RehearsalPlanDTO` refuses a main row after a reserve row.
- `roster/domain/rehearsal_plan.py`: `item_calls_seat` honours `is_break`; the done rule
  (decision 17) and the "over" constant. Golden cases in `rehearsal_plan_cases.json` (break ×2,
  reserve counts toward the window) AND the TS mirror `features/rehearsals/lib/rehearsalPlan.ts`
  (`PlanRuleRow.is_break`, `planRowOf`) in the same stage — both suites read the one fixture.
- `roster/services.py`: `replace_plan` (new fields in `values`; stamps `plan_changed_at` when
  anything was created, changed, moved or deleted); `mark_plan_item` (done → `done_at`, not
  done → `skipped_at`; a break refused); `announce_plan` (revision flag when
  `plan_announced_at` was already set); `rehearsal_plan_lines` (`reserve`, and nothing when
  the plan is not public).
- `roster/serializers.py`: `RehearsalPlanItemSerializer` (`is_reserve`, `is_break`, `skipped_at`,
  `done` — "over" computed once per rehearsal and passed in context, never `item.rehearsal` per
  row); `RehearsalSerializer.get_plan` / `get_my_plan_window` apply the gate; `plan_changed_at`
  exposed; `ProgramItemSerializer._rehearsed` per decision 17.
- `roster/views.py`: whose view it is decides drafts — the schedule dashboard and `retrieve`
  pass the preview target, the lead sheet passes "drafts visible", `GET plan/` answers a member
  `rows: []` while unpublished, and `PUT plan/` answers `plan_changed_at`.
- `roster/tasks.py`: `_dispatch_rehearsal_reminders` / `_reminder_groups_by_window` — no lines and
  no window for an unpublished plan.
- `notifications/message_content.py`: `_plan_lines` prints the reserve line;
  `_compose_rehearsal_plan_announced` branches on the revision flag. `.po`/`.mo` pl/fr/en via
  polib.
- Tests in `roster/test_rehearsal_plan.py`: the gate (member, preview, manager, lead sheet, after
  the start, `GET plan/`); the reminder without a published plan (one group, no lines); the
  reserve suffix; break windows; done (before the end `null`, after it main true / reserve
  false, an explicit stamp wins both ways, break `null`); statistics count distinct rehearsals and
  stay `null` until an evening is over; `plan_changed_at` on a deletion; the revision copy.
  Existing retrieve and reminder tests publish first.

**As landed (2026-09-22).** Where the code departs from or adds to the list above:
- Migration `roster/0060`, with two `CheckConstraint`s: a row holds at most one verdict
  (`done_at` or `skipped_at`), and a break names no piece.
- Whose view it is travels as `plan_drafts_visible` in the serializer context: retrieve and the
  schedule dashboard pass `not is_preview and user_is_manager`, the lead sheet passes `True`.
  Without the key (the plain rehearsal list) a manager sees drafts and a member does not.
  `_plan_access` (was `_plan_rehearsal_or_404`) returns the rehearsal AND whether the reader is
  on the conductor's side; the same flag gates drafts on `GET plan/` and writes on the tick door.
  `GET plan/` answers `plan_changed_at` too, not only `PUT`.
- `announce_plan` refuses a resend when `plan_changed_at <= plan_announced_at` (400, "The plan
  has not changed since it was sent.") — the server twin of the disabled "Wyślij zmiany".
- `plan_revised` stays false while an earlier plan send still waits in the announcement queue
  (`AnnouncementQueue.has_pending_change`): the cast has not heard the first one, and the queue
  collapses to the latest metadata, so a flag set there would announce a "change" to a plan
  nobody received. `RehearsalUpdatedMetadata.plan_revised` is a typed field.
- Statistics are `null` until ANY non-break row of the project has a verdict — an evening over,
  or an explicit tick. A tick during the evening therefore shows the figures before the end; the
  spec's "until one evening is over" differs only in that window. Two queries (rehearsals, then
  rows), because `Rehearsal.end_date_time` stays the single reader of `duration_minutes`.
- A tap on the tick door always writes explicitly; there is no way back to "no verdict" (nobody
  asked for one).
- The e-mail's reserve line is the msgid "If time allows:" (with the colon).
- TS mirror: `PlanRuleRow.isBreak` (camelCase, like its siblings); `planRowOf` takes `is_break`
  as OPTIONAL, because the editor's draft rows do not carry it yet — Stage 7 makes the draft
  carry it and should make the field required then.

### Stage 7 — Frontend: the same semantics on every surface

- Types: `shared/types/index.ts` (`RehearsalPlanItem`: `is_reserve`, `is_break`, `skipped_at`,
  `done`; `Rehearsal.plan_changed_at`), `features/rehearsals/types/rehearsalPlan.dto.ts`.
- Editor: `plan/usePlanEditor.ts` (the divider as a sortable item, `is_reserve` derived at save;
  `addBreakRow`; fills per decisions 15 and 17), `RehearsalPlanEditor.tsx` (Opublikuj / Wyślij
  zmiany / Opublikowano {when}; caption "Szkic — chór go nie widzi"; "Dodaj przerwę"; the
  changed-after caption from `plan_changed_at`), `RehearsalPlanRow.tsx` (a break row: no chips,
  muted).
- Read side: `RehearsalPlanTimeline.tsx` (divider, break, ticks from `done`),
  `RehearsalDebrief.tsx` (pre-ticked, new heading, no breaks), `api/plan.queries.ts` (the
  optimistic tick writes `done` and the stamps), `RehearsalPage.tsx`, `TimelineRehearsalCard`,
  `NextEventHero` (previews stop at the divider). Check `NotificationItem` for the revised-plan
  copy.
- `QUERY_CACHE_BUSTER` (the DTO changed; bump only if the current value is committed). i18n ×3
  (`rehearsals.plan.*`, `schedule.rehearsal.plan.*`).
- After this stage, `done_at` in `frontend/src/features/rehearsals` appears only in types and the
  optimistic write.

**As landed (2026-09-22).** Where the code departs from or adds to the list above:
- The draft is `{ rows, reserveStart }`; the divider is the sortable id `RESERVE_DIVIDER_KEY`,
  and `moveRow` sorts the keys with the divider spliced in, so the divider's new index IS the
  reserve start. `is_reserve` exists only in `toDTO`. Every single add (piece, free row, break)
  lands above the divider too, not only the fills — the reserve is something a row is dragged
  into. `planRowOf` now takes `is_break` as required.
- Carry-over reads `done === false` (breaks excluded) from the previous rehearsal by date; that
  is also what makes an evening not held yet offer nothing — its unticked rows are `null`.
- The caption reads "Opublikowany · wysłano {when}" (not "Opublikowano {when}"): the stamp is
  the LAST send, and after a resend "Opublikowano" would date the publication wrongly. The draft
  caption is withheld once the evening has started (the plan is public by then); the save toast
  splits on the same fact (draft vs. "Chór widzi zmiany, ale nie dostał o nich znać").
- The free-row placeholder no longer suggests "przerwa" ("np. Rozśpiewanie, ogłoszenia"): a
  break typed into a free row calls everyone, which is the bug decision 16 exists to fix.
- The debrief's record face (no write callback) shows `done === true` only; the pre-tick
  (`done ?? !is_reserve`) is an input's proposal, not a verdict.
- The timeline draws the reserve on a dashed spine under a gold "Jeśli starczy czasu" rule; a
  break is muted and never "bez Twojego głosu" (the server answers `calls_me: false` for it to
  everyone).
- Found along the way: `notifications.changes.plan` did not exist in any locale, so the bell's
  chip on every plan send read the raw key "plan". Added, with `plan_revised` ("Plan zmieniony"),
  which `NotificationItem` swaps in when the metadata says `plan_revised`.
- `QUERY_CACHE_BUSTER` → `2026-09-rehearsal-plan-done` (the previous value was committed).

### Stage 8 — Minutes and effective clocks (decision 23; backend and frontend, high effort)

- `roster/models.py`: `RehearsalPlanItem.minutes` → `makemigrations` (`roster/0061`; Stage 6
  took `0060`).
- `roster/dtos.py`: `RehearsalPlanRowDTO.minutes` (positive; a break may carry minutes).
- `roster/domain/rehearsal_plan.py`: `effective_clocks(rows, start)`; `plan_blocks` and
  `plan_window_for_seat` read it. Golden cases in `rehearsal_plan_cases.json`: minutes only; minutes
  with an anchor mid-plan; the same rows reordered move a section's arrival; a row without minutes
  mid-plan makes the rows after it flow under. The TS mirror (`lib/rehearsalPlan.ts` + its test)
  in the same stage.
- `roster/services.py`: `replace_plan` carries `minutes` (a change of minutes is a change of the
  plan: `plan_changed_at`); `rehearsal_plan_lines` prints anchors only.
- `roster/serializers.py`: `RehearsalPlanItemSerializer` gains `minutes`, `clock`,
  `clock_derived` (effective clocks computed once per rehearsal and passed in context).
- Frontend: types; `plan/RehearsalPlanRow.tsx` (the minutes field, the clock slot per decision 23);
  `plan/usePlanEditor.ts` (effective clocks for the draft through the mirror, anchoring,
  un-anchoring); `plan/RehearsalPlanEditor.tsx` (the end-of-rehearsal line);
  `plan/RehearsalPlanTimeline.tsx` (the display rule: anchors and the reader's own flips; all
  clocks when `calls_me` is null). i18n ×3.
- Tests in `roster/test_rehearsal_plan.py`: the golden cases through the API (a tenor's window
  from minutes alone), `plan_changed_at` on a minutes edit, reminder lines without derived times.

**As landed (2026-09-22).** Where the code departs from or adds to the list above:
- Migration `roster/0061_rehearsalplanitem_minutes`. The DTO bounds minutes to 1–600.
- `effective_clocks(rows, start)` returns `EffectiveClock(clock, derived)` per row and reads any
  `TimedRow` (a protocol: `starts_at` + `minutes`), so the serializer runs it over the stored
  rows without building rule rows. An unanchored FIRST row gets the rehearsal start as a derived
  clock; a row after one without minutes gets `clock=None` (flows under). `plan_blocks` now
  takes `start` and `PlanBlock.starts_at` is never null — the first block always has a clock.
  Every existing golden case passes unchanged.
- The serializer's clocks travel as `plan_clocks` in the context, built with `plan_over` by
  `plan_queries.plan_row_context(rehearsal, items)` over the WHOLE plan — the tick door, which
  answers one row, reads all of them for it.
- Golden cases carry an optional `clocks` list (derivedness = a clock on a row without `time`);
  five new cases, the four named above plus "a break's minutes move every clock after it".
- `rehearsal_plan_lines` needed no code: it already printed `starts_at`, which is the anchor.
- Editor: decision 18's ghost slot lands here together with decision 23 — the slot shows the
  anchor as a `TimeField`, a derived clock as a muted button (tap = anchor it at that time, via
  `anchorRow`), "+ godz." when nothing is known; the field stays open while focused, so
  clearing an anchor does not unmount it mid-edit. The minutes field sits beside the NOTE, not
  on the title line — on a phone the title needed that width. A copied or carried-over row
  keeps its minutes and drops its anchor.
- The end line is drawn above the first row that does not fit whole (it starts at or after the
  end, or its minutes run past it); an evening crossing midnight reads small-hour clocks as the
  next day. It is a non-sortable `<li>` rendered with the row, not a drag target.
- Chorister display: `shownClocks` in `lib/rehearsalPlan.ts` — anchors, the clock of the block
  the reader's first called row falls in (arrival), and the first clock after their last
  called row (release); a mid-evening gap shows nothing. Staff (`calls_me` null) see every
  clock. The debrief reads `clock`.
- `QUERY_CACHE_BUSTER` not bumped: Stage 7's `2026-09-rehearsal-plan-done` is still
  uncommitted, and it ships together with these fields.

### Stage 9 — Editor ergonomics

- Block header (decision 19): new `plan/PlanBlockHeader.tsx`, rendered inside the block's first
  row `<li>` so it travels with the row on drag; `usePlanEditor.ts` gains `setFamilyOnRows` /
  `setPlayersOnRows` (SET, not toggle).
- Attendance strip (decision 20): new `plan/PlanAttendanceStrip.tsx`; `usePlanEditorData.ts`
  reads the attendance register under its existing key.
- Dirty confirm (decision 22): `features/projects/editors/tabs/RehearsalsTab.tsx` +
  `onDirtyChange` on the editor.
- i18n ×3.

### Stage 10 — Project grid

- New `plan/ProjectPlanGrid.tsx` + `plan/useProjectPlanGrid.ts`, mounted in `RehearsalsTab.tsx`
  behind `SegmentedTabs`; layout precedent `AttendanceMatrixTab.tsx` (sticky first column,
  horizontal scroll on a phone). Writes through the plan's whole-list PUT per rehearsal,
  invalidating `["rehearsals"]` and that rehearsal's `["rehearsal-plan", id]`. i18n ×3.

### Verification

Per stage, as above: ruff + mypy on `roster`, `core`, `notifications`; `roster` tests on the
sqlite settings; `makemigrations --check`; `npm run typecheck`, the vitest golden suite, and
`npm run build` after Stages 7, 8 and 10. `make migrate` on dev after Stages 6 and 8; prod gets
0059–0060 with the queued 0057–0058.

Browser, developer:
- After 7: in a chorister preview a saved, unpublished plan is invisible (card, hero, page);
  "Opublikuj plan" makes it appear; deleting the last row then shows "zmieniony po wysłaniu"
  and "Wyślij zmiany". A reserve divider on the page and in print. "20:00 przerwa, 20:15 Lumen
  same panie" → a tenor's window ends at 20:00. An evening that ended with no debrief → the
  programme tab counts its main pieces, reserve pieces stay gold; the debrief opens pre-ticked.
- After 8: 18:00 start, "Lumen · 20 min · bez T, B", then "Orff · 30 min" → the editor shows
  18:20 muted on Orff, a tenor's card says "Twoja część: 18:20–…"; drag Orff first → the tenor's
  arrival becomes 18:00 with nothing retyped; tap the 18:20 to anchor it, drag again → it stays
  18:20. The chorister's page shows only his arrival and anchors, the lead sheet every clock. A
  plan longer than the evening shows the end-of-rehearsal line between rows.
- After 9: a block header toggles "Tenory" across its rows; the strip drops a section after an
  absence is reported; closing a dirty sheet asks.
- After 10: the grid mirrors the plans; a tap on a future cell shows up in that evening's
  editor.

### Traps

- `done_at` no longer means "done". Any reader that still checks it shows a missed debrief as
  "nothing happened" again.
- The gate is one predicate with five readers (two serializer fields, `GET plan/`, the reminder
  lines, the reminder windows). The reminder is the one most likely to be missed.
- `is_reserve` is derived from the divider at save. A draft that stores it per row lets a drag
  put a main row under a reserve one, and the DTO then refuses the whole list.
- The golden fixture is read by both suites: a row-shape change in Stage 6 without the TS
  mirror breaks the frontend suite.
- `done` depends on `now`: a rehearsal's rows flip at its end without a write, and a persisted
  query may hold the old `null` until it refetches. Acceptable.
- Two clock sets after Stage 8: the window and the blocks read EVERY effective clock; the
  chorister's display shows a subset (anchors and their own flips). A reader built on the
  displayed clocks computes the wrong window. Every existing golden case (anchors only, no
  minutes) must pass unchanged — with no minutes, effective clock = `starts_at`.
