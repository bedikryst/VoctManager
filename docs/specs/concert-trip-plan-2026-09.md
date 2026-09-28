# Concert trip plan — a day plan that spans days, and singers who join on site

Status: **Specified 2026-09-28. Nothing implemented.** Three stages; Stages 2 and 3 both depend on
Stage 1 and not on each other. One stage per session; move this line when a stage lands and say
whether it is committed, migrated and seen in the browser.

## Context

An out-of-town concert is a trip. The choir meets in its home city the day before, travels
together, has a warm-up and an acoustic rehearsal at the venue that evening, sleeps in a hotel and
sings the concert the next day. From departure on, every point of the trip is shared. A few singers
live in the concert city: they skip the departure, the travel and the hotel, but they are due at the
acoustic rehearsal and at the pre-concert call. Trips like this will be common. Trips with more
than one concert are not expected.

What the code says (survey 2026-09-28):

- Only the two anchors carry a real date: `Project.call_time` and `Project.date_time`. Run-sheet
  rows store a bare `HH:MM`, and `warmup_*` / `soundcheck_*` are `TimeField`s. All of them belong
  to concert day by definition (`roster/models.py`, the comment above `warmup_start`;
  `roster/domain/day_timeline.py`, `build_day_timeline` docstring).
- The timeline already has the notion of a day: `TimelineEntry.day_offset` (backend) and
  `DayTimelineAnchor.dayOffset` (frontend). Points are hard-wired to `0`, and windows ignore it
  (`fixtureSortKey` in `features/projects/lib/dayTimeline.ts`).
- The result on the first real trip: call Saturday 14:00, concert Sunday 13:30, warm-up 19:00 and
  sound check 19:15–22:00 printed **after** the concert, on Sunday.
- Run-sheet rows already carry an optional `location_id`, and `LocationCategory` already has
  `HOTEL`, `TRANSIT_STATION`, `PARKING` and `RESTAURANT`. A trip's places need nothing new.
- The subscribed calendar entry opens at `call_time` (`core/ical_service.py`, `_build_ics`).
- The project reminder fires 48 h before `date_time` (`roster/tasks.py`,
  `_dispatch_project_reminders`). If the departure is more than 48 h before the downbeat, the
  reminder arrives after the group has left.

## Decisions

1. **No third entity.** A trip is the project's own plan spanning more than one day. A `Trip`
   model would need its own cast, notifications, calendar entry, singer view and PDF, and would be
   a second answer to "where am I due, when". Rejected along with it: modelling a joiner as "with
   the group from point X on". The typical joiner comes to Saturday's rehearsal, goes home, and
   comes back on Sunday. Also rejected: a per-person, per-point attendance matrix. Nobody fills in
   25 × 12 checkboxes.
2. **A day is an offset from concert day**, an integer in `[-3, +3]`. It is not a date. Moving the
   concert moves the whole plan, and a missing value means `0`, so every stored plan stays valid
   with no data migration. Run-sheet rows carry it as the JSON key `day`. The two windows get the
   columns `warmup_day` and `soundcheck_day`. They are separate columns because the acoustic
   rehearsal can be on Saturday and the warm-up on Sunday.
3. **No "trip" switch.** A plan is multi-day when any entry sits off concert day, including the
   call. Every surface then groups the plan under date headings and titles it "Plan wyjazdu"
   instead of "Plan dnia". A switch is one more thing to forget.
4. **The departure is a run-sheet point, not the call.** The departure point has `day: -1`, a
   place in the home city, and `travellers_only`. The call keeps its original meaning: the
   on-site call before the concert, due for everyone. As a result, an empty call place correctly
   means the venue, and the 24 h plausibility ceiling (`MAX_PLAUSIBLE_BUFFER_MINUTES`) stays as it
   is. Rejected: a `call_location` field. It would only be needed if the call were the departure.
   The call can still be set on another date, as today; the editor adds a hint (Stage 3).
5. **`travellers_only` on a run-sheet row** is a JSON boolean, false by default. Use it for the
   departure, travel, hotel, the group's meals and the return. Anchors and the two windows are
   never travellers-only: the call is for everyone, and the warm-up and sound check are music.
6. **`Participation.joins_on_site`** is a boolean, false by default: the exception. The manager
   sets it in the cast tab. `ParticipationViewSet` is already `IsManagerOrReadOnly`, so a singer
   cannot set it. The control appears only while the plan has at least one `travellers_only`
   point. A flag left behind after those points are removed has no effect.
