# Call sheet remediation — audit and repair spec

Status: READY TO IMPLEMENT · Written 2026-08-09 · Backend-heavy (`backend/roster/infrastructure/`,
`backend/templates/projects/`), small frontend surface (labels + one new export entry point).

Audited artifact: the 5-page `Audience.PRODUCTION` PDF from the "Test" project, generated
2026-08-09 17:10. Every defect below was reproduced against the source, not inferred from the
render alone; where a claim needs a DB check before acting on it, it says so.

The other two audiences — what a user *without* manager rights receives from `export_day_sheet` —
were reproduced by rendering all three sheets from a fixture mirroring the audited project
(call time 20 days before the downbeat, conductor holding a `Participation`, five Spotify
recordings on one piece, six past rehearsals). Findings in §2.5. **The non-admin sheets are not
simplified documents: they are the same document with sections removed, so they inherit every
defect in §2 and add three of their own.**

### Locked with the owner (do not re-litigate)

1. **`cast_confirmed` / `cast_pending` count singers only.** The conductor is never part of the
   cast census (D20), on any sheet.

Source of truth for the current implementation:
`backend/roster/infrastructure/document_generator.py` (context) ·
`backend/templates/projects/call_sheet_pdf.html` (layout) ·
`backend/roster/views.py:793-948` (querysets, audience resolution, endpoints).

---

## 0. Verdict

**The document is not a call sheet. It is a project dossier printed on A4.**

A call sheet is a day-of instrument: read standing up, 40 minutes before the downbeat, in a
sacristy, on paper or on a phone, under mild stress. It has to answer five questions in five
seconds — *when do I arrive, where exactly, what happens in what order, what do I sing, whom do I
call*. What this PDF actually contains is the whole project database: six rehearsals that already
happened, material-coverage counters, the invitation queue, per-piece casting matrices, coverage
metrics, and a roster — across five pages, of which maybe one and a half are usable on the day.

That is not a formatting problem. Two documents with irreconcilable readers have been fused into
one:

| | Day card | Production report |
|---|---|---|
| Reader | singer, conductor, stage manager | project manager |
| Moment | the day, minutes before | weeks before, at a desk |
| Job | *execute* | *find what is not ready* |
| Success | nothing needed that isn't on it | every hole is visible |
| "2/3 tracki" | meaningless — nothing can be done | the entire point |
| Past rehearsals | noise | the record |

Everything else in this audit is downstream of that fusion. The current sheet fails both readers:
the singer wades through coverage counters to find the arrival time, and the manager gets no
blocker list — the one thing a status report exists to produce.

**Recommendation: split into two documents** (§4, Etap 2). The `Audience` enum already encodes half
the idea; the missing axis is *document kind*. The cheaper alternative — keep one document, fix
only the defects in §2–§3 — is genuinely viable and is what Etapy 0–1 deliver on their own; it
leaves the sheet honest but still asks the singer to read a status report. State the choice before
starting Etap 2, not during it.

### The second structural fault: the document has no notion of "today"

It renders identically whether generated three months out or forty minutes before the downbeat.
That is why six rehearsals from 22.06–25.07 print on a 09.08 concert sheet, and why nothing warns
that the call time sits three weeks before the concert. `generation_label` is the only time-aware
line on the page, and it only stamps *when it was printed*, never *what that means*.

### The third: the printed day contradicts the panel's day

`frontend/src/features/projects/lib/dayTimeline.ts:199` (`buildDayTimeline`) merges the call time
and the downbeat into the run-sheet points as anchors — the correct model of a concert day, already
written, already tested by use. The PDF ignores it and prints the raw `run_sheet` JSON. Result, on
page 2 of the audited render: a "Przebieg dnia" reading `12:00 Start / 12:30 Rozpoczęcie` directly
under a header that says the call is 19:02 and the downbeat 20:02. Two implementations of the same
concept, one of them wrong, in one document.

---

## 1. Architectural findings

**A1 · Wrong axis.** `_SECTIONS` (`document_generator.py:81-105`) is keyed by audience only. Kind
and audience are independent: a stage manager needs the *day card* shaped for production, and a
conductor may want the *report* before a rehearsal block. Key it `[kind][audience]`.

**A2 · Two sources of truth for the concert day.** See above. `buildDayTimeline` must move to the
backend and become the SSOT that both the API read-model and the PDF consume. As long as it lives
only in TypeScript, the printed timeline will keep drifting from the edited one.

**A3 · Print-shaped, screen-designed.** `.btn` (`call_sheet_pdf.html:128-133`) renders rounded
pill buttons, one of them a solid black CTA ("PEŁNY SCORE"). On paper these are decorations whose
target URL is invisible — unreachable even by typing. On a phone they are 8pt tap targets inside a
PDF. The bridge that works in both media is a QR code plus the resource named in words; buttons are
the one thing that works in neither.

**A4 · No i18n.** Every string in the template is hardcoded Polish, `_()` is never used, and
`doc_lang` (`document_generator.py:113`) only fills `<html lang>`. The rest of the backend is
gettext-clean and the panel carries three locales. The ensemble's own conductor is francophone.

**A5 · Wrong typographic identity.** The call sheet is handed
`font_face_css()` + `BOOK_FONT_STACK` — Gentium Plus, the *score book's* face
(`document_generator.py:422-423`). `_brand_font_context()` with IBM Plex Sans + Cormorant Garamond
already exists two functions above (`:118`) and is used only by contracts. So a document made
almost entirely of labels, times, tables and counters is set in one serif at one width, and does
not look like the institution that issued it.

**A6 · No print canon.** `.ai/04_design_system.md` governs the panel and says nothing about printed
artifacts; the score book, the contracts and the call sheet each invented their own scale, palette
and rules. Three PDF templates, three design systems.

**A7 · No structured day-of logistics.** There is nowhere to record the entrance/gate, parking,
dressing room, warm-up slot, sound-check window, or an on-site emergency number. `Project.description`
and `Location.internal_notes` are the only vessels, and neither reaches the sheet as a fact. This
is the largest *missing* content, and it is exactly the content a call sheet exists for.

---

## 2. Defect ledger — correctness

Ordered by damage. `†` = visible in the audited render.

**D1 † · A call time on another day prints as a bare hour. Dangerous.**
`document_generator.py:356` and the masthead cell `call_sheet_pdf.html:235` both run
`_format_time` → `%H:%M`. In the audited project the call is ~20 days before the concert, and the
sheet prints `ZBIÓRKA 19:02` next to `DATA 09.08.2026`. Every reader will parse that as 19:02 on
concert day.
*Fix:* when `call_time.date() != date_time.date()`, the cell prints the date with the hour and the
band takes a warning rule. Never print a naked hour that belongs to a different day.

**D2 † · `_format_call_buffer` has no ceiling.** `document_generator.py:936-945` computed
`481 h 00 min` and the template stated it as fact: *"481 h 00 min między zbiórką a startem"*. The
function guards `<= 0` and nothing else. The panel already has the concept —
`DetailsTab.tsx:157` prints *"Zbiórka nie wypada przed koncertem"* — but only refuses the negative
case there too.
*Fix:* a buffer is meaningful within one day. Outside `0 < buffer <= 12 h`, the sheet reports a data
error in the producer-facing document and, on the day card, suppresses the derived line entirely
rather than stating an absurdity.

