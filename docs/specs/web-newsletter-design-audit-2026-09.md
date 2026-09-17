# Newsletter: design and experience audit

Date: 2026-09-16. Status: **Audit complete; design recommendations for a fresh design session. No application changes made.**

Scope: the current, uncommitted `/newsletter` in `web/`, with `/nuntius` and recovery states where they complete the same experience. The three supplied screenshots show the rejected paper treatment and two views of the current register. The implementation record is `web-newsletter-leaf-implementation-2026-09.md`; the breviary brief is historical evidence, not an implementation instruction.

Evidence: supplied desktop screenshots, source inspection, two existing photographic assets, and primary references linked below. No live browser inspection, mobile screenshots, assistive-technology testing, delivery testing, or performance measurements. Earlier reported build/test results were not rerun and do not establish design quality. Findings below distinguish visible observations, source findings, and hypotheses.

## Judgment

The original brief made simulated stationery the protagonist. Its layered paper, shadow and metallic bookmark carried more identity than the invitation itself. Describing these props as a contemporary edition did not make their execution contemporary. This was a conceptual error, not merely an insufficiently refined ribbon.

The current version removes that obstacle and establishes a usable editorial vocabulary. It still feels interchangeable: dark ground, fine serif, muted gold, small capitals and rules communicate a cultural category rather than this ensemble. The headline, explanation and action are too detached from one another. The register solves the problem of filling a page more convincingly than it solves the problem of inviting someone.

Neither serif typography nor restraint is obsolete. “Looks like 2012” is a reaction, not a useful acceptance criterion. There is also no defensible recipe for what the best designers will want at the end of 2026. The relevant tests are specificity, hierarchy, legibility, interaction quality and the truth of the offer.

## Findings and priorities

Priority 1 means resolve before implementation is considered finished. Priority 2 means include in the next composition study. These priorities express impact, not estimated conversion gains.

| Priority | Finding and evidence | Recommendation |
| --- | --- | --- |
| 1 | **The invitation is split into separate reading paths.** Screenshot 2 puts the largest phrase at the left, its explanation at the far right, the concert below the phrase, and the form below the explanation. The button finishes at the outer right edge. | Group headline, offer, email and action into one continuous reading sequence. Let the concert support that sequence from a secondary region. |
| 2 | **Empty space often separates related content.** The large space after NUNTIUS and the broad central gutter do not consistently establish a useful hierarchy. The CSS expressly sizes the working column to shorten the consent clause (`notice.css:659`). | Size the form for reading and entry, then compose the surrounding space. Do not make legal copy length determine the whole page. Avoid uniformly shrinking every gap. |
| 1 | **Functional typography is over-miniaturized.** Source sizes are 11 px for labels, 12.5 px for the clause and 10 px for the CTA (`notice.css:1154`, `:1174`, `:1182`). The screenshot reinforces the disparity with the display headline. | Study labels at 13–14 px, clause at 14–15 px, button at 14–16 px, and ordinary reading text at 16–18 px. These are design targets, not WCAG minima. Use sufficient weight, not opacity alone, to support reading. |
| 2 | **Four type families have distinct roles but little room to perform them.** Cormorant, Cinzel, Plex Sans and Plex Mono accumulate in a small amount of content. Latin, roman numbering and tracked labels compete for attention. | Retain Cormorant for display and Sans for use. Reserve Cinzel for one quiet naming role; keep Mono only where actual metadata benefits. Do not commission another font to evade the hierarchy problem. |
| 1 | **The offer is less specific than the information already available.** “Zostaw e-mail. Damy znać o naszych koncertach.” names the mechanism, but gives little sense of the useful contents of a message. | Describe the real service: concert invitations with place, date and programme. Promise a fixed frequency only after the sending policy is settled. |
| 1 | **The register does not prove email frequency.** The implementation record argues that a count of evenings establishes cadence. But `concerts.yaml:1111` has multiple performances of one programme; `:2141` does too. The UI rows represent cycle programmes, not individual messages or necessarily individual events. | Present the archive as evidence of the ensemble's work. Never infer newsletter frequency from its row count. Rename “Najbliższy wieczór” to “Najbliższy koncert”: the displayed event starts at 13:30. |
| 2 | **The archive is the strongest editorial element, but its metadata is spread too far apart.** Screenshot 3 sends location and date to the far end of long leaders; five tracks compete with the title. | Keep the archive. Make titles primary; group city/date into a compact supporting area and constrain its reading measure. Retain Latin and numerals only where they clarify continuity with the concert cycle. |
| 2 | **The visual identity lacks an authentic human or musical anchor.** Actual concert names are present, but the visitor mostly encounters generic prestige signals. | Introduce one carefully selected ensemble asset if it improves the composition. A strong photographic edit can establish people, proximity and place. A weak asset should be omitted. |
| 1 | **Mobile gives the full concert preview precedence over signup.** `NoticeSignup.astro:157` places it before the form; `notice.css:1487` stacks that order below 760 px. | On mobile, put the offer and email before the extended preview. A short event line may precede the email. Exact fold position is unverified; do not claim a measured number of screens. |

