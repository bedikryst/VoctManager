# README and media refresh

Status: **All four stages done 2026-09-25 and committed. Left: the developer's look at the pushed
README on GitHub, in both themes.**

The README last changed on 2026-09-11 and was substantively written in mid-August. Since then: the
finance module, two rounds of the rehearsal plan, the annotation offline/scope work, dark mode, three
rounds of feedback from Florent. This spec names what the README should change, what the seed must
learn so that the app can be photographed, and how the screenshots and GIFs get made.

## Findings

**The README read as model-written.** Aphorisms closing paragraphs, "X, not Y" framing, em dashes,
explanations of things the reader knows, and volume counts nobody can verify. Stage 4 rewrote both
files; the style rules are in that section and bind every later edit.

**The August promise was stale**: "He's committed to running the end-of-August date through it
himself. That'll be the first honest test." Closed from Q1.

**The seed is behind, not broken.** On a fresh SQLite database (`migrate` + `seed_db --seed 2026`)
it completes cleanly in 11 s. What it never touches:

| Area | Missing in `backend/roster/management/commands/seed_db.py` |
|---|---|
| Rehearsal plan | `RehearsalPlanItem` (no plan anywhere); `Rehearsal.called_sections`, `calls_instrumentalists`, `led_by`, `debrief*`, `plan_announced_at`, `duration_minutes` |
| Delegation | `RehearsalDelegate` |
| Cast by section | `Participation.is_section_leader`, `section_rank`, `default_voice_line` |
| Instrumentalists | no `Artist` with `VoiceType.INSTRUMENTALIST`; the organist is still a `Collaborator` with `Specialty.INSTRUMENT` (pre-2026-09 model) |
| Divisi solos | `ProjectSoloAssignment` |
| Finance | every budget stays in PLANNING; no contract issued (`finance/services/contracts.py` unused); no approved plan, no closed budget, no settled grant |
| Annotations | 6 rows, none on the `leader` layer |
| Audio | every `Track` takes the default `PRACTICE` kind; no tempo giusto take |
| Notebook | `core.Note` never created |

`copydesk.*`, `outreach.*` and `core.FeedbackReport` are also untouched; none of them is
photographed, so leave them out.

## Stage 1 — the seed catches up

One file: `seed_db.py`. Extend, do not restructure. Write through the service layer wherever one
exists, as the finance section already does — model writes skip the rules the screens rely on.

1. **One hero project** (upcoming concert, in the next ~10 days) that carries every new surface:
   - a rehearsal today or tomorrow with a plan of ~6 rows: minutes on most rows, one break, the
     reserve divider with one row under it, one row excluding lines (renders as "bez T, B · n osób"),
     `plan_announced_at` set, `led_by` a conductor;
   - a sectional rehearsal the same week (`called_sections="SA"`) and one with
     `calls_instrumentalists=True`;
   - two past rehearsals with rows marked done and a debrief, so the plan grid (pieces ×
     rehearsals) and the "rehearsed n times" figure have data;
   - a live delegation to an assistant conductor with some scopes granted.
2. **Cast by section**: section leaders in every section, `section_rank` on about half the cast,
   `default_voice_line` on singers who have a stable seat. Include the baritone-in-bass-section
   case (see `docs/specs/florent-feedback-2026-09.md`).
3. **Instrumentalists as artists**: move the organist to an `Artist` with `INSTRUMENTALIST`, add a
   pianist; cast them on the hero project and on one instrumental piece.
4. **One divisi piece with a named solo** (`ProjectSoloAssignment`).
5. **Finance across three states**: one completed project with the budget closed, fees paid,
   contracts issued with sequential numbers and the season grant settled; the hero project with an
   approved plan and partial payments; one draft project still in PLANNING. Check the audit's §7
   decisions (`docs/specs/project-finance-audit-2026-09.md`) before choosing states the rules may
   refuse.
6. **Annotations**: one edition on the hero project with marks on all four layers (shared,
   leader, conductor, personal) — ink, hairpin, breath, fermata, a note — so the scope card has
   something to show.
7. **Tracks**: one tempo giusto take next to the practice takes on one piece.
8. **Notebook**: three or four `core.Note` rows for the admin.

