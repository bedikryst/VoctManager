# Newsletter, round 6: prototype G — the page is the letter

Status: Rejected by the developer on 2026-09-17 ("a card with a form, not a letter") and superseded
by `web-newsletter-letter-prototype-g2-2026-09-17.md`. The stage contract below (grid, sticky,
crop, scroll) still holds; the sheet, the dark side and the running head do not.
Date: 2026-09-17
Answers: `docs/specs/web-newsletter-round5-audit-2026-09-17.md` (moves G1–G4)
Study: `C:\Users\kryst\vm-shot\newsletter-v2\g-letter.html` · renders and `measurements.txt` in
`C:\Users\kryst\vm-shot\newsletter-v2\out-g\` · harness `C:\Users\kryst\vm-shot\g-shots.cjs`

## The one sentence

**The page is the letter; the room is what the letter is about.** The reader addresses the next
invitation to themselves: the e-mail field is the `DO` line on the sheet, the consent is the sheet's
footnote, the act is the rule and small capitals at the sheet's foot, and `Do zobaczenia.` is the
letter's sign-off — not the page's headline. The dark side holds the room, one sentence, and the
photograph's credit. Nothing else.

## What G is, against F

| | F (round 4) | G |
| --- | --- | --- |
| Where the act lives | dark column: label, field, consent, filled paper button | on the sheet: `DO` + ruled input, footnote, rule-and-label act |
| The sheet | a card holding text that was already in the column | the whole offer: evening, incipit, sign-off, address block, receipt |
| The photograph | inset plate, 4:5, conductor's back centred, 713 px at 1920 | bleeds top and left, hard right and foot; 1.34:1 crop, faces at a third, lectern at the foot; 974 px at 1440, 1415 px at 1920 |
| Headline on black | `Do zobaczenia.` 60 px | none — the sentence of offer at 24–32 px serif under the photograph is the `h1` |
| Arrival | photograph fades in behind placed type | room present in frame one; the **sheet** arrives (opacity + 28 px, 640 ms) |
| Scroll | rules draw in act two | the stage is sticky; the paper **comes up over the room**, the room dims to 62 %, the sheet lifts 160 px to meet the paper; rules draw |
| Commitment | address written on the card; two serif headings stack in the column | address written on the sheet's own line, sheet lifts, the **sanctuary lamp lights** in the photograph; receipt is on the sheet, one place |
| Music | none | the incipit *Cantate Domino canticum novum* on the sheet, Hassler credited |
| Latin rubrics | 14 px italic subtitles | hanging in the register's margin at 17 px, own column |
| Dark ground | flat `#08080a` | warm `#0a0908` with film grain (inline SVG turbulence, 16 %) |
| Act | filled paper rectangle | ink rule + tracked label + arrow; hover draws a gold rule along it |

## Geometry contract

```
--sheet-w     clamp(400px, 36cqw, 560px)     a letter's width, capped
--overlap     clamp(56px, 7cqw, 120px)       how far the sheet reaches back over the room
--sheet-drop  clamp(32px, 12vh, 150px)       the sheet's top below the head row
--gutter      max(22px, 3.4vw)
--plate-ratio 1.18 phone · 2.33 tablet · none in the spread (the field is the grid area)
```

Spread at `@container page (min-width: 900px)`: columns `gutter | 1fr | sheet-w − overlap | gutter`,
rows `64px | 1fr | auto`. The room takes columns 1–2 and rows 1–2 (bleeds top and left). The sheet
takes column 3, rows 2–3, `justify-self: end; width: var(--sheet-w)` — wider than its track, so it
overflows back over the room by exactly `--overlap`. The lede row (column 2, row 3) has
`min-height: 28vh` so the photograph's foot stays above the sheet's; the sheet **must** cross that
edge or it is a card pinned to the picture's side.

Sticky stage only at `(min-width: 900px) and (min-height: 700px)`: the stage is `height: 100svh`
there, and a sticky element taller than the viewport would hide its own foot.

The crop: `room-spread.webp`, frame (63) x 0→0.66 · y 0.20→0.94, 1800×1346, delivered with
`object-fit: cover; object-position: 40% 30%` so a wide field trims the listeners' foot and a narrow
one trims the conductor, never a face. A 150 px shade at the plate's top carries the running head.

## Measured

