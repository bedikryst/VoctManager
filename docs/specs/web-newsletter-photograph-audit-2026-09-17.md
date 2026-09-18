# Newsletter, round 9: the photograph, and the dark side under it

Status: **Integrated into `web/` on 2026-09-17** — `components/NoticeLetter.astro`,
`styles/notice-letter.css`, `NoticeForm` variant `letter`, crops by `scripts/nuntius-room-crops.mjs`.
The promise and the one-line clause are in production (round 10, below). The study
(`g3-letter.html`) is now the record, not the plan. Awaiting the developer's visual verdict on the
live page. **Round 11 (below) tried to carry the letter's blank onto the other placements and was
REFUSED on sight**; **Round 12 (below) replaced it and was REFUSED in turn** ("no idea behind it,
shoved in because we wanted a newsletter"); **Round 13 (below) moved the landing's ask off the
footer and into the register, first as its last row and then as a ribbon in its left margin — and
that is REFUSED too, as the brief for a redesign this session did not have the altitude to make.**
Read Round 13 FIRST: it carries the standing brief, what the tree holds today and what must not be
proposed again. Then Rounds 11 and 12 before touching `NoticeSignup`, the band section of
`notice.css` or the door in `ContactPage.astro`.
Date: 2026-09-17
Supersedes: `web-newsletter-letter-prototype-g3-2026-09-17.md` on the crop, the asset set and the
plate's material. Everything else in G3 still holds.
Study: `C:\Users\kryst\vm-shot\newsletter-v2\g3-letter.html` · renders and `measurements.txt` in
`out-g3\` · cut script `C:\Users\kryst\vm-shot\cut-room-windows.cjs` · harness `g-shots.cjs`.

## What was wrong

The letter was placed to the pixel; the photograph was poured into whatever rectangle the layout
left over. The plate's box is an accident of the window — 1.10:1 at 901×900, 1.68 at 1440×900,
2.01 at 1920×1080, 2.41 at 1920×900, 2.33 on a tablet — and `object-fit: cover` then decided where
the picture got cut. Measured on frame (63), the row luminance says there are exactly two lines a
plate may end on:

| frame y | what is there | mean lum (0–255) |
| --- | --- | --- |
| 0.27 | the red sanctuary LED, blown to 255,0,0 | — |
| 0.41–0.59 | faces, folders, the conductor's back | 26 → 65 |
| 0.62–0.68 | dark dresses, the listeners' silhouettes | 13 |
| 0.71–0.86 | the brass lectern, blown to 255 at 0.78 | 15 (max 158) |
| 0.89–1.00 | floor, dead black | 7 |

The old cut (`y 0.20→0.94`, top-anchored at 30 %) hit none of them:

- **1440×900 and 1920×1080: the plate's foot sliced the lectern's base** — the one warm object in
  the foreground, guillotined by the edge at both sizes.
- **1920×900, the developer's own screen: the foot fell across five lit dresses** at mid-thigh, and
  the lectern showed as a gold sliver touching the edge.
- **The red LED at frame y 0.27 landed inside the navigation band**, directly above `O NAS` at 1440
  — a saturated red point on a page whose palette keeps crimson for alarm.
- **The bottom 5 % of the old window was dead floor** (lum 7), so a twentieth of every plate was
  black with nothing in it, immediately above where the reading starts.
- **The tablet still ate the rejected roof round's cut**: a 2.33:1 band that took the conductor's
  head off at the top edge and put the altar crucifix behind the language switcher.
- **The photograph was the only surface on the page without grain.** The dark ground carries 0.16,
  the sheet 0.06, the picture none — so its own black (13) sat a step below the ground's (24) and
  the foot of the plate read as a band of shadow rather than an edge.

## What changed

**One frame, three windows, and the foot is fixed.** `object-position: 100% 100%`: the plate's
bottom edge and its right edge are the composed ones, and what a shorter or narrower box gives up
is ceiling and the far end of the row. Cutting the other way bisects the conductor's head; this way
the edge falls on a singer seen from behind.

| window | cut from frame (63) | aspect | serves |
| --- | --- | --- | --- |
| `room-spread.webp` | x 0→0.66, y 0.285→0.885 | 1.650:1 | plate boxes 1.1–1.95 — desktop and tablet |
| `room-wide.webp` | x 0→0.66, y 0.285→0.68 | 2.506:1 | boxes 1.95–2.6 — short-wide desktop, landscape phone, 200 % zoom |
| `room-phone.webp` | unchanged (x 0.02→0.46, y 0.26→0.90) | 1.031:1 | the phone held upright |

The spread cut ends **below** the lectern, in the floor shadow, and carries the vault; the wide cut
ends **above** it, in the dresses, and carries less vault. Neither contains the red LED. Both are
cut by `cut-room-windows.cjs`, which documents the luminance table above.

The `<source>` conditions are the boxes that resolve wider than about 1.95:1 — `(min-width:1700px)
and (max-height:1100px)`, `(min-width:1200px) and (max-height:820px)`, a coarse pointer under
560 px tall, and the stacked layout in a landscape window (a desktop at 200 % zoom lands there).

**The tablet gets a room, not a band.** `--plate-ratio` at 641–899 px goes 2.33 → 1.62: at 820×900
the plate is 820×506 and the act still stands above the fold (758 of 900). `roof-tablet.webp` is no
longer referenced.

**A phone held sideways** keeps a plate tall enough to clear the 84 px bar (`--plate-ratio: 2.5`,
no `max-height`): 844×338, heads 98 px down, the letter reached by scrolling.

**The plate carries grain** at 0.07, the page's own. The seam at the plate's foot goes from 12.7 vs
23.9 to 18.0 vs 23.9 — the picture's black stays deeper than the page's, as a print's does, but the
foot no longer reads as a trough.

## What did not change, and why

- **The photograph does not animate on arrival, and should not.** The page has one arrival gesture
  and it belongs to the sheet: laid down, opaque from the first frame, with the two blanks ruling
  themselves under it. A second gesture on the largest object on the page would compete with it,
  and the only ones on offer — a scale settle, a light coming up — are the stock hero moves this
  page has spent five rounds getting away from. `measurements.txt` records `photo 1` at every
  sampled time, deliberately.
- **The recede on the scroll stays a flat veil.** Measured in an identical window of the picture as
  the reader leaves: lum 38.2 → 36.6 → 34.5 → 32.9 → 30.0 → 24.8 at 0/10/18/28/40/60 % of the
  scroll, i.e. −35 % by the time the register's paper is halfway up. It has to be flat: the paper
  eats the picture from the bottom, so everything still on screen is the plate's top band, and a
  directional dim would spend itself on the part already covered.
- **No frame, no scrim, no gradient on the picture.** The plate bleeds off the top and the left and
  has a hard edge at the foot and at the right, where the sheet lies over it — round 4's decision,
  intact. The only gradients near the photograph are the room's warm spill on the ground beneath it
  (`.room::before`) and the sanctuary bloom inside it, which is still spent only on the commit.

## The dark side under the photograph

Two changes, both from measurement rather than taste.

**The promise is scope, not a count.** `Przed każdym koncertem wyślemy Ci jeden krótki list —
termin, miejsce i program.` promised an operational limit nothing enforces: one programme sung in
three cities is three dates, and a moved hour is another letter. The first outreach review's answer
was an annual ceiling (`kilka listów w roku`); the second review rejected it — an expectation is
not an operational limit, and it must not be promised without a sending policy that can keep it.
What the page can promise without a policy is the purpose the consent record already holds:
concerts. The page now reads

> Piszemy tylko o koncertach. Termin, miejsce, program i każda zmiana.

The subject stands in a short sentence of its own and the list follows it; the change is the last
**item** of that list, never a sentence about changes — written out it orphaned `Gdy` at the end of
a line, and as an item it is one more thing the letter carries, which is also the best reason a
stranger has to give their address. Two non-breaking spaces hold `o koncertach` and `i każda`; in
the study they are typed, in production `lib/typo` makes both by rule.

**The photo credit was positioned by the window, not by anything it belongs to.** `align-self: end`
inside a row whose height is `min-height: 32vh` put it 28 px under the clause at 1920×900, 86 px at
1920×1080 and 188 px under the sentence at 1024×768. Held to the sentence (`align-self: start`,
28 px), it lands within 3 px of the clause's foot at every desktop height, so the credit and the
clause close the dark side as one band of small print — and the left column stops being a single
display line marooned in its column.

**The channel between the two columns** is what the window leaves: the sentence is pinned to the
gutter under the photograph's left bleed and the field's right edge is pinned 36 px clear of the
sheet, so the gap was 53 px at 1440 and 417 px at 1920. Rather than move either anchor, the field's
column cap goes 440 → 520 px: it only widens above ~1570 px, 1440 is untouched, 1920 closes to
337 px and the blank the reader writes on grows from 353 to 433 px. The act's foot still lands on
the sentence's last baseline (761 / 761 at 1920×900).

## Measured (unchanged rows omitted)

| | round 8 | round 9 |
| --- | --- | --- |
| 1920×900 plate | 1475×612, spread cut, foot across lit dresses | 1475×612, wide cut, foot in shadow |
| 1920×1080 plate | 1475×734, lectern's base sliced | 1475×734, wide cut, conductor whole and clear of the sheet |
| 820×900 plate | 820×352 (2.33:1), roof cut | 820×506 (1.62:1), spread cut |
| 844×390 plate | 844×242, heads under the bar | 844×338, heads 98 px clear |
| zoom200 | 720×279, spread cut, beheaded | 720×279, wide cut |
| Plate foot vs ground (lum) | 12.7 / 23.9 | 18.0 / 23.9 |
| Act above the fold | every width but landscape | unchanged |
| Overflow-x, all widths and states | none | none |

## Round 10: the promise in production

The sentence is no longer the study's alone. Four fields carry it, each in three locales, and they
move together — a reader who signs up on the band, reads the receipt page and then opens the
confirmation mail must meet one promise, not three:

| field | file |
| --- | --- |
| `notice.lede` | `web/src/content/pages/koncerty.yaml` (pl) · `pages.en.yaml` · `pages.fr.yaml` |
| `page.states.confirmed.body` | `web/src/i18n/content/nuntius.ts`, three locales |
| `signup.meta.description` | `web/src/i18n/content/nuntius.ts`, three locales |
| `promise` | `backend/outreach/copy.py`, three locales |

- EN: `We write only about concerts. The date, the place, the programme and every change.`
- FR: `Nous n'écrivons que pour les concerts. La date, le lieu, le programme et chaque changement.`

**The copy desk's drafts had to move in the same pass.** `web/copydesk/drafts/{en,fr}/koncerty.yaml`
still held `One short letter before each concert…` — the exact count this round removes — and a
draft is a mirror of the overlay, not a scratchpad: the next `copy-draft` would have re-proposed the
old promise as if it were a new decision. Both draft rows and the notes above them now state the
scope rule and name the rejected wordings.

**The consent clause is untouched and stays `3.0`.** Frequency was never in `consentHtml`, the
record's purpose (concerts) is what the new sentence states, and `3.0` has not shipped, so there is
no history a bump would protect.

**The lede is shared by four placements** — the band on `/koncerty`, the strip on the landing and
`/kontakt`, and the leaf on `/newsletter` — so the sentence replaced `Zostaw e-mail. Damy znać
o naszych koncertach.` everywhere at once. The imperative it dropped is carried by the field's own
label and the button beside it.

## Round 11: the other placements inherit the blank — REFUSED

**Verdict (developer, 2026-09-17, on the landing's strip at Completorium):** *"You are carrying
/newsletter onto the landing and the other pages too simply. It has no right to exist there:
entirely different tokens, different buttons. On a page of its own it can defend itself; inside
the pages it has to be part of the composition. Take the newsletter as inspiration at the level of
abstraction, never transfer it this literally."* What he saw: a white paper bar with sans-serif
text and an arrow, sitting in a footer whose whole register is Cinzel rubrics with a Latin tier,
hairlines, Cormorant italic links (`napisz do nas`) and the hour clock — one object from another
page laid on top of a composition that already has its own materials. The letter's blank is the
letter's; on `/koncerty` the page's button is the gold pill, on the landing the footer's verbs are
italic serif links, on `/kontakt` the ask is the fourth door beside three doors that have a shape.

**What survives the verdict** (the level of abstraction he asked for): one field and nothing
else — no name, no placeholder; the promise (`notice.lede`) as the placement's only sentence, the
rubric naming the list, `Do zobaczenia.` back on the letter as its sign-off; no "newsletter block"
chrome. **What does not survive:** the paper act bar, the italic `Na adres` label in the letter's
serif, the letter's rule colours — any MATERIAL taken from `/newsletter`. Each placement's ask is
built from its host page's own type, rules and controls, so that removing it would leave a hole
in that page and not a patch.

**State of the tree after this round.** Stage 1 below was implemented and builds (`astro check`
0 errors, `astro build` 49 pages). Of it, KEEP: `NoticeForm.tsx` with one composition and
`placement: "letter" | "band"` (the collapse of `band`/`leaf`/`letter` and the removal of the
name field and the `leaving` phase are right regardless of what the bands look like);
`NoticeSignup.astro` reduced to one branch without `leaf`/`ahead`/`level`; `styles/notice-blank.css`
as the letter's blank, imported by `NoticeLetter.astro` (on `/newsletter` nothing changed
visually — the rules moved, with their values). REJECTED and to be REPLACED: the band and strip
sections of `styles/notice.css` (the `.notice-promise` grade, the flex row, the `--blank-*`
re-pointing on `.notice-inner-strip .notice-form`) and `NoticeSignup`'s import of
`notice-blank.css` — the bands must not mount the letter's object; whether the island's markup
(`notice-blank`, `notice-act-bar`) stays one shape with two skins or the band gets its own markup
is the next session's first decision. `git checkout` is safe ONLY for `notice.css` and
`NoticeSignup.astro` (clean at the start of this round); `NoticeForm.tsx`, `NoticeLetter.astro`,
`notice-letter.css` and `nuntius.ts` carry uncommitted round-10 work and must not be reset.

**The diagnosis below still holds; the thesis that followed it does not.**

**What was wrong.** The band on `/koncerty`, `/koncerty/<slug>`, `/kontakt` and `/404`, and the
strip in the landing's footer, were the 2016–2022 institutional newsletter block: a centred
display line, a lede, a row of *name | e-mail | gold button*, the clause under it — the same
costume the hero wore in rounds 3–5, and for the same reason: no thesis, only a form with a
headline. Three concrete faults. (1) Two fields and a button are a form; the letter settled on one
blank, no placeholder, no name — and with the one-line clause (3.0) the sentence that said what
the name was for no longer exists on screen; `/nuntius preferences` asks for it. (2) `Do
zobaczenia.` is the letter's sign-off; as a band's headline it says goodbye at the moment of
asking, and it is what a reader arriving on `#nuntius` lands on. (3) Centred display over a
centred form is the costume itself.

**Thesis — refused, see the verdict above.** *Every door to the list is the same object: one line
to write an address on.* The placements were to inherit the letter's blank, differing only in
ground and grade. Kept here as the record of what was built and why it failed: a shape carried
across pages is a patch on every page but its own.

```
NUNTIUS · ZAPROSZENIA NA KONCERTY                        rubric, and the landmark's heading
Piszemy tylko o koncertach. Termin, miejsce,             the whole of notice.lede, serif
program i każda zmiana.

Na adres ______________________  [Chcę otrzymywać zaproszenia →]
Adres przetwarza Fundacja VoctFoundation, zgodnie z polityką prywatności.
```

- No new strings. `notice.lede` is the band's only sentence, at the strip's former display grade;
  `notice.h2` stays the letter's sign-off (`letter-signoff`) and leaves the bands.
- The heading of the landmark is the rubric (`Nuntius · <eyebrow>`), set as `h2`: it names the
  list; the promise is a paragraph under it.
- The name field leaves every placement. `subscribeToNotices` keeps its contract and is sent `''`.
- The band is set from the left in a 660px column (the `Nondum` station's own measure). The
  station above it is centred; the change of register is the point — here the page turns from
  reading to writing. If it jars on the developer's screen, centring the voice is one line.
- At ≥780px the blank and the act stand on one line; below it they stack as on the letter.

**Per surface.** `/koncerty`, `/koncert`, `/kontakt`, `/404`: night ground as today, the act is the
letter's paper bar — on the night side the one paper object. Landing strip: the footer's first row,
voice left, blank + act on one line right, and the act follows the hour — the footer inverts
`--paper`/`--ink` along `--nox`, so `background: var(--ink); color: var(--paper)` is an ink bar on
parchment by day and the letter's paper bar at night, in one rule.

**Two findings that changed the plan.** (1) `variant` on `NoticeForm` carried two independent
things: the field's composition (blank vs. row) and whether the page stands alone (receipt with
*edit address* and resend, the mirror onto the sheet, which box to freeze). With one composition
left, the prop is `placement: "letter" | "band"`, and the `leaving` phase — the leaf's exchange
animation — goes with the leaf. (2) `notice.css` is not loaded on `/newsletter`, and `/nuntius`
wears `.notice-email`, `.notice-label` and `.notice-submit` (`NuntiusIsland.tsx`). So the blank
cannot be "moved into" `notice.css` (the letter would lose it) and the base field rules cannot be
deleted (the receipt page would lose them). The blank is therefore its own sheet,
`styles/notice-blank.css` — one object, imported by `NoticeLetter` and `NoticeSignup` — with its
colours on custom properties (`--blank-*`) that default to the night side and that the strip
re-points at the footer's tokens.

**Rejected for these placements.** The room photograph as a band's ground (11–12px type over an
image never holds 4.5:1; `/koncerty` already has the stations' naves). The evening ahead on a band
(on the sheet it is the letter's content; on a band it is a slot). A link to `/newsletter` in place
of the field (on `/kontakt` it was tried and sent the reader two screens into a walk they had not
asked for; the landing is the one screen reached without looking for the list). An input inline in
the sentence (iOS zooms fields under 16px; a wrapping line with an input inside is a lottery).

**Stages** (as planned; stage 1 was built and its visual half refused — see the verdict).

1. *The object and the placements* — built in this round, then refused. `styles/notice-blank.css` (new);
   `NoticeLetter.astro` imports it and `notice-letter.css` loses the blank/act rules;
   `NoticeSignup.astro` to one branch, no `variant="leaf"`, no `ahead`, no `level`;
   `NoticeForm.tsx` to one composition with `placement`, no name state, no `leaving` phase;
   `notice.css` band and strip sections rewritten for the rubric, the promise, the blank row and
   the `[data-sent]` receipt (`.notice-say` hidden instead of `.notice-h2`/`.notice-lede`).
   Verification: `npm run build` in `web/`.
2. *Cleanup* — a session of its own, because `.notice-leaf` is the GROUND of `/nuntius`
   (`NuntiusIsland.tsx`) and the leaf section of `notice.css` (~890 lines) is mostly alive through
   it. Prune only what no longer has a caller, each class grepped against `NuntiusIsland` first:
   `.notice-stage`, `.notice-opening`, `.notice-lines`, `.notice-field-address`,
   `.notice-field-given`, `.notice-proximum`, `.notice-evening-*`, `.notice-runhead` (if the
   receipt does not wear it), `[data-phase]` and the `notice-leaf-lift`/`notice-leaf-settle`
   keyframes (`.notice-row`, `.notice-field`, `.notice-field-name`, `.notice-h2`, `.notice-lede`
   went in stage 1 with the band section). Keep `.notice-label`, `.notice-email`,
   `.notice-submit` and `.notice-error`: the receipt page wears them. Dead chrome keys in
   `NoticeFormChrome`/`nuntius.ts` (`emailPlaceholder`, `nameLabel`, `namePlaceholder`, `submit`
   under `form`) in three locales — `nameLabel`/`namePlaceholder` under `preferences` stay.
   Rewrite the headers of `notice.css` and `NoticeForm.tsx` to the one-composition truth. Then
   the `noscript` fallbacks and `.notice-inner` doc comments.
3. *The register's tally* (`Pięć programów, osiem wieczorów`) — numerals in three locales, a
   session of its own.

## Round 12: each placement in its host's materials — BUILT

**The brief (developer, 2026-09-17):** ideas first, then build as proposed, deciding alone; one
shape may serve several pages and there may be two heights; decide which pages carry the field
and which only a link; *"only not 2019–2020 again — it is the second half of 2026."*

**Decisions.**

1. *One markup, three dresses, by ground — not one dress.* What every placement shares is the
   composition (rubric naming the list → the one sentence → one line to write an address on →
   the act → the clause) and the island's markup. No two placements share a visual rule, because
   no control on this site is global: `.pill` lives in `KoncertyPage`, the capsule `.channel-copy`
   in `ContactPage`, the italic verb in `06-footer.css`. The night pages share tokens, so they
   honestly share one dress; the landing's footer and `/kontakt` are two other worlds and each
   dresses its guest itself. The test each dress had to pass: take it out and a hole is left in
   the page, not the mark of a sticker.
2. *Field on /koncerty, /koncert (while the evening is ahead), the landing and /kontakt; link
   only on /404.* The spec's earlier rejection of "a link instead of the field" was about a link
   to `/koncerty#nuntius`, two screens into a walk; a link to `/newsletter` lands on the letter's
   first screen, so it is back on the table — and on the vacat leaf the footer's own `Nuntius`
   stanza already IS that link, one screen down, so the band there was two doors to one list on
   one short page and the second was an object from another page. Band removed; the hero takes
   `min-height: 100svh` back so the footer does not float.
3. *Hollow `.pill`, never gold.* `.pill-gold` is documented on its own page as "the Via's one call
   to give"; a list signed up for in gold reads as a purchase.
4. *The key stands ON the line's baseline, in every dress.* The first render put it above the
   line (`.station-meta` over its text) and the empty input's height hung it 50–55px over the
   rule, which made the line read as a separator — round 8's finding, repeated. The label on the
   baseline with the rule running on from it is the letter's shape at the level of abstraction
   the verdict allowed, in each host's material.
5. *Not a box.* The first proposal set the night field as a bordered box at pill height with the
   key inside; dropped before building, because that is Material's outlined text field (2018)
   and exactly the "2019–2020" the brief named. A key on a hairline in the page's serif is the
   editorial idiom of now.
6. *The night band's column is 760, not the `Nondum` station's 660.* Key, line and pill share a
   row; in 660 the line between them was 219px, sixteen characters of an address. The station
   above is centred, so nothing was aligned to 660.

**The three dresses.**

- *Night band* — `styles/notice.css`, loaded by `NoticeSignup`; `/koncerty` under the last
  station, `/koncerty/<slug>` while `unsung`. Rubric = the site's two-tier eyebrow. Promise =
  `.station-essence` (italic serif 19–26px, 92% paper, 42ch, weight 300 for the ink press).
  Row = `ADRES E-MAIL` in `.station-meta`'s capitals on the baseline · a hairline in the pill's
  ink (`rgb(244 241 233 / 0.4)`, candle on focus) carrying the address in serif 20–24px · the
  hollow `.pill` restated (capitalis 10.5px, border 40%, candle fill on hover). Clause in sans
  12px at 60%. Under 560px the pill drops to its own row, left-set.
- *Landing strip* — `styles/landing/06-footer.css`, "NUNTIUS — pas zapisu"; `.notice-strip`
  over the footer's head, in the footer's measure to the pixel. Rubric = the stanza label
  (`· NUNTIUS zaproszenia`: dot first by flex `order`, Cinzel 11.5 in `--candle-text`, mono
  gloss). Promise = italic serif 18–22px, `--ink`. Row = the registry's key/value
  (`.foundation-legal`: mono 9px key on the baseline, value on a `--line-strong` hairline) with
  the address in upright serif 18–21px (the house's verbs are italic; the reader's hand stands
  upright) · the act as the Vox verb (`.foundation-vox-list a`: italic serif, 22% underline that
  redraws from the left, `--candle-text` on hover, no arrow). Clause = the RODO line (mono
  10.5px, links darker than the prose). Voice 1.5fr beside form 2.9fr from 900px; stacked below.
  Every colour is a `--nox` token, so the strip turns with the hour in one rule; the refusal
  colour is mixed on the same axis. Layout rules carry `:not([data-sent])` because the receipt
  centres `.notice-inner[data-sent]` at the same specificity.
- */kontakt door* — `ContactPage.astro`'s own `<style>` through `:global()`; `.notice-door` on
  the page's parchment where the dark inset stood (the inset was round 11's mistake in another
  coat: a foreign ground). Rubric = the page's eyebrow, gold as ink. Promise = the intro's
  italic a step down. Row = a `.channel` (hairline over and under): `ADRES E-MAIL` at the seat
  band's datum grade on the baseline · the address in `.channel-mail`'s serif (22–34px) on a
  `--line-strong` hairline · the act as the `.channel-copy` capsule in `--candle-ink`, filling on
  hover — the control that copies an address on three doors sends one on the fourth. Clause at
  `.channel-hint`'s grade. Not inside `Tres ianuae`: those are three ways of writing TO us, and
  a fourth under that count would be false.

**Island.** `NoticeForm.tsx`: the act is `.notice-act` (the letter's sheet renamed with it); the
arrow renders only for `placement="letter"` — no host draws arrows on its controls; the label
prints `Na adres` + sr-only field name on the letter and the plain `Adres e-mail` on a band.
`NoticeSignup.astro`: no `variant`, no `notice-blank.css` import; the rubric is three spans
(`.lat`, `.notice-rubric-dot`, `.notice-rubric-gloss`) so the footer can put the dot first.
`notice-blank.css` is the letter's alone (header rewritten). `notice.css` lost its strip section
and its header now says what it is. `/newsletter` unchanged visually.

**Rendered** (`vm-shot\notice-r12.cjs` — element-region shots at 1920/1440/390 from `astro
preview`, both plates of the landing forced through `data-lumen`; `notice-r12-sent.cjs` — the
receipt with the endpoint stubbed): the band, the strip by day and at night, the door, typed and
sent. Traps the harness met: the landing's entrance rite is a fixed overlay with a scroll lock
(remove `.preloader`, drop `preload-open`/`threshold-open`); the hour is real, so at 23:30 the
"day" shot was night until the attribute was forced; `getComputedStyle().fontFamily` reports the
declared face, not the loaded one — a 1440 shot showed the promise in the fallback serif while
the numbers said Cormorant.

**Left open.** The developer's verdict on the three live pages. Stage 2 (the `.notice-leaf`
prune) and the tally remain their own sessions. `web:404` stays in the surface allowlist with no
form behind it — harmless, prunable with stage 2.

## A note on the renders

`out-g3\` before this round held two runs six minutes apart — a full one and a `quick` one — so
most widths carried pre-fix shots while the spec's table quoted the three that had been re-shot.
Every render in `out-g3\` is now from one full run, and `measurements.txt` is that run's stdout.
Redirect the harness to the file; it does not write it itself.

## Round 13: the landing's ask leaves the footer — BUILT, REFUSED, AND THE BRIEF THAT REPLACES IT

**Status: the tree holds this round's code and it builds clean. It is NOT approved.** The developer
asked for an independent assessment in a fresh session before anything else is drawn. Do not
"fix the findings" of this section one by one — that is the loop Round 5 recorded.

### The verdict that opened the round

On the three dresses of Round 12, on the live pages: *"It is not, at the moment, the level of the
best web design in the world in 2026. In every version it looks a bit idealess, shoved in because
we want a newsletter so it had to go in. I would like it to be interesting, fitted to the page, and
inviting to fill in — but by design, not by text."* And: start with the landing, then the rest.

### The diagnosis this round acted on

The fault was read as one of PLACE, not of skin. All three placements stood after their page had
finished speaking: on /koncerty after the last concert, on /kontakt after the board, on the landing
literally after the coda's finalis. The landing had argued the form out of every position that
means anything — the register's own comments say *"a LINK, not a form: the address is taken on a
page built for it"*, the coda's say *"do not take its last breath away"*, and the offering band had
just asked for money — so what was left was the hallway past the end. Round 12 heard *"it must be
part of the composition"* as *"use the host's materials"*; the materials arrived, the composition
did not.

### What was built (two takes, both in the tree's history of this session)

1. **The register's last row.** The ask moved out of the footer and into `PathSection` as an undated
   final line of the register, built from `.path-ahead`'s anatomy: rubric tier, the address on a
   display-scale line with the field's key on its baseline, the act on the measure's right edge,
   the clause as fine print. Refused on sight: *"you cannot see it at all, it is the easiest thing
   to skip; the button does not look pressable; and it drives into the nearest concert."*
2. **The ribbon in the left margin (what the tree holds now).** From the developer's own image — *a
   half-hidden bookmark on the left, always there, sliding out as you come near its height and back
   as you move away.* Built as `.path-nuntius`: a panel of lighter stock with a gold binding edge
   and a vertical two-tier rubric on its tail, placed by hand into the register grid's first column
   (`align-self: end`, so its foot lands on the register's closing rule), laid back across the page
   gutter by `--path-gutter` and drawn by `animation-timeline: view()` — tucked at both ends of the
   range, held out across its middle, cancelled outright on `:hover`/`:focus-within`. Ungated it
   simply rests drawn; below 981px the margin does not exist and it becomes a panel at the
   register's foot. The act finally wears a real capsule, which a register row could never give it.

### The standing brief for the next session (developer, 2026-09-18)

- **Much more ambition, in the animation AND in the composition.** This is the whole point. Neither
  take had it.
- **Let it in much wider** — the ribbon as built is a 460px panel in the margin; he wants the thing
  to come in far wider (*"or possibly narrower"* — the current width is simply the wrong answer).
- **Lower: under the nearest concert.** Not beside the register's foot, under the announced evening.
- **Inviting by DESIGN, not by copy.** The wording is settled and is not the lever.
- Sticky was considered and is NOT what he means: nothing follows the reader. The object stands in
  one place in the document and answers approach.

### What must not be proposed again

Everything in Rounds 11 and 12's refused lists, plus: the ask standing after the coda; the ask as a
row inside the register; a bare word under a hairline as the act (*"does not look pressable"*); and
"the same object on every page", which is Round 11's verdict and still holds — the landing's answer
does not transfer to /koncerty or /kontakt, which are still on Round 12's dresses and still unjudged.

### The tree, precisely

- `landing/PathSection.astro` — mounts `NoticeSignup` as `.path-nuntius` with the spine; the open
  card's second link to the list is gone (one ask per card).
- `landing/04-rooms-interludes.css` — the ribbon's dress, `--path-gutter`, `@keyframes path-ribbon`;
  the register's closing rule is back on `.path-ahead`/`.path-next` where it was.
- `landing/07-responsive.css` — below 981px the three grid items return to the flow and the ribbon
  becomes a flat panel.
- `landing/06-footer.css` — the `NUNTIUS — pas zapisu` block (338 lines) and the strip's share of
  the `--nox` axis are DELETED. If the landing's ask ever returns to the footer, it is written
  again from the footer's materials; it is not restored from git.
- `LandingPage.astro` — no section between the coda and the footer.
- `NoticeSignup.astro` — new `level` prop (2 | 3) so a host can say what the rubric's outline level
  is. `NoticeForm.tsx` untouched but for two header lines.
- Harness: `C:\Users\kryst\vm-shot\notice-r13.cjs` against `astro preview` :4321. **Its scroll math
  is wrong and must be fixed before it is trusted** — it computes a scroll position from the
  element's document offset, and Lenis plus the page's pinned scenes land somewhere else entirely.
  Drive `view()` animations by `el.getAnimations()[0].currentTime = CSS.percent(n)`, never by
  scrolling to a computed y. (`currentTime` in ms throws on a scroll-driven timeline — memory.)

## Round 14: LINIATURA — the register goes on, unwritten — BUILT

**Status: in the tree, uncommitted, built and rendered; awaiting the developer's eye.** The thesis
was named in an independent assessment session and approved by him before anything was drawn.

### The assessment that closed Round 13

On the ribbon, rendered rather than reasoned about. Four findings, none of them matters of taste:

1. **At rest the ribbon showed the wrong 72px.** `.path-nuntius-spine` was the flex row's first
   child — the left edge — while `translateX(calc(-100% + var(--ribbon-tail)))` leaves the RIGHT
   edge on screen. At 1920 the spine sat at x −387…−315, off screen; what showed was the panel's
   own right edge, a form sliced vertically (a fragment of the capsule, the orphan `…nie` of the
   clause). The bookmark never said NUNTIUS in the state a reader spends all their time in. The
   CSS comment claimed the opposite and had always been wrong.
2. **`view()` bound to the animated element's own box makes "answers approach" identical to
   "slides in on entry".** With h 326 against a 1000px viewport the ribbon was fully drawn at
   `cover 28%` — exactly when it was fully visible — and began tucking at 73%, as it left. That
   is AOS `fade-left` written in a newer syntax. A real answer to approach needs a subject other
   than the animated element.
3. **`.path-nuntius` was the only bordered, filled rectangle on the landing.** Every other border
   in `styles/landing/*.css` is `999px` or `50%` — the chrome's pill, the dots. The page is built
   from hairlines and open type, so a rectangle on it is a sticker whatever tokens paint it. Round
   11's verdict, one level down: then the materials were foreign, now the geometry was.
4. **The act was an inscription pretending to be a button.** The capsule was set in Cinzel, which
   `base.css` reserves for the Latin voice — rubrics, numerals, inscriptions — and whose own
   `.audio-toggle` comment says a stateful mechanism stays on the mono because it is "a mechanism,
   not an inscription". That is the mechanical reason "the button does not look pressable" survived
   being given a shell.

### The thesis

> **The register does not end — what is already known does. Under the announced evening the page
> stays what it has been, ruled paper, with nothing written on the lines yet. The reader writes the
> first of them.**

### What follows from it, and what was built

- **Place.** Inside `.path-body`, directly under `.path-ahead`'s closing candle rule, still inside
  movement II, before the `III · SUSTINETE NOS` marker. Measured: at 1920 the field is at x 667,
  the same left edge the announcement takes; `.path-ahead`'s foot is at y −8 when the field is
  centred. Under the nearest concert, as the brief asked.
- **Measure.** The register's own, 1083px at 1920 / 895 at 1440 — not the margin, not a panel. The
  rail column stays empty beside it, which is the register's existing mark for what has not
  sounded. No fill, no border: the field is the page, not an object on it.
- **The act is a door by SCALE, not by a shell.** Cormorant upright at `clamp(21px, 1.85vw, 29px)`
  on a persistent `--candle-ink` hairline with the page's own arrow (`content: "\2192"`, the
  `.primary-link` idiom), on the measure's right edge with the clause on its left — the
  announcement's own two-edge gesture repeated. Upright against the ensemble's italic: the house's
  verbs lean, the reader's hand stands up. Gold as ink, never as fill.
- **The motion is the RULING, and the scroll is its clock.** `view-timeline-name: --liniatura` on
  the field; the four empty lines below the form reference it and each draws from the left across
  its own window of the field's passage (`cover 16→28%`, `23→34`, `30→40`, `36→47`). Nothing
  translates, nothing is sticky, nothing follows the reader, and the cascade reverses on the way
  back up. Measured at 1920: `0/0/0/0` a screen above, `100/100/63/3` on approach, all four ruled
  by the time the field is centred. **The ruling is spent before the reader stops**, deliberately —
  ranges that ran past centre left a hairline frozen a quarter drawn while someone typed, which
  reads as a rendering fault rather than as paper.
- **Ungated, the paper is simply ruled.** The lines are real borders; only under `@supports
  (animation-timeline: view())` and `no-preference` is the border blanked and handed to a
  pseudo-rule. Verified: the reduced-motion render is the settled render.

### The one policy this round bends, and why

`styles/registers.css` states that no hairline was ever added to have something to animate — "every
one is a border the layout already carried", and inventing lines for the effect is the showreel move
that register exists to make unnecessary. The four empty lines are new hairlines. They are kept
because the policy is about DECORATION and these are the section's SUBJECT: they carry the argument
for handing an address over, they are present with JavaScript off and motion declined, and they are
ruled by distance rather than by a trigger. **If they ever stop being the subject they should be
deleted, not handed to `.reveal-rule`.** Flagged here so the next reader judges it rather than
inherits it.

### The tree

- `landing/PathSection.astro` — `.path-nuntius` and its spine are gone; `.path-liniatura` (an
  `aside` carrying `bandAria`) mounts `NoticeSignup level={3}` and the `aria-hidden` void of four
  lines, inside `.path-body` after `.path-ahead`.
- `landing/04-rooms-interludes.css` — the ribbon's ~420 lines replaced by the liniatura's dress and
  its ruling; `--path-gutter`, `--ribbon-tail`, `@keyframes path-ribbon` and the by-hand grid
  placement of `.section-label`/`.path-body` are gone with it.
- `landing/07-responsive.css` — the ribbon's ≤981px block deleted. The liniatura needs none: it
  lives inside `.path-body` and follows the grid's own collapse. It has its own ≤720 rule (the act
  above the clause, both left-set) and ≤560 rule (the key comes down a step so the address keeps
  its line: 218 → 234px at 390).
- `NoticeSignup.astro`, `NoticeForm.tsx` — header comments only; `level` and `placement` unchanged.
- Verification: `npm run build` clean (49 pages), `npm run check` 0 errors, `npm run test:audit`
  24/24, register audit clean. Harness `C:\Users\kryst\vm-shot\notice-r14.cjs` (+ `-sent.cjs` with
  the endpoint stubbed) against `astro preview` :4321 — **no computed scroll targets**: the field is
  reached by `scrollIntoView` and walked in real pixel steps, and the ruling is read back off
  `getComputedStyle(line, "::before").transform`.

### Left open

- The developer's eye, on the live page.
- **The receipt leaves ~300px of air under it.** `.notice-inner[data-sent]` freezes the box so the
  ruled lines do not leap when the form is replaced (measured: 331px → 331px), and the receipt is
  top-set inside it. The freeze is right; whether the receipt should sit centred in that box is a
  judgement, not a defect.
- `/koncerty` and `/kontakt` are still on Round 12's dresses and still unjudged. **The liniatura
  does not travel** — it is the register's figure. What travels is the grammar: the ask stands where
  the page's own material runs out, not after the page has stopped speaking, and its act is sized
  like a door in that page's own scale. `/koncerty` has the landing's old fault (a band after the
  last station); `/kontakt`'s fourth door is inside its page's argument and may survive as built.
- Stage 2 (the `.notice-leaf` prune) and the register's tally remain their own sessions.

## Round 15: the liniatura made honest — one pitch, a seal, the receipt on the lines — BUILT

**Status: in the tree, uncommitted, built (49 pages, register audit clean), `astro check` 0 errors,
`test:audit` 24/24, rendered at 1440 and 390 in four states; awaiting the developer's eye.** The
developer opened the round with *"this is not the peak of what can be done in 2026 — assess it
yourself, ignore the prohibitions, free hand."* Round 14's thesis stands; its execution did not.

### What was wrong with Round 14, rendered

1. **The metaphor was not in the picture.** The field's rule began after the key (x 597), the
   empty lines at the measure's edge (x 473); the lines' pitch (63px) had no relation to the field
   row (48px); 87px of unruled air stood between the act row and the first empty line. A stranger
   saw a form and four separators after nothing — an unfinished table. "The reader writes the first
   line" existed only in the CSS comment.
2. **Two underlines competed.** The field's rule and the act's rule ended on the same right edge
   72px apart, both under ~30px Cormorant. The act read as a second, shorter field — the mechanical
   reason "does not look pressable" survived a fourth round.
3. **No centre of gravity.** 647px of section, 48px of content, eight elements of one weight.
4. **Nothing answered the hand** beyond a gold focus hairline; the act was as open at an empty field
   as at a written one.
5. **The one animation was spent before it could be seen** (ranges ending at cover 47%).
6. **The receipt abandoned the figure**: the form vanished in a frozen box and the lines stood by.

### What was built

- **One ruled sheet, five lines, one pitch (`--lin-pitch`), one measure.** Row 1: the key on the
  baseline and the address, the rule under the WHOLE row from the measure's left edge. Row 2: the
  clause on the left end, the act on the right, both standing on the second rule. Rows 3–5: empty,
  ink receding 70/48/30% of `--line-strong`. `.notice-form` is a two-row grid with authored areas;
  row 2's rule is the form's own `::after` (a border on each of the two things standing on it would
  break at the gap); row 1's is `.notice-blank::after` so focus can thicken it (2px, ink) without
  moving anything.
- **The act is a seal on the line.** The verb in upright Cormorant at a step under the address's
  grade, NO underline, and after it the page's one round control — the hairline circle with a glyph
  that closes the vault and the lightbox — carrying the arrow. It **inks the moment the address is
  well-formed** (`.notice-blank:has(.notice-email:valid) ~ .notice-act::after`; `required` added to
  the field in `NoticeForm.tsx` so `:valid` means "written", the form stays `noValidate`). Hover
  inks the hairline; focus rings the seal in `--candle-ink`. Ink fill, never gold: the vault is
  the page's one call to give.
- **The receipt is written on the same lines.** The rubric and the promise STAY (the night band
  hides them; here the promise is one italic line and still true). Title with the ✦ set into it,
  body, hint take three ruled rows; `.path-liniatura:has([data-sent])` puts the first empty line
  out. Measured at 1440: rules at 419/494/569/644/719 before, 419/494/569/644/719 after — **no rule
  moves**. Lines write in one after another (opacity only, `no-preference` gated). Two overrides
  were needed against `notice.css`: the receipt's margin keyed on `[data-sent]` (that sheet zeroes
  it at 0,3,0) and `max-width: none` on body/hint (a capped paragraph is a short rule).
- **The ruling lands as the block is centred** (windows 20→33, 28→41, 36→50). Measured: 45–59/0/0
  at −320px, 100/100/100 centred.
- **Air:** section 647 → 538px at 1440; margin above `clamp(56px, 6vw, 100px)`; say → sheet
  `clamp(28px, 3vw, 44px)`.
- **Phone (≤720):** one column, rows blank / error / act / clause, each ruled (the clause's
  `border-top` is the act row's foot); the refusal comes into the flow because the act row has no
  air above the seal. ≤560 the key steps down as before.

### The tree

- `landing/PathSection.astro` — three empty lines, not four; header and liniatura comments.
- `landing/04-rooms-interludes.css` — the liniatura block rewritten (grid rows, seal, receipt on
  the lines, ruling windows).
- `islands/landing/NoticeForm.tsx` — `required` on the address field; one header line.
- Harness: `scratchpad/peek2.cjs` this session (rest / approach / written / sent, one width per
  run; endpoint stubbed by `page.route`). Fold into `vm-shot\notice-r15.cjs` if kept.

### Left open

- The developer's eye. **How exposed should the ask be on the landing?** The round's author
  proposed keeping its volume and adding an earlier link. That was a recommendation, not an
  accepted decision; the strategic review below challenges its premise. Neither proposal is built.
- The seal's arrow is Cormorant's `→` optically centred by hand (`padding-bottom: 2px`); check on
  a Retina display.
- `/koncerty` and `/kontakt` unchanged, still on Round 12, still unjudged. Stage 2 prune and the
  tally remain their own sessions.

## Strategic review after Round 15 — 2026-09-18

Status: **Recommendation, not approved or implemented.** Based on the developer's desktop
screenshot and source inspection; mobile and motion were not visually reassessed. Product code
is unchanged. Round 15 remains the implementation in the working tree.

- **Role:** make invitations a prominent next action for interested listeners who cannot attend
  the announced concert. Preserve the ensemble's introduction and the separate patron journey.
- **Exposure:** an earlier, explicit invitations link and a stronger destination solve different
  problems. Placement alone does not resolve the destination's weak hierarchy.
- **Diagnosis:** the promise reads as supporting copy; the empty field contributes little visual
  weight; the action sits far from the field's starting point; the unwritten rows occupy more
  space than their meaning earns in the supplied image. The register metaphor is optional for
  comprehension: joining the list must be obvious without reading its design rationale.
- **Direction:** retain the location, type family and open ruled composition. Give the benefit
  a real headline, bring the field and action into a tighter visual group, make the action clear
  before a valid address is entered, and reduce the empty ruling unless it earns its space in
  the whole-page composition. Keep the stable receipt and useful interaction feedback.
- **Decision boundary:** exact copy, dimensions, line count and earlier link placement remain
  design work. Existing aesthetic prohibitions are hypotheses to reassess, not user decisions.
  No conversion improvement is established by this review; assess visibility and completed
  double opt-ins separately if measurement is added later.

## Round 16: the sheet gets a headline, the act stands on the written line — BUILT

**Status: in the tree, uncommitted, built (49 pages, register audit clean), `astro check` 0
errors, `test:audit` 24/24, measured at 1920/1440/1200/390 in rest / written / sent; awaiting the
developer's eye.** Approved from the design below with "do what you propose, decide yourself", then
amended twice by the developer during the build — see **Built, and what changed on his word** at
the end of this section, which is the record of the tree; the design text is kept as the reasoning.
The design keeps the landing's composition as the review directed — the place (under
`.path-ahead`, inside movement II), the register's measure, the type family, the open ruled sheet,
the stable receipt, the seal that inks on a written address — and changes the sheet's hierarchy in
four places.

### Three premises of the review, checked against the tree

1. **An earlier link already exists.** `ProximumSection` prints `invitation.cta` ("Otrzymuj
   zaproszenia") as `.proximum-notice` — 11px capitals at 60% paper, a quiet door under the
   announced evening, in section 2 of the landing. It points at `/koncerty#nuntius`: two screens
   below that page's head, on Round 12's unjudged band. `SiteFooter.astro` already states why that
   target is wrong for a reader who has not walked the cycle. The "earlier link placement" question
   is therefore a retarget, not a new element.
2. **The empty ruling cannot go to zero without a second mechanism.** The receipt takes three rows
   and the form two; the "no rule moves" invariant needs one empty line to put out. With ONE line
   the block is Round 14's finding 1 again (a separator after nothing). Two is the floor at which
   the lines still read as ruled paper and the receipt still lands without a pixel moving.
3. **A headline at the register's title clamp (32–64px) would stand 300px under the announced
   evening's name at the same grade.** The ask must not outrank the evening. The headline takes
   the step below.

### The design, in reading order (desktop, two-column sheet)

- **Rubric** — unchanged: `Nuntius · zaproszenia`, 11px capitals, gold dot. Rendered as a `p`
  eyebrow once a headline exists; the heading moves to the headline.
- **Headline** (`h3.notice-head`, new): upright Cormorant 300 with `.ink-press`,
  `clamp(28px, 3.1vw, 46px)` (44.6 at 1440, 46 at 1920), line-height 1.08, `--ink`,
  `text-wrap: balance`, full measure, `margin-top: clamp(12px, 1.2vw, 18px)` under the rubric.
  One sentence, one line at 1440 and 1920.
- **Promise** — the same sentence (`notice.lede`), demoted from the block's largest text to its
  supporting line: Plex Sans upright, `clamp(16px, 1.25vw, 19px)`, `--ink-soft`, line-height
  1.55, `max-width: 46ch`, `margin-top: clamp(10px, 1vw, 14px)`. It drops `.ink-press` (the
  headline carries it — the audit's 300-rest rule follows the class) and keeps `.reveal`.
  Cormorant at 17–21px as running text is the wedding-invitation register the letter refused
  (memory, Round 7); the sentence is text now, so it takes the text face.
- **Air say → sheet:** `clamp(24px, 2.6vw, 40px)` (from 28–44; the headline now carries the
  weight the air was standing in for).
- **Row 1 — the written line, and the act ON it.** Grid areas `"blank act"`: the key (11px
  capitals, on the baseline) and the address (Cormorant 300, `clamp(21px, 1.9vw, 30px)`) on the
  left, the act on the right edge, `align-items: end`, column-gap `clamp(24px, 2.6vw, 40px)`.
  Rule 1 becomes `.notice-form::before` at the row's foot — full measure, because two things now
  stand on it; focus thickens it through `.notice-form:has(.notice-blank:focus-within)::before`
  (2px, `--ink`), invalid reddens it through `:has(.notice-email[aria-invalid="true"])`.
  The key, the address and the seal are one group on one line: writing ends where the act is.
- **The act, clear before anything is written.** Verb `chrome.commit` unchanged (it is the
  consent-bearing verb; one wording everywhere), upright Cormorant at **400**,
  `clamp(17px, 1.4vw, 21px)`, `--ink`; gap to the seal `clamp(10px, 1vw, 14px)`; seal
  `--lin-seal: clamp(38px, 2.8vw, 44px)`, its foot 6px above rule 1. **At rest the ring is
  `1px solid var(--ink)` with the arrow in `--ink`** — a drawn control in the page's own
  circle-with-glyph idiom, not a `--line-strong` ghost. Written-and-valid: fill `--ink`, arrow
  `--paper` (Round 15's answer to the hand, kept). Hover in either state: `scale(1.06)`. Disabled:
  opacity .55, `cursor: progress`. Focus: 2px `--candle-ink` outline, offset 4px.
- **Row 2 — the clause alone**, left, on rule 2 (`.notice-form::after`, as now), padding-measured
  to 52ch. The refusal stays absolute at `top: calc(var(--lin-pitch) + 8px)` over the clause's
  air.
- **Two empty lines**, `--lin-pitch` each, inks 58% and 34% of `--line-strong`. Ruling windows
  retimed for two: `cover 22→36%` and `32→48%`, the second landing as the block is centred —
  measure, do not trust the numbers.
- **Receipt** — unchanged: title with ✦ at the address's grade, body, hint on three ruled rows;
  the first empty line put out; rules before and after must match at 1440 AND 1920.
- **Pitch** `clamp(58px, 5.2vw, 78px)` unchanged; the seal (≤44px) clears it with the address's
  descent. Section height at 1440 ≈ 548px (Round 15: 538) — the same volume, with the weight in
  the headline instead of in air.

### Copy

- **Headline (PL, primary):** `Zaprosimy Cię na kolejne koncerty.` — a benefit in the reader's
  direction, the list's own word (zaproszenia), plural and open-ended so it does not collide with
  the evening announced 300px above it (which `invitation.line` — "Napiszemy przed następnym
  Koncertem Duchowym." — would, exactly as `ProximumSection`'s comment says it does there). No
  negation, no numeral, no "każd-" doubling the promise's "każda zmiana". Lives in
  `landing.yaml` under `register` (`noticeHeadline`), typed in `i18n/content/landing.ts`, EN/FR
  through the desk (`make copy-draft → copy-check → copy-apply`; drafts mirror the overlay —
  `[[reference_copydesk_run_traps]]`). Round 13's "wording is not the lever" was said of the
  existing sentences; a headline tier with nothing to set in it is not a design, so this is one
  new sentence and nothing else changes.
- **No-new-copy fallback**, if the developer keeps Round 13's line: promote `notice.lede` to the
  headline tier as-is (two sentences, two lines at 1440) and print no supporting line. Weaker —
  "Piszemy tylko o koncertach." headlines a restriction, not a benefit — but built from settled
  words.
- Rubric, clause, verb, receipt: unchanged.

### The narrow sheet

The two-column row needs ≈780px of measure (key ~141 + act ~337 + twenty characters of address).
That is ~1260px of viewport, so the switch is made on the **measure**, not the viewport:
`.path-liniatura { container-type: inline-size }` and `@container (max-width: 799px)` → one
column, rows blank / error / act / clause, each ruled; the act left-set with the seal beside its
verb; the clause's `border-top` as the act row's foot (Round 15's ≤720 layout, promoted to a
container rule and one breakpoint). **The put-out of the first empty line applies only in the
two-column layout** — stacked, the form is three rows and the receipt three, so nothing is put
out. Round 15's global put-out moved the rules by one pitch on the phone; this is the fix.
`≤560px` keeps the key's step-down.

### The earlier door

`ProximumSection.astro` `hrefNotice` → `localizePath("/newsletter", lang)`. One line. The reader
at the announcement who wants invitations lands on the page built to be told out loud, on its first
screen — the strongest destination on the site, and the footer's own target for the same reason.
No third door on the landing; no same-page anchor (an in-page jump across Lenis and the pinned
scenes is unverified and there is nothing it would beat). `ConcertPage.astro:174` has the same
target and the same argument, but is not the landing — its own session.

### Refused from the review, kept from Round 15

- Empty lines to zero or one (above). A shell, capsule or rectangle for the act (Round 14's
  findings 3 and 4 stand: the page has no filled rectangles and Cinzel is not a mechanism's face).
  A headline at the title clamp. Moving the block. Touching the verb or the clause.
- Kept: the place, the measure, one pitch, a rule under every row, the seal inking on `:valid`,
  the receipt on the same lines, the ruling as the scroll's clock, ruled paper as the ungated
  state.

### The tree, when this is approved

- `web/src/content/pages/landing.yaml` — `register.noticeHeadline` (PL); the EN/FR draft files in
  the same pass, then the desk targets (needs a clean tree — commit Rounds 15 and 16 first;
  `copy-sync` refuses a dirty one).
- `web/src/i18n/content/landing.ts` — the field on `LandingCopy["register"]`.
- `web/src/components/NoticeSignup.astro` — optional `headline?: string`; when given, the rubric
  is a `p`, the headline is the `Rubric`-level heading with `reveal ink-press`, the promise keeps
  `reveal` and loses `ink-press`. Header comment: the heading is the rubric ONLY where no headline
  is given.
- `web/src/components/landing/PathSection.astro` — passes the headline; the void has two lines;
  the liniatura comment says row 1 = key · address · act.
- `web/src/styles/landing/04-rooms-interludes.css` — the liniatura block: headline and promise
  tiers, `"blank act" / "clause clause"`, rule 1 on `.notice-form::before`, the act's rest ring,
  the seal's size, the container rule, two lines and their windows, the scoped put-out. Header
  comment rewritten to the new truth, not annotated with the change.
- `NoticeForm.tsx` — nothing: the act is already `.notice-blank`'s sibling and the grid places it.
- Harness: `vm-shot\notice-r16.cjs` from this session's `scratchpad/peek2.cjs` — 1440, 1920 and
  390; rest / approach / focus / written / sent; rule y-positions read before and after send.
- Verification, once: `npm run build` (49 pages, register audit), `npm run check`,
  `npm run test:audit`; rules equal before/after send at 1440 and 1920; row 1 never wraps at
  ≥1260; the stacked sheet at 390 in four states.

### Built, and what changed on his word (2026-09-18)

Everything in the design above is in the tree as specified — headline, promise in Plex Sans,
act on the written line, ink ring at rest, two empty lines, container-query fold, scoped put-out,
Proximum → `/newsletter` — with the EN/FR headline written straight into `pages.en.yaml` /
`pages.fr.yaml` AND the desk drafts (`copydesk/drafts/{en,fr}/landing.yaml`), so the next
`copy-draft` proposes nothing for the key. Two things he changed on seeing the first render:

1. **The sheet leaves the register's axis.** His call, against the design's "keep the place": *"it
   is hard to see there is a field there"*, then *"move it to the left, keep the length, start
   where `Z drogi` starts."* The author's counter — run it to the right edge as well, because rules
   ending mid-page are the one unanchored edge on a page built from edges — was built, shown, and
   refused: *"full width will not work; this is designed for a shorter block, you cannot just
   enlarge it."* So: `.path-liniatura` is the `.section-grid`'s SIBLING (not its item — a grid row
   would inherit the column gap as air and the label's sticky range), `width: min(1580px, 100%)`
   centred like the grid, and it pays the rail column and the gap as `padding-right` computed from
   the grid's own template (`(G − gap) × 0.32/1.32 + gap`; `--section-gap` hoisted onto `.section`
   in `02-hero-sections.css` so both read one value). Measured: left edge 170 = `Z drogi`'s at
   1920, 72 at 1440; address width 613/443 — identical to the in-column build, so the block keeps
   the length it was drawn for. Below 980 (one column) the padding is zero (`07-responsive.css`).
2. **The field is marked by a dotted leader, not by text.** His first idea for the same complaint
   was animated text in the field — typing and erasing, or cross-fading — *"what are the 2026
   trends?"* Refused by the author with three reasons that stand: he refused a placeholder himself
   on the letter (Round 7); a machine writing the reader's line first contradicts the sheet's
   thesis; rotating prompts are a live 2024–26 pattern only where each text is a candidate INPUT
   (AI prompt boxes) and an email field has exactly one thing to type. What is built: under the
   address only, while the line is unwritten and unfocused, the row's rule is a dotted leader —
   `"Adres e-mail ………………"` — a 1px ink line masked to 2px dots (`repeating-linear-gradient`
   mask) over a paper-coloured cover that hides the hairline beneath; under the key and under the
   seal the rule stays solid. Focus or any written character fades both layers out (0.45s) and the
   solid, inked rule is what remains. The island prints `data-blank` on the empty input
   (`NoticeForm.tsx`) — the honest form of the `:placeholder-shown` trick for a field that has no
   placeholder; autofill reaches `onChange` on a controlled field, so the mark goes with it.
   **If the dots read too quiet on his screen, the one motion that says "type here" without
   writing for the reader is a resting caret at the line's start — offered, not built.**

Measured after both changes (`vm-shot\notice-r16.cjs`, `astro preview`): rules before → after
send identical at 1920 (14100/14178/14256/14334), 1440 (13340/13415/13490/13565) and 1200 folded
(five rules, nothing put out). At 390 the first two receipt rules land on the form's; the THIRD is
6px higher — the clause wraps to two lines, the hint to three, and both rows are content-sized
above the pitch. Phones only; noted, not fixed. Row 1 at 1200 folds (content 745 < 800) as
designed; the developer's ~1915 is two-column. Leader opacity 1 at rest, →0 on writing; the seal
ring reads `--ink` at rest and fills on `:valid`. Section height at 1440: 498px (Round 15: 538).

### The ruling runs to the edge; the writing does not (2026-09-18, his second look) — BUILT

On the built sheet he saw what change 1 had left: *"something is missing on the right"* — the
rules stopping at 1253 under a register whose every row ends on 1750. He reopened full width. The
refused full-width build had stretched the WRITING with the rules (a 1000px address, the act a
screen from its key), and that is what "designed for a shorter block" was about; the rules were
never the problem. So the third shape: **every rule runs from the section's left edge to the
register's right edge, and the writing keeps the measure it was drawn for.** Ruled paper is ruled
to its margin whether or not the hand reached it. The act still stands where the pen stops, at
1253, with paper after it. Nothing of the writing moved: address 613/443, headline one line,
promise 46ch, fold at the same width, rule positions before/after send identical
(14100/14178/14256/14334 at 1920).

Mechanics. `.path-liniatura` keeps its `padding-right` (the container's content box is still the
writing, so the fold is untouched) and each ruled row bleeds into it: `.notice-form` takes
`margin-right: -tail; padding-right: tail` (rules are the padding box's pseudo-elements, the grid
lays out in the content box); the receipt's `p` rules moved from `border-bottom` to an `::after`
drawn `right: -tail`, because a border stops where the tier's measure-as-padding stops;
`.path-liniatura-void` takes the tail as negative margin whole. Two traps, both paid for in this
session:

- **A `%` or `cqi` inside an unregistered custom property resolves where the property is USED.**
  `--lin-tail` held `min(1580px, 100%)`; on the form `100%` was the writing's width and the rules
  stopped at 1630. Fix: `@property --lin-tail { syntax: "<length>" }` — it computes to px on
  `.path-liniatura` and inherits as px — with `100cqi` in place of `100%`, which needs `.path` to be
  a size container (`container-type: inline-size`; its width is explicit, so containment costs it
  nothing). The `@property` is registered once, in 04-rooms-interludes; the register audit (R2)
  fails the build on a second registration.
- `07-responsive` zeroes the tail below one column as `--lin-tail: 0px` (a `<length>`, not a bare
  `0`), not `padding-right: 0`.

If the act reading mid-line is what he objects to next, the one-change alternative is the act at
the register's right edge with the leader kept at its length: `margin-right: -tail` on the form
without the padding, `padding-right: tail` on `.notice-blank` instead. Not built; the leader
ending where the act begins is the stronger reading of "write here, up to the act".

Harness `vm-shot\notice-r16.cjs` now also reports `x`: every rule's left/right against the grid's
right edge, and the act's right; `form::before` is measured from the form's first grid track (the
custom property reads back as its `clamp()` tokens, so it was `null` before).
