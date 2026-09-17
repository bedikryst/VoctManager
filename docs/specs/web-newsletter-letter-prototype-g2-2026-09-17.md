# Newsletter, round 7: prototype G2 — the reader addresses the letter

Status: Superseded on arrival, scroll, identity and the field's shape by
`web-newsletter-letter-prototype-g3-2026-09-17.md` (round 8). The letter's thesis, the sheet's
content and the geometry contract below still hold. Two things still await the developer's eye:
the static light spill on the dark ground and the 6 % grain on the paper.
Date: 2026-09-17
Supersedes: `web-newsletter-letter-prototype-g-2026-09-17.md` on the sheet and the dark side; G's
stage contract (grid, sticky, crop, scroll) still holds except where this file says otherwise.
Study: `C:\Users\kryst\vm-shot\newsletter-v2\g2-letter.html` · renders and `measurements.txt` in
`C:\Users\kryst\vm-shot\newsletter-v2\out-g2\` · harness `C:\Users\kryst\vm-shot\g-shots.cjs`
(unchanged) plus `g2-typed.cjs` for the typed-but-not-sent state.

## The one sentence

**The reader writes their address under the photograph, and the letter on the right is addressed
to them as they type.** The dark side holds the sentence that says what the letter is, one ruled
field, one bar of paper for the act, one line of small print, and the credit. The sheet holds only
the letter: letterhead, the addressee's line (a mirror of the field, not an input), the evening,
the sign-off, the signature. Nothing is over the photograph.

## Why G was rejected, in the developer's words and mine

G's sheet was "a card with a form, not a letter": it had a magazine's running head, a register
entry, a 54 px headline pretending to be a sign-off, and a form under it — the addressee at the
foot, where no letter puts it. My first G2 moved the field to the sheet's head and set the whole
sheet in Cormorant; the developer's two objections were right: the field was the quietest thing on
the page, and a display serif at 15–17 px reads as a wedding invitation, not a 2026 product. His
counter-proposal — field under the photograph, mirrored onto the letter — is what was built.

## What G2 is, against G

| | G | G2 |
| --- | --- | --- |
| Where the reader writes | on the sheet, after the sign-off | under the photograph, beside the sentence; the sheet's `Do` line mirrors it live |
| The sheet | listing + headline + form + small print | letterhead (links to `/`) · `Do` + mirror line · Laudes / title / date / place · incipit + Hassler · `Do zobaczenia.` · `VoctEnsemble` |
| Faces on the sheet | mono, Cinzel, Cormorant, Plex Sans, gold link | Cormorant for display lines only; Plex Sans for text lines; mono for the date (site atom); Cinzel only for the letterhead mark |
| Placeholder | `imie@przyklad.pl` | none — the label `Na adres` carries it |
| The act | rule + tracked Cinzel capitals + arrow, on the sheet | full-width bar of paper on the dark side, Plex Sans 500, arrow |
| Running head | gold Cinzel over the photograph, 150 px shade | none; photograph enters clean; home link at the register's foot beside `Wszystkie koncerty` |
| Material | creases, gradient, inset ring | flat paper + 6 % grain (same SVG noise as the dark ground); shadow falls right and down (light from the room) |
| Arrival | sheet fades + 28 px | sheet is laid down (translate + `rotateX(-7deg) rotateZ(-0.7deg)`, shadow tightens); then both rules — field and `Do` line — draw from the left in one gesture, 600 ms later |
| Commitment | address on the card; lamp bloom | `Do` line inked, sheet lifts 8 px, lamp bloom, `Do zobaczenia.` firms 300 → 460 (the one use of the variable axis); receipt takes the field's place on the dark side |
| Receipt | second serif headline on the sheet | `List zaadresowany.` + two lines + `Popraw adres`, on black, where the field was |

## Geometry contract (delta from G)

```
--sheet-w     clamp(400px, 33cqw, 500px)     narrower than G's 560: a letter, not a card
--overlap     clamp(56px, 8cqw, 120px)
--sheet-drop  clamp(32px, 12vh, 150px)
--lede-min    32vh                            the row under the photograph; also what keeps the
                                              photograph's foot above the sheet's foot