**D3 † · Section numbering starts at 2.** The `metrics` section
(`call_sheet_pdf.html:510-519`) renders no `.section-head` but still consumes `forloop.counter`, so
the production sheet is numbered 2,3,4,5,6,7,8 and has no section 1. The chorister sheet has the
same bug whenever `personal` is falsy.
*Fix:* the metrics band is a hero strip, not a section — move it out of the `{% for %}` loop. Number
from a counter over *titled* sections only.

**D4 † · The run sheet ignores the day's anchors.** `document_generator.py:452` +
`call_sheet_pdf.html:341-363`. See A2. The printed timeline can contradict the header it sits under,
and did.

**D5 · Run-sheet times sort as strings.** `document_generator.py:879` sorts on the raw string, so
`"9:00"` lands after `"12:00"`. The panel's `TimeField` emits zero-padded `HH:mm`, so today this
survives by accident — but `run_sheet` is an unvalidated `JSONField` (`models.py:180`) and legacy
rows exist.
*Fix:* parse to minutes; unparseable entries sort last, in input order.

**D6 · `_normalize_run_sheet` does not read `label`.** `document_generator.py:865-871` accepts
`title|task|activity|name`. Rows keyed `label` — the shape used across
`roster/tests.py:72,1893,2860` — fall through to the literal fallback **`'Timeline entry'`**: an
English placeholder in a Polish document.
*Fix:* add `label` to the chain; make the fallback translatable.

**D7 † · Duplicate identical reference buttons.** `document_generator.py:665-669` labels every link
with `get_source_display()`, so a piece with five Spotify recordings prints **five buttons all
reading "SPOTIFY"** (page 4, both "Os justi" and "Magi veniunt"). `Recording` carries `performer`
and `year` (`archive/models.py:489-490`) — the disambiguating data exists and is discarded.
*Fix:* label from `performer` (+ `year`), source demoted to a qualifier; cap at 2 links per piece
(featured first) and drop the rest — a printed sheet is not a discography.

**D8 † · `BIS` printed twice per piece.** The pill beside the title (`call_sheet_pdf.html:402`) and
`material_badges`, which also contains `'BIS'` (`document_generator.py:673`), render adjacent.

**D9 † · The badge row restates the button row.** `NUTY PDF · TRACKI · NAGRANIE REFERENCYJNE ·
CASTING` sits directly above buttons reading `NUTY PDF · SPOTIFY · SPOTIFY…`. Two encodings of one
fact, 5pt apart. `TRACKI` is worse than redundant: it is a coverage flag shaped like an affordance,
and there is no way to reach a track from paper.

**D10 † · Voice requirements print in codepoint order, not SATB.** `views.py:816` orders
`PieceVoiceRequirement` by raw `voice_line`; `VoiceLine` values are `S1/A1/T1/B1`
(`core/constants.py:11-22`), so alphabetical gives **`2x Alt 1, 2x Bas 1, 2x Sopran 1, 2x Tenor 1`**.
`_VOICE_LINE_ORDER` (`document_generator.py:53`) already exists and is applied correctly to casting
rows — it is simply not applied here. `Track.voice_part` (`views.py:811`) has the same defect.

**D11 † · Orphan leading separator in the piece metaline.** `call_sheet_pdf.html:405` chains
`{% if %}` fragments each carrying its own ` · ` prefix, so a piece with no duration opens with
`· la-pl`. All three pieces in the render.
*Fix:* build the metaline as a list server-side and `join`.

**D12 † · Raw codes as prose.** `piece.language` prints `la-pl` / `la`; `voicing` prints `SATB`
unlabelled; `event_facts` prints the IANA string `Europe/Warsaw` (`document_generator.py:358`).
*Fix:* human labels; the timezone fact appears only when it differs from the ensemble default, and
then as `czas warszawski (UTC+2)`.

**D13 † · `Pokrycie crew 0` annotated "Wsparcie potwierdzone."** `call_sheet_pdf.html:516` branches
on `crew_tentative` alone, so zero crew and zero tentative reads as *confirmed*. A project with no
technical team is reported as fully staffed.
*Fix:* three states — none / partial / all confirmed.

**D14 † · Two-column splits break catastrophically across pages.** `.split` is
`display: table` with two `table-cell`s (`call_sheet_pdf.html:104-107`). When the right column
overflows, WeasyPrint splits the row: the exhausted left cell leaves a hole. In the render, the
bottom third of page 1 is blank and the top-left half of page 2 is blank, with one card floating
alone — roughly **one page in five wasted to a layout mechanism**.
*Fix:* stop using table-cells for page-level columns. Single flow with `break-inside: avoid` per
card, and reserve two-column only for content that provably fits one page.

**D15 † · The roster's two columns are split by index parity, not height.**
`call_sheet_pdf.html:465-472` uses `divisibleby:2` on the section index, so sections 0,2,4 go left
and 1,3,5 right regardless of size — a 12-voice Sopran section can sit beside a 1-voice Alto.
*Fix:* balance server-side by member count.

**D16 † · Two columns of em-dashes.** In the casting tables (`call_sheet_pdf.html:435-443`),
`PODAJE DŹWIĘK` and `UWAGI` are `—` in 11 of 12 rows across pages 4–5.
*Fix:* drop a column whose entire table is empty; when pitch data exists, mark it as a symbol on the
singer's name rather than reserving 120pt of width for it.

**D17 † · A badge that is always true.** Six rehearsal rows, six identical gold `OBOWIĄZKOWA` pills
(`call_sheet_pdf.html:377`) — the loudest ink on page 3 carrying zero information.
*Fix:* mark only the exception (`opcjonalna`); state the default once, above the table.

**D18 † · Past rehearsals on a concert-day sheet.** No time filter anywhere
(`document_generator.py:394-402`). Six rehearsals from June and July fill page 3 of a 9 August
sheet.
*Fix:* the day card lists only what is still ahead (and, at most, `6 prób odbytych` as one line);
the full plan belongs to the report.

**D19 † · The same person printed twice in one section.** Page 5:
`Mezzosopran (2) · Pia Antonia Franciska Vućemilović · Pia Antonia Franciska Vućemilović`, inflating
`cast_confirmed` to 6. `unique_active_project_participation` (`models.py:460`) rules out two
participations for one artist, so this is **two `Artist` rows for one human** — possible because
artist uniqueness is on `email` alone (`models.py:105`) and only bites when both rows carry one.
*Verify first* with a query before acting.
*Fix, two parts:* (a) roster-level duplicate detection/merge — its own task, filed in §4 Etap 6;
(b) the document must not silently print one name twice — dedupe within a section and mark the
collision in the report.

**D20 † · The conductor is counted as an unconfirmed singer.** Page 5:
`OCZEKUJĄCE POTWIERDZENIA (3) … Dyrygent: Florentyn de Bazelaire`. `_group_participations_by_voice`
(`document_generator.py:812`) groups by `artist.voice_type` and `_VOICE_TYPE_ORDER` includes
`CONDUCTOR` (`:64`), so a maestro holding a `Participation` lands in the choir census and inflates
`cast_pending`. He then appears a third and fourth time — in the arrival callout and in
`Prowadzenie`/`Kontakty`. This contradicts the settled rule that the podium is
`Project.conductor → Artist`, not a `Participation`.
*Fix:* exclude `VoiceType.CONDUCTOR` from the ensemble census and from both cast metrics; render the
podium as its own line, once.

**D21 † · Address printed with a duplicated postal code, and a country in English.**
Page 3: `02-532, Rakowiecka 61, 02-532 Warszawa, Poland`. `Location.formatted_address` is free text
(`logistics/models.py:49`) fed from Places with no normalization.
*Fix belongs to logistics* (§4 Etap 6); the sheet's cheap guard is to drop a trailing country that
equals the ensemble's own and to collapse a repeated postal code.