The current archive, actual upcoming event, open layout, restrained palette and warm headline are worth retaining. “Do zobaczenia.” can work when it belongs to a clear invitation. Enlarging it further will not supply the missing idea.

## Recommended composition

**A direct invitation from the ensemble, supported by a concrete glimpse of its work.** This is a content and hierarchy decision, not a new physical-object metaphor.

On desktop, study a continuous invitation column containing the small page label, “Do zobaczenia.”, the useful offer and the form. Its heading should take its scale from that column rather than dominate a separate horizontal row. Keep the action on the same reading axis as the fields. The second column carries one authentic image and a compact upcoming-concert entry. Avoid making both columns compete as independent heroes. Start with an overall measure around 1120–1280 px instead of stretching the functional composition to 1560 px; judge the result with real content rather than treating those numbers as law.

The concrete artistic decision should be the relationship between the people in the selected frame and the invitation beside it: voices directed toward a shared point, proximity to a listener, or the conductor's gesture. Preserve the image's real light and colour. Do not substitute a generic church interior, a gold-tinted stock photo, or generated evidence of a performance. Place text on a stable solid ground; the photograph does not need to become a backdrop.

On mobile, the order should be: identity and headline, useful offer, email and action with disclosure, optional supporting material, upcoming concert details, archive. Essential event context can remain near the offer without placing the entire blurb in front of the task. The layout must also work when there is no announced concert or no suitable image.

Keep the dark ground for the first study so hierarchy can be judged without changing the entire visual language. There is a documentation conflict: `.ai/07_marketing_public_site.md` names light parchment as the main identity, while this implemented page deliberately uses night. Record the chosen page treatment in the next brief; do not silently turn an audit of newsletter hierarchy into a site-wide palette migration.

Suggested product copy for study:

- Label: **Zaproszenia na koncerty**; NUNTIUS may remain secondary.
- Headline: **Do zobaczenia.**
- Offer: **Wyślemy Ci zaproszenie na kolejny koncert — z terminem, miejscem i programem.**
- Action: **Chcę otrzymywać zaproszenia**.
- Supporting entry: **Najbliższy koncert**.

The offer and action are proposals, not approved consent wording. Retain the current disclosure's substance, including its succession sentence, while improving its readability. Do not hide it in a collapsed control to make the composition shorter. The outstanding privacy-policy history entry belongs to its existing workstream; this audit does not resolve legal sufficiency.

Consider offering the optional name after confirmation: the service primarily needs an address, and the existing flow already supports managing the greeting. This is a product choice for the next brief, not an instruction to silently remove the field or its disclosure. A visible, genuinely optional name field remains defensible if personal address is important to the ensemble.