```

The sheet no longer carries the act, so it is shorter (594 px at 1440) and the lede row is what
makes it cross the photograph's foot. The lede row is a two-column grid from 1180 cqw (sentence
+ credit left, form right, `clamp(320px, 28cqw, 440px)`); stacked below that; on the phone it
comes **before** the sheet in DOM and on screen — the reader writes first and scrolls down to a
letter that already carries their address. The stage has `overflow-x: clip` (never `hidden`) so
the light spill can reach past the right edge without a scrollbar and without breaking sticky.

## Measured

| Viewport | Room | Sheet | Over the room / below its foot | Act bottom |
| --- | --- | --- | --- | --- |
| 1920×900 | 1475×612 (2.41:1) | 500×594 | 120 / 154 px | 777 ✓ |
| 1920×1080 | 1475×734 (2.01:1) | 500×617 | 120 / 76 px | 900 ✓ |
| 1440×900 | 1031×612 (1.68:1) | 475×594 | 115 / 154 px | 774 ✓ |
| 1024×768 | 671×363 (1.85:1) | 400×544 | 82 / 337 px | 634 ✓ |
| 901×900 | 543×477 (1.14:1) | 400×555 | 72 / 250 px | 747 ✓ |
| 899 / 820×900 | band 2.33:1 | 500 wide, after the form | — | 654 / 620 ✓ |
| 390×844 | 390×331 | 346×525, top 750 | — | 602 ✓ |
| 320×568 | 320×271 | 276×594 | — | 542 ✓ |
| 844×390 · zoom200 | — | — | — | below fold, scrolls |

No horizontal overflow anywhere, in any form state. All four states at 1440 keep the sheet at
≤ 766 px (receipt 758). Contrast: the sentence on black 13.9–15.1:1 worst; everything on the
sheet ≥ 15:1; the act's label on its paper 16.5:1. (The harness's `field` probe reports ~4:1 —
that is the field's own rule inside the input's box, not the ground.) Keyboard: the field is the
**first** tab stop; the fourth reaches the letterhead link. Arrival: sheet 0.77 at 300 ms, 1.00 at
700 ms (the harness's `y` reads 1 px there because the transform is now a 3-D matrix); rules draw
600–1300 ms. Scroll and reduced motion as in G.

## Honest weaknesses, for the developer's eye

- **1920×900 shows a 2.41:1 field** of the 1.34:1 crop — the lectern is gone. A wider crop for
  wide fields (one more `<source>`), chosen on `g-frame-grid.cjs`, is the fix; not done here.
- **1920×1080: the sheet crosses the photograph's foot by 76 px** — the thinnest in the matrix.
  `--lede-min` at 34vh buys ~22 px.
- The sentence wraps to four lines at 1440 (its column is 380 px beside the form); three at 1920.
- The empty `Do` line on the sheet before typing is a blank ruled line. It is meant to read as a
  form letter's blank; if it reads as an error, the alternative is a faint em-dash — never an
  example address.
- The light spill (`.room::before`, 15 % gold peak) is static and the one colour on the dark side
  the photograph did not bring. The developer questioned "the light"; the moving lantern was
  removed, this stayed pending his eye. Removing it is one rule.
- The paper grain at 6 % is below seeing at 1×: a surface, not a feature — keep or delete, not raise.
- On the phone the mirror is out of view while typing; the letter with the address is what the
  scroll reveals. Accepted.
- Type is in px; rem at integration. The act's wording (`Chcę otrzymywać zaproszenia` vs `Zapisz
  mnie`) is still the open copy decision from round 3.

## Before integration

Integration points as in rounds 3–6: `NewsletterPage.astro`, `notice.css`, `NoticeRecord.astro`;
the signup state owner is `NoticeForm.tsx`. G2 changes two things there: the form renders in the
lede row (not on the sheet), and the sheet needs the field's value — the simplest shape is a
`data-mirror` target in the sheet's static markup that the island writes with one `textContent`
per input event, plus the `has-text` / `addressed` classes. The running head is gone, so whatever
`NuntiusPage.astro` renders as a header must be checked against this; the letterhead mark is the
home link, and the register's foot gets `Strona główna VoctEnsemble →` beside `Wszystkie koncerty →`.

The working tree carries unrelated newsletter and consent work (`NoticeForm.tsx`, `notice.css`,
`NoticeRecord.astro`, `noticeRegister.ts`, `consent.py`) — **this pass wrote only this file, the
G spec's status line, the memory, and study files under `vm-shot\`.**

## Reproducing it

From `C:\Users\kryst\vm-shot`. Reads local HTML; touches neither dev nor production:

```powershell
node g-shots.cjs "C:\Users\kryst\vm-shot\newsletter-v2\g2-letter.html" "C:\Users\kryst\vm-shot\newsletter-v2\out-g2"
node g-shots.cjs "C:\Users\kryst\vm-shot\newsletter-v2\g2-letter.html" "C:\Users\kryst\vm-shot\newsletter-v2\out-g2" quick
node g2-typed.cjs "C:\Users\kryst\vm-shot\newsletter-v2\g2-letter.html" "C:\Users\kryst\vm-shot\newsletter-v2\out-g2"
```

The page itself takes `?state=typed|invalid|sending|error|receipt`, `?fail` (the POST fails) and
`?hold` (arrival waits for `window.__arrive()`).