Keep it idempotent and deterministic under `--seed`. Update the counts in `_print_summary`, then
rewrite the `make seed` paragraph in `README.md` and `README.pl.md` from that summary.

Verify once at the end: ruff + mypy on `roster`; on a scratch SQLite database run the seed twice
(idempotency), then with `--clear`. The settings override used for the survey: a module that
imports `config.test_settings_sqlite` and points `DATABASES["default"]["NAME"]` at a file, placed
on `PYTHONPATH` outside the repo. Point `MEDIA_ROOT` there too, or the placeholder files land in
`backend/media/`.

### As built (2026-09-25)

Verified as above: ruff and mypy clean, the three runs print the same summary. Where the build
departs from the list:

- **The hero is the Mass** (`showcase=True` in `PROJECTS`, 6 days out). Its programme gained an
  organ prelude (Bach, BWV 645, empty voicing), the one instrumental piece, cast to the organist on
  `ACC`. The pianist plays in no piece: she is the rehearsal accompanist, called by the dress
  rehearsal's `calls_instrumentalists`. The plan evening is tomorrow at 18:30, led by the guest
  conductor, who holds the delegation.
- **Two grants, not one.** Settling a source freezes every allocation made to it, so a single
  season grant would lock the drafts' plans. The spring grant funds the two played concerts and is
  settled last; the autumn grant is awarded and funds everything else. Wratislavia is CLOSED;
  Miserere is APPROVED and fully paid (the "ready to close" state); the Mass is APPROVED with its
  expenses paid, the players' contracts issued and half its grant received. No fee is a mandate,
  so R4's employer contributions never block the close.
- **The named solos sit on Lux Aeterna** ("Sleep"), the project that holds the announcement
  queue: saving them queues the soloist's notice. The soprano position is matched by section, so a
  mezzo takes it when the cast drew no soprano.
- **Nothing notifies.** The debrief, the plan's send and the evening's leader are written as
  stamps, because their services send through Celery, which in dev would reach real providers. The
  grant goes through its service; it is silent only because the guest conductor has no account.
- Along the way: plenary rehearsals no longer list the whole cast as invited (an explicit list
  froze the call and ignored `calls_instrumentalists`), attendance is recorded only for those
  called, and the older annotations use palette inks, all written through `AnnotationSerializer`.

## Stage 2 — screenshots

**Where the data lives.** The dev database is disposable (Q2): reseed it in place with
`docker exec voctmanager-web-1 python manage.py seed_db --clear --seed 2026`. No dump needed.
The dev stack (`make up`, migrated 2026-09-25) serves the panel at `http://localhost/login`; no
Vite dev server on 5173 is needed.

