# Newsletter, round 9: the photograph, and the dark side under it

Status: Audited, changed, re-rendered and measured. The photograph and the plate live in the study
only and await the developer's verdict; the letter, the chrome stand-in, the arrival and the scroll
are unchanged from round 8. **The promise is in production** (round 10, below).
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

## A note on the renders

`out-g3\` before this round held two runs six minutes apart — a full one and a `quick` one — so
most widths carried pre-fix shots while the spec's table quoted the three that had been re-shot.
Every render in `out-g3\` is now from one full run, and `measurements.txt` is that run's stdout.
Redirect the harness to the file; it does not write it itself.
