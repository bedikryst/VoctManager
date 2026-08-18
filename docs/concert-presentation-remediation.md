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

## Second pass (2026-08-18)

**The spotlight was not one tap from the event sheet. It was the only card there was.**
`Schedule` hands the very next event to `NextEventHero` and renders the feed from
`visibleEvents.slice(1)` — so a concert has no `TimelineProjectCard` while it is the
next thing due, which is precisely the day everything above was written for. The
dashboard is the hero alone, and `GoalConcertCard` suppresses itself when the concert
*is* the next event. The block that shipped into the event sheet was therefore
unreachable, in the app, on concert day: the facts existed only in the PDF that cannot
open without signal and in a subscribed `.ics`. (This is the third finding asserted
from reading a component without tracing the surface that renders it — see below.)

**So the concert hero opens the day, the way the rehearsal hero already opens the
evening.** `RehearsalHero` had escalated into Rehearsal Mode for a −2h…+3h window since
the beginning; `ProjectHero` had no equivalent. It has one now, bound to
`resolveImminence(...) === "TODAY"` — the logistics taxonomy's own bucket, so "today"
means one thing product-wide, and the badge earns `pulse` because at midnight it stops
being true. On that day the card carries "Na miejscu" and the day plan; on every other
day it is exactly what it was.

- The two blocks are shared components (`OnSiteFacts`, `ConcertDayPlan`), not a second
  copy: the spotlight and the event sheet are the same reader looking at the same day,
  and a door named differently on the two is two doors. `hasOnSiteFacts` /
  `hasConcertDayPlan` are exported beside them, because the caller owns the heading and
  the empty state and has to be able to ask before it renders.
- `ConcertDayPlan` hangs its dots outside its own padding box, so a height cap goes on a
  wrapper — capping the plan itself clips them. Said in the component, where the next
  caller will be standing.
- `useCountdownLabel` now takes the caller's clock instead of starting a second one.
  Both heroes already held a `useNow()` to decide their mode; a card whose countdown and
  whose mode disagree about the time is worse than one that is merely stale.

**The manager's Overview states the on-site facts in `ProjectFactsCard`**, not in a card
of its own — it was already a definition list of the concert's bare facts deep-linking
to Details, which is where all four are typed. They sit under `Miejsce` (the address,
then where exactly at it, then who is there), labelled in the Details form's own words
rather than the singer's, and only when entered. The contact is one row, because a name
and a number are one person to call — the same grouping the change notification makes of
the same two columns.

- The number is **stated, not dialled**, and that is a `SectionCard` constraint rather
  than a preference: `onActivate` is an `onClick` on the card itself (`role="button"`),
  and only the `action` slot stops propagation. A `tel:` anchor in the body would follow
  its own href *and* navigate the card to Details underneath it. Nothing interactive
  belongs in a `SectionCard` body while its whole surface is the control; the tap-to-call
  lives on the surfaces the singer reads.

**The `.ics` feed gains the podium, and drafts stay out of it.** A conductor holds no
seat, so a feed resolving `live_seats` was empty of the dates they are the reason for;
their conducted projects and *every* rehearsal within them now join it. Drafts do not,
and this is the one place the file and the panel deliberately disagree:
`get_artist_schedule` hands a conductor their unpublished plans because they are the one
assembling them, while this file leaves the panel to be mirrored onto a calendar
provider's servers and re-read on that provider's cadence — hours to days. A plan still
moving daily would sit there wrong, and would sit there after being abandoned. Both
halves are pinned by one test, so neither gets "fixed" into agreement by accident.

**Verified.** `npm run typecheck` · `npm run lint` · `npm run build` · `ruff` + `mypy` on
`core` (clean) · `manage.py test core roster --settings=config.test_settings_sqlite`
(597 tests, OK). New tests: 4 on the conductor's feed — the podium with its sectionals, a
draft held in the panel and withheld from the file, a cancelled project taking its
rehearsals, and the day facts on a podium entry. By eye: nothing, as above.

## Still open

1. The i18n dead-key sweep is still pending overall (`projects.details_tab.day_plan.anchor_*`
   were removed in the first pass because they were replaced).
2. Unrelated, found while verifying: `ActivatePage.test.tsx`'s two cases fail in a full
   `vitest run` and pass in isolation, on a clean tree as well as a dirty one. Each takes
   ~4.5s to render and the `waitFor` loses the race under parallel load. It is a flake in
   the test, not in the page.

## Withdrawn findings

Recorded because each was asserted from reading a component in isolation, and each was
wrong once the data — or the surface doing the rendering — was traced:

- **"The event sheet is one tap further."** It is not, for the one event this whole
  record is about; see the second pass above. Reading `TimelineProjectCard` says where a
  block lives, and says nothing about when that component is on screen.

- **`tabular-nums` on the run-sheet clock is correct.** `.ai/04_design_system.md`
  §Typography: figures that align down a column — a ledger, a duration column, *a clock*
  — are sans + `tabular-nums`. The "never `tabular-nums`" rule is about `Metric`, the
  display figure in Cormorant.
- **The concert does not drop out of the spotlight at the downbeat.** `useScheduleData`
  filters UPCOMING on `now - 4 h`, so a 19:00 concert stays the hero until 23:00. The
  live window I proposed adding already exists, uniformly, for both event kinds.
