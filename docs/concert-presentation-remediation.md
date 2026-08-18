# Concert presentation remediation (2026-08-18)

**How to read this file.** It records why the concert now looks the way it does to a
chorister, and what was deliberately left alone. `Still open` is the only section a
follow-up session has to read before deciding what to do next; the rest is reasoning
you only need when you are about to change one of these surfaces.

Sibling record: `docs/call-sheet-remediation.md` (the printed day card). This one is
about everything *outside* the PDF.

---

## Diagnosis

Stage A7 of the call-sheet remediation added nine day-of columns to `Project`
(entrance / parking / dressing room, two typed windows, on-site contact) and wired
them into the printed day card. Nothing else was wired at all.

- The data reached the chorister's browser (`ProjectSerializer` is `fields = '__all__'`,
  and `schedule-dashboard` serialises whole projects with it) and **no component
  rendered a single one of them**. The only way to see them was a PDF.
- That PDF is a `volatile` blob, and blobs are excluded from the query persister
  (`main.tsx` `shouldDehydrateQuery`). The panel persists its whole cache for 24 h, so
  outside a church with no signal the concert card paints from cache and the one
  document carrying the door, the parking and the phone number is the one thing that
  cannot open.
- The day had **two axes**: the printed sheet merges the windows into the run sheet
  (`document_generator._structured_day_points` → `build_day_timeline`), while every
  panel surface read raw `run_sheet`. A producer typing a sound check could not see it
  collide with a run-sheet point, and the singer's app showed a day the PDF disagreed
  with.
- Changing any of the nine was **silent**: `_PROJECT_CHANGE_KEYS` did not know them, so
  a sound check pulled 90 minutes forward the evening before the concert notified
  nobody — while a dress-code tweak did.
- The subscribed `.ics` feed wrote its own visibility rule instead of reading
  `Participation.live_seats`, and **published DRAFT concerts** into singers' calendars.

## What shipped

**One axis, three surfaces.** `buildDayTimeline` now merges four fixtures (call,
warm-up, sound check, downbeat) into the points; `buildProjectDayTimeline` is the
read-only entry point that sorts a stored run sheet first, mirroring the server's
`normalize_run_sheet` → `build_day_timeline` pair. Read by the producer's editor, the
Overview widget and the chorister's event sheet.

- Placement matches the print side by construction: `FIXTURE_NUDGE` puts the call
  before a point of the same minute and the downbeat after it, with the windows in
  between — which is where the backend's stable sort leaves them, because it appends
  the synthesised window points to the sorted run sheet.
- Windows carry no `dayOffset`. A window is wall-clock on concert day (the run
  sheet's own frame); only an anchor can sit on another date.
- The names live once, in `DAY_FIXTURE_PRESENTATION` (`lib/projectPresentation.ts`),
  and are the printed card's words msgid for msgid in all three languages. A singer
  reading "Rozśpiewanie" on the PDF has to recognise it in the app.
- **This killed the lexical sort** in two places (`a.time.localeCompare(b.time)`), where
  `"9:00"` sorted after `"12:00"` — `run_sheet` is unvalidated JSON and still holds
  rows written before the current time control.
- The empty state is now gated on *the plan*, not the entries: a day carrying only a
  call and a downbeat has nothing planned between them and says so in words the two
  anchors cannot.

**"Na miejscu" in the chorister's Logistics tab.** Entrance / parking / dressing room
as plain label-value type (a chip is for an exception, not for a fact), the contact as
an `Eyebrow` label with a `tel:` button under it. Only what was entered — a row reading
"Parking: —" answers nothing and pushes the fact that does answer something off a phone
screen. Unnamed, the role *is* the name, so no line repeats the label above it.

**Every day-of fact now announces itself.** Each note keeps its own change key
(`entrance` / `parking` / `dressing_room`), because each is its own fact with its own
name; the contact is one key, because a name and a number are one person to call. The
two windows are diffed **as pairs**, before the update loop writes them
(`format_time_window`, now in `roster.domain.day_timeline` so the notification and the
calendar entry render a window identically) — four columns emitting four rows would say
"17:00 → 15:30" without ever saying which hour of which window moved.

- **Not** in `_TIME_CRITICAL_FIELDS`, and the comment there now says why: the call time
  is the hour the cast is held to, and it does not move when a window inside the day
  does. News, not an alarm.

**The `.ics` feed reads `live_seats` like every other chorister-facing door.** With it
came three bugs the hand-rolled query carried: deleted rehearsals stayed in the
calendar, sectionals went to everyone (a soprano got the basses' rehearsals), and the
description escaped its parts and then the whole assembled string, so a comma reached
the calendar as `\,`. Concert entries now carry the day facts, the downbeat (the entry
starts at the call time) and nothing that was left blank.

**The day-sheet endpoint** (`_resolve_day_sheet_audience`) hand-rolled two of
`live_seats`' three conditions and left out the one about the project, so a singer cast
into an unpublished draft could fetch its day card. The test fixture had been asserting
the whole access model against a DRAFT project; it is now published, like every concert
whose day sheet somebody actually fetches.

## Verified

`npm run typecheck` · `npm run lint` · `npm run build` · `npx vitest run` (92 tests,
10 files) · `ruff` + `mypy` on `core` / `roster` / `notifications` (clean) ·
`manage.py test roster core notifications --settings=config.test_settings_sqlite`
(703 tests, OK). New tests: 5 on the timeline (window placement, the shared-minute
tie, `HH:MM:SS`, an end with no start, the stored-day sort), 3 on the change diff,
5 on the calendar feed, 1 on the day-sheet gate.

Nothing here was verified by eye. The panel is the developer's to look at, and the
`.ics` has not been opened in a real calendar client.

## Still open

1. **The concert-morning surface is `NextEventHero`, and it carries none of this.** The
   event sheet is one tap further, and on the day of a concert the hero is what people
   look at. A compact line (entrance + the phone) is the obvious move; the reason it was
   not made is "one primary element per card", which is a real rule and may still lose
   to the use case. **Decide, don't drift.**
2. **The manager's Overview has no on-site card.** The facts are one click away in the
   Details editor where they are entered, which is why this was left — but Overview is
   the producer's one screen for the concert.
3. **The conductor's subscribed calendar is still empty of the projects they only
   conduct.** `get_artist_schedule` gives them their podium projects (drafts included,
   deliberately); the feed gives them nothing, because it resolves seats. Fixing it means
   deciding whether a draft belongs in a file that syncs to other people's devices.
4. The i18n dead-key sweep is still pending overall (`projects.details_tab.day_plan.anchor_*`
   were removed here because they were replaced).

## Withdrawn findings

Recorded because both were asserted from reading a component in isolation, and both
were wrong once the data was traced:

- **`tabular-nums` on the run-sheet clock is correct.** `.ai/04_design_system.md`
  §Typography: figures that align down a column — a ledger, a duration column, *a clock*
  — are sans + `tabular-nums`. The "never `tabular-nums`" rule is about `Metric`, the
  display figure in Cormorant.
- **The concert does not drop out of the spotlight at the downbeat.** `useScheduleData`
  filters UPCOMING on `now - 4 h`, so a 19:00 concert stays the hero until 23:00. The
  live window I proposed adding already exists, uniformly, for both event kinds.