**D22 · `piece.editions.all()` / `recordings.all()` fallback re-queries.**
`document_generator.py:645-646` uses `getattr(..., None) or piece.editions.all()`; `to_attr` always
sets the attribute, so an **empty** prefetch list is falsy and falls through to a fresh query per
piece. Correctness is unaffected — reverse managers derive from `ActiveManager`
(`core/models.py:74`), so soft-deleted rows stay out — but it is an avoidable N+1 on exactly the
pieces that have nothing to show.
*Fix:* `getattr(piece, 'prefetched_editions', None)` with an explicit `is None` test.

**D23 · English fallbacks in a Polish document.** `'Unassigned'`
(`document_generator.py:754`), `'Timeline entry'` (`:871`), `'Pozycja programu'` is fine.
Fold into the i18n pass (Etap 5) but do not ship them meanwhile.

**D24 · Polish plural handled as an abbreviation.** `call_sheet_pdf.html:265`:
`{% if personal.section_size == 1 %}osoba{% else %}os.{% endif %}` — the singular is a word, the
plural is a full stop. Chorister sheet only; not in this render.

---

## 2.5 What a non-admin actually receives

Reproduced, not inferred. `_SECTIONS` (`document_generator.py:81-105`) resolves to:

| audience | sections rendered |
|---|---|
| chorister | Twoja rola · Wydarzenie i przygotowanie · Przebieg dnia · Twoje próby · Program |
| conductor | Program · Obsada · Zespół · Przebieg dnia · Plan prób · Wydarzenie · Kontakty |
| production | *(metrics)* · Wydarzenie · Przebieg · Plan prób · Program · Obsada · Kontakty · Zespół |

**N1 · The singer's sheet contains no contact information at all.** `_SECTIONS[CHORISTER]` has no
`"contacts"` entry, so the section never renders — while `_build_contact_directory`
(`document_generator.py:593-605`) carefully constructs a privacy-safe chorister entry (the
conductor's name, deliberately no phone, *"Za pytania i spóźnienia pisz w aplikacji."*) for exactly
that audience. **That branch renders nowhere.** The person most likely to be late, lost, or on the
wrong tram is handed a call sheet with nobody to call. This is the single worst finding in the
audit — worse than D1, because D1 misinforms while this simply abandons the reader.
*Fix:* the day card always ends with one contact line. Under RODO the maestro's private mobile is
not the answer for a 40-voice choir — surface the name plus the in-app channel now, and file an
ensemble-level ops number under Etap 6 (A7).

**N2 · The maestro's own sheet lists him as an unconfirmed choir member.** The conductor audience
includes `ensemble`, and with a `Participation` on the project the pending block renders
`OCZEKUJĄCE POTWIERDZENIA (1) · Dyrygent: Florentyn de Bazelaire` on the card he opens. Same root as
D20; the fix removes it from all three sheets at once.

**N3 · The chorister's preparation card can be pure negative space.** With no project score and no
playlist, `Zabierz na dziś` renders two rows both reading **`Brak`**, neither linked — a card whose
entire content is the absence of two resources, on the sheet of the one person who cannot do
anything about either. `preparation_assets` (`document_generator.py:539-556`) builds the rows
unconditionally.
*Fix:* the day card lists resources that exist. Nothing to list ⇒ no card. Missing materials are a
line in the production report's blocker list, which is where someone can act on them.

**N4 · Every §2 defect reaches the non-admin sheets, several amplified.**
Confirmed present on both: the `480 h 00 min` arrival window (D2), the naked call hour that belongs
to another day (D1), five identical `SPOTIFY` buttons (D7), `2x Alt 1, 2x Bas 1, 2x Sopran 1, 2x
Tenor 1` (D10), the `· la-pl` opener (D11), the split-table page hole (D14). Two are worse here than
on the production sheet:
- the six *past* rehearsals (D18) are titled **"Twoje próby"** on the singer's card — the sheet
  states, on concert day, that six rehearsals are yours, all of them already over;
- the singer is the reader least equipped to recognise `480 h` as a data-entry error, and the most
  likely to act on `ZBIÓRKA 19:02`.

**N5 · Chorister numbering survives only by luck.** It reads 1–5 because `export_day_sheet` always
resolves a recipient. `_build_call_sheet_context:292-298` still permits `personal=None` for
`CHORISTER`, and that path reproduces D3 exactly (numbering starts at 2).

**N6 · The singer never sees who else is singing.** No `ensemble` section for the chorister
audience. Defensible in isolation; combined with N1 it means the singer's document answers *what do
I sing* and almost nothing about *who is around me and how do I reach anyone*.

**Correctly handled, do not "fix":** crew PII (phone, e-mail) never reaches a chorister sheet — the
privacy branch works and `roster/tests.py:4329-4336,4375-4381` locks it. Keep those assertions green
through every stage below.

---

## 3. Design and UI/UX findings

**U1 † · Page 1 says everything twice.** The masthead factbar (`:228-245`) prints Data / Zbiórka /
Start / Miejsce; the event card twenty lines below (`:303-307`, built at
`document_generator.py:354-364`) prints Data wydarzenia / Zbiórka (call) / Start koncertu / Strefa
czasowa / Typ lokalizacji / Miejsce / Adres. Four of seven rows are a restatement, on the same page,
in a weaker typographic voice. The event card should carry only what the masthead cannot: address,
venue type, podium.

**U2 † · The metrics band is a matrix pretending to be tiles.** `POTWIERDZONA OBSADA 6 · PROGRAM 3 ·
PRÓBY 6 · POKRYCIE CREW 0` are four unrelated denominators sitting in one row of equal-weight boxes;
two pages later the same figures reappear as `Gotowość materiałów 3/3, 2/3, 2/3, 3/3`. The design
system's own rule applies: *sibling figures in one line share one denominator, or they are not
siblings*. Coverage is a **pieces × materials grid** — one glance, one denominator, holes visible as
holes. And a status report should open with what is *missing*, not with what is counted.

**U3 † · Everything is a card, so nothing is important.** Nine surfaces on the production sheet share
one border, one radius, one background pair. There is no visual distinction between *act on this
now* and *for reference*. The audited page 1 gives the same weight to the arrival window as to the
timezone identifier.

**U4 † · The only heavy ink is spent on the least useful things.** The solid black `PEŁNY SCORE`
button and six gold `OBOWIĄZKOWA` pills are the darkest marks in the document. The arrival time —
the single fact people actually look for — is 12.5pt semibold in a row of four equals.

**U5 † · Old-style figures on a document made of numbers.** `body` sets
`font-feature-settings: "liga" 1, "onum" 1` (`:35`), so every time, date, page number and metric
prints in text figures that dip below the baseline. Correct for the score book's verse; wrong for a
timetable read under stress.
*Fix:* lining figures for the document. Keep proportional widths — alignment in the time columns
comes from a fixed-width gutter column, not from `tabular-nums`.

**U6 † · One face at one width for everything.** See A5. Labels, tables, times and titles all in
Gentium Plus, so the eyebrow rows (7pt, uppercase, 2.2pt tracking, serif) read as texture rather
than as structure.

**U7 · Section order buries the roster.** `_SECTIONS[PRODUCTION]` (`:95-104`) ends
`… contacts, ensemble`. On the day, who is standing on the risers is consulted more often than the
contact directory.

**U8 † · Empty states are written for the wrong reader.** *"Program nie został jeszcze
zatwierdzony."* / *"Czas do uzupełnienia."* are producer copy, and they print on the singer's sheet
too. A day card should never ask its reader to fix data.

---

## 4. Repair spec

Six stages. Etapy 0–1 are self-contained and worth shipping even if the split is rejected.

**Status: Etapy 0, 1, 2, 3, 4 and 5 are DONE.** Etap 6 is open.

**Etap 1's pagination claim was wrong, and was corrected in Etap 2 (2026-08-14).** The
"five pages become three" outcome was reasoned from the CSS because WeasyPrint cannot render on the
Windows dev host (`libgobject-2.0-0`) and Docker was down. Measured in the container against the dev
database, the production sheet after Etapy 0–1 was **11 pages for an 8-piece project, of which
roughly four pages' worth was blank** — one of them a section heading above 996pt of nothing.

The cause was never `.split`, which Etap 1 rewrote; it was `.card { page-break-inside: avoid }`,
pre-existing and untouched. A `.card` is a *section's whole body* (every program item, the whole
roster, the entire contact directory), so it routinely outgrows a page, and WeasyPrint answers an
unfittable `avoid` by pushing the box to a fresh page before breaking it anyway — stranding the
heading behind it. Measured cost of that one declaration: **3 of 11 pages.**