**Tooling.** Playwright driving system Edge (`channel: "msedge"`, no browser download), as in the
existing `C:\Users\kryst\vm-shot\` harness. Put the capture script in the repo at
`tools/readme-media/` with its own `package.json` (`playwright-core` only) and gitignored raw
output: the README will be refreshed again, and a script outside the repo is lost context. Log in
as `admin / admin123`; reach the singer's view through the artist preview (`?artist=<id>`), not a
second login.

**Format.** Every shot in light and dark. Desktop 1440×900 at `deviceScaleFactor: 2`; phone
390×844 with `isMobile`, `hasTouch`, DPR 2; the music stand at tablet size. The README pairs them
with `<picture><source media="(prefers-color-scheme: dark)" srcset="…-dark.png"><img src="…-light.png"></picture>`,
which GitHub honours, so the page follows the reader's theme.

**Shot list** (README uses about six; the rest serve the portfolio):

1. Conductor dashboard — replaces `docs/assets/admin-dashboard.png`
2. Finance workspace overview (`/panel/finance`)
3. Project fees and ledger in the hub
4. Funding: grant with line allocations
5. Rehearsal page, singer, phone — the plan with "Twoja część 19:00–21:00"
6. Rehearsal plan editor, conductor — minutes, block header, reserve
7. Plan grid, pieces × rehearsals
8. Music stand with marks on several layers and the scope card open
9. Cast read by section, with leaders
10. Score review cockpit — retake of `docs/assets/score-compiler-review.png`

Replace the 24 existing files in `docs/assets/` under the same names where the subject still
exists; delete the ones nothing references.

### As built (2026-09-25)

`tools/readme-media/`: `shots.mjs` (stills), `gifs.mjs` (takes), `lib.mjs` (login, themed
contexts, cursor, ffmpeg), `prepare.py` (run in the web container before every capture; it prints
the ids the scripts navigate to). Reseed first; the header of each script says how. Departures:

- **The seed needed two more fixes.** "Twoja część" is computed from time blocks
  (`plan_window_for_seat`), and tomorrow's plan had one block, so every window was the whole evening
  and none was shown; the editor had no block header either. The plan now opens with the women at
  18:30 and the whole choir at 19:00. The expenses had no due dates, so the finance overview showed
  zeros; they now fall due before the concert. The login paragraph (seed summary, both READMEs) now
  gives e-mails: the form rejects `admin`.
- **Shot 5 logs in as the tenor.** `my_plan_window` is answered for the signed-in reader only and
  the artist preview has no rehearsal page, so `?artist=` cannot show it.
- **The stand shows a real engraving.** The seed's scores are blank placeholder pages. `prepare.py`
  swaps the showcase edition for Mozart's *Ave verum* from the Mutopia Project (CC BY 4.0) and lays
  the seeded marks over its staves; the ingest take uploads Priuli's *Ave dulcissima Maria*
  (Mutopia, CC BY-SA 3.0). Both are credited under the GIF in the READMEs.
- **Names are `<subject>-light.png` / `-dark.png`.** Nothing outside the repo links to
  `docs/assets/`, so the old names were not kept. All 21 old screenshots and `.old/` are deleted;
  `logo_Voct.png` and both monograms stay (brand masters, not screenshots). The upload still is
  dropped: the ingest GIF shows the same thing moving.
- **The stand is shot upright** (820×1180), the way a tablet stands on a music desk; the plan
  editor is cut out whole from a tall window, so the reserve at its foot is in the frame.
- **Two shots beyond the list.** `materials-singer`: the tenor's practice console on a phone, his
  line soloed, the playhead at 1:15 (`prepare.py` swaps the showcase piece's one-second placeholder
  takes for 3:05 of silence, or the player reads "0:01"). `locations-map`: portfolio only. The Maps
  key admits only the Vite dev origin, so it needs `npm run dev` and
  `README_MEDIA_BASE=http://localhost:5173`; on the docker panel the map stays blank
  (`RefererNotAllowedMapError`), and the docker image has no Maps key at all (it lives only in
  `frontend/.env`).
- **English stills for `README.md`.** `node shots.mjs --lang en <names>` writes
  `<name>-en-<theme>.png` for the shots that carry English waits: the header pair, the tenor's
  rehearsal and practice pages, the grant. The profile's language beats the browser's after login,
  so `prepare.py` switches the two accounts and the run switches them back. The seed's data stays
  Polish, and a caption says so; the GIFs are Polish only.
- Sessions are cached in `out/sessions/`: a login spends about five of DRF's 10 anonymous requests a
  minute, and back-to-back runs were refused with 429.
- The stills weigh about 20 MB after lossless optimisation; each light dashboard is 1.9 MB (the
  noise texture defeats PNG). Quantising to 256 colours halves it but turns the gold accents grey,
  so it was not done.

Found on the way and fixed: the exclusion chips read "bez tenory" (a nominative after "bez"); they
now have their own genitive phrases in all three locales. The READMEs promised `AI · 95%` chips; the
review screen shows a trust dot and deliberately no percentage (`ProvenanceChip.tsx`), and the text
now says so.

Found and not fixed:
- In the plan editor the note field's placeholder ("Notatka: od t. 40, pierwsze czytanie…") is
  styled like a written note, so in a still every row without a note looks annotated.
- In English the rehearsal page mixes clocks: the header reads "06:30 PM–09:00 PM", the window
  under it "Your part 19:00–21:00". The window arrives from the server as ready "HH:MM" strings
  (`window_payload`) and never passes through the locale's time format.
- The README's feature list had no line on the practice tracks; one was added with the shot.

## Stage 3 — GIFs

Three takes, 6–10 s each, ≤ 4 MB each (every byte stays in the git history for good):

