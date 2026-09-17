# Newsletter register: implementation record and remaining stages

Date: 2026-09-16. Status: **Stage 1 rebuilt as a REGISTER and standing; awaiting the developer's
visual judgement.** Stages 2-7 not started.

Backend findings: [Outreach second review](web-outreach-second-review-2026-09.md).

**The creative brief [A letter between the leaves](web-newsletter-breviary-concept-2026-09.md) is
SUPERSEDED for this page and must not be reimplemented.** It specifies a parchment sheet with rear
edges and a silk marker on the night ground. That was built, judged, and removed twice — the second
time against the law in the header of `web/src/styles/nave-menu.css` (lines 88-116, dated
2026-08-03), which records three field passes establishing that modelled material on a flat ground
"reads as a foreign body no matter how it is tuned", that the material is DENSITY rather than light,
and that gold on parchment is refused at 2.7:1. The brief predates that law. Everything in it about
composition, edges, ribbon and plate is void; its wording decisions are not.

## Decisions taken before implementation

1. **Stage 1 covers `/newsletter` AND `/nuntius`**, so the whole choreography is closed in one
   pass, including "Confirmed through email".
2. **The page is a REGISTER: ruled type on the site's night.** Four rules divide it — the gold head
   above the running head, the register rule opening the ask, the record rule, the colophon. Two
   columns under them, and the concert corpus set out as an index beneath. Nothing is drawn,
   modelled or lit. What the composition spends is density of information.

## What stage 1 built

A third variant on the one signup component. `NoticeSignup.astro` now renders `band`, `strip` or
`leaf`; the five placements that are not `/newsletter` still pass `band`/`strip` and were verified
unchanged (no leaf class, no stage, same widths and alignment).

- `components/NoticeSignup.astro` — two trees. The leaf's running head sits outside `.notice-stage`
  and survives the exchange; the headline, lede and island are siblings inside it.
- `islands/landing/NoticeForm.tsx` — `variant` prop, `open → leaving → sent` machine, the waiting
  leaf (address + "Popraw adres", recovery disclosure, resend with a countdown).
- `islands/landing/NuntiusIsland.tsx` — the mount effect now only READS the URL; a button spends
  the token. Runtime selection of the next evening. The panel wears the leaf.
- `components/pages/NuntiusPage.astro` — serialises future station evenings (from `date` AND
  `dates[]`) with their place, typeset moment and href.
- `i18n/content/nuntius.ts` — states `confirm`/`unsubscribe`, chrome blocks `actions`/`programme`,
  the waiting leaf's controls; all three locales.
- `styles/notice.css` — the whole `.notice-leaf` section.

### The second pass: what made it a page

The composition above was correct and empty — measured, the reading column held 181px of ink in a
407px box and the two columns stood at a 4:1 imbalance. Styling could not fix that; only content
could. What the rebuild added:

- `lib/noticeRegister.ts` — derives the register from the concert corpus: the evening still ahead,
  and the record of those already sung, most recent first. A RECORD rather than a forecast, because
  the corpus holds one future station at a time and an index of those is a list of one.
- `components/NoticeRecord.astro` — the full-measure index at the foot of the page: numeral, latin,
  title, leader, place, moment. One ruled line per evening.
- `NoticeSignup.astro` — the leaf branch became `.notice-opening` + `.notice-ask`, and the ask's
  reading column carries the evening ahead with its own sentence.
- The consent CHECKBOX is gone and the clause is unchanged in substance — see `outreach/consent.py`
  for why the box was never the evidence, and why the succession sentence stayed on screen.

## Traps found while building, worth not rediscovering

1. **`astro-island` is `display: contents`, which changes LAYOUT, not SELECTORS.** The React form
   and receipt become grid items of `.notice-stage`, so the layout works — but in the DOM their
   parent is still `<astro-island>`, so `.notice-stage > .notice-form` matches nothing. It fails
   silently and auto-placement makes the result look nearly right. Use descendant selectors.
2. **`auto` grid tracks cannot align columns across rows that are each their own grid.** A
   content-sized track is resolved per GRID, so the index's latin column sized to LAMENTUM on one
   row and INCARNATIO on the next, and the columns silently stopped lining up — each row looks
   correct on its own. The index uses FIXED tracks measured from the longest content
   (`--entry-cols` in `notice.css`). Subgrid is the other honest answer; it needs a support floor
   and a fallback path, and these four columns hold names, places and abbreviated dates.
