# Newsletter roof, round 4: the portfolio audit

Status: Audit written against prototype E, and **all five moves built as prototype F**. Rendered and
measured; not integrated into `web/`. The developer has not yet judged F.
Date: 2026-09-17
Audits: `docs/specs/web-newsletter-roof-corrected-2026-09-17.md`
Studied: `C:\Users\kryst\vm-shot\newsletter-v2\e-roof-editorial.html` and `out-e\`
Built: `C:\Users\kryst\vm-shot\newsletter-v2\f-letter-spread.html`, renders in `out-f\`

## The verdict

Prototype E is correct and anonymous. Every measurement in the corrected spec holds — the band is a
room, the crops are art-directed, nothing overflows, the contrast floor is honest. None of that is the
problem. **The composition is the most-produced cultural hero of 2016–2022**: full-bleed photograph,
scrim dissolving to flat black, serif display standing in the dissolve, filled gold rectangle beneath.
It is executed better than most of them and it is still the same object. Nothing on the page could
only be this ensemble's, and nothing on it could only be a *newsletter*.

## Six structural faults

1. **The photograph melts instead of being placed.** `.veil` dissolves the frame into `#080807`, so
   the image has no edge, therefore no scale and no authority; the display line sits in the murkiest
   zone the page owns; and the black below has no top. A melt is what you do when you will not decide
   where the picture ends. It also bleeds to the browser chrome, which is the 2019 reflex.

2. **One flat ground for 1627 px.** No second surface, no texture, no tonal band. Sections are
   separated by emptiness alone (56 px, 96–168 px). The lower half reads as unfinished rather than
   quiet.

3. **No letter on a page that sells a letter.** The offer says `wyślemy Ci jeden krótki list — termin,
   miejsce i program`. The page never shows one. `Najbliższy wieczór` is already three quarters of
   that letter's content, set as a floating column of website text instead of as the artefact.

4. **The hero's grid is invisible and the aside is orphaned.** `minmax(0,1fr) 38%` with `gap: 0 4%`
   leaves ~260 px of nothing at 1440, crossed by no rule and tied by no baseline. Both columns are
   flush left with the same rag and end ragged (797 / 753). No overlap, no asymmetry of size, no
   element crossing a column: the composition has no tension. "Editorial" is claimed but the
   apparatus — rules, folios, hanging figures, marginalia — exists only as the record's 10 % hairline.

5. **Commitment is a text swap.** `e-1440x900.png` and `e-1440x900-receipt.png` are the same picture.
   `--warmth: 0 → 1` is invisible at full size, which settles *Still open* §1: **drop it**, it buys
   nothing for two baked assets per crop. The page's one emotional beat produces no event.

6. **It reads as a very good 2019, not 2026.** The tells: scrim hero; flat gold CTA with tracked
   small caps; five viewport `@media` switches (560/640/780/900/1025) driving one component, where the
   2026 answer is container queries and intrinsic sizing; a 1627–2333 px page where scrolling does
   nothing at all, with `animation-timeline: view()/scroll()` baseline; Cormorant (300–700) and Cinzel
   (400–900) loaded as variable fonts and used at two static weights; type in px.

## Five moves, in order of force

**A — Two grounds: the room, then the paper.** The hero stays dark. From the credit down the page
turns to `--paper` with ink type, and the record is set as a printed register: hanging roman
numerals, real rules, tabular dates. Cheapest large change: it gives the page a second act, ends the
flat-black monotony, turns the photograph into a *scene* rather than a background, and matches the
material the rest of `web/` is built from.

**B — The letter as a specimen.** Replace the floating `Najbliższy wieczór` column with a facsimile
of the invitation itself — paper, hard shadow, lying in the room's foot: rubric, title, date line,
place, two lines of programme, sign-off. It shows the product, gives the hero its missing object and
its depth, and lets paper appear once before the section that adopts it. This is the image that goes
in a portfolio.

