# Concert trip plan — a day plan that spans days, and singers who join on site

Status: **All three stages implemented and committed 2026-09-29 (Stage 1 separately, Stages 2
and 3 with the two Stage 3 gaps and the audit fixes together). `roster/0069` not migrated
anywhere. Nothing seen by the developer: no PDF, no calendar entry, no editor, no singer card.**
Next: the developer's look in the browser and at a printed sheet, then `make deploy` +
`make migrate` on prod before the 2026-10-10 trip, then the Rollout steps. Move this line when
that happens.

Audit notes (2026-09-29, after Stage 3):
- The invitation now states where the reader's plan starts (`plan_starts_at` and the three
  `plan_start_*` keys on `ProjectInvitationMetadata`), per seat, in the details before the call
  and in the push glance. A concert that means a night away is a different yes, and the
  invitation is the only message before the decision. Resolved once per publication for each
  of the two groups (`ProjectInvitationContext.plan_start_by_on_site`), and without a context
  for a seat added to a live trip.
- `roster/queries/day_plan_queries.py` → `plan_start_metadata` is the one assembly of those keys;
  the reminder and the invitation both use it, and `message_content.py` composes both from
  `_plan_start_glance` / `_plan_start_row`.
- The schedule payload's `plan_start` carries `place` (the point's venue when not the event's).
  "Add to calendar" puts it in the description's first row, as the feed does: the entry's
  LOCATION is the concert venue, so without it a Saturday 14:00 entry points to Warsaw.
- Checked and left as they are: the change messages (a `run_sheet` edit is the generic "Day
  schedule" change), the artist merge (a folded seat keeps the survivor's flags, as it does for
  `is_section_leader`), and `ProjectSerializer` (`fields = '__all__'`, so the day columns travel).

Stage 3 notes (where it departs from the list below):
- `compareRunSheetTimes` is `compareRunSheetItems` (plus `sortRunSheet`); `suggestRunSheetTime`
  is `suggestRunSheetMoment`. `readDayOffset` is the frontend `_read_day_offset`; `planDayDate`
  dates a day on the calendar; `hasTravellersOnlyPoint` decides whether the cast offers the mark.
  The label helper is a hook, `features/projects/hooks/usePlanDayLabel.ts`, because its fallback
  (no concert date yet, a project being created) is translated copy.
- `day_timeline_cases.json` has four multi-day cases; two of them fail without the clamp.
- The day select's empty value is concert day, placeholder "Dzień wydarzenia" (not "Dzień
  koncertu": Masses and weddings use the same editor, and it pairs with "Miejsce wydarzenia").
- The "Tylko dla jadących" toggle sits on the row's second line with the day and the place, which
  wrap under the description as one group; the first line has no width for a worded toggle on a
  phone. Lit, it is the row's label, so the editor adds no second one.
- The editor drops the per-anchor date caption: an anchor off concert day makes the plan
  multi-day, and the day heading then carries the date (as the PDF did in Stage 2).
- The cast tab's mark is an icon toggle (`MapPinHouse`) beside the section-leader star, explained
  by the toolbar sentence, with the two counts above it. Counts exclude declines, conductor and
  players included: they are seats and hotel places.
- Found outside the list: the singer's spotlight (`NextEventHero`) opened the plan only when the
  concert was today. It now opens on any day the plan spans.
- Gaps closed after Stage 3: "Add to calendar" booked a project from the downbeat, and the
  singer's card stated "Zbiórka 12:30" with no plan start. The schedule payload's `PROJECT` item
  now carries, per reader (`include_travellers_only = not joins_on_site`), `plan_start`
  (`at`, `day_offset`, `title`, `window`, `place`; null unless the plan opens before the call) and
  `calendar_entry` (`starts_at`, `ends_at`). The client derives neither.
  - `Project.calendar_span(bounds)` is the one rule for a project's calendar block; the feed, the
    reminder's attachment and the payload all use it.
  - `PlanStartChip` sits before the call on the timeline card and the spotlight: label, hour, and
    a note with the day (off concert day only) and the point's title or the window's name
    (`usePlanStartNote`).
  - The button's entry now opens at the call on a one-day concert, as the feed's does. Its
    description gains the feed's first two rows (plan start with its place; the downbeat,
    whenever the entry opens before it), composed on the client from the same facts. A change
    to `_project_description` in `core/ical_service.py` must be mirrored in `AddToCalendar.tsx`.
  - Readers of the concert time on singer surfaces left as they are: the spotlight's countdown
    and `GoalConcertCard` count to the concert, which is what they name.