The archive should stay as a compact editorial ending, not a second conversion pitch. A purely typographic treatment remains a viable fallback if no image passes selection. Its success would depend on rhythm, grouping and content, not adding a decorative waveform or animated score.

### Asset assessment

Two existing files were visually inspected. `web/src/assets/photos/kd-hymn-4.jpg` provides an actual ensemble and strong spatial depth, but the bright altarpiece, border and embedded credit dominate this export. It is not a ready hero asset. `kd-9-kart-6.jpg` conveys shared space with the audience, but its frontal light flare and technical equipment compete heavily with people. Neither is selected by this audit. Use a suitable authorized source and honest attribution; do not erase credits as a layout shortcut. Historical photography must be captioned as historical rather than imply that it depicts the future concert.

## Experience defects beyond the still frame

These are source findings; their observable runtime symptoms have not been reproduced in a browser.

| Priority | Evidence | Required outcome |
| --- | --- | --- |
| 1 | `NoticeForm.tsx:203` captures the submitted email, but inputs remain editable at `:387`; the receipt reads current state at `:511`, and resend reads it at `:289`. | With a slow response and an edited field, receipt and recovery still refer to the address actually submitted. |
| 1 | The email error renders after disclosure and action at `NoticeForm.tsx:469`; the input lacks an error association at `:387`. | Put the field error beside the field, associate it programmatically, and distinguish it from a request failure. |
| 1 | Resend sets both a cooldown and success at `NoticeForm.tsx:295`, but `waiting > 0` hides that success at `:537`. | Immediately acknowledge the resend request; show availability separately. Avoid a seconds-updating live region. Actual screen-reader announcement behaviour requires testing. |
| 1 | `NuntiusIsland.tsx:225` switches to error after a failed confirmation/unsubscribe; the relevant action exists only in the original states at `:341`. | Provide an in-context retry without making the person reopen the email. |
| 2 | Backend limits are 80/254 characters (`outreach/serializers.py:47`); the form does not reflect them. Requests have no explicit application timeout (`api/notices.ts:107`). | Handle field constraints and prolonged requests coherently, preserving entered values. |
| 2 | `cursor.css:17` suppresses native cursors site-wide. | Restore the normal text cursor inside form fields. Judge the decorative cursor separately from this precision task. |

Preserve real labels, email autofill, input text at least 18 px in this variant, full-width mobile action, focus movement into the receipt, reduced-motion handling and the distinction between request accepted and subscription confirmed. These are existing strengths.

Keep the transition into the receipt local and quiet. The remaining diagonal “leaf” departure was conceived for a physical object that is now absent. Study a short opacity transition without moving the whole invitation away. No essential text should wait for a reveal. The success state, correction, resend and failure states deserve the same compositional care as the empty form.

## Accessibility evidence and boundaries

Nominal contrast calculations use `--paper #f4f1e9`, `--dark #080807`, CSS alpha compositing and WCAG relative luminance. They are not sampled screenshot or live computed-style measurements:

- Archive numerals at alpha 0.38 (`notice.css:1013`) give approximately **3.21:1**; the upcoming numeral at 0.42 (`:874`) gives **3.70:1**. At 12.5/15 px these are below the 4.5:1 normal-text criterion if they convey cycle numbering, as the implementation intends.
- Placeholder alpha 0.48 gives **4.53:1** on the plain base: very little margin. The gradient and actual compositing still need validation.
- Input underline alpha 0.26 gives approximately **2.08:1** on the base. Where that line identifies the input, it should reach the applicable 3:1 non-text contrast requirement. Decorative archive rules need not meet that same threshold.

Small font size alone does not establish WCAG failure. Passing a colour ratio also does not make thin, tiny text comfortable. W3C explicitly discusses thin type and antialiasing in [Contrast Minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html); control indicators are covered by [Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html). Use 44 px comfortable action targets as a design target, not a misstatement of the AA rule: [Target Size Minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) specifies 24 CSS px with exceptions.