**C — Kill the melt, place the frame.** Inset the photograph (gutter left and right, a measured band
of black above it), give it a hard bottom edge, and let the display line sit below that edge or cross
it deliberately. Hang the credit in the margin beside the frame instead of as a right-aligned row.
Replaces the contrast argument entirely: type on black needs no gradient measurement.

**D — Motion: bin the hover highlight; the scroll becomes the light.** `color → --candle-lit` on hover
is the most generic hover there is. Replacements, one of:
- *The rule draws* — the entry's top hairline runs from the left to the full measure on hover/focus
  (scaleX, ~220 ms). The apparatus does the work; no colour changes.
- *The numeral carries it* — only the roman brightens and the row shifts 6 px right; a print gesture.
- Scroll-driven: each entry's rule draws itself as the record enters the viewport
  (`animation-timeline: view()`), so the register writes itself; hover is then only the numeral.
Arrival keeps the single photograph cross-fade, but the bloom is tied to **scroll position**, not to a
900 ms timer — the sanctuary lamp lifting as the reader leaves the room.

**E — Commitment as an event.** No room-warming. The specimen letter (B) takes the reader's own
address into its address line in mono, and the ground makes its turn to paper early. One visible
change of state, zero baked assets.

**CTA, separately.** The filled gold rectangle is the loudest cheap object on the page and the second
strongest dating tell after the scrim. Either paper-on-dark (the letter's own material, ink label) or
a rule-and-label whose gold hairline fills on hover.

**One type moment.** `Pięć programów, osiem wieczorów — od stycznia 2024.` is the best sentence on the
page and it is set at 17 px at the very bottom. It is the candidate for the page's one large size.

## What F actually is

A **spread**. Above 900 cqw the room stands on the left page and the words on the right, and the
letter is laid across the seam. Below it the plate is a wide crop above the words, as before.

- **The plate replaced the band.** Inset, hard-edged, `width: 100%` + `aspect-ratio` + a `max-height`
  cap. Nothing is ever set over the photograph, so `.veil` is gone and no gradient has to be
  measured for contrast — the display line stands on flat black at 17.7:1 at every stop.
  `width: 100%` is load-bearing: with only `aspect-ratio` and `max-height`, a clamped height pulls
  the *width* in with it and the plate stops filling its column (600 px of picture in a 638 px
  track, 152 px short of it at 1920).
- **A new crop.** `room-portrait.webp`, 4:5, x 0.257→0.683 · y 0.13→0.93 of frame (63) — the lit
  brass lectern at the foot, three singers, the conductor with his arms up, the altar cloth and the
  sanctuary lamp, and a third of the plate given to the vault above their heads. `room-phone-nave.webp`
  is the same window at 1.32:1, so a phone and a desktop now see one room instead of two. The warm
  twins are dead with `--warmth`.
- **The letter.** A sheet of the page's own paper, `grid-column: 1 / -1` starting 32 % across, so it
  lies on the photograph and crosses into the text column. Its body is the evening on the left and
  an address block at the sheet's foot on the right: `DO` over a ruled blank. That blank is the
  page's argument in one gesture.
- **Commitment is the letter's event.** On the receipt the address is written onto the rule, the
  rule goes to full ink, the sheet lifts 10 px and its shadow deepens — and the offer, a promise in
  the future tense that has just been kept, is taken off the screen so two serif headings do not
  stack.
- **Act two is paper.** Hard seam, a 2 px gold rule that draws across it on scroll, the register set
  as a printed index, and the page's one large size at the end: `Pięć programów, osiem wieczorów.`
  at up to 68 px, with `Od stycznia 2024` under it as a mono rubric.
- **Motion.** One event on arrival and it is still the photograph (0.24 → 0.79 → 0.99 at 200/400/700 ms).
  Everything else answers the scroll: the lamp's bloom on `view()` over the plate, and each register
  rule drawing itself as its row enters. Hover is the apparatus — the hanging numeral to full ink and
  the title 8 px off its margin. No colour flash anywhere.
- **The act is paper, not gold.** It warms to gold only under the cursor or the keyboard, which is
  the only gold-as-response left on the page.
- **Container queries.** Layout asks `@container page` at 560/780/900/1180; `@media` is left with the
  two things it alone can do — `<source media>` art direction and the landscape-phone height case,
  which is scoped with `(pointer: coarse)` so a desktop at 200 % enlargement no longer trips it.

## Measured (F)

| Viewport | Plate | Act bottom | Letter | Page |
| --- | --- | --- | --- | --- |
| 1920×1080 | 713×891 (0.8:1) | 516 ✓ | 673→968, 290 px onto the plate | 2132 |
| 1920×900 | 713×750 | 504 ✓ | 590→886 | 1917 |
| 1440×900 | 605×750 | 504 ✓ | 587→883, 246 px overlap | 1917 |
| 1024×768 | 509×618 | 498 ✓ | 553→857 | 1807 |
| 901/899×900 | 448×560 / 827×318 | 501 / 836 ✓ | — | 1843 / 2210 |
| 820×900 | 754×290 | 808 ✓ | — | 2171 |
| 390×844 | 334×253 | 762 ✓ | — | 2431 |
| 320×568 · 844×390 · zoom200 | — | below fold, scrolls | — | — |

No horizontal overflow at any width or in any form state. Display and offer measure 17.73:1 — flat
black, not a gradient. The act measures its own paper at 16.47:1.

**Contrast pass.** Every muted tint was recomputed rather than inherited: ink at α < 0.62 over paper
composites to about #6b6a66 and fails 4.5:1, which most of the register and the letter's metadata were
doing. Paper-side mutes are now ≥ 0.62, dark-side ≥ 0.56, and `--candle-ink` went to `#7a5f26` (5.1:1
on paper) because `#8a6d2f` was 4.1:1.

## Still open, carried forward

- *Corrected spec §1* (`--warmth`) — **closed. Dropped**, with the two baked assets per crop.
- *Corrected spec §2* (type in px) — still px in F. Settle in `notice.css` during integration, as rem.
- *Corrected spec §3* (`Chcę otrzymywać zaproszenia` vs `Zapisz mnie`) — copy decision, still untaken.
  At 320 px the long label is still what forces the balanced two-line wrap.
- *Corrected spec §4* (`f-letter.html`) — **closed**: the letter is inside F, not beside it.
- *Corrected spec §5* — `web-newsletter-composition-2026-09.md` §2 still describes the axis; reconcile
  before either file is used as a checklist.
- **The credit sits between the plate and the headline on a phone.** That is where a plate's caption
  belongs, but it is two lines of mono between the photograph and the display line. Judge it on a real
  phone before moving it.
- **The right column holds 150 px of black between the act and the letter at 1080.** Read as air here;
  it is the first thing to reconsider if the first screen feels thin.
- Working tree caution from the corrected spec stands: `NoticeForm.tsx`, `notice.css`,
  `NoticeRecord.astro`, `noticeRegister.ts`, `consent.py` carry unrelated work. **This pass did not
  touch the repository beyond this file.**

## Reproducing it

From `C:\Users\kryst\vm-shot`. Reads local HTML; touches neither dev nor production:

```powershell
node f-spread-shots.cjs "C:\Users\kryst\vm-shot\newsletter-v2\f-letter-spread.html" "C:\Users\kryst\vm-shot\newsletter-v2\out-f"
```

Eleven viewports (fold and full page), the four form states at 1440 and 390, three scroll positions
across the seam, the register's hover, reduced motion, keyboard focus, and the arrival paused at
explicit timeline positions. The pause filters on `a.timeline === document.timeline`: a scroll-driven
animation has a progress-based timeline and throws when handed a millisecond.

The crops are cut by `cut-portrait.cjs` and `cut-phone-nave.cjs` (session scratchpad), which read
`web/src/assets/photos/new/VE_9Kart_Krk (K.Grudzińska)  (63).jpg` and write only into
`vm-shot/newsletter-v2/images/`. Production cuts through `.original-photos/` and `npm run photos:proxy`,
where `widths` must travel with `width`.
