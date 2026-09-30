# Conductor density audit: steps to an answer (2026-10)

Status: sessions 1 and 2 implemented 2026-09-29 (uncommitted, not yet reviewed in a browser);
sessions 3–4 not started. The fixes below are ranked, and "Implementation sessions" assigns every fix to one of
four sessions.
Decided 2026-09-29:
- Fix 7: the dashboard card keeps counting the whole ensemble.
- Fix 11: the backend owns the blocker list.

Settled in session 1, where the text below says otherwise:
- Fix 1: the banner does not call `useUpcomingAbsences`. `features/dashboard/hooks/useRehearsalAbsences`
  runs the same `collectUpcomingAbsences` on the banner's own rehearsal, cut at that rehearsal's
  start rather than the clock, so the figure survives while the evening is under way. It uses plain
  queries on the Overview's keys, so a failed read drops the badge instead of suspending the page.
- Fix 2: `cast_*` did count the conductor's seat. The project list annotations now exclude
  `voice_type = DIR`, and `useProjectInvitations` does the same. A draft shows "Obsada N głosów";
  only a published project shows "Potwierdzeni X z N" and "N czeka".
- Fix 7: the card's caption reads "Wszyscy aktywni śpiewacy w bazie", because the hub already uses
  "Zespół" for a project's cast. Its total is the sum of the four sections, so the conductor and the
  players are not counted.
- "Current" rehearsal: the mismatch was real (the banner listed rehearsals of closed projects and
  dropped the evening at +2 h). The banner now uses the workspace rule: open projects,
  `isRehearsalLive` or later.
- Pipeline order: `compareProjectHorizon` in `features/projects/lib/projectPresentation.ts`. Fix 3
  (session 2) should sort with it.

Settled in session 2:
- Fix 3: the "Zakończone" filter keeps newest first; every other filter sorts by the horizon.
- Fix 4 and fix 7 share `features/projects/lib/castStanding.ts`. The status segment appears only
  on a published project, and it replaces the header badge, which would repeat its "Wszyscy"
  figure. While a segment narrows the list, rows keep their section numbers and cannot be dragged.
- Fix 7: a draft shows every seat that isn't declined, with no "+N". Under a narrowing segment a
  section header counts the rows shown. The rail marks a voice gold only when nobody is cast in it,
  answered or not. One caption under the rail explains "+N", because a phone has no hover.
- Fix 5: only filled named positions are named. Legacy SOLO rows, and positions whose performer
  declined or left, stay in the gap count.