Two further measurements worth keeping (they contradict what the CSS suggests):
- **`columns: 2` for the roster works.** Etap 1's one genuine layout win — it balances on height and
  flows across pages, confirmed visually.
- **`break-after: avoid` on `.section-head` is a no-op in WeasyPrint.** Rendered page-for-page
  identical with and without it; do not reach for it to keep a heading with its content.
- **Single-column throughout costs pages, it does not save them.** The `.split` event pair packs two
  short cards into the height of one (11→9 pages when stacked instead of 8 when kept side by side),
  so §4's "single column throughout" for the day card is rejected on measurement.
- **The same `avoid` on the small box costs a page too (measured in Etap 3, and it reverses one of
  Etap 1's decisions).** Etap 1 kept `.split` for the event pair and added
  `page-break-inside: avoid` so it would move whole rather than tear. Measured on "Lux Aeterna":
  that one rule is worth **a full page on two of the four documents** — report 9→8, singer's day
  card 5→4 — because a pair too tall for the rest of the page jumps to the next one entire.
  Rebuilding the pair as `columns: 2` under the same guard measures identically, so the guard is the
  cost, not the mechanism. The rule is gone: the pair tears, and the worst case is half a page
  instead of all of it. **The general form, now measured on boxes of two different sizes: in
  WeasyPrint `page-break-inside: avoid` on anything bigger than a card is a page-eater, not a
  safeguard.**

### Etap 0 — Correctness (no redesign) — DONE

Fix, in the current template and generator: **D1, D2, D3, D5, D6, D7, D8, D10, D11, D12, D13, D20,
D22, D23** plus **N1, N2, N3, N5**. Nothing here moves a box; the document stops making false
statements and the singer stops being handed a sheet with nobody to call.

Two of these need a decision, not just a patch:
- **D1/D2** define a shared helper, `resolve_call_window(project) -> CallWindow`, returning the
  localized call datetime, the downbeat, the buffer, and a `problem` discriminator
  (`none | not_before | different_day | implausible`). The masthead, the event facts and the report's
  blocker list all read it. This is the seed of the Etap 3 SSOT — write it in
  `roster/domain/`, not in the infrastructure adapter.
- **D20/N2** is settled (see "Locked with the owner"): the conductor leaves the cast census and the
  roster on all three sheets, and appears once, as the podium.

**As built.** `roster/domain/call_window.py` is the new seam: `resolve_call_window` returns both
ends localized, the buffer, a `crosses_day` display flag and a `problem` discriminator, with the
plausibility ceiling (`MAX_PLAUSIBLE_BUFFER_MINUTES = 12 h`) named once. `localize` moved there from
the generator. Etap 3 grows this module into the day timeline rather than adding a second one.

Two decisions taken while building, worth knowing before changing them:
- **`crosses_day` is a display requirement, not a fault.** An evening call for a morning concert is
  ordinary on tour; what it forbids is printing the call as a bare hour.
- **D19 collapses rather than deduplicates.** Two roster rows with one name print once as
  `Nazwisko (2 wpisy)`; the count still counts participations, because two people may genuinely
  share a name and the document must not delete one of them. The merge itself is Etap 6.

**Gotcha found by rendering, not by reading:** Django's `{# … #}` comment **cannot span lines** —
a multi-line one is emitted as literal text into the PDF. Use `{% comment %}` in this template.

### Etap 1 — Layout survival — DONE

**D14, D15, D16, D17, D18, D24, U1, U7, N4, N6.** Retire `.split` as a page-level mechanism; keep it
only inside a card that provably fits. Balance the roster columns server-side. Drop all-empty table
columns. Filter rehearsals by time — and give the chorister's section a heading that matches what it
lists. Cut the masthead/event-card duplication. Give the chorister audience the `ensemble` section
(names only, no statuses) so the singer's sheet answers "who is around me".

Expected outcome on the audited data: five pages become three, with no content removed.

**As built.** `.split` survives only for the event pair, now with `page-break-inside: avoid` so it
moves whole instead of tearing; the roster switched to CSS `columns: 2`, which balances on height
and flows across pages — better than the server-side count-balancing this spec originally proposed,
and it deleted the `divisibleby:2` template logic entirely. Casting columns and the rehearsal type
column are emitted only when the table has something to put in them: on the audited data the sheet
now renders **zero** filler em-dash cells, and the rehearsal table lost a whole column to the
caption "Wszystkie próby obowiązkowe."

### Etap 2 — The split (architectural) — DONE (2026-08-14)

**As built, and where it departs from the spec below.** The `DocumentKind` axis landed as specified.
The *two-template, two-context-builder* implementation did not, and was rejected on three grounds:

1. **The measured problem was orthogonal to the split.** ~35% of the document was blank because of
   one break rule (above). Splitting first would have shipped that defect into two documents.
2. **A fourth print template makes A6 worse.** Three PDF templates already carry three invented
   design systems; Etap 4 exists to write one canon and apply it, and Etap 5 to gettext the
   literals. Both would have to land twice, forever.
3. **The rejection in §5 does not apply to this axis.** "One document with a compact flag" was
   rejected because *the flag becomes the thing nobody sets*. `DocumentKind` is set by the endpoint,
   not by a person — `export_call_sheet` → report, `export_day_sheet` → day card. Nobody chooses.

So: **one template, keyed `_SECTIONS[kind][audience]`.** Kind decides what a section *contains*
(coverage counters, the invitation queue, past rehearsals, the requirement matrix and the
"(2 wpisy)" duplicate marker are report-only); audience decides section order and privacy, as before.
`resolve_document_kind` normalises the kind *before* anything reads it, so a report requested for a
singer degrades to a day card whole — a fallback that fixed only the section list would have left a
dozen content gates still in report mode, leaking crew PII and the invitation queue.

Measured on the dev database (8-piece project, 19 participations):

| sheet | before Etap 2 | after |
|---|---|---|
| report · production | 11 p | 8 p |
| day card · production (stage manager) | — | 4 p |
| day card · conductor | 10 p | 7 p |
| day card · chorister | 6 p | 5 p |

The remaining chorister length is **content-bound, not layout-bound**: eight program cards and a
15-voice roster are honest pages. §4's "one page" target assumed a smaller programme; the levers
left are Etap 4 (density, typography) and Etap 6 (structured logistics replacing prose).

Two decisions taken while building:
- **The 12 h plausibility ceiling was raised to 24 h.** It contradicted its own module: `crosses_day`
  exists to bless an evening call for a morning concert on tour, and a 15 h tour call was then
  flagged as a probable data-entry error. One day is the widest gap that can still belong to this
  concert, and the errors this guards against (a day, a month, the observed twenty days) all clear
  it comfortably.
- **D19's "(2 wpisy)" marker is report-only.** Etap 1 gave the chorister the `ensemble` section
  (N6), which put a database-hygiene annotation on the sheet of the reader who cannot act on it —
  and if the two rows really are two people, the plain repetition is the truth. The report annotates
  the roster *and* names the collision in the blocker list, which is where the merge gets decided.

**Still not done from this stage:** the QR replacing the button row belongs to Etap 4. (The anchor
strip this stage deferred landed with Etap 3, below.)

**Audited again in Etap 3 (2026-08-14), by rendering rather than by reading.** All four
kind × audience combinations the endpoints can actually produce were rendered against the dev
database and read as contact sheets. **The page counts published above reproduce exactly: 8 / 4 / 7 /
5.** Three claims were checked and hold:

- **`resolve_document_kind` closes the leak whole.** A report requested for a singer renders
  byte-identical to their day card (same section list, `is_report` false, no blockers, no crew PII).
  There is exactly one caller of `generate_call_sheet_pdf`, and the normalisation happens before any
  branch reads the kind, so there is no path around it: `export_call_sheet` is `IsManager`, and
  `export_day_sheet?audience=production` re-checks `IsManager` before honouring the parameter.
- **The day card is clean of report content on the render, not just in the context:** zero
  `class="metrics"` bands, zero blocker bands, zero requirement matrices ("4x Sopran 1 …": 34
  occurrences on the report, 0 on all three day cards), no "(2 wpisy)", no `Tel.`/`E-mail` on the
  chorister sheet.
- **`report × conductor` is configured but unreachable.** No endpoint produces it. Harmless, and the
  section list is right if one is ever added — but nothing exercises it outside the test suite.

Two smaller findings from that pass, both fixed here rather than filed:
- **Raising the ceiling to 24 h left a hole the ceiling used to cover.** A call entered one day early
  but later in the day (concert 11:00, call the previous evening at 19:00) is a 16 h window: it
  clears the ceiling, so no warning fires, and the only signal is the date in the masthead. That is
  right for the day card — the tour case is real and the date is printed — but the report has a
  blocker list precisely for "confirm this was deliberate". `crosses_day` inside the plausible
  window now adds one, worded as a confirmation rather than an error. The threshold itself stays at
  24 h: 12 h contradicted `crosses_day`, which exists to bless exactly these calls.
- **The one-template decision holds.** Nothing in the four renders wants a second template: the
  kind-specific surface is the blocker band, the coverage band and a dozen content gates, against
  ~590 lines of shared chrome and CSS that Etap 4 is about to rewrite once. What the renders *do*
  show is that section **order** is the day card's remaining weakness (the maestro's casting matrix
  runs four pages before his run sheet) — an ordering problem, not a template problem, and the Etap 3
  masthead answers it by putting the day's anchors on page 1 for every audience.