| Viewport | Room | Sheet | Over the room / below its foot | Act bottom | Runhead worst |
| --- | --- | --- | --- | --- | --- |
| 1920×900 | 1415×647 (2.19:1) | 560×594 | 120 / 119 px | 730 ✓ | 4.19 |
| 1920×1080 | 1415×778 (1.82:1) | 560×608 | 120 / 24 px | 765 ✓ | 7.39 |
| 1440×900 | 974×648 (1.5:1) | 518×592 | 101 / 116 px | 728 ✓ | 7.77 |
| 1024×768 | 661×545 (1.21:1) | 400×552 | 72 / 164 px | 682 ✓ | 7.93 |
| 901×900 | 534×648 (0.82:1) | 400×558 | 63 / 82 px | 706 ✓ | 8.22 |
| 899 / 820×900 | band 2.33:1 | 560 wide, below the band | — | 831 / 796 ✓ | 5.9 / 6.2 |
| 390×844 | 390×331 | 346×559 | — | 831 ✓ | 5.35 |
| 320×568 · 844×390 · zoom200 | — | — | — | below fold, scrolls | ≥ 4.6 |

No horizontal overflow anywhere, in any form state. Everything on the sheet measures ≥ 16:1 on its
own paper; the lede on black 15–16:1. Reduced motion: sheet at opacity 1 at 600 ms. Keyboard: four
tabs reach the field. Arrival: sheet 0.17 → 0.77 → 0.96 → 1.00 at 150/300/500/700 ms; photograph and
lede at 1 throughout. Scroll at 1440: room dim 0.07 → 0.58 and sheet lift −18 → −149 px across the
first viewport; register rules 0 → 1 as each row enters.

## Honest weaknesses, for the developer's eye

- **The creases** (two hairlines at 33 % and 66 % of the sheet, ink 7.5 % / white 60 %) are a whisper
  at 1×. Either make them read or delete them; as they stand they are a fact nobody sees.
- **1920×900 cuts the lectern** — a 2.19:1 field of a 1.34:1 crop loses 39 % of height. The faces are
  right; the foreground object is a third of itself. A wider crop for wide fields is the fix if it
  matters; it costs one more `<source>`.
- **1920×1080: the sheet crosses the photograph's foot by only 24 px.** Reads as lying on the corner
  still, but it is the thinnest margin in the matrix. `--sheet-drop` at 14 vh buys ~20 px more.
- **The black above the sheet on wide screens** (505×172 at 1920×900) is air. It is the first thing
  to reconsider if the first screen feels thin on the right.
- **Type is in px**, as in every round; rem at integration in `notice.css`.
- **Variable axes still unused** beyond the static weights (300 display, 400 title, 600 capitals).
- The phone puts the `h1` (the sentence of offer) *after* the sheet. Semantically fine; a screen-reader
  hears the letter first.

## Before integration

The candidate integration points are unchanged from rounds 3–4: `NewsletterPage.astro`,
`notice.css`, `NoticeRecord.astro`; the signup state owner is `NoticeForm.tsx`. G changes what
`NoticeForm.tsx` renders — the field, the clause and the act must render **inside** the sheet's
markup, and the receipt replaces the address block in place. The copy decision from round 3 §3
(`Chcę otrzymywać zaproszenia` vs `Zapisz mnie`) is still untaken; on the sheet the long label fits at
320 px without wrapping, so the wrap argument is gone and only the wording is left.

The working tree carries unrelated newsletter and consent work (`NoticeForm.tsx`, `notice.css`,
`NoticeRecord.astro`, `noticeRegister.ts`, `consent.py`) — **this pass wrote only this file, the
memory, and study files under `vm-shot\`.**

## Reproducing it

From `C:\Users\kryst\vm-shot`. Reads local HTML; touches neither dev nor production:

```powershell
node g-shots.cjs "C:\Users\kryst\vm-shot\newsletter-v2\g-letter.html" "C:\Users\kryst\vm-shot\newsletter-v2\out-g"
node g-shots.cjs "C:\Users\kryst\vm-shot\newsletter-v2\g-letter.html" "C:\Users\kryst\vm-shot\newsletter-v2\out-g" quick
```

`quick` is the loop for looking: three folds, the receipt, two scroll stops, two arrival frames.
The full run is the proof: eleven viewports fold and full, four states at 1440 and 390, six scroll
stops, hover on the register and the act, reduced motion, keyboard focus, five arrival frames.

`cut-spread-room.cjs` re-cuts the crop; `g-frame-grid.cjs` prints frame (63) with a tenths grid so
a window is chosen by eye and named in fractions. Both write only under `vm-shot\`.