7. **A joiner sees the same plan as everyone.** Travellers-only points are muted and labelled, not
   hidden. Knowing where the group is has value (joining for dinner), and two versions of one plan
   are two sources of truth. A one-line banner states the reason.
8. **One reminder per project.** It is timed from the earliest moment of the whole plan: that
   moment minus the existing 48 h lead. The calendar attachment it carries is personal (see
   Stage 2).
9. **Calendar entry per person.** It runs from the reader's first due moment to the end of the
   plan (or the existing fallback after the downbeat). A joiner's entry therefore spans the night
   they spend at home. This is accepted for now; see "Deferred".
10. **The cast tab counts both groups**, for example "Jedzie 18 · dołącza na miejscu 3". That is
    the number of car seats and hotel places the producer has to arrange.

## Domain (Stage 1)

`roster/domain/day_timeline.py`:

- Constants `MIN_DAY_OFFSET = -3` and `MAX_DAY_OFFSET = 3`, exported.
- `RunSheetPoint` gains `day: int = 0` and `travellers_only: bool = False`.
- `normalize_run_sheet` reads `day` as an `int` within the range, or `0` for anything else. `bool`
  is an `int` subclass, so `True` must be rejected explicitly. It reads `travellers_only` only
  when the value `is True`. The sort key is `(day, *clock_sort_key(time))`, so an unreadable time
  sorts last *within its day*.
- `build_day_timeline`: a point's key is `day * MINUTES_PER_DAY + minutes`, the carried key for
  an unset time carries the day with it, and a point's `TimelineEntry.day_offset` is `point.day`.
  The anchor tie-break (`_anchor_sort_key`) is unchanged.
- New `plan_bounds(...)`. Inputs: the run sheet, the call window, the two windows with their
  days, the project timezone, and `include_travellers_only: bool`. It returns the plan's first
  instant and its last planned instant after the downbeat, or `None` when nothing is planned
  after it (the same no-fabricated-hour rule as `plan_end`). Wall-clock values become instants
  with `datetime.combine(concert_local_date + timedelta(days=day), time, tzinfo=ZoneInfo(tz))`.
  With `include_travellers_only=False` the travellers-only points are skipped. The call, the
  windows and the concert always count.
- `plan_end` keeps its meaning. Its entry now carries a `day_offset`, which callers print.

`roster/infrastructure/document_generator.py` — `_structured_day_points` passes
`day=project.warmup_day` / `project.soundcheck_day`.

## Stage 1 — backend core

- **Model and migration** (`roster/models.py`, next free migration number; `0069` at the time
  of writing):
  - `Project.warmup_day` and `Project.soundcheck_day`: `SmallIntegerField(default=0)` with
    min/max validators taken from the domain constants. Rewrite the comment above the windows:
    they are wall-clock times on the day their `*_day` column names, relative to concert day.
  - `Participation.joins_on_site`: `BooleanField(default=False)`, with a comment stating
    decision 6.
- **DTOs** (`roster/dtos.py`): `ProjectCreateDTO` / `ProjectUpdateDTO` accept `warmup_day` and
  `soundcheck_day` (`int`, `ge`/`le` from the constants). Run-sheet rows stay unvalidated by
  design; `normalize_run_sheet` is their only interpreter.
- **Change diff** (`roster/services.py`, `_DAY_WINDOWS` in `update_project`): a window compares
  as `(day, start, end)`. Moving the acoustic rehearsal from Sunday to Saturday at the same hours
  MUST produce a change. The value names the day when it is not concert day. Use the date
  formatting the change messages already use; do not invent a second one. Row-level `day` and
  `travellers_only` edits already surface as the generic `run_sheet` change, because the JSON
  compares unequal.
- **Schedule payload** (`roster/queries/schedule_queries.py` → `get_artist_schedule`;
  `roster/views.py` → `schedule_dashboard`): each `PROJECT` item gains
  `joins_on_site: bool`, taken from the reader's own seat. It is `false` where the reader has no
  seat (conductor, manager). `?artist=` preview gets it for the previewed member.
- **Tests** (`roster/tests.py`):
  - normalization of `day` (range, `True`, strings, missing);
  - ordering across days, with an unreadable time on day −1;
  - timeline placement of a point on day −1 against a call on day −1 and a concert on day 0;
  - windows on day −1;
  - `plan_bounds` for both values of `include_travellers_only`, including a trip across the
    2026-10-25 DST change;
  - the window diff on a day-only move.