The conductor runs the panel from a phone. This audit takes the six questions he asks most and
counts, from the code, what each answer costs on a phone and on a desktop, starting from `/panel`.
The yardstick is the density rule in `.ai/04_design_system.md` ("prefer compact rows and real data
over decorative padding"). Very little of the cost turned out to be padding. Most of it comes from
routing, from stacking order on a narrow screen, and from counts shown where names already exist.

Constraints held throughout:

- No panel-wide compact mode. Every fix is local to one surface.
- Screens used during a rehearsal keep their spacing: the score stand (Partytura viewer, score
  book), the rehearsal page `/panel/schedule/rehearsal/:id`, the lead sheet, and the roll-call rows
  and plan editor in `/panel/rehearsals`. A fix may link to them or change what sits above them. It
  does not tighten them.

Paths are relative to `frontend/src/` unless they start with `backend/`. Line numbers are as of
2026-09-29.

## How steps were counted

- **T** is a tap or click. Typing into a search counts as one T.
- **S** is a scroll of about one viewport to bring the answer on screen.
- **E** is a screen change: a route, a sheet or a modal.

Phone means 390 px wide with about 650 px usable above the dock. Desktop means 1280 px or wider.
Heights were estimated from the classes and row counts in the code, assuming 40 singers,
10 rehearsals and a six-row plan. Nothing was measured in a browser, so read every S as ±1.

Two paths are counted for each question:

- The **likely** path is the one the entry points suggest: a dock tab, or a dashboard card named
  for the question.
- The **shortest** path is the best one that exists, whether or not anything leads to it.

## Where it stands

| # | Question | Phone, likely | Phone, shortest | Desktop, likely | What the conductor sees on arrival |
|---|---|---|---|---|---|
| Q1 | Who won't come to the next rehearsal | Banner, then `/panel/rehearsals`: **T1 S13 E1 = 15** | Spotlight card, hub, "Zgłoszone nieobecności": T2 S≤1 E2 = 5 | T1 S6 E1 = 8 | Likely path: names found only by scanning the whole roll call. Shortest path: names and notes, grouped by rehearsal, but only when the next rehearsal belongs to the next concert. |
| Q4 | Who hasn't confirmed the concert | Projekty, project, Obsada: **T3 S5–6 E3 ≈ 12** | Pipeline row, then the invitations sheet: T1 S2 E1 = 4 | T3 S3–4 E3 ≈ 10 | Likely path: "Czeka" badges to scan, with no filter and no count. Shortest path: complete, with contact links. |
| Q2 | Who sings the solo in piece X | Projekty, project, Divisi, piece, solo editor: **≈ 11** | Spotlight, "Obsada programu" tile, piece: ≈ 8 | ≈ 6; through Ctrl+K a dead end, ≈ 9 | The name sits inside a select in an edit form, one piece at a time. |
| Q6 | Voice balance for the concert | Dashboard ensemble card: T0 S1 E0 = 1, **wrong** | Confirmed only, counted by hand on Obsada: T2 S5 E2 = 9 plus counting; or the day-sheet PDF, ≈ 10 | The card is visible, and wrong | The card counts the whole roster and miscounts two voices (see "Wrong answers"). |
| Q3 | What's on today's rehearsal | Banner, then the workspace plan editor: T1 S3–4 E1 ≈ 6 | Więcej, Mój Kalendarz, Otwórz próbę: T3 S2 E3 = 8 | T1 S1 E1 = 3 | The banner shows when and where at zero steps. The plan reads as an edit form unless he finds the calendar. |
| Q5 | What's missing for the next concert | Spotlight, hub, "Wymaga uwagi": T1 S1 E1 = 3, **partial** | Complete only in the "Raport produkcji" PDF: T3 E2, plus reading the PDF | T1 S0 E1 = 2, partial | The panel checks 8 things. The PDF checks about 15 (see fix 11). |

## What the six paths share

1. **Dashboard entry points open a workspace instead of the answer.** The rehearsal banner links to
   bare `/panel/rehearsals` (`features/dashboard/components/NextRehearsalAlert.tsx:70-77`). The
   absence notifications do the same (`backend/notifications/message_content.py:275`,
   `features/notifications/components/NotificationItem.tsx:723-731`). The debrief notification
   already passes `?rehearsal=`.
2. **Counts stand where names already exist.** The dashboard and hub show "Nieobecni: 3",
   "N czeka", "Luki w obsadzie 2" and "Obsada 40". Two sheets that name the people already exist,
   `UpcomingAbsencesSheet` and `ProjectInvitationsSheet`, but each opens from exactly one place.
3. **On a phone, desktop's two columns become one long stack.**
   - The rehearsal rail lists every rehearsal, oldest first, and its height is capped only at `lg`
     (`features/rehearsals/components/RehearsalRail.tsx:232`). On a phone it sits above the
     inspector.
   - On the dashboard, the Spotlight card's `min-h-[400px]` and the ensemble card push the pipeline
     down to about y 1430.
4. **The hub is hard to reach and hard to read on a phone.**
   - The project list sorts newest first (`features/projects/hooks/useProjectDashboard.ts:81-83`),
     so the next concert sits below every later one.
   - The hub's ten tabs scroll sideways with no scrollbar and no scroll to the active tab
     (`features/projects/components/ProjectTabs.tsx:108`). At 390 px, Obsada (5th) and Divisi
     (6th) start off-screen.
5. **Two figures on the dashboard are wrong**, and the cheapest answer to Q6 is one of them.

## Fixes, ranked by the steps they remove

The order follows the phone step count of the path each fix shortens, largest first. A desktop-only
fix is placed by its desktop count. The figure after the arrow is the estimated count once the fix
is in.

### 1. The rehearsal banner opens the list of who is missing (Q1: phone 15 → 2, desktop 8 → 2)

- Make the "Nieobecni: N" badge (`NextRehearsalAlert.tsx:167-177`) its own button, layered above
  the card's link overlay the way `LocationPreview` is at `:138`. It opens `UpcomingAbsencesSheet`
  for that rehearsal.
- The count and the rows must come from one rule. Today they come from two:
  - The banner reads the server's `absent_count`, which counts every ABSENT or EXCUSED record
    (`backend/roster/views.py`, around line 2103).
  - The sheet leaves out declined seats and seats no longer called
    (`features/projects/lib/upcomingAbsences.ts:101-111`).

  As a result, "Nieobecni: 4" can open a list of three. Recommended: the banner calls
  `useUpcomingAbsences(projectId)` and counts the group for its own rehearsal. That costs one extra
  query on the dashboard, which is the price of having one rule.
- This also removes a mismatch: the banner and the Spotlight card can belong to different projects
  (`useAdminDashboardData.ts:236-258` and `:291-325`). Scoping the sheet to the banner's own
  rehearsal makes that harmless.
- The banner's own link, and the ABSENCE_REQUESTED and ATTENDANCE_SUBMITTED notifications, carry
  `?rehearsal=<id>`. The workspace already reads that parameter
  (`features/rehearsals/hooks/useRehearsalsData.ts:368-386`).
- Decided against:
  - Sending the count to the attendance matrix. The matrix is an entry tool: a tap changes a mark,
    and it has no excuse note.
  - Pinning absentees to the top of the roll-call roster. That is a rehearsal-time screen, ordered
    for marking attendance.

### 2. The Spotlight card says who hasn't answered (Q4: phone 12 → 2–3, desktop 10 → 2)

- Replace the "Obsada N głosów" metric (`SpotlightProjectCard.tsx:82-88`, which is fed
  `cast_total`) with confirmed out of total. Add a gold "N czeka" that opens
  `ProjectInvitationsSheet`.
  - That sheet already lists pending singers first, with mail and phone links
    (`ProjectInvitationsSheet.tsx:240-245`).
  - `cast_confirmed` and `cast_pending` are already in the dashboard data
    (`useAdminDashboardData.ts:224-227`).
- Show "N czeka" only for a published project, and only when N > 0. An RSVP the system asks for
  stays silent until publication, and the resting state says nothing (design system, "Never state
  the resting default").
- Check that the `cast_*` figures leave out the conductor's own seat, as the hub's "Zespół" tile
  does.

### 3. The project list puts the next concert first (Q4, Q2 and Q5 dock paths: one scroll less each)

`useProjectDashboard.ts:81-83` sorts by date, newest first. Sort upcoming projects soonest first,
then undated ones, then past projects that are not yet closed. On a phone, the list exists to open
the next concert.

### 4. The Obsada tab filters to "Czeka" (Q4, where he acts on it: about 5 inner scrolls → 1 tap)

- Today the cast list has no status filter. Search filters only the pool (`useCastTab.ts:336-348`),
  and the header badge shows the total (`CastTab.tsx:571`).
- Add a status segment: Wszyscy · Czeka · Odmowa. Each option's count comes from the same predicate
  that builds its rows (design system, "Compute a tab's count from the same predicate").
- Fix 2 answers the question. This fix serves what comes next: this tab is where he re-invites
  someone or follows up.

### 5. The overview's programme card names the soloists (Q2: phone 11 → 4, desktop 6 → 2–3)

- The data is already loaded and then thrown away. `useProgramFulfillment` loads
  `useProjectSolos` (`useProgramFulfillment.ts:54,107-119`) and reduces it to a gap count, and
  `ProgramWidget` prints only "N luk".
- For each piece with named solos, print one caption line: `Solo: Name (part)`. Keep the gap count
  only where a solo is still unfilled.
- Use plain `Caption` type under the title, with no chip. A solo assignment is a fact about the
  row, not an exception.
- The Divisi editor stays the place to change solos. A `?piece=` parameter on Divisi
  (`useMicroCasting.ts:249`; today the selected piece is not in the URL) is worth adding once
  something needs to deep-link there. Nothing does yet.

### 6. The hub's tab strip shows where it is (Q2, Q4 and Q6 on a phone: one hidden swipe less)

`ProjectTabs.tsx:108` holds ten tabs in a sideways-scrolling strip with no scrollbar and no scroll
to the active tab. By estimate, about four fit at 390 px, so Obsada and Divisi start off-screen and
nothing shows that the strip scrolls. Scroll the active tab into view on every route change, and add
an edge fade on the side that overflows.

### 7. The concert's balance comes from the cast tab; the dashboard card says it counts the whole ensemble (Q6: phone 9 plus hand counting → 5, desktop → 4)

- **Decision.** The dashboard's ensemble card (`TelemetryWidget`) keeps counting every active
  artist in the roster. Q6 is therefore answered on the cast tab: Spotlight → "Zespół" tile →
  balance strip, which costs T2 S1 E2.
- **Cast tab.** The balance strip counts every seat that isn't declined, invited singers included
  (`useCastTab.ts:374`). Its section headers even include declined seats (`CastTab.tsx:637`).
  - Show confirmed and invited separately in each group. Confirmed is the main figure, and invited
    is a secondary figure that appears only when it is above zero.
  - Compute the section headers with the same function.
- **Dashboard card.**
  - Its label has to say "the whole ensemble". The card sits in the same row as the next-concert
    card, so without that label it reads as the concert's balance. That misreading is what put
    this card in the audit.
  - Build its tally from the shared voice → section map instead of private
    `startsWith` filters (see "Wrong answers").
- **Grouping.** Don't regroup voices as part of this fix. The strip's five groups, with mezzo kept
  separate (`voiceFamilies.ts:166`), are a separate decision. Any change to grouping needs the
  baritone/bass casting scenario covered in a test.

### 8. Ctrl+K finds a piece inside the current programme (Q2 on desktop: 9 → 3)

- Today a manager's piece result opens the archive card (`useCommandItems.ts:295-316`), which knows
  nothing about projects.
- When the piece is on a live programme, add a second result, "X · <project>", that opens
  `/panel/materials/:projectId/:pieceId`.
  - That page's Obsada column lists solos by name (`PieceDivisiRoster.tsx:102-131`).
  - At `lg` the column shows without tapping a tab.

### 9. The banner opens today's plan for reading (Q3: phone 8 on the clean path or 6 in the form → 2)

- Add a "Plan" link on `NextRehearsalAlert` to `/panel/schedule/rehearsal/:id`. That is
  `RehearsalPage`, the read-only timeline with times and notes. Today a manager reaches it only
  through Więcej → Mój Kalendarz → Otwórz próbę.
- Add a command-palette action, "Najbliższa próba", that opens `/panel/schedule/next`. The route
  exists, and only the home-screen shortcut uses it.
- The page itself is a rehearsal-time screen. It gets linked to, not changed.

### 10. On a phone, the rehearsal rail stops pushing the roll call down (Q3 likely path: 6 → 3, and the roll call reaches the first screen)

- Below `lg`, the rail lists every rehearsal of the project at full height, oldest first
  (`RehearsalRail.tsx:232` caps it only at `lg`). The inspector therefore starts about 1400 px down.
- Below `lg`, choose one of two options:
  - Show the selected rehearsal as a single row that opens the rail as a sheet.
  - Cap the rail's height and scroll it to the active row.
- The roll-call rows and the plan editor keep their size. This fix changes what sits above a
  rehearsal-time screen, not the screen itself.

### 11. "Wymaga uwagi" lists everything that is missing (Q5: from a PDF to 3 steps, complete)

- The panel (`ProjectAttentionPanel.tsx:89-191`) checks eight things: programme gaps, absences, no
  cast, empty programme, no rehearsals, empty run sheet, score book and dress code.
- The production report's blocker list
  (`backend/roster/infrastructure/document_generator.py:1749-1937`) also checks: invitations with
  no answer, nobody confirmed yet, call time, venue, on-site phone, pieces without scores, section
  tracks and crew. Two blocker lists for one concert will keep drifting apart.
- **Decided:** the backend owns the list. The panel renders it and the PDF prints it.

**One domain function.** `DocumentGenerator._build_blockers` becomes a pure function in
`backend/roster/domain/readiness.py`, next to `attendance_window.py` and `day_timeline.py`.
- It takes plain facts rather than the PDF's program cards:
  - the call window;
  - the venue;
  - the cast without the conductor, split into pending and confirmed (built as in
    `document_generator.py:588-602`);
  - per piece: score present, track count and casting coverage;
  - the crew;
  - the merged day points;
  - the on-site phone;
  - the dress code.

  Building the full program cards is too heavy for an endpoint the overview opens.
- It returns typed entries: a stable `code`, a `count`, and `subjects` (the names or piece titles
  behind the gap). It returns **no sentences**.
- The PDF maps each code to its existing gettext strings. The panel maps each code to i18next keys,
  because a sentence written by the server is in the server's language (design system).

**It also takes over the checks only the panel runs today:** no rehearsals, and the score book
missing or out of date. After that, `ProjectAttentionPanel` computes no blocker of its own. The
absences row is the one exception and stays on the client: `collectUpcomingAbsences` already
serves that row, the sheet and `RehearsalsWidget`.

**Check this first: programme gaps follow two rules today.**
- The panel counts partial coverage: divisi lines and named solos (`useProgramFulfillment`).
- The report counts only pieces with no casting at all (`casting_count`).

The server rule has to become the coverage rule. Otherwise a piece cast on three of four lines drops
off the list. The per-piece "N luk" in `ProgramWidget` must then read the same result. Before
porting, check whether `_build_coverage_census` (`document_generator.py:1193`) already computes it.

**Endpoint.** A read action on the project, for example `GET …/projects/{id}/readiness/`, fetched
only by the overview. It is not a field on the project detail, because every project fetch would
pay for it.
- Freshness comes from a preset in `shared/api/queryPolicy.ts`.
- Invalidate it together with the project detail key after mutations to participations, the
  programme, the crew or the project itself.

**Rows.** Each row's target is decided on the client, from its code:
- "Bez odpowiedzi" opens the invitations sheet from fix 2. That sheet moves into
  `features/projects` so both surfaces can open it.
- Absences keep their sheet.
- Every other row keeps a tab segment.

The header badge counts categories, not problems (`:241`). Drop it: the rows are the count.

### 12. The dashboard's first screen on a phone (Q4 shortest path: S2 → S1)

- `ArtifactCard` builds `min-h-[400px]` into itself (`shared/ui/composites/ArtifactCard.tsx:74,85`),
  and its only caller is the Spotlight card. Move the minimum height to the caller, at `lg` only. On
  a phone it is empty height above the pipeline. This is the one fix that the density rule decides
  literally.
- Below `md`/`sm`, the pipeline hides "czeka" and "Bez partytury" and leaves them as hover
  tooltips (`ProductionPipeline.tsx:86,93,177,185`). Hover never happens on a phone, so that data
  is never shown there. Keep short visible labels.

## Wrong answers found on the way

Fix these first, whatever the ranking. They are cheap, and today they mislead from the dashboard.

- **Ensemble card.** `TelemetryWidget.tsx:54-59` adds mezzos to S, although its own comment says
  mezzos sing the alto line. `useAdminDashboardData.ts:149-151` counts B with `startsWith("B")`,
  which already matches BAR, and the widget then adds BAR again, so every baritone counts twice.
  The card keeps its roster scope (fix 7). The tally itself is what gets fixed.
- **Banner count.** The banner's `absent_count` and the absences sheet follow two different rules
  (see fix 1).
- **Pipeline order.** The pipeline has no "date ≥ today" filter (`useAdminDashboardData.ts:203-214`),
  unlike the Spotlight card (`:240-250`). A past concert that has not been closed is listed first.
- **"Current" rehearsal.** The two surfaces use different rules, so they can highlight different
  rehearsals. Whether that happens in practice is unverified.

  | | Counts as current until | Projects included |
  |---|---|---|
  | Banner (`useAdminDashboardData.ts:294`) | 2 h after start | Closed projects too |
  | Workspace (`attendanceStats.ts:196`) | 3 h after start | Active projects only |

## Implementation sessions

Every fix belongs to exactly one session. The sessions are grouped by the files each one changes,
not by rank, so that no component is read twice in two sessions. Run them in this order; session 4
depends on session 1. Each session starts from this file, and its survey is the file and line
references above. Verification runs once, at the end of each session.

### Session 1 — dashboard and notifications

**Covers:** "Wrong answers", fix 1, fix 2, fix 7 (dashboard card: label and tally), fix 9 and
fix 12.

**Files:**
- `features/dashboard/`: `NextRehearsalAlert`, `SpotlightProjectCard`, `TelemetryWidget`,
  `ProductionPipeline`, `useAdminDashboardData`.
- `ProjectInvitationsSheet`, which moves into `features/projects`.
- `shared/ui/composites/ArtifactCard.tsx`.
- `widgets/panel-shell/command/commandActions.ts`, for the "Najbliższa próba" action.
- `features/notifications/components/NotificationItem.tsx`.
- `backend/notifications/message_content.py`.

**Watch:**
- The helper at `message_content.py:275` is shared with other notification types, and
  `backend/roster/test_rehearsal_plan.py:622` asserts its bare path. Add `?rehearsal=` only for
  ABSENCE_REQUESTED and ATTENDANCE_SUBMITTED, never inside the helper.
- The "current rehearsal" mismatch in "Wrong answers" is unverified. Confirm it before aligning the
  two rules.

**Verify:**
- Frontend: `npm run typecheck`, then `npm run build`.
- Backend: ruff and mypy on `notifications`, then the `notifications` and `roster` tests with the
  sqlite settings.
- Every new string exists in the pl, en and fr locales.

### Session 2 — project list and hub

**Covers:** fix 3, fix 4, fix 5, fix 6 and fix 7 (cast tab balance strip and section headers).

**Files:**
- `features/projects/hooks/useProjectDashboard.ts`
- `features/projects/components/ProjectTabs.tsx`
- `ProgramWidget` and `useProgramFulfillment`
- `CastTab` and `features/projects/editors/hooks/useCastTab.ts`

**Watch:**
- Fix 4's filter and fix 7's strip count the same seats. Build both from one status predicate in
  `useCastTab`.
- Cast grouping stays as it is.

**Verify:**
- `npm run typecheck` and `npm run build`.
- The vitest suites under `features/projects/lib/`, if the predicate lands there.
- Every new string exists in all three locales.

### Session 3 — rehearsal workspace and command palette

**Covers:** fix 10 and fix 8.

**Files:**
- Fix 10: `features/rehearsals/Rehearsals.tsx` and `features/rehearsals/components/RehearsalRail.tsx`.
- Fix 8: `widgets/panel-shell/command/useCommandItems.ts`.

**Watch:**
- Fix 10 sits directly above the roll call, which is used during rehearsals. Change the rail only.
  The roll-call rows and the plan editor keep their size and their order.
- Fix 8 needs to know which live programmes contain a piece. Find out where the palette can get
  that data before choosing the approach. If the palette cannot get it without a new request,
  report that instead of adding one.

**Verify:** `npm run typecheck` and `npm run build`.

### Session 4 — readiness on the backend

**Covers:** fix 11.

**Order of work:**
1. Settle the rule for programme gaps. Check whether `_build_coverage_census` already computes
   partial coverage.
2. Write `roster/domain/readiness.py` with tests.
3. Switch the PDF to it. Its output must not change, apart from the programme-gap rule.
4. Add the endpoint.
5. Rewrite `ProjectAttentionPanel` against the endpoint.

**Depends on:** session 1. The invitations sheet has to be in `features/projects` by then.

**Watch:** the PDF keeps its existing gettext msgids, so the `.po` files do not change. If a msgid
does change, follow the project's `.po` + `.mo` workflow.

**Verify:**
- Backend: ruff and mypy on `roster`, then the `roster` tests with the sqlite settings.
- Frontend: `npm run typecheck` and `npm run build`.
- Every new string exists in all three locales.

## Not in this audit

- A panel-wide compact mode. Apart from the empty minimum height in fix 12, none of the cost above
  comes from row padding.
- The spacing of rehearsal-time screens.
- Entry points to the lead sheet. Its "Sprawdź obecność" link appears only on later schedule cards
  (`TimelineRehearsalCard.tsx:377-409`). Whether a manager gets `i_lead` is unverified. This is
  worth a look if the conductor ever leads a rehearsal from that sheet.