---

Original spec for this stage follows.

New axis in `document_generator.py`:

```python
class DocumentKind(StrEnum):
    DAY_CARD = "day_card"            # the day, for the people performing it
    PRODUCTION_REPORT = "report"     # the state of preparation, for management

_SECTIONS: dict[DocumentKind, dict[Audience, tuple[str, ...]]]
```

Templates split into `projects/day_card_pdf.html` and `projects/production_report_pdf.html` over a
shared `projects/_print_base.html` (page chrome, fonts, tokens). `_build_call_sheet_context` splits
into `_build_day_context` and `_build_report_context` over a shared `_build_common_context`.

Endpoints: `export_day_sheet` → `DAY_CARD` (audience resolved as today, `views.py:898-918`).
`export_call_sheet` → `PRODUCTION_REPORT`, manager-only, unchanged URL so nothing breaks; add
`export_day_sheet?audience=production` for the stage manager who wants the day card in its
production shape. Frontend: relabel the two export entries (`ProjectHubLayout.tsx:433-439`,
`schedule.service.ts:110-129`) and add the third; `DocumentType` in
`DocumentViewerPage/types.ts:16-20` already carries both names.

**Document A — Karta dnia.** One page; two only when the roster or program genuinely overflows.
Single column throughout. Three bands:

1. **Nagłówek — the five-second answer.** Title, date written out
   (`niedziela, 9 sierpnia 2026`), audience label, "Stan na …". Then one strip that is the only
   heavy typography on the page — the day's anchors, derived rather than listed as four independent
   fields:

   ```
   ZBIÓRKA            PRÓBA AKUSTYCZNA      DOWNBEAT           KONIEC (ok.)
   18:30              19:00                 20:00              21:15
   ```

   Under it, one line: venue, street address, and a QR to the map. If the call falls on another day
   (D1) the cell carries the date and the band takes the warning rule.
2. **Przebieg dnia** — the merged timeline from Etap 3: anchors and run-sheet points in one
   chronological list, anchors in the heavier voice, times in a fixed left gutter. No table header.
3. **Audience band.**
   - *chorister*: Twoja rola (pieces, voice line, pitch duties), dress code, what to bring, one
     contact.
   - *conductor*: program in order with voicing and pitch responsibilities.
   - *production*: roster by section with confirmation state, crew, contacts with phone numbers.

Not on the day card, ever: coverage counters, past rehearsals, invitation queues, "do uzupełnienia"
copy.

**Document B — Raport produkcji.** Opens with a **blocker list**, not with tiles:

```
DO ZAMKNIĘCIA
· Zbiórka ustawiona 20 dni przed koncertem — sprawdź datę        ← data error
· 3 zaproszenia bez odpowiedzi · Alt: Alto Testowa · Tenor: Jakub Majchrzak
· 1 utwór bez tracków sekcyjnych · Magi veniunt ab oriente
· Brak obsady technicznej
```

Then: coverage as one pieces × materials grid (U2), full rehearsal plan including what has passed,
casting, roster with statuses, contact directory, program list in ZAiKS order. Its measure of
success is that every hole is visible on page 1.

### Etap 3 — Day-timeline SSOT — DONE (2026-08-14)

Port `frontend/src/features/projects/lib/dayTimeline.ts` to `backend/roster/domain/day_timeline.py`:
`build_day_timeline(run_sheet, call_time, date_time, tz) -> list[TimelineEntry]`, preserving the
anchor tie-break and the day-offset semantics the TS version already documents. ~~Both the PDF and
the schedule read-model consume it~~ — **wrong: no read-model touches `run_sheet`; the consumers are
the PDF and the panel** — the frontend keeps its copy for live editing only, and a test asserts the
two agree on a shared fixture. Fold `resolve_call_window` from Etap 0 into this module.

**As built.** `roster/domain/call_window.py` **became** `roster/domain/day_timeline.py` (one module,
as Etap 0 said it would) and grew `RunSheetPoint`, `TimelineEntry`, `normalize_run_sheet`,
`build_day_timeline` and `plan_end`. The generator no longer parses run-sheet rows at all.

Four decisions the port had to take, because the two sides did not agree on their own:

