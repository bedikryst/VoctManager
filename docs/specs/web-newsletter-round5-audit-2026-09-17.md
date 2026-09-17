# Newsletter, round 5: why the spread does not close it either

Status: Audit only. No prototype built, nothing integrated. Written against prototype F after the
developer judged both E and F generic.
Date: 2026-09-17
Audits: `docs/specs/web-newsletter-roof-portfolio-audit-2026-09-17.md` (round 4) and
`docs/specs/web-newsletter-roof-corrected-2026-09-17.md` (round 3)
Studied: `C:\Users\kryst\vm-shot\newsletter-v2\f-letter-spread.html`, renders in `out-f\`
(1440×900 fold and full, 1920×1080, 390×844, receipt), and F's motion rules in source.

## The verdict

Round 4 diagnosed E correctly and then built the diagnosis rather than a design. Each of the six
faults got a local substitution: the melt became an inset plate, one ground became two, the missing
letter became a cream rectangle holding the text that was already in the right column, the invisible
warmth was deleted, the colour hover became an apparatus hover. Every substitution is an improvement
and the page's logic is untouched — photograph, headline, promise, field, button, credit, list,
closing line, in that order, as in E, as in the study before it.

**That is why it still reads as assembled rather than designed: it has an arrangement, not an
argument.** A page that a designer wants in a portfolio can be named in one sentence that is about
this ensemble and this offer. F's sentence is "an inset photograph beside a form, with a card." The
faults are gone; the anonymity is intact, because the faults were never what made it anonymous.

## Why it does not close it

1. **Two protagonists that never meet.** The act (label, field, consent, button) lives in the dark
   column. The letter lives on the sheet, with an empty `DO` rule on it. So the page shows the
   artefact and separately operates a UI about the artefact. The sheet is decoration for the form and
   the form is a control panel for the sheet; neither is the page. The one gesture this page could
   own — *the reader's address being written onto the letter* — is split across 500 px and two
   materials. F half-admits this: on the receipt the address does appear on the `DO` rule, which is
   the best moment on the page and the only one that arrives too late to be seen by anyone deciding
   whether to subscribe.

2. **The receipt is drowned.** `f-1440x900-receipt.png`: `Sprawdź skrzynkę.` stacks under
   `Do zobaczenia.` (round 4 claimed the offer was removed so two serif headings would not stack —
   the render shows them stacked), followed by four lines of small sans about spam folders and
   seven-day links. The event — sheet lifting, address written — is bottom right, competing with
   support copy top right. The room does not acknowledge it at all; the plate is pixel-identical
   before and after.

3. **Scroll is dead space.** 1917 px of page and the only things that happen in it are hairlines
   drawing themselves in act two. The first screen is finished in 720 ms of photograph cross-fade and
   then never changes: everything is at full opacity in frame one, so arrival is a picture
   materialising behind type that was already placed — backwards, since the room is the thing that
   was always there and the letter is the thing that is being handed over. The developer's reading
   ("everything is dropped in at once, the animation is only the rules further down") is exact, and
   the fix is not to add effects to this composition. **The scroll has to carry the composition**:
   round 3 was right that staggered `.reveal` fades read as a broken interface, and the conclusion
   drawn — remove motion — left the page with no time dimension at all.

4. **The photograph is the weakest asset and it is the first thing anyone looks at.** The 4:5 crop's
   protagonist is the conductor's back, dead centre; the top ~40 % of the plate is near-black vault
   carrying one red sanctuary lamp. `project_web_newsletter_leaf_2026-09` records the conductor's
   back as a rejected subject ("tells the reader nothing") — F reinstates it and frames it. At 1920
   the plate is 713 px of a 1920 px viewport, so the picture is also small. A portfolio page's
   photograph stops you; this one is atmospheric wallpaper with an empty half.

5. **Nothing on the page could only be this ensemble.** No music, anywhere, on a page selling
   invitations from a vocal ensemble: no notated fragment, no line of sung text, no recording. The
   one proprietary system the page owns — the Latin rubrics, `Laudes / Lamentum / Memoria / Psalmi /
   Terra / Incarnatio`, with the roman folio `LIST VI` — is set at 15 px italic as a subtitle and at
   10.5 px in the corner. Swap the names and dates for another choir's and the page is unchanged.

6. **Two type sizes pretending to be a scale.** Display 60 px at 1440, entry titles 22 px, and
   everything else between 10.5 and 17 px. The closing `Pięć programów, osiem wieczorów.` at up to
   68 px is the only other large thing and round 4 was right to build it. Between 22 and 60 there is
   nothing, so the page has a headline and a body and no register in between — the flatness reads as
   default, not as restraint. Cormorant (300–700) and Cinzel (400–900) are still loaded as variable
   fonts and used at two static weights; round 4 listed this as a dating tell and did not fix it.

7. **The dark half has no ground.** Flat `#080807` behind a cream card is a dark-mode interface, not
   a printed object. No grain, no vignette, no tonal variation across 900 px of black. This is the
   cheapest reason the paper reads as a `div` with a background colour.