3. **A void moves unless the column carrying it is given content, and the clause is the lever.**
   Measured: the reading column ran 226px empty under a heading and a lede, a 4:1 mass imbalance
   against the form beside it. Widening the apparatus column shortens the CONSENT CLAUSE (109px →
   87px) and so lowers the whole form — the one change that improves both columns at once, since
   the reading column loses width it was not using. The rest closed when the evening ahead got its
   own sentence (`about.blurb`). Final void: 125px, inside a zone bounded by rules.
4. **A photograph was built here and removed; do not rebuild it without a new asset.** The frame
   the corpus declares for an evening (`about.img`) is a promotional composite, not a photograph of
   the ensemble, and on this page it was the one foreign object. As GROUND it is refused outright:
   the index is 11–12.5px type on a 4.5:1 floor, which no scrim can guarantee over an image, and a
   scrim heavy enough to try spends the image's range (register audit, R10). What would change the
   answer is an asset — a real concert frame, dark, in the site's palette.
5. **The resend needed no backend work.** `CONFIRM_RESEND_COOLDOWN` (10 min) already exists in
   `backend/outreach/models.py` and `subscribe()` throttles against it, answering identically in
   every case. `NOTICE_RESEND_COOLDOWN_MS` in `api/notices.ts` mirrors it; keep the two together
   and never let the client floor drop below the server's.
6. **Colour fringing on text in headless screenshots is subpixel AA, not a defect.** Computed
   colours were checked and are solid.
7. **`.lat` is styled only INSIDE a rubric.** `base.css` matches it as `:is(.eyebrow, .micro, …)
   .lat`, so worn anywhere else — an index row, say — it inherits nothing and renders as body text,
   silently. The register's latin names carry `lang="la"` and their own face instead. The
   `--lat-ink` trap does not arise, because the base rule never applies.

## Deliberately not done

- `NOTICE_DISCLOSURE_ID` / `errorDisclosure` from the abandoned `.agent/codex-nuntius-wip` sketch.
  An identifier with no immutable server-side registry is a placeholder. It belongs to stage 6.
- Removing `emailPlaceholder` / `namePlaceholder`. That is the second review's recommendation, not
  the brief's, and those fields are shared by all six placements — removing them would change the
  five that stage 1 was told to leave alone.
- `programme.none`. `confirmed.body` was rewritten to name no date, so it is true whether or not
  an evening is published, and the empty case needs no second sentence. There is no hollow card.

## Remaining stages, one session each

| # | Scope | Note |
| --- | --- | --- |
| 2 | Landing: judge the footer strip against the register | It wears the footer's day/night plate (`--nox`) and is the ONE placement on parchment — the register's night values do not travel there. Decide whether it needs anything at all before touching it |
| 3 | The band on `/koncerty` and the concert page | Unchanged by this pass and verified so. If it is revisited, the question is whether it earns the evening-ahead entry too, not whether it gets edges |
| 4 | Invitation on `/kontakt` and `/404` | Withdraws the form from both, so `web:kontakt` and `web:404` stop being used as `surface` — decide whether they stay in the backend allowlist for existing consent records |
| 5 | The confirmation email in the same family | Restrained correspondence layout plus a plain-text version |
| 6 | Backend from the second review | Durable outgoing record with retries; disclosure-id registry; row-locked transitions plus a PostgreSQL concurrency test |
| 7 | Sending policy | A board decision before the first campaign. The SUCCESSION clause is settled and no longer part of this stage: it stands on screen in clause 3.0, as the policy's own note above § *Lista zaproszeń* requires |

## Verification

`npm --prefix web run check` — 0 errors, 0 warnings, 16 hints across 205 files as of this stage.
`npm --prefix web run build` — 49 pages; register audit clean (its one note is six dark
photographs, unrelated). Backend: ruff and mypy clean on `outreach`, 54 tests OK.

Final geometry at 1440px, for whoever tunes this next: measure 1296, apparatus column 547, void in
the ask 125px, consent clause 87px, index tracks 46 / 120 / 769 / 192 / 88 with the title track's
494px of slack spent as the leader.

Visual judgement belongs to the developer, in their own browser.
