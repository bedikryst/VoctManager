# Newsletter roof, corrected: the first prototype

Status: Prototype rendered and measured. Not integrated into `web/`. The developer has not yet judged it.
Date: 2026-09-17
Answers: `docs/specs/web-newsletter-roof-independent-audit-2026-09-17.md`
Study: `C:\Users\kryst\vm-shot\newsletter-v2\e-roof-editorial.html` · renders and
`measurements.txt` in `C:\Users\kryst\vm-shot\newsletter-v2\out-e\`

## What changed, and why it is the geometry that changed first

The audit's verdict was that the photograph reads as a band of performers while the prose describes a
room. That is not a grading problem and no gradient closes it: **at full bleed, the vertical content a
band can show is fixed by viewport width ÷ band height**. A 52svh band at 1920 is a 4.1:1 slice, and a
4.1:1 slice of a 1.5:1 frame is eleven torsos. So the band stopped being a fraction of the viewport's
height and became an **aspect of its width**, with height only as a ceiling:

```
--band   ≤ 640 px   clamp(300px, 96vw, 54svh)    ≈ 1.04 : 1   phone crop
         641–1024   clamp(300px, 43vw, 58svh)    ≈ 2.33 : 1   tablet crop
         ≥ 1025 px  clamp(340px, 38vw, 74svh)    ≈ 2.63 : 1   desktop crop
         ≤ 560 px tall  clamp(240px, 43vw, 62svh) — and the words start BELOW the photograph
