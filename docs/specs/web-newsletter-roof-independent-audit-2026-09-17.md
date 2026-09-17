# Newsletter roof: independent design audit

Status: Audit complete. Recommended design changes remain unimplemented and require rendered comparison.
Date: 2026-09-17

## Scope and evidence

Read only sections 2, 3 and "Where this still has room" of
`docs/specs/web-newsletter-composition-2026-09.md`, plus the supplied local study and renderer.
No memory documents or production source were inspected. Existing working-tree changes were left alone.
This is an audit of `C:\Users\kryst\vm-shot\newsletter-v2\d-roof.html`, not an assertion about the live product.
The existing `c-axis` screenshots were also inspected as a comparison, not re-rendered.

Evidence directory:
`C:\Users\kryst\.codex\visualizations\2026\09\17\01a0af4f-5991-7273-b9ac-2e7be74a0c5c\newsletter-audit`.
It contains the supplied renderer's three baseline screenshots, nine supplementary full-page renders,
`measurements.json`, deterministic paused animation samples and settled warmth samples.
The supplementary `audit.cjs` uses the supplied HTML and local Edge; it changes no source assets.

## Verdict

The page has a coherent palette and an economical invitation, but its ambition exceeds its current
composition. The photograph reads as a tightly cropped band of performers. The prose describes a room
seen from a listener's seat. The foreground and architecture that would make that distinction convincing
are largely cropped or dissolved away. The lower half then resolves into a conventional signup and a
visually subordinate event listing. More elaborate fades will not close this gap.

Retain frame (63), the roof idea and the main sentence for the first corrective prototype. Change the
photographic scale, event hierarchy and page rhythm before pursuing another visual effect. The recommendation
is a hypothesis for the next render, not a claim that an unbuilt design has already succeeded.

## Findings, in priority order

| Priority | Evidence | Consequence and correction |
| --- | --- | --- |
| High | At 844x390, the photo is clamped to 340px but title placement still uses 52svh (202.8px). The title begins at y=68.8; the offer crosses faces and lit scores. | Derive both photo height and text placement from one resolved dimension. In short viewports, let content flow below the photograph. Scrolling is preferable to text over faces. |
| High | At 820x900 the phone crop cuts heads at the top. At 821x900 the desktop crop becomes a close-up of the conductor. | A single 820px switch conflates photo art direction and layout. Introduce a tablet treatment of the same photograph, and validate crop by aspect ratio as well as width. |
| High | At 320x568 the invite grows to 287.6px inside a nominal 264px content area. Its right edge reaches x=315.6. | The unbreakable CTA contributes a min-content width that consumes the right gutter. Permit grid children to shrink and adjust the CTA treatment without reducing legibility. |
| High | The next event is small and dim beside the form; on 390x844 its title is below the first screen. The photo credit follows that future event. | Make the upcoming evening a reason to subscribe. Give it a clearer title/date hierarchy, a visible programme link, and identify the historical photograph explicitly. |
| Medium | Four type families, spaced capitals, Roman numbering and two layers of Latin labelling compete in a short page. | Preserve Cormorant for the invitation and programme, Cinzel for the masthead, Plex Sans for reading and controls; restrict Mono to actual metadata. Reduce simultaneous small typographic signals. |
| Medium | At 500ms, offer opacity is 0.433 and controls remain at 0.42. At 1000ms, the action is only at 0.725. | Keep essential text and controls fully readable from the first paint. Animate the photograph, with a shorter restrained exposure change. The current entrance resembles a disabled interface. |
| Medium | The supplied HTML ends after the event and credit; there is no record section. | The whole-page rhythm cannot be judged from this first movement. Build the actual next event plus a compact past-programme register before claiming the page is complete. |

The 1120px measure includes viewport-dependent padding. Its usable width decreases from about 976px
at 1440 to 928px at 1920. This explains why the photo grows while the invitation becomes relatively
more isolated. Separate the outer viewport gutter from the inner reading measure in the next study.
Likewise, the aside's fixed 112px top padding aligns at the largest headline size but drifts as the
headline shrinks. Align it to content rows, rather than one desktop offset.

## Recommended design direction

1. **Show a room that contains people.** Preserve meaningful foreground and some vertical architecture.
   Test a bounded photo scale on very wide screens, with the page ground continuing around it, and a
   crop specific to tablet proportions. Do not enlarge a narrow strip until the conductor becomes the
   entire subject. If the available source cannot supply that spatial depth, accept the limit and
   commission/select a suitable photograph instead of simulating it with stronger gradients.
2. **Keep the intimate invitation.** The main sentence and the concrete one-letter-before-each-concert
   promise are sufficient. No additional emotional slogan is necessary. Preserve the easy-to-find email
   label and a comfortable button target. Fit the control to the measure instead of shrinking its text.
3. **Make the event editorially useful.** Promote the programme title and readable date/place. Retain a
   real work title and an explicit programme link. On phones, test a single factual next-event line
   before the field; keep the expanded preview below the action. Avoid burying the field beneath a card.
4. **Separate the two evenings.** Begin the historical caption with an explicit photo identifier and
   associate it with the image, not the future concert's metadata. Keep the credit readable without
   forcing it across the brightest portion of the photograph.
5. **Give the lower page another rhythm.** Start with the future programme, then a compact typographic
   register of past programmes. Titles lead; venue/date follow; Roman numerals stay subordinate.
   Use factual derived totals only. A continuous warm-paper section is a worthwhile comparison for
   tonal relief, but a larger dark-space rhythm may be sufficient. Do not turn the register into a
   gallery of cards or an unrelated second hero.