Stage 2 notes (where it departs from the list below):
- `PlanBounds` carries `first` and `last` as `PlanMoment`s (a run-sheet point, a window key, or
  an anchor), plus `opens_before_call`; `start`/`end` are properties. `plan_bounds` takes the
  windows as the `Project.day_windows()` mapping, so a window opening the plan is known by key.
- `plan_end` is gone. The masthead "Plan ends" cell reads `bounds.last`, the same per-reader value
  the calendar entry ends on, so a joiner's sheet no longer ends on the group's return.
- `Project.plan_bounds(include_travellers_only=...)` is the one assembly for the calendar and
  the reminder. The call sheet calls the domain with its own call window.
- `roster/queries/day_plan_queries.py` resolves point venues for the sheet, the calendar and the
  reminder alike.
- The reminder carries `plan_start_window` (a window key) beside `plan_start_title`, because a
  window is named in the reader's language at render time. Sends are grouped by the whole
  per-reader bounds, not by start alone. The push body leads with the plan start when there is
  one.
- Behaviour change on one-day plans: a non-travellers-only point before the call now opens the
  plan everywhere (masthead cell, calendar DTSTART, reminder row). A crew-only point before the
  call ("Otwarcie kościoła") therefore reads as due for singers. Not addressed; see Deferred.
- The invitation (`roster/invitations.py`) was not in any stage's list; the audit added it (see
  Audit notes).

Stage 1 notes for the next stages:
- `point_sort_key` is the one ordering rule (day, then clock); the call-sheet merge uses it too.
- A point without a readable time keeps its predecessor's position but is clamped to its own day,
  so day groups never split. The frontend (Stage 3) must mirror the clamp, not only the sort.
- Run-sheet rows are no longer wholly unvalidated: the DTOs refuse a `day` that is not a whole
  number in range and a `travellers_only` that is not a boolean. Readers stay lenient.
- `Project.day_windows()` is the only way to read the two windows; `format_day_window` states one
  with its date when it is off concert day. `plan_bounds` takes no zone (it uses the downbeat's)
  and counts the call only when `CallWindow.is_stated`.
- A window change off concert day is escalated to URGENT by the emitter
  (`queue_broadcast(time_critical_fields=...)`).
- Already in place from Stage 3's list: `RunSheetItem.day` / `travellers_only` types,
  `readRunSheetDay`, and `useDetailsForm` keeping both keys through the dirty check and the save.
  The editor still sorts and places every row on concert day; the shared
  `day_timeline_cases.json` has no multi-day case yet, and Stage 3 must add them.
- The masthead "Plan ends" note and the calendar description already state the day. The
  call sheet groups a multi-day plan under dated headings (Stage 2).

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
  (Removed in Stage 2 in favour of `PlanBounds.last`; see the Stage 2 notes.)

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
  `soundcheck_day` (`int`, `ge`/`le` from the constants). Run-sheet rows stay free JSON and
  `normalize_run_sheet` is their only interpreter; the DTOs only refuse a bad `day` or
  `travellers_only`, which the reader would otherwise misplace without a word.
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
- A way to mark a point before the call as not due for singers (crew, production), so a one-day
  plan's early crew point stops opening the singers' plan.
- Telling a singer when the manager toggles `joins_on_site` for them. Today only the plan's banner
  says it. The risk is a traveller marked by mistake, who then sees the departure muted.
- Rooming lists, per-person trip costs, and more than one concert per trip.

## Traps

- `useDetailsForm` rebuilds rows key by key in three places. A key missing from any of them is
  lost silently or blocks the save.
- The frontend and backend sorts must agree: day, then minute, with an unreadable time last
  within its day.
- `location_id` and `day` sit in JSON that older rows never had validated. Every reader degrades
  a bad value to the default and never errors; only the write refuses one.
- `Participation` is serialized with `fields = '__all__'`, so `joins_on_site` reaches every
  payload that embeds a seat. That is harmless (it is not personal data), but do not add a
  second, hand-written copy of it.
