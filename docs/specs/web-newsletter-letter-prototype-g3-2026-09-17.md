# Newsletter, round 8: prototype G3 — what surrounds the letter

Status: Built, rendered and measured. Not integrated into `web/`. Awaiting the developer's verdict
on the whole; the letter itself (G2's sheet) is unchanged except for the letterhead and the shape
of the addressee's line.
Date: 2026-09-17
Supersedes: `web-newsletter-letter-prototype-g2-2026-09-17.md` on arrival, scroll, identity and
the field's shape; G2's thesis, geometry contract and measurements otherwise still hold.
Study: `C:\Users\kryst\vm-shot\newsletter-v2\g3-letter.html` · renders and `measurements.txt` in
`C:\Users\kryst\vm-shot\newsletter-v2\out-g3\` · harness `C:\Users\kryst\vm-shot\g-shots.cjs`
(scroll probe now reports the chrome's state and whether the paper cuts the sheet) plus
`g2-typed.cjs`. `g2-letter.html` is kept untouched for comparison.

## What this round is about

Round 7 settled the letter. This round is the page around it: the site's chrome, the sender's
identity, the arrival, the scroll, and the one thing on the dark side that was not reading — the
field. Four changes, one finding.

## The finding: the page was judged for seven rounds without the site's chrome

Production renders `<SiteChrome tone="dark">` over `/newsletter`: a fixed bar, 84 px at rest, the
brand (glyph + `VoctEnsemble`, serif 21/300) at the left, the nav at the right, its own 50 % → 0
scrim. Every render since round 1 lacked it, so "nothing on the opening says VoctEnsemble" was in
part an artefact of the study. G3 carries a stand-in at the values that decide composition (fixed,
height, brand, nav, scrim, night glass after half a viewport, paper glass while a `.tone-light`
surface is under the bar). The developer's steer: **do not refine the stand-in further** — the real
bar is fitted at integration. The stand-in stays only so the renders show the page as it will be.
Consequences already visible: `--head-h` is 84 (the bar's height), the sheet's top sits at 192 at
900 vh, and the field is no longer the first tab stop (production's skip-link handles that).

## The four changes

1. **Letterhead = the site's brand.** `VOCTENSEMBLE · NUNTIUS` in 10.5 px Cinzel was a footnote,
   not a letterhead. The sheet's head now carries the same object the chrome wears — the glyph
   (`/logo-mark.png` as a mask, 17×40) and `VoctEnsemble` in the serif at 21/300 — set in ink
   because it lies on paper, which is the flip the chrome itself makes over a light ground. Nuntius
   is gone from the sheet; the subject `Najbliższy wieczór` stays in the margin. The sheet grows by
   ~15 px. This is the one place "teksty nie większe" is knowingly crossed: it is not the sentence
   or the field, it is the sender's name at the size the site already gives it.

2. **The field is a form letter's blank.** `Na adres` sat 60 px above a hairline — the empty
   input's own height — so the rule read as a divider, on the phone plainly. Now the label sits on
   the input's baseline, in the letter's italic (the face the sheet's `Do` is set in), and the rule
   runs on from it: `Na adres ________`. The sheet's addressee line takes the same shape: `Do
   ________`. Two blanks, one shape, both rules still drawn together on arrival. Still no
   placeholder. On the phone the sample address fits the line at 22 px exactly; longer ones scroll
   in the input as every input does, and the mirror on the sheet shows them whole.

3. **The sheet does not fade.** Round 4's rule was "nothing that is read fades", and the sheet is
   read. Arrival keeps the lay-down (translate + `rotateX(-7deg) rotateZ(-0.7deg)`, shadow far and
   soft → tight) at opacity 1 from the first frame: a sheet in the air, then on the desk.
   `measurements.txt`: opacity 1.00 at every sampled time.

4. **On the scroll the letter travels with the reader; the paper never cuts it.** G2's `lift`
   (−160 px over 100 vh) let the register's paper come up over the sheet and slice it at
   `Do zobaczenia.` (see G2's `g-scroll-28.png`). G3: the room stays sticky and dims as before; the
   sheet moves one-for-one with the scroll (`leave`: 0 → −100vh over 0–100vh), i.e. it is content
   leaving the viewport while the room stays behind. The paper follows 91 px under the sheet's foot
   at every stop (`clear` in the probe), and the sign-off is the last thing to leave. Sticky is now
   gated on `@supports (animation-timeline: scroll())` **and** `prefers-reduced-motion: no-preference`:
   without the timelines a pinned room would cut the letter, so the page simply scrolls.

## Measured (1440×900 unless stated)

| | G2 | G3 |
| --- | --- | --- |
| Sheet | 475×594, top 165 | 475×602, top 192 |
| Sheet over the room's foot, 1920×1080 | 76 px | 119 px |
| Scroll 28 %: sheet bottom / paper top | 765−45 / 625 → **cut** | 533 / 624 → clear |
| Scroll 60 % | cut | sheet bottom 218 / paper 309, chrome paper glass |
| Arrival opacity at 300 ms | 0.77 | 1.00 |
| Contrast: sentence / act label / sheet | ≥ 13.9 / 16.5 / ≥ 15 | unchanged |
| Overflow-x, all widths and states | none | none |

Phone (390×844): chrome brand over the photograph's top, photograph, sentence, `Na adres ____`,
act, clause, credit, sheet, paper — the reader writes first, as in G2.

## Honest weaknesses, for the developer's eye

- Between 10 % and 40 % of the first viewport the paper covers the sentence and the field while
  the letter is still leaving above. Intended — the reader is leaving — but it is the one moment
  with three grounds on screen (room, black, paper).
- The tilted first frame: before `is-in`, the sheet stands 28 px low and 7° back. Under the
  production page transition that is the frame the page arrives on; it is a sheet in the hand,
  and it settles in 860 ms. If it reads as a glitch, the fix is a smaller angle, not a fade.
- The name now appears three times on the opening: chrome, letterhead, signature. Chrome is the
  site's; letterhead and signature are what a letter has. If it is one too many, the signature is
  the one to question, never the letterhead.
- 1024×768 (unchanged from G2): the plate is 671×363 and the sheet is 567 tall — the letter
  dominates a small room. Not touched this round.
- `Strona główna VoctEnsemble →` at the register's foot was decided when the page had no head;
  with the chrome's brand as the home link on every page it is redundant. Left in, as decided.

## Study-only mechanics

- The brand glyph is inlined as a data URI (`--mark`) by `newsletter-v2\inline-mark.cjs`: a CSS
  mask is fetched in CORS mode and a `file://` page has a null origin, so `url(images/logo-mark.png)`
  never loads under the harness. Production serves `/logo-mark.png` from its own host and needs none
  of this. Re-run the script if the glyph changes.

## Before integration

As G2, plus: the sheet and the paper carry `tone-light`, and the page needs the same
`IntersectionObserver` the concert pages run (`ConcertPage.astro`, `setupKdTone`, rootMargin
`-64px 0px -90% 0px`) to flip the chrome to paper glass while the sheet or the register is under
the bar — `notice.css` / `NewsletterPage.astro` do not do this today. The arrival hook (`is-in`)
must be re-armed on every ClientRouter navigation, not on `load`. The chrome stand-in is dropped
at integration; nothing in the composition depends on its markup, only on `--head-h: 84px`.

## Reproducing it

From `C:\Users\kryst\vm-shot`. Reads local HTML; touches neither dev nor production:

```powershell
node g-shots.cjs "C:\Users\kryst\vm-shot\newsletter-v2\g3-letter.html" "C:\Users\kryst\vm-shot\newsletter-v2\out-g3"
node g-shots.cjs "C:\Users\kryst\vm-shot\newsletter-v2\g3-letter.html" "C:\Users\kryst\vm-shot\newsletter-v2\out-g3" quick
node g2-typed.cjs "C:\Users\kryst\vm-shot\newsletter-v2\g3-letter.html" "C:\Users\kryst\vm-shot\newsletter-v2\out-g3"
```

The page takes `?state=typed|invalid|sending|error|receipt`, `?fail` and `?hold` as G2 does.