8. **The seam is a colour change at a y-coordinate.** Round 4's strongest move is real, but nothing
   *causes* it: the background turns to paper at a fixed point, with a gold rule drawn across it. The
   page does not change behaviour across the seam, so the two grounds are a graphic device rather
   than two places.

## What F got right, and must not be rebuilt

The inset hard-edged plate (and with it the end of gradient-contrast arithmetic); `width: 100%`
beside `aspect-ratio` + `max-height`; two grounds; the printed register with hanging numerals and
tabular dates; container queries with `@media` left only to art direction and the landscape-phone
case scoped with `(pointer: coarse)`; the recomputed paper-side tints and `--candle-ink #7a5f26`;
apparatus hover instead of a colour flash; the closing line at size; `--warmth` deleted.

## Four structural moves

**G1 — One object: the address is written onto the letter.** The field, the consent line and the
button leave the dark column and land on the sheet. `DO` over a ruled blank *is* the input; the
consent line is the sheet's footnote; the act is an ink label under a hairline that fills, not a
filled rectangle. The dark column then holds three things: the display line, one sentence of offer,
and the credit. Buys: the page states its thesis in a single frame, the first screen gains a
protagonist, and commitment happens in one place — the address written, the sheet lifting, the folio
turning to `LIST VII`. Costs: four form states re-set on paper (invalid, sending, error, receipt);
contrast already recomputed in F. This keeps the accepted premise — the room is still the ground,
the reader still sits in the nave — and moves only the act.

**G2 — The first screen is a stage, not a poster.** The plate sticks for one viewport. As the reader
scrolls, the sheet rises over the room and *its* paper becomes the page's paper, so the seam is
caused by the letter rather than declared at a y-coordinate. Arrival inverts: the room is present in
frame one, the type is set, and the single event is the sheet arriving (translate + shadow, ~620 ms,
once). All of it on `animation-timeline: scroll()/view()`, no JS, everything static under
`prefers-reduced-motion`. This is the move that separates 2026 from 2021: not more animation, but
the scroll being the medium the composition is built in.

**G3 — Re-cut the photograph, and give it more of the viewport.** Criteria, to be measured rather
than argued: lit faces at a third of the plate, a lit foreground object (the brass lectern earns its
place), no more than ~20 % of the plate spent on empty vault, and the plate at ≥ 40 % of viewport
width at 1920. Two candidates from frame (63): a tighter portrait on the two lit singers with the
lectern, or the wide room placed as a hard-edged plate at a larger share. Cheapest large gain on the
list; `cut-portrait.cjs` already does the work.

**G4 — Promote the ensemble's own apparatus.** The Latin rubrics and roman folios become the page's
structure: hanging in the margin at size, indexing the register, closing the page. Add the one thing
entirely missing — a line of what is actually sung that evening (`Cantate Domino canticum novum`)
set at true scale as the page's single quotation. It supplies the missing typographic step between
22 and 60 px, and it is the only element on the page that no other ensemble could publish.

**Supporting, not structural.** Ground the dark half with grain and a vignette keyed to the plate.
Use the variable axes that are already loaded (optical weight at display size, tighter tracking
above 48 px). Move type to rem during integration, as round 3 and 4 both deferred.

## Open decisions that belong to the developer

- G1 contradicts nothing in the accepted premise but does invert where the act lives. If the act must
  stay dark-side, G1 collapses to a decorative sheet again and the page needs a different thesis.
- `Chcę otrzymywać zaproszenia` vs `Zapisz mnie` is still untaken from round 3 §3, and G1 changes the
  question: on the sheet the label is an ink line under the address, where the long form no longer
  forces the 320 px wrap.
- Whether to build G1+G2 as prototype G before touching `web/`. Rounds 3 and 4 were each one session.

## Working tree caution, carried forward

`NoticeForm.tsx`, `notice.css`, `NoticeRecord.astro`, `noticeRegister.ts`, `consent.py` carry
unrelated newsletter and consent work and must not be overwritten. This pass wrote only this file.