1. **Sorting is normalisation, not merging.** The TS `buildDayTimeline` deliberately does *not*
   reorder points (`useDetailsForm` sorts on commit, so a half-typed time cannot yank the row under
   the cursor); the old backend normalizer *did* sort (fix D5). Both are right for their caller, so
   they are now two functions: `normalize_run_sheet` reads the stored JSON **and sorts it**, and
   `build_day_timeline` merges anchors into whatever order it is handed. The parity test therefore
   asserts placement only, on a fixture whose points are already ordered — stated in the fixture and
   in both suites, because it is the one thing "the two agree" does *not* cover.
2. **The "third normalizer" was a name collision.** `roster/dtos.py:_normalize_run_sheet` only
   coerced `None`→`()` and `list`→`tuple`; it never read a row. Renamed `_freeze_sequence`, with a
   comment pointing at the real one. There is now exactly one function in the backend that
   interprets a run-sheet row.
3. **A point still cannot say "the day before", and that stays.** It mirrors what the field holds —
   a bare `HH:mm` — so concert day is the run sheet's implicit frame while anchors carry a real date
   and are placed by the offset between them. The call anchor prints its distance ("20 dni
   wcześniej") wherever it lands.
4. **Parity is mechanical, not aspirational.** `backend/roster/domain/day_timeline_cases.json` holds
   nine cases (anchors bracketing the day, both tie-breaks, an overnight call, a call after the
   downbeat, a carried empty time, a missing call, an empty run sheet). `roster.tests.
   DayTimelineContractTests` and `frontend/src/features/projects/lib/dayTimeline.test.ts` both replay
   it. The fixture lives on the backend side so the Python test can never silently skip.

**Two defects found while porting, fixed here.** The panel's own load/commit sort was the D5 string
compare (`localeCompare`), surviving by the same accident as the backend's did; it now uses the
shared `compareRunSheetTimes`, and `parseClockTime` accepts the unpadded legacy hour the backend
already accepted. Stored times are canonicalised to `HH:MM` on the way out so the printed gutter
lines up with the anchors beside it.

**The anchor strip landed too** (§4's day-card masthead, deferred by Etap 2). It is derived from the
merged axis, and it is honest about what it cannot derive:
`DATA · ZBIÓRKA · POCZĄTEK KONCERTU · KONIEC PLANU`, where the last cell is the final run-sheet point
when the day runs past the downbeat and is **absent** otherwise. Under the band, the day card now
prints venue + street + map link as one line, and drops the address row from the event card. The
report keeps `MIEJSCE` in the fourth cell and its address in the event card, because its reader is at
a desk.

**Measured after the stage** (same project, 8 pieces / 19 participations):

| sheet | after Etap 2 | after Etap 3 |
|---|---|---|
| report · production | 8 p | 8 p |
| day card · production | 4 p | 4 p |
| day card · conductor | 7 p | 7 p |
| day card · chorister | 5 p | **4 p** |

The merged axis adds two rows to every sheet (and was worth a ninth page on the report until the
`.split` guard came off — see the Etap 1 note above, which this stage revises).

**What the merged axis immediately exposed, and what it deliberately does not do:** on the dev data
the run sheet carries its own "POCZĄTEK KONCERTU" point at 11:28 while the project's downbeat anchor
reads 13:28 — the two now print one under the other instead of the header and the table quietly
contradicting each other across half a page (D4, still live on that data). The timeline does **not**
dedupe a point that restates an anchor: when they agree the repetition is harmless, and when they
disagree the repetition *is* the finding.

### Etap 4 — Print design system — DONE (2026-08-14)

**The canon is written and lives in `.ai/04_design_system.md`, § `Print artifacts`.** That file is
`.gitignore`d (agent context), so it is not in this repo's history — this section is the tracked
record of *what* was decided; the canon itself is the normative copy, and there is deliberately only
one. It governs the call sheet, the contract and the score book, and it is ~25 lines.

**Applied to all three templates.** The call sheet and the contract were rewritten onto it. The
score book was **read against it and deliberately left alone**: it already complies where the canon
binds every artifact (atoms carry the `avoid`, nothing depends on colour), and it takes the canon's
one named exception — a book keeps Gentium Plus and its oldstyle figures, because it sets verse a
singer reads while singing, not a table of hours.

**Measured on the dev database** (`Koncert Wiosenny „Lux Aeterna”`, 8 pieces / 19 participations),
all four combinations the endpoints can produce, rendered in the container and read as contact
sheets:

| sheet | after Etap 3 | after Etap 4 |
|---|---|---|
| report · production | 8 p | **6 p** |
| day card · production | 4 p | **3 p** |
| day card · conductor | 7 p | **5 p** |
| day card · chorister | 4 p | 4 p |

The report now runs with essentially no internal slack (page tails 13 / 19 / 24 / 40 / 23 pt on
pages 1–5). `report × chorister` still renders byte-identical to that singer's day card.

**What produced the pages.** Most of it is the face: the sheet was set in Gentium Plus at 10.5pt and
is now IBM Plex Sans at 9.5pt, which is the same optical size (Plex draws a 0.516em x-height against
Gentium's ~0.45) at meaningfully less height. Three layout decisions did the rest:

- **The casting section stopped being eight bordered cards** and became one card of hairline-
  separated blocks, the same shape the programme list already had. Nine identical surfaces gave
  every piece the same weight (U3) and cost a border, two paddings and a gap each.
- **The event pair moved from `table-cell` to `columns: 2`.** Two table-cells tear at whatever
  height the taller one reaches and leave the exhausted cell blank beside the one still running —
  a third of a page on the report. Balanced columns end together. Re-confirmed on measurement:
  collapsing the pair to one column *costs* a page on two documents, so the two-column pair stays.
- **`.grid td` padding 5pt → 4pt.** The report is mostly tables; one point per row was worth a whole
  page of it, and it is what closed the report's own orphan.

**Decisions taken while building.**

- **`break-inside: avoid` moved off the programme entry and onto the piece's *identity*
  (`.prog-id`: number, title, composer, metadata).** Guarding the whole entry cost a full page on the
  maestro's card, and rendering it without the guard showed the only break it was ever buying off was
  the resources line dangling to the next page. So the identity is the atom, and what may follow it
  flows. This refines the standing rule rather than contradicting it: **the atom is the smallest
  thing that must not be torn, not the smallest box in the markup.**
- **`report × conductor` is deleted, not given an entry point.** It was configured in Etap 2 and no
  endpoint ever produced it. A query flag with no UI is precisely the "flag nobody sets" that §5
  rejects, and `resolve_document_kind` already degrades the pair to the day card the maestro can
  actually request — now covered by a test. If a conductor's report is ever wanted it arrives with
  the entry point that motivates it.
- **A day card leads with the day.** The run sheet is now the first numbered section on all three day
  cards (after `personal` on the singer's, which is the one section nobody else's sheet carries). The
  maestro's card opened on four pages of casting matrix before reaching the hours its own masthead
  had just stated. The report still leads with the event: its reader is establishing facts, not
  executing them.
- **U2: the coverage tiles became a grid.** Four counters over four denominators in a row of equal
  boxes were a matrix pretending to be tiles. There are now two things: a **census** — one line of
  plain type where every figure carries its own noun, so no two of them read as shares of a
  denominator they never had — and a **grid**, one row per piece and one column per material, where a
  missing material is an empty cell. Presence is a mark and absence is space, so a hole is a hole on
  a mono print. The four `Nuty per utwór 6/8`-style rows left the event card, which now carries only
  the two project-level resources.
- **QR policy (A3).** Two codes at most, and never three: the venue map on a day card (a public map,
  and the address it decodes is printed beside it, so nothing is lost without a phone) and the Spotify
  playlist. The score and the per-piece editions are **named in words with the sentence that says how
  to reach them** — they sit behind the app's login, and a code that leads to a login wall is worse
  than no code, because it is tried first. Reference recordings name performer + platform: one QR per
  recording is how a page becomes a QR wall (§5). New dependency: `segno` (pure Python, SVG output; a
  raster prints blocky at the 15mm a scannable code needs).
- **The contract joined the canon.** Its palette was stock Tailwind slate plus a blue (`#002395`)
  that appears nowhere else in the product — not an identity, a default. It now uses the same four
  ink steps, the same gold rule and lining figures. **No wording changed**; it is the same legal
  text.
- **Crimson left the personal block.** A singer who has not answered yet wore the alarm colour. An
  unanswered invitation is work in progress, so it is a gold chip, and the *confirmed* case — the
  expected state — dropped its chip entirely and says so in plain type.

**The orphan on the last page: measured, and only half of it was a break-rule problem.** The
report's is gone (the density pass pulled the contact directory back onto page 6). The singer's card
still ends on a page carrying only `Kontakty`, and that is **content arithmetic, not a break rule**:
rendering it with `break-inside: avoid` removed from *every* atom leaves it at four pages, and so do
all three plausible section orders (contacts before the roster, contacts straight after the personal
block). Its pages 1–3 are full to within 27pt. The levers left are Etap 6 (structured logistics
replacing prose) and content decisions this stage is not allowed to take.

**Two things worth knowing before touching this template again.**

- `columns: n` and `page-break-inside: avoid` interact: a card inside a `.multicol` needs
  `break-inside: avoid-column`, and removing it measurably *worsens* the balance rather than freeing
  it.
- The ink scale is declared as custom properties on `:root` in each template. WeasyPrint resolves
  `var()` fine in the document, but the `@page` margin boxes keep literal values — a running footer
  is outside the element tree the properties are inherited through.

---

Original spec for this stage follows.

- **Two voices.** Cormorant Garamond for titles, the anchor strip and display figures; IBM Plex Sans
  for every label, table, time and counter. Both already bundled
  (`backend/assets/fonts`, `print_fonts.py:44-57`) — the call sheet simply has to stop asking for the
  score-book face (A5).
- **Lining figures** document-wide (U5).
- **Ink scale, four steps**, and one rule weight. Gold is structure; crimson is reserved for a
  stated problem and appears nowhere else.
- **No pill for a fact that is always true** (D17). No button shapes (A3): a resource is named in
  words, with a QR when it is genuinely reachable — at most three per page.
- **Break rules**: every card `break-inside: avoid`; no page-level table layout (D14).
- Verify against a mono laser print: nothing may depend on colour alone.

### Etap 5 — i18n — DONE (2026-08-14)

gettext the templates and the generator's literals; resolve `doc_lang` from the recipient's locale
rather than a global setting; `pl/en/fr` `.po` + committed `.mo` via polib. Fold in D23.

**As built.** ~170 msgids across `document_generator.py` and `call_sheet_pdf.html`, English msgids
in the catalog's existing convention. `resolve_document_language(project, audience, recipient,
requester_language)` is the new seam and `generate_call_sheet_pdf` wraps **both** the context build
and the render in `translation.override` — most of this document's wording is composed in Python
(a numeral governs the noun beside it), so an override around the template alone would have
resolved half the sheet against the request's language. D23 is folded in: `'Unassigned'` was already
gone by Etap 0 and `'Timeline entry'` became `'Punkt dnia'` in Etap 3; both now come from the catalog.

**The reader, not the server.** `SCORE_BOOK_LANG` is no longer read here (the score book keeps it).
The singer's card resolves from `recipient.artist.user.profile.language`, the maestro's from
`project.conductor.user.profile.language`, and only the two production sheets — which have no named
reader — fall back to the language of whoever asked, passed in by the view. The request's own active
language is deliberately unused: `LocaleMiddleware` sets it from `Accept-Language`, which follows the
panel's UI, not the person the document is for.

**Measured on the dev database** (`Koncert Wiosenny „Lux Aeterna”`, 8 pieces / 19 participations),
rendered in the container and read as contact sheets:

| sheet | after Etap 4 (pl) | Etap 5 · pl | Etap 5 · fr |
|---|---|---|---|
| report · production | 6 p | 6 p | **7 p** |
| day card · production | 3 p | 3 p | 3 p |
| day card · conductor | 5 p | 5 p | 5 p |
| day card · chorister | 4 p | 4 p | 4 p |

**Polish is unchanged, and that was the acceptance test**: every msgstr is the exact string the sheet
printed before this stage, so the pl render is the Etap 4 render. The French report's extra page is
content arithmetic, not a layout fault — Etap 4 left it with 13/19/24/40/23 pt of slack, and the
longer French runs push the contact directory off the roster's page. Nothing was squeezed to hide it.

**Three defects the French render exposed, all fixed here.**

- **The coverage column heads collided.** `ENREGISTREMENTDISTRIBUTION`, with no gap, under the marks
  they label. The heads are uppercase at 1.2pt tracking, so a nine-letter label is already ~47pt in a
  44pt cell — Polish only fit by luck. The cell is now 56pt and those four heads carry their own
  `coverage column` msgctxt, because this is the one place in the document where a translator must be
  free to abbreviate (`Écoute`, `Distrib.`) without abbreviating the same word where it has room.
- **The programme ordinal was not inside its own atom.** Etap 4 put `break-inside: avoid` on
  `.prog-id`, but the gold numeral sat in a *sibling* table-cell, so the row could split between the
  two and strand a lone "1" at the foot of a page — which French promptly did. The number is part of
  the identity and now lives inside the guarded box; what may follow keeps its indent via `.prog-more`
  and stays free to break. No page-count change in either language.
- **A Polish vocative inside a French sentence.** The greeting printed `first_name_vocative`
  unconditionally: *"Préparé pour vous, Janie"*. `core.greetings.apply_vocative_rule` has been the
  one place that knows Polish is the only supported language with a distinct vocative since the
  2026-07 pass; the call sheet was a seventh copy that ignored it. It now calls it.

**A pre-existing test leak, surfaced not caused.** Two `roster` tests send `Accept-Language: en` to
pin a translated choice display. `LocaleMiddleware` activates that language for the whole thread and
never deactivates, so every later test in the process ran under English — invisible while nothing
asserted on translated copy, and instantly fatal to five call-sheet tests once the sheet had any.
Both now `addCleanup(translation.deactivate)`.

**Decisions taken while building.**

- **Short labels carry a `call sheet` msgctxt; sentences do not.** Twelve of the labels this document
  needs already exist in the catalog from the panel and notifications, and half of them mean something
  slightly different there (`Focus` → *Plan próby*, `Dress code` → *Strój*, `Casting` → *Obsada*,
  `Polish` → capitalised *Polski*, which reads as a heading inside a piece's metaline). More to the
  point, a printed head sits in a measured width: reusing a shared msgid would let a notification
  rewrite break this layout. Sentences are unique by construction and reuse nothing by accident.
- **`_count_label` is gone; `ngettext` replaces it.** The hand-rolled three-form selector was correct
  Polish and wrong everywhere else (it gives French *"0 pièces"*). The trap it hid is that `ngettext`
  is only correct **if the pl entry exists**: with a missing entry gettext falls back to the msgid
  pair's own two-form English rule and silently prints *"5 utwory"*. A test walks every `ngettext`
  call in the generator with an `ast` scan and asserts, at n = 1/2/5/12/22, that the catalog answers
  and that the buckets are the Polish ones (22 takes *few*, 12 does not).
- **Dates stay numeric (`%d.%m.%Y`).** Writing the day out would mean Django's bundled catalogs, which
  capitalise the Polish weekday and the French month where neither language wants it. One date, in the
  one order all three locales read the same way.
- **The ZAiKS CSV, the DTP export and the contract PDF stay Polish, deliberately.** ZAiKS is a filing
  format the Polish collecting society parses; the DTP export is copy for a Polish concert programme;
  and the contract is Polish legal text whose language is a legal decision that starts with the
  clauses, not with a placeholder. Translating one string in the contract would also make it follow
  `Accept-Language` and drop a single French word into an otherwise Polish agreement.
- **`h` / `min` / `s` are not translated.** They are SI symbols, identical in all three locales; a
  catalog entry there only invites someone to translate a unit into something that is no longer one.
- **`makemessages` was not used and could not be.** No GNU gettext on the Windows host, and running
  it would rewrite every `#:` reference across three 770-entry catalogs and mark as obsolete anything
  it cannot see at a call site — which includes the entries built from `_LANGUAGE_NAMES` and
  `_COVERAGE_COLUMNS`. The catalogs were appended with polib from a msgid set extracted by Django's own
  `templatize` (so template msgids are byte-exact) plus an `ast` pass over the generator, with the
  merge refusing to write on any mismatch between the two. The `en` `.mo` is byte-identical after the
  merge and that is correct: English msgstrs are empty, so English falls back to the msgid.
- **Two dicts reach gettext through a variable** (`_LANGUAGE_NAMES`, `_COVERAGE_COLUMNS`), which no
  scanner can see. That is a deliberate trade — the alternative is 19 module-level lazy proxies in
  dicts that are otherwise plain `dict[str, str]` — and a test walks both dicts against the compiled
  pl catalog, which is a stronger guarantee than extraction would have been.

### Etap 6 — Data hygiene (separate track, needs migrations)

- **D19** duplicate-artist detection and a merge path in the roster.
- **D21** address normalization on Places import.
- **A7** structured day-of logistics on `Project`: entrance/gate, parking, dressing room, warm-up
  slot, sound-check window, on-site emergency contact — plus the editor fields for them. Until this
  lands, the day card is missing the content it most exists to carry.

---

## 5. Rejected

Recorded so they are not re-proposed.

- **One document with a "compact" flag.** Both readers get a compromise, and the flag becomes the
  thing nobody sets. The split is what makes each document allowed to be opinionated.
- **A hard one-page cap on the day card.** A 40-voice roster legitimately overflows. The cap belongs
  on *what may appear*, not on how many pages the permitted content takes.
- **Rendering the day card in the browser / React-to-PDF.** It must be generatable server-side to be
  attachable to a notification and downloadable offline; a second layout engine is a second design
  system.
- **Dropping WeasyPrint for headless Chromium.** Buys correct flexbox, costs a browser in the image
  and the deterministic bundled-font guarantee `print_fonts.py` exists to provide. The layout faults
  in §2 are ours, not the engine's.
- **A QR per link.** Three per page maximum, or the page becomes a QR wall and none of them get
  scanned.
- **Colour-coding voice sections.** Prints as four indistinguishable greys on the mono printer a
  sacristy actually has.
- **`PRÓBA AKUSTYCZNA` and `KONIEC (ok.)` as fixed cells of the anchor strip** (§4's four-cell
  sketch). Neither is stored. The sound check could only be found by matching free-text titles
  ("próba akustyczna" / "sound check" / "akustyka"), which is a guess printed as a fact in the
  heaviest type on the page; the end could only be derived by summing piece durations, which ignores
  applause, pauses and the interval and would print an hour nobody planned. The strip states the two
  anchors it owns and closes with the last *planned* point when there is one — see Etap 3.
- **Deduplicating a run-sheet point that restates an anchor.** When they agree the second line costs
  nothing; when they disagree, hiding one of them re-creates D4 with better manners.
- **An entry point for `report × conductor`** (Etap 4). A query flag with no UI is the "flag nobody
  sets" rejected two entries above; the branch is deleted instead, and the pair degrades to the day
  card. Reinstate it *with* the endpoint that wants it, not before.
- **A QR on the score or on a per-piece edition.** Those endpoints are access-gated; a code that
  lands on a login wall is worse than no code, because a reader tries it first and concludes the
  sheet is broken. Gated resources are named in words plus the sentence saying where to find them.
- **A hard `break-inside: avoid` on a programme entry** (Etap 4). Worth a full page on the maestro's
  card, and the tear it prevented was only ever the resources line leaving the piece behind. The
  guard belongs on the piece's identity.
- **Reusing the panel's existing msgids for this document's short labels** (Etap 5). Twelve of them
  already exist, and half mean something else there (`Focus` → *Plan próby*, `Casting` → *Obsada*).
  Beyond the wording: a printed head sits in a measured width, so a shared msgid lets a notification
  rewrite silently break a page. Short labels take a `call sheet` context; sentences, unique by
  construction, reuse nothing by accident.
- **Writing the date out in words** (§4's `niedziela, 9 sierpnia 2026`). It has to come from Django's
  bundled catalogs, which capitalise the Polish weekday and the French month where neither language
  wants it. `%d.%m.%Y` is one date in the one order all three locales read the same way.
- **`makemessages` for these catalogs** (Etap 5). No GNU gettext on the dev host, and it would rewrite
  every `#:` reference across three 770-entry catalogs while marking as obsolete every msgid it cannot
  see at a call site — including the ones built from `_LANGUAGE_NAMES` and `_COVERAGE_COLUMNS`, whose
  translations would then vanish from the compiled `.mo` with no error anywhere.
- **A second consumer for the day timeline "because the spec said so".** §4 claimed "both the PDF and
  the schedule read-model consume it" — no backend read-model touches `run_sheet` (checked:
  `queries/`, `dashboard_serializers.py`, `serializers.py`), and none should be invented to justify
  the module. The consumers are the PDF and the panel, which is exactly why the parity fixture
  exists.

---

## 6. Verification

- `& .venv\Scripts\python.exe -m ruff check backend\roster` and `… -m mypy backend\roster` — clean
  baseline, keep it.
- `& .venv\Scripts\python.exe backend\manage.py test roster --settings=config.test_settings_sqlite`.
  The existing suite (`roster/tests.py:4212-4396`) asserts against `render_to_string` output, not
  rendered PDFs — extend it there: every defect in §2 that has a textual signature gets an
  assertion (no `481 h`, no `· la-pl` opener, no duplicate `SPOTIFY` label, section numbering starts
  at 1, no conductor in the cast counts).
- PDF-level checks need WeasyPrint's native libraries; run them in the container
  (`docker compose exec`), not on the Windows host — the host path degrades to 503 by design
  (`views.py:870-875`).
- **Render all three audiences, always.** The non-admin sheets are where the damage lands (§2.5) and
  they are invisible from the manager's export. The audit used a throwaway `TestCase` that renders
  `projects/call_sheet_pdf.html` for `PRODUCTION`/`CONDUCTOR`/`CHORISTER` from one fixture and
  writes the HTML to disk; reach for the same technique before calling a stage done.
- Page-count and whitespace regressions are visual: render the audited "Test" project after Etapy 0–1
  and confirm three pages with no orphaned column.