Verify: ruff + mypy on `roster`; `roster` tests (sqlite settings); `makemigrations --check`.

## Stage 2 — backend outputs (PDF, calendar, reminder)

- **Call sheet PDF** (`document_generator.py` → `_build_timeline_rows`, `_build_masthead_facts`;
  `templates/projects/call_sheet_pdf.html`):
  - When the plan is multi-day, insert a heading row before the first entry of each day, with
    the full date from `_format_date`. The per-anchor `day_note` is then redundant and is
    dropped. The section heading reads "Trip plan" instead of the day-plan heading.
  - Travellers-only rows carry a small label (`pgettext('call sheet', ...)`, "for the travelling
    party"). On a sheet whose `recipient.joins_on_site` is true, the row is also muted.
  - Masthead: when the reader's first due moment precedes the call, add a "Plan starts" cell
    before the call cell. Its value is the time, and its note is the day and the entry's title.
    For a traveller this is the departure; for a joiner it is the Saturday warm-up. Without it, a
    traveller reads "Call 12:30" in the masthead and can reasonably conclude they may arrive on
    Sunday. The conductor's and the report sheets use the whole plan.
  - The "Plan ends" cell's note gains the day when `end.day_offset != 0`.
- **Calendar** (`core/ical_service.py`):
  - `_personal_events` also returns the ids of projects where the reader's seat has
    `joins_on_site`. `_build_ics` takes that set, and the season feed passes an empty one.
  - A project VEVENT runs from `plan_bounds(include_travellers_only=not on_site).start` to
    `max(bounds.end, date_time + FALLBACK_EVENT_DURATION_MINUTES)`.
  - `_project_description`: a window off concert day states its date. When the entry opens before
    the call, add a first row naming that moment (title, date, time, place name), so a VEVENT
    that opens at 14:00 on Saturday says what happens at 14:00.
- **Reminder** (`roster/tasks.py`, `_dispatch_project_reminders`):
  - Prefilter candidates with `date_time__lte = now + lead + timedelta(days=-MIN_DAY_OFFSET)`.
    Keep those whose `plan_bounds(include_travellers_only=True).start <= now + lead`, and claim
    `reminder_sent_at` **only for the kept ids**. Today the claim runs over the whole filter.
  - Split recipients by `joins_on_site` and send one bulk notification per distinct plan start.
    Each send has its own `ics.start` / `ics.end` and metadata `plan_starts_at` (ISO),
    `plan_start_title` and `plan_start_place`. With no travellers-only points both groups
    resolve to the same start and one send goes out.
- **Reminder copy** (`notifications/message_content.py`, `_compose_project_reminder`): when
  `plan_starts_at` precedes the call, the first detail row is "Starts" with the date and time,
  rendered through the same display helper as `starts_at`, then the title and the place. There is
  no new `NotificationType`.
- **Translations**: new msgids in `backend/locale/{pl,en,fr}/LC_MESSAGES/django.po`; recompile
  the `.mo` files, which are tracked.
- **Tests**:
  - `core/tests.py`: VEVENT start and end for a traveller, a joiner and the season feed;
    description rows.
  - `roster/tests.py`: reminder timing when departure is more than 48 h before the downbeat;
    the claim covers only the kept ids; two sends when the groups differ, one when they do not;
    PDF rows (headings, travellers-only label, joiner muting, "Plan starts" cell).

Verify: ruff + mypy on `roster`, `core` and `notifications`; the tests of those three apps
(sqlite settings).

## Stage 3 — frontend

- **Types**:
  - `shared/types/index.ts`: `RunSheetItem` gains `day?: number` and
    `travellers_only?: boolean`, documented the way `location_id` is. `Project` gains
    `warmup_day` and `soundcheck_day`. The participation type gains `joins_on_site`.
  - `features/projects/types/project.dto.ts` mirrors them.
  - `features/schedule/types/schedule.dto.ts`: `ScheduleDashboardProjectItem.joins_on_site`.
  - Bump `QUERY_CACHE_BUSTER` (`main.tsx`); the DTO shape changed.
- **`features/projects/lib/dayTimeline.ts`** (and `dayTimeline.test.ts`):
  - Windows carry `dayOffset`, and `fixtureSortKey` uses it for every fixture.
  - `DayTimelinePoint` gains `dayOffset`, and point keys include the day.
  - `compareRunSheetTimes` becomes an item comparator `(day, minute)`, matching the backend
    sort exactly; `buildProjectDayTimeline` and `useDetailsForm` use it.
  - `suggestRunSheetTime` suggests a `{ day, time }` pair. A new point takes the day of the
    latest point.
  - New `groupDayTimeline(entries)` → `{ dayOffset, entries }[]` and `isMultiDayTimeline`, so
    the three renderers below share one grouping.
  - A date-label helper (weekday short + day.month, from the concert date and an offset,
    locale-aware) for headings and the day select.
  - Tests mirror the Stage 1 backend cases.
- **Editor**:
  - `editors/hooks/useDetailsForm.ts`: `day` and `travellers_only` in all **three** places that
    rebuild a row key by key: `normalizeRunSheetItem`, `toComparableRunSheet` (the dirty check;
    without it the save stays blocked) and `sanitizedRunSheet`. Also add `warmup_day` and
    `soundcheck_day` to the form state and the payload. A day change is a commit, so it re-sorts
    at once. The typed-time rule (sort on blur, not on keystroke) stays.
  - `editors/tabs/components/RunSheetRow.tsx`:
    - `onUpdate` accepts non-string values.
    - The second line gets a ghost day select beside the place select. Its placeholder names the
      default ("Dzień koncertu"), the same pattern as "Miejsce wydarzenia". The options are
      dates for offsets −3…+3, with the concert day marked.
    - The first line gets a labelled toggle "Tylko dla jadących", readable without hover, not
      icon-only.
  - `editors/tabs/components/DayTimeline.tsx`: date headings when multi-day, and a
    travellers-only label on those rows.
  - `editors/tabs/DetailsTab.tsx`:
    - A day select beside each window's start/end pair.
    - A caption under the call field, shown whenever the plan is multi-day or has a
      travellers-only point: "Zbiórka dotyczy wszystkich. Wyjazd wpisz jako punkt planu, z
      miejscem."
    - The section title switches between "Plan dnia" and "Plan wyjazdu".
- **Cast tab** (`editors/hooks/useCastTab.ts` and the row that renders the section-leader
  control): a "Dołącza na miejscu" toggle through the same `updateParticipationMutation` path.
  It is shown only while the project's plan has a travellers-only point. The tab header shows
  the two counts (seats not declined).
- **Manager card** (`ProjectCard/widgets/RunSheetWidget.tsx`): headings, the travellers-only
  label and the title switch.
- **Singer views**:
  - `features/schedule/hooks/useScheduleData.ts` maps `joins_on_site` onto the event.
  - `TimelineProjectCard.tsx` and `NextEventHero.tsx` pass it on and switch the title.
  - `ConcertDayPlan.tsx` shows date headings. For a joiner, travellers-only rows are muted with
    the label "dla jadących", under the banner "Dołączasz na miejscu — wyszarzone punkty dotyczą
    tylko jadących."
- **Locales**: every new string in `pl`, `en` and `fr`. Polish is primary and must read natively.

Verify: `npm run typecheck`, `npm run test` (dayTimeline), `npm run build`. The developer checks
the editor, the cast tab and the singer view in the browser.

## Rollout

`make migrate` on prod after deploying Stage 1 (the migration adds three columns with defaults).
Then, for the first trip, on prod in the panel:

1. Set the call to the on-site call on concert day. Clear the Saturday values from the call and
   from any interim note in the description.
2. Set the warm-up and sound-check windows to day −1.
3. Add the departure as a point: day −1, the meeting place, travellers only. Add the hotel, the
   meals and the return the same way.
4. In the cast tab, mark the singers who join on site.

## Deferred

- A per-day calendar entry for joiners, so the VEVENT does not span a night at home.
- Telling a singer when the manager toggles `joins_on_site` for them. Today only the plan's banner
  says it. The risk is a traveller marked by mistake, who then sees the departure muted.
- Rooming lists, per-person trip costs, and more than one concert per trip.

## Traps

- `useDetailsForm` rebuilds rows key by key in three places. A key missing from any of them is
  lost silently or blocks the save.
- The frontend and backend sorts must agree: day, then minute, with an unreadable time last
  within its day.
- `location_id` and now `day` sit in unvalidated JSON. Every reader degrades a bad value to the
  default and never errors.
- `Participation` is serialized with `fields = '__all__'`, so `joins_on_site` reaches every
  payload that embeds a seat. That is harmless (it is not personal data), but do not add a
  second, hand-written copy of it.