--lift   0.30 — the display line stands at 70% of the band, whatever the band resolved to
```

Rendered, the band is 2.63:1 at 1440×900 and 2.88:1 at 1920×900, against 3.1:1 and 4.1:1 before.
Everything on the first screen is derived from `--band` or from `--display`; no offset is a pixel count
guessed at one width.

**Three crops of frame (63), one frame.** Delivered by `<picture>` from
`vm-shot/newsletter-v2/images/`, each cut at the aspect its band actually resolves to:

| Crop | Frame span | Delivered | What it holds |
| --- | --- | --- | --- |
| `roof-desktop.webp` | x 0→1, y 0.270→0.826 | 2200×815, 2.70:1 | pillars, crucifix, sanctuary lamp, the ensemble, the listeners' heads along the foot |
| `roof-tablet.webp` | x 0.18→0.93, y 0.315→0.798 | 1600×687, 2.33:1 | the same room walked closer — at 820 px the full width puts eleven singers in 570 px |
| `room-phone.webp` | unchanged (x 0.02→0.46, y 0.26→0.90) | 900×873 | five singers over a listener's silhouette and the lectern |

Each has its baked warm twin, cut and graded by `scratchpad/cut-roof.cjs`
(`modulate saturation 1.04 / brightness 1.035`, `linear [1.075, 1.005, 0.93]`) — the spec's grade,
unchanged.

## Every finding, and what it resolved to

| Audit finding | Resolution | Evidence |
| --- | --- | --- |
| Short viewports put the offer across faces | At `max-height: 560px` the type flows below the band (`margin-top: band + 30px`); the running head drops its third term, which was the part crossing the conductor | `e-844x390.png` |
| One 820 px switch conflated art direction and layout | Three switches, all separate: photograph at 640/1025, **columns at 780**, display size at 900. 820 and 821 now render identically | `e-820x900.png`, `e-821x900.png` |
| The CTA consumed the 320 px gutter | `min-width: 0` on the grid children; below 360 px the label wraps balanced at the same 12 px. Measured 264 px wide, right edge 292 of 320 | `e-320-act.png` |
| The evening ahead was small, dim and below the fold | Title to `clamp(28px, 2.5vw, 36px)` at full paper, the moment in mono directly beneath it, an explicit `Program wieczoru →`, and two columns from 780 px so it is on the first screen on a tablet | `e-1440x900.png` |
| The credit read as the concert's metadata | Its own row under the hero, right-aligned, opening `Na zdjęciu:` — it names the photograph before anything else | `e-1440x900-full.png` |
| Mono competing with three other faces | The field label moved to Plex Sans. **Mono on this page now means metadata only**: dates, places, the credit, the rubrics | — |
| The entrance read as a disabled interface | All `.reveal` staggering gone. One event: the photograph, 0.24 → 0.79 → 0.99 across 200/400/700 ms (~780 ms total), with the bloom descending over 900 ms. Reading matter and controls are at full opacity in the first frame | `measurements.txt` |
| Warmth answering hover and typing | Only `body.committed`, beside the words that say a letter has gone out. Hover and focus are answered by the candle underline and the button's own lift | `e-1440x900-receipt.png` |
| No second movement to judge rhythm by | The record is built: five programmes from the corpus, `var(--roman-col)` + title/Latin + a right-hand place/moment cluster capped at 22ch, then `Pięć programów, osiem wieczorów — od stycznia 2024.` The page is 1627 px at 1440 against 900 px of first screen | `e-1440x900-full.png` |
| The measure narrowed as the photograph widened | `width: min(100% - 2 * var(--gutter), 1120px)` — the gutter is the viewport's, the measure is the content's. 1120 px of line at both 1440 and 1920 | `measurements.txt` |
| The aside's 112 px drifted with the headline | `padding-top: calc(var(--display) * 0.97 + 24px)` — the rubric lands on the offer's first line at every size | `e-1024x768.png` |

## Measured

Every width above the fold at 1440×900 including the act, no horizontal overflow at any width, and
the worst 0.1% of ground under the display line:

| Viewport | Band | Act bottom | Display line, worst |
| --- | --- | --- | --- |
| 1920×900 | 666 px (2.88:1) | 880 ✓ | 5.45:1 |
| 1920×1080 | 730 px (2.63:1) | 924 ✓ | 4.87:1 |
| 1440×900 | 547 px (2.63:1) | 797 ✓ | 5.59:1 |
| 1024×768 | 440 px (2.33:1) | 696 ✓ | 6.38:1 |
| 820/821×900 | 353 px (2.33:1) | 668 ✓ | 6.25 / 6.10:1 |
| 390×844 | 374 px (1.04:1) | 672 ✓ | 6.10:1 |
| 320×568 | 307 px (1.04:1) | 656, scrolls | 7.28:1 |
| 844×390 | 242 px | below the photograph | no ground — the type is on flat black |

**The phone crop's foot is a stop deeper than the others', and the crop is what decides it**: the
brass lectern's lit top runs across 68–87% of that frame, which is exactly where the display line
lies. On the desktop stops it measured 2.95:1 — under the 3:1 a display size is allowed. With its own
foot gradient it is 6.10:1. This is a per-crop fact, not a taste for darkness; a fourth crop would
need its own measurement.

These numbers are the ground under an element's whole box with its text hidden. They do not establish
contrast at individual glyphs, and the black-area share is not a score to optimise.

## Still open

1. **The warmth is imperceptible.** Rendered at `committed` and compared full size, `0 → 1` does not
   read at screen scale. It is honest and it costs two baked assets per crop. Either accept it as
   something only a returning eye notices, or spend the assets elsewhere. **The developer's call.**
2. **Type is in px.** Inherited from the study. Browser zoom reflows correctly at 320 CSS px, but a
   reader's own font-size setting is not honoured. `notice.css` should carry rem — settle it during
   integration, not here.
3. **The CTA label.** `Chcę otrzymywać zaproszenia` is what forces the 320 px wrap; the production
   chrome's `Zapisz mnie` never would. Copy decision, deliberately not taken in this pass.
4. **The light-letter alternative (`f-letter.html`) was not built.** The audit called it a competing
   prototype only if the corrected roof still feels generic. Judge this one first.
5. `docs/specs/web-newsletter-composition-2026-09.md` §2 `Where this still has room` still describes
   the axis and its second movement. It must be reconciled against this file before either is used as
   an implementation checklist.

## Reproducing it

From `C:\Users\kryst\vm-shot` on the developer's Windows machine. Both commands read local HTML; neither
touches dev or production:

```powershell
node e-roof-shots.cjs "C:\Users\kryst\vm-shot\newsletter-v2\e-roof-editorial.html" "C:\Users\kryst\vm-shot\newsletter-v2\out-e"
```

It shoots the ten acceptance viewports (fold and full page), the four form states at 1440 and 390,
reduced motion, keyboard focus, and the arrival paused at explicit timeline positions rather than
sampled after a wait — a screenshot costs a few hundred ms of its own, so a `t800` taken by waiting is
not 800 ms of anything.

To re-cut the crops: `scratchpad/cut-roof.cjs`, which reads
`web/src/assets/photos/new/VE_9Kart_Krk (K.Grudzińska)  (63).jpg` and writes into
`vm-shot/newsletter-v2/images/`. It writes nothing into the repository.

## Before integration

The working tree carries ongoing newsletter and consent work (`NoticeForm.tsx`, `notice.css`,
`NoticeRecord.astro`, `noticeRegister.ts`, `consent.py`) — **it was not touched by this pass and must
not be overwritten**. The candidate integration points are `NewsletterPage.astro`, `notice.css` and
`NoticeRecord.astro`; the signup state owner is `NoticeForm.tsx`, and the receipt wording in this
prototype is `koncerty.yaml`'s (`sentTitle` / `sentBody` / `sentHint`) with the rubrics from
`i18n/content/nuntius.ts` (`register.ahead` = `Najbliższy wieczór`, `register.record` = `Dotychczas`).
The three crops are study assets: production cuts them through `.original-photos/` and
`npm run photos:proxy`, where `widths` must travel with `width`.