Global focus-visible styling exists. Do not report that all focus indicators are missing. Header/content overlap in screenshot 3 is a verification item rather than a diagnosed sticky-header bug. No mobile, zoom, performance or full WCAG conformance claim can be made from these desktop screenshots.

## Reference points

These primary sources were checked on 2026-09-16 through their published descriptions and page content, not a live visual interaction audit. Their lessons are specific; none proves that imitation will produce an award-winning result.

- [Kunsthalle Basel / PORTO ROCHA](https://www.portorocha.com/kunsthallebasel): a distinctive serif, legible supporting sans and artwork coexist. The lesson is the division between expressive identity and reading comfort, not a requirement to animate the logo.
- [PAC NYC / PORTO ROCHA](https://www.portorocha.com/pacnyc): its visual device comes from the institution's architecture; its voice acts as an approachable host. VoctEnsemble needs a comparable connection to its own practice, not PAC's frames or scale.
- [Amsterdam Sinfonietta / Studio Dumbar](https://studiodumbar.com/work/amsterdam-sinfonietta-identity): the graphic system relates to actual music. The [poster account](https://studiodumbar.com/work/amsterdam-sinfonietta) dates the identity to 2018, usefully disproving the idea that recency alone establishes quality. Do not copy a generative effect without its musical reason.
- [Berliner Philharmoniker newsletter](https://www.berliner-philharmoniker.de/en/newsletter/): describes the actual contents and monthly rhythm. Borrow the concrete promise, not the large institution's many preferences or required personal fields.

## Next stage and acceptance

Start a fresh design session from this audit. Produce one coherent desktop/mobile composition and its receipt/error states before implementation. Use real copy and actual image candidates. Review it against the existing register, not against the rejected paper version; beating the latter is too low a bar.

The next brief should name these potential implementation files: `web/src/components/NoticeSignup.astro`, `web/src/styles/notice.css`, `web/src/components/NoticeRecord.astro`, `web/src/components/pages/NewsletterPage.astro`, `web/src/islands/landing/NoticeForm.tsx`, `web/src/islands/landing/NuntiusIsland.tsx`, `web/src/i18n/content/nuntius.ts`, and `web/src/content/pages/koncerty.yaml`. Include the existing web copy/translation workflow for all three locales. Shared signup placements require an explicit scope decision; an audit of this page is not authorization to redesign all of them.

Separately, `web/src/lib/noticeRegister.ts:135` selects one upcoming programme and `:143` assigns every other programme to the past record. Additional future programmes would therefore be misclassified; it also ignores performance-level `dates[]`. The current upcoming label is fixed at build time (`NewsletterPage.astro:67`). Retain the existing post-event deployment obligation and specify correct empty/multiple-future-event behaviour before relying on the register more heavily.

Acceptance checks for the next stage:

1. A new visitor can explain what they receive and identify the action without decoding NUNTIUS or exploring the archive.
2. Heading, offer and form read as one invitation; the composition remains convincing without photography or an announced concert.
3. On 390 px mobile the extended concert preview does not precede signup; 320 px reflow and 200% zoom preserve content and actions. Judge real screens, not assumptions about the fold.
4. Functional text remains comfortable; focus, control contrast and targets are verified, including keyboard use and a screen reader for recovery.
5. Submission, slow response with edits, correction, resend, API failure, confirmation and unsubscribe all preserve the correct address and offer a clear next action.
6. Historical images and programme rows make no false claim about upcoming performances or sending frequency.
7. Assess recognition without the logo: actual ensemble content and editorial choices should carry identity. A more decorative effect is not evidence of improvement.

No conversion lift is asserted. If measurement is later introduced, evaluate completed confirmations and failures as well as submissions, following the site's existing privacy constraints. No trackers are proposed by this audit.