6. **Spend motion on one event.** Keep the image arrival restrained, roughly 600-900ms as a prototype
   target, with no staggered dimming of reading matter. Compare warmth only on meaningful success,
   accompanied by explicit status text. Neither hovering nor typing means someone has subscribed.
   A sent confirmation email also must not be described as completed subscription.

## Alternatives and discarded absolutes

| Direction | Strength | Cost | Recommendation |
| --- | --- | --- | --- |
| Corrected roof (63) | Real ensemble, warm faces, existing invitation language | Requires crop and hierarchy work across intermediate sizes | First prototype |
| Axis (36), existing c-axis | More singular silhouette and vertical light structure | Form occupies the shaft; faces lit from below read more spectral to this reviewer; event loses the first screen | Not an automatic upgrade |
| Dark room followed by a light editorial invitation | Stronger tonal rhythm; paper has a real function as the place for the letter and programme | A genuine redesign requiring a complete responsive proof | One competing prototype if the corrected roof still feels generic |

Using different photographs at different breakpoints is not inherently wrong: two images can describe
the same event. It needs accurate descriptions and attribution, but that is a content responsibility,
not a universal design prohibition. The current evidence does not show that it would improve this page.

A top gold rule is also not intrinsically wrong, but here it adds a second horizontal divider without
improving navigation or meaning. Keep it absent in the first prototype. Likewise, full-alpha fades are
appropriate at a photo-to-flat-ground seam; an image touching the viewport boundary does not acquire a
visible internal seam merely because its first pixel is not fully black. Evaluate actual boundaries.

The current "Where this still has room" section still refers to the axis, four illuminated scores and
its second movement. It must not be used as an implementation checklist for the roof without reconciliation.

## Measurements and their limits

The supplied renderer, after its 3.4-second settling wait, reports:

| Viewport | Mean weighted sRGB | Pixels below 24 | Reported headline "worst" |
| --- | --- | --- | --- |
| 1920x900 | 21.5 | 86% | 9.90:1 |
| 1440x900 | 23.3 | 85% | 9.60:1 |
| 390x844, DPR 2 | 27.3 | 82% | 5.88:1 |

These measurements reproduce the darkness, not the aesthetic diagnosis. Black-area share includes
text and button pixels and depends on viewport height. It is not a score to optimise.

The renderer assumes opaque paper for every probe. The offer actually has alpha 0.82; supplementary
compositing gives approximately 11.4-11.9:1 over its settled background, not 17+:1. Its "worst" is the
99.9th luminance percentile, not the absolute worst pixel. All these probes examine an element's full
rectangle and remove its text shadow. They cannot establish contrast at individual glyphs. The short
landscape render visibly fails composition; box samples around 1:1 flag the collision rather than
constituting a complete WCAG assessment.

The official guidance requires 4.5:1 for normal text and 3:1 for large text, and explicitly cautions
that thin strokes can look weaker despite nominal compliance:
[W3C contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).
Include 320 CSS pixels in acceptance:
[W3C reflow guidance](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html).

The supplied `--frames` sequence waits 200/250/250/250ms, so its t800 and t1600 labels do not represent
those times. The `--warm` sequence waits only 140ms against a 1.9s transition. The supplementary study
pauses animations at explicit timeline positions and waits 2s for warmth, confirming computed opacities
0, 0.62 and 1. The settled warmth remains modest; it should support feedback, not carry meaning alone.

The reference is a visual study: no form submission, success/error states, real concert/privacy links,
or main landmark are present. Those omissions are not reported as production regressions. Reduced motion
is respected at initial load; switching the preference later leaves an obsolete headrule selector and
does not explicitly suppress the action's pseudo-rule transition. Button focus also lacks the photo
response that hover receives. Validate the complete keyboard and status flow during integration.

## Next stage and files

Start a fresh session from this audit. Build one revised study named `e-roof-editorial.html` in the
evidence directory, using the reference's existing image/font assets. Only add `f-letter.html` for the
light-letter alternative if a second direction is actually needed. These are proposed filenames, not
existing deliverables. Render the whole page and actual pending/success/error states, not just its opening.

Acceptance widths/heights: 1920x900, 1920x1080, 1440x900, 1024x768, 821x900, 820x900, 390x844,
320x568 and 844x390; also check enlarged text, reduced motion and keyboard focus. Essential text must
be legible immediately; photo crops must preserve people; margins must survive the CTA; future-event
metadata and the historical photo must be unambiguous. Do not gate success on a target black percentage.

Before production integration, inspect the current versions of `web/src/components/pages/NewsletterPage.astro`,
`web/src/styles/notice.css` and `web/src/components/NoticeRecord.astro`, and locate their actual signup
state owner. These are candidate integration points, not an implementation map verified by this audit.
The working tree contains ongoing newsletter/consent work; do not overwrite it.

Reproduce the original baseline locally on the developer's Windows machine, from `C:\Users\kryst\vm-shot`:

```powershell
node newsletter-study.cjs "C:\Users\kryst\vm-shot\newsletter-v2\d-roof.html" "C:\Users\kryst\.codex\visualizations\2026\09\17\01a0af4f-5991-7273-b9ac-2e7be74a0c5c\newsletter-audit" baseline
```

For the supplementary matrix and corrected motion samples, run `node` with the absolute path to
`audit.cjs` in the evidence directory. Both commands inspect local HTML; neither targets dev or production servers.