1. Rehearsal plan: drag a row, set minutes, switch to the singer's view.
2. Annotations: draw a hairpin, open the mark, move it up the scope ladder.
3. Score ingestion: upload → live progress → review cockpit. This one runs the real pipeline
   (needs the Anthropic key in dev, ~$0.04–0.20 a run, non-deterministic): record once and keep.

Record with Playwright, inject a visible cursor (headless shows none), convert with ffmpeg
(installed, 8.1.1) through `palettegen`/`paletteuse`, ~960 px wide, 12–15 fps. A relative `.mp4` in
the repo does not play inline on GitHub; only files uploaded through the GitHub web editor
(`user-attachments`) do, so the README uses GIFs.

### As built (2026-09-25)

`rehearsal-plan.gif` (7 s, 1.9 MB), `annotations.gif` (8.5 s, 2.4 MB, upright tablet, 720 px),
`score-ingestion.gif` (10 s, 3.7 MB). The plan take never writes: leaving the editor drops the
unsaved edit. Leftover marks from the annotation take are removed by the next `prepare.py`.

**The ingest ran twice, $0.14 in all.** Under the dev stack's `runserver` (WSGI) the SSE response is
buffered whole ("StreamingHttpResponse must consume asynchronous iterators"), so the first take
showed "W kolejce…" for 41 s and then the end state. Production runs gunicorn with uvicorn workers.
The second take ran with the dev `web` container switched to `uvicorn config.asgi:application`
through a throwaway compose override, then switched back. To rehearse the take for free, upload a
PDF that is already in the archive (`INGEST_PDF=…`): the SHA-256 match skips the model.

The panel in the dev `frontend` container was patched in place with a local build
(`VITE_API_URL= npm run build`, copied into `/usr/share/nginx/html/app`) to show the chip fix; the
next `make up` rebuilds the image anyway.

## Stage 4 — README text (`README.md` and `README.pl.md` together)

**Done 2026-09-25**, in two passes. First the content: the August promise closed from Q1, Rehearsal
plans and Finance sections, the offline-annotations mistake, nested annotation layers. Then a full
rewrite of both files for style (rules below): shorter, a feature list up front, Status moved
next to the top, commit and test counts removed on purpose. The Polish file was rewritten natively,
not translated.

**Image markup, done 2026-09-25:** the header pair (dashboard, review) as `<picture>` pairs; the
annotation GIF beside the practice console under the feature list; the ingest GIF in place of the
upload shot, with the score credits; the plan GIF beside the tenor's phone under Rehearsal plans;
the grant page under Finance. Five stills and three GIFs, English stills in `README.md`; the
other shots stay in `docs/assets/` for the portfolio.

The `make seed` paragraph was rewritten in the Stage 1 session from the seed's new summary.

### Style rules for anything added to either README

Readers in 2026 recognise model-written prose within a sentence, and it puts them off before the
content lands. Every later edit (the seed paragraph, captions, alt text) follows these:

- No closing aphorism at the end of a paragraph. Stop when the information stops.
- No "X, not Y" / "rather than" framing unless the contrast is itself the information.
- No em dashes in prose; use a full stop, a comma or parentheses.
- No sentence fragments for effect ("Never the email."), no italics for emphasis, no rhetorical
  questions, no "quietly"/"silently"/"honest".
- Don't explain what the reader already knows (what a liveness probe is, why each deploy step
  exists).
- No counts that measure volume (commits, tests, source files): with AI-assisted code they impress
  nobody and the developer can't vouch for them. Numbers that describe the product stay (ingest
  cost, polling interval).
- Polish is written as Polish, not translated: no calques, plain developer register, English terms
  where Polish developers use them (pipeline, endpoint, deploy).

## Out of scope

**The promotional film.** Stages 2–3 produce clean, repeatable screen takes, which are raw material.
The shot that sells this app — a tablet on a real music stand, a pen marking a score, a pedal turning
the page — needs a camera, a rehearsal and the singers' consent to appear. Editing, music and
pacing belong in an editor (DaVinci Resolve, CapCut), not in ffmpeg.

## Answers (2026-09-25)

- **Q1.** The end-of-August concert went through the app successfully; the singers used it during
  the concert. The next programme is in rehearsal and both the conductor and the choir use it.
- **Q2.** Dev data is disposable.
- **Q3.** Finance is on production and working.
