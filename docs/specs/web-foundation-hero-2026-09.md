# VoctFoundation — hero design and implementation plan

Date: 2026-09-18.
Status: superseded as direction on 2026-09-18 by [web-foundation-hero-v3-2026-09.md](web-foundation-hero-v3-2026-09.md) — the developer reviewed §9 and asked for a produced centrepiece (film + title-sequence typography) rather than another typeset composition. §9 stays implemented in the working tree, uncommitted, as the base the third iteration builds on. §2–§3 describe the first composition; §9 records where the second departs from them and why.
Parent brief: [foundation and support page](web-foundation-brief-2026-09.md).

## 1. Decision and scope

**Make the foundation's opening read as a contemporary cultural institution: confident typography, an actual rehearsal photograph, clear ways to act.** The ensemble presents the musical experience; the foundation makes the preparation and people visible.

The current opening uses the same Cormorant light/italic, Latin rubric, gold capsule and separate full-width photograph as the ensemble's editorial pages. Merely changing spacing would leave the requested distinction too weak. The proposed difference comes from a substantial sans-serif headline, one cobalt accent, an asymmetric composition and documentary photography.

This is the user's requested local exception to the parent brief's visual sameness (§3 and §4A) and the public-site canon's shared composition. It applies **only to the opening of `/fundacja`, `/en/fundacja` and `/fr/fundacja`**. Keep the existing brand names, logo, navigation, footer, paper background and factual story. The rest of the foundation page retains its current design for this stage.

Opening boundary: replace the current `.hero` **and its immediately adjacent `figure.plate`** with one hero. The existing `#na-co-ida-srodki` section and everything after it are outside scope. Integrating the plate avoids two consecutive large photographic statements. Do not implement the parent brief's site migration as part of this task; the working tree already contains unrelated navigation, vault, translation and infrastructure work.

## 2. Composition

Desktop, starting at 1100 CSS px: one shared container, maximum width 1240 px, existing `--gutter`; a 7:5 grid with a 48–64 px gap. Text is on the left. The photograph is on the right, vertically centred against the combined headline/lead/actions. The section index spans the entire container below both columns.

```text
                   EXISTING SITE NAVIGATION

  Fundacja VoctFoundation

  Żeby muzyka                     [                             ]
  miała ciąg dalszy.               [  actual rehearsal          ]
                                  [  landscape photograph      ]
  Foundation / ensemble           [  complete original frame   ]
  relationship and preparation.   [                             ]
                                   Rehearsal caption and credit
  [ Chcę wesprzeć ↗ ]
  Dla firm i instytucji ↗

  ───────────────────────────────────────────────────────────────
  Na tej stronie   Costs · Patronage · Partnership · Documents

                   EXISTING COSTS SECTION
```

The diagram describes hierarchy, not literal English product labels. Use the existing localised copy and real anchors. Both action arrows are optional, small, decorative SVGs; an arrow is not a new interaction.

- Start with top padding `clamp(104px, 10vw, 144px)` and bottom padding 40–56 px. Respect the current breadcrumb and navigation clearance. The hero has natural content height, with no viewport lock. At 1440×900, aim to see the headline, both actions, photograph and index; do not shrink readable text to meet a fold.
- Keep the photograph inside the page grid, with straight edges, no card wrapper and no text over it. Its landscape proportions are part of the composition.
- The eyebrow is a plain foundation identifier, without the Latin `Fundatio` prefix. This is page text, not a replacement logo.
- Keep headline wording and emphasis: “Żeby muzyka / miała **ciąg dalszy.**” The emphasis becomes upright cobalt. Aim for two lines on wide desktop; allow the translated phrase to wrap naturally. Do not force nowrap across the whole second line.
- Keep the full existing lead, primary action, secondary action and four-item index. The primary anchor remains `#wsparcie`; the secondary remains `#partnerstwo`. Preserve the primary's existing analytics class.
- Separate the index with one existing-colour hairline. Give it comfortable sentence-case links and clear hover/focus states; it is a useful table of contents, not a decorative microtype band.

Tablet and phone, below 1100 px: one column in DOM order — identity, title, lead, actions, photograph/caption, index. Centre neither the text nor the photograph. Keep actions before the photograph so helping does not require scrolling through a large image. At 760 px and below, the primary can fill the width; the secondary remains a separate text link with a generous hit area. Use a two-column index that becomes one column when content requires it. At 320 px, every label must wrap without horizontal scrolling. No horizontal swipe strip and no sticky donation bar.

## 3. Visual settings

These are implementation starting values, adjustable within the chosen composition after the developer's visual review.

| Element | Setting |
| --- | --- |
| Ground / normal ink | Existing `--paper` and `--ink`; keep the warmth shared with the rest of the site |
| Foundation accent | Local `--foundation-accent: #2446cf`; headline emphasis, primary action and focus outlines only |
| Accent hover | Local `--foundation-accent-hover: #1b35a5` |
| H1 | Existing self-hosted `var(--sans)` / IBM Plex Sans; weight 600; line-height 1.04; tracking about `-.04em`; wide desktop `clamp(64px, 5.6vw, 84px)` |
| H1 below 1100 px | `clamp(38px, 6.2vw, 64px)`; allow additional lines, protect diacritics, no cropped line masks |
| Lead | IBM Plex Sans 400; 18 px / 1.55 desktop, 17 px / 1.55 phone; max-width 46ch; normal style |
| Identifier | IBM Plex Sans 500, 14 px, normal case, modest tracking; no badge/container |
| Primary | IBM Plex Sans 500, 16 px; cobalt fill with white text; minimum height 48 px; 4 px radius; 20–24 px horizontal padding |
| Secondary / index | IBM Plex Sans, 15–16 px; underline on interaction, visible focus; at least 44 px interactive height |
| Caption | IBM Plex Sans 400, 13 px / 1.45; normal ink softened only within readable contrast |

The cobalt has approximately 6.5:1 contrast against the existing paper and over 7:1 against white; retain these exact colours unless replacement contrast is checked. It is a proposed foundation accent, not an existing brand token. Define it on `.foundation-hero`, never on `:root` or `body`.

The desired character is direct, human and cultural. Let scale, alignment, a real gesture in the photograph and the small colour intervention do the work. This recommendation does not need additional ornaments, simulated dashboard elements or an animation concept to be complete.

## 4. Photograph — selected and inspected

Use `web/src/assets/photos/kd-wcielenie-1.jpg` (2560×1703), already present in the approved site corpus. The image shows the conductor on the left and singers working with scores around a table. It makes preparation visible and preserves a human counterweight to the strong headline.

- Keep the **complete original landscape frame**, approximately 3:2, on desktop and phone. Use natural dimensions; do not turn it into a portrait crop or crop out the conductor's hand and singers. No colourisation, tint, additional grayscale filter, vignette or retouching.
- Find its entry by `img === "kd-wcielenie-1"` in the `wcielenie` concert gallery. Its recorded `moment` is `rehearsal`. Use that gallery entry's translated alt as the factual visible caption, followed by the existing `frameCredit` helper's result. The verified EN/FR key is `concert.wcielenie.gallery.kd-wcielenie-1.alt`: resolve it through the existing overlay helpers by image identity, not a numeric gallery index.
- This is a rehearsal for *Kontemplacja Wcielenia*. Do not label it as preparation for *Pochwała Stworzenia*, or inherit a concert date/venue: the rehearsal's date and location are not recorded. Keep the existing gallery and its source files unchanged.
- Since the visible caption describes the same photograph, an empty image alt is acceptable to avoid duplicate narration; keep the `figure`/`figcaption` available to assistive technology, without `aria-hidden` on the figure.
- Use Astro `Picture` (already imported by the page) and the existing photo resolver. Supply intrinsic dimensions, a capped fallback `width`, responsive widths such as 480/768/1024/1536/1920 and honest `sizes` for the grid/single-column regimes. One responsive image, `loading="eager"`, `fetchpriority="high"`; no new runtime JavaScript.

## 5. Implementation map and traps

**Required application file: `web/src/components/pages/FoundationPage.astro`.** Read its hero, plate, imports/data setup and corresponding scoped CSS. Replace that opening in place; keep new selectors under `.foundation-hero`. Update its header description only if it ceases to describe the file truthfully.

| Existing mechanism | Required handling |
| --- | --- |
| `.ink-press` on H1 spans | Remove from the new H1. Its variable-font axis settings override `font-weight` and would make the headline light again. IBM Plex Sans supports 100–700, not 800/900. |
| Global `em` styles | Explicitly inherit the sans font, reset italic and use the local accent on the existing `title2Html` emphasis. Keep semantic `em` and the content contract. |
| `.capsule, .hero-primary` combined rules | Separate hero styling without changing the existing `.capsule` declarations/states used further down the page. |
| `const plate = bleedPair("chor-nawa")` and `BleedImage` | Remove only imports/setup made unused by integrating the plate. `BleedImage` assumes full-bleed coverage, 120% height and parallax; use `Picture` here instead of changing that shared component. |
| Reveal / navigation | Render the complete opening visibly by default. Do not add `reveal`, `ink-press`, delayed entrance or page-level gate logic to the new opening; retain all existing reveal behavior below it. |
| Shared surfaces | Leave `BaseLayout`, `SiteChrome` (light tone), `tokens.css`, `base.css`, shared transitions and canvas/safe-area variables untouched. Do not modify global typography or body backgrounds. |

Reuse current `copy.hero.*` fields. **No rewritten product prose or new translation keys are needed for this design.** The caption/credit reuse existing concert translations and credit labels. The YAML comment saying `Fundatio` remains in markup will become stale: correct that comment only in `web/src/content/pages/fundacja.yaml`, in English, without changing its editorial values. No other source file is expected to need changes.

Translation baseline found on 2026-09-18: foundation EN/FR prose exists in desk drafts, but `pages.en.yaml` and `pages.fr.yaml` have no `page.fundacja.*` entries; routes currently fall back to Polish. This is a pre-existing publishing gap, not completed localisation. Check the design against the existing translated drafts for length, but do not publish unrelated drafts to make this hero task appear complete. The desk's propose/apply operations are not page-filtered. Do not hand-edit generated overlays or trigger a broad publication. Report this separate dependency in the handoff if still present.

## 6. Execution and acceptance

Implement in a fresh session on the Windows **development** machine, directly in `C:\Users\kryst\Moje aplikacje\VoctManager`, on the existing `master` checkout. Inspect the current diff first; preserve other sessions' changes. No branch, commit, push or production deployment is part of this task.

At the end of the implementation stage, from `C:\Users\kryst\Moje aplikacje\VoctManager\web`, run once:

```powershell
npm run check
npm run build
```

These check Astro/TypeScript and the production build. Fix reported problems and rerun only the affected checks. This stage adds no interaction requiring a new test suite. Do not inspect built output or drive the running app; the developer performs the visual review in their browser.

Acceptance for that review: clearly stronger sans typography and cobalt hierarchy; full rehearsal frame; practical visible actions; readable 320/390/768/1024/1440 px layouts and 200% zoom; natural translated wrapping; keyboard focus; no dependency on motion or JavaScript for the hero; correct hash navigation under the shared header. The foundation below the opening and all ensemble pages must retain their previous appearance and behavior. A static hero also satisfies reduced-motion use without a separate animated state.

Record completion and any remaining visual feedback in this file. Do not call the whole foundation page translated, reviewed, or migrated merely because this stage passes.

## 7. References and design judgment

References checked 2026-09-18. These support the direction; they are not templates or evidence of Voct's own activities.

- [Wieden+Kennedy — Foam refresh, 2025, including Foam Talent 2026](https://wkams.com/work/foam-brand-refresh/): a cultural identity built around editorial typography, hierarchy and deliberate visual tension. Adapt that compositional confidence, not its wordmark, motion or campaign graphics.
- [Pentagram — Moholy-Nagy Foundation](https://www.pentagram.com/work/moholy-nagy-foundation): contemporary grotesque typography and restrained neutral grounds in a foundation's archival identity. A precedent for the approach, not a new 2026 launch.

The recommendation for the second half of 2026 is the designer's judgment: clearer institutional character, real photography and economical typography suit this foundation better than borrowing a seasonal effects package. The proposed cobalt, proportions and selected photograph are specific decisions for Voct.

## 8. Completion — 2026-09-18

Implemented as §2–§5 describe, in `web/src/components/pages/FoundationPage.astro` only (plus the
stale `Fundatio` comment in `content/pages/fundacja.yaml`). `astro check` and `astro build` pass.
Screenshots at 320/390/768/1024/1440 for PL and at 1440 for EN/FR, with computed styles read
back: the headline renders IBM Plex Sans 600 with `font-variation-settings: normal` (the ink press
is absent and explicitly cut off), the emphasis is upright cobalt, nothing scrolls horizontally at
320. The developer's browser review is still to come.

Departures from the starting values, and why:

- The emphasised phrase (`em`) is `white-space: nowrap`. At 320 px the second line fell as
  "miała ciąg / dalszy."; keeping the phrase whole gives "miała / ciąg dalszy.". The rest of the
  line still wraps freely, which is what §2 asks for. Every locale's phrase is under ~4.5 em.
- The decorative arrows on the actions were omitted; nothing in the composition needed them.
- The social card (`og:image`) keeps the nave plate `chor-nawa`: the card is not part of the
  opening and the singing ensemble is what a shared link to the foundation should show.
  `bleedPair` therefore stays imported; only `BleedImage` went.

Seen in the screenshots, for the review rather than fixed here:

- 1024 px sits just under the 1100 px grid threshold: single column, the text alone on the left
  half, then the photograph at full container width (922×613). The threshold is §2's; lowering it
  to ~960 would put the photo beside the text at 1024 but at 364 px wide.
- At 1440 the photograph column is 493 px against a 690 px text column that the type only half
  fills. If the opening reads inert, the lever is the 7:5 proportion (a 6:6 or 5:7 grid, or a
  larger cap on the photo), not motion — §3 states the hero needs no animation to be complete.
- FR wraps the first line: "Pour que / la musique / ait une suite." — three lines, permitted by §2.
- The rehearsal frame is monochrome in the corpus: `kd-wcielenie-1.jpg` and its archived original
  both measure equal RGB channel means, so the site's pipeline is not desaturating anything. A
  colour original would have to be a new archive file; replacing the proxy in place would recolour
  the `wcielenie` concert gallery as well, which §4 leaves unchanged.

The translation gap §5 recorded is closed: `pages.en.yaml` and `pages.fr.yaml` carry
`page.fundacja.*` since commit 0b61fca, so `/en/fundacja` and `/fr/fundacja` render translated.

## 9. Second iteration — 2026-09-18

The developer's verdict on §8: acceptable as a first pass, inert, and a question whether a
design like this needs an entrance to live. The diagnosis is compositional. Text left, image
right, centred on a 7:5 grid is the landing-page template of the last decade; the headline at
84px filled half of its 690px column and the photograph at 493px was a thumbnail of the gesture
it was chosen for. §1 asks for an asymmetric composition and confident typography, and §3 for
scale and alignment to do the work — 7:5 with vertical centring is neither.

Two decisions, taken with the developer before implementation:

- **Composition: typographic poster.** The headline runs the whole 1240px measure. Under it one
  row parts 5:7 — the lead and both acts in the narrow column, the rehearsal frame in the wide
  one, both hanging from the same top edge. The numbered index closes the opening across the
  measure. The alternative kept — 7:5 with a larger headline and a 6:6 grid — was rejected as
  the same silhouette at a bigger size.
- **Motion: none; hover only.** `registers.css` states the site's doctrine on entrances: an
  offset is slide-deck physics, a blur-up is the signature of a generated page, nothing starts
  at zero. The ink reveal cannot include the H1 (§5, weight axis) and would leave the acts at
  half ink until a controller runs. The developer chose the static opening over an ink reveal on
  the second row and over a CSS opacity/translate entrance. The one moving thing is the arrow on
  each act: a 3px nudge along the reading direction on hover, transform only.

Values that departed from §2–§3, in `FoundationPage.astro` only:

| Element | Was (§8) | Now |
| --- | --- | --- |
| Grid | 7:5 text/photo from 1100px, vertically centred | H1 full measure; row 5:7 lead/photo from **960px**, top-aligned |
| H1 | `clamp(64px, 5.6vw, 84px)` desktop; `clamp(38px, 6.2vw, 64px)` below | `clamp(80px, 8.6vw, 132px)` from 960 (82 → ~124 at 1440); `clamp(40px, 9vw, 80px)` below; line-height 1; tracking −.045em; `text-wrap: balance` |
| Lead | 18px / 46ch | `clamp(18px, 1.45vw, 21px)` / 1.5 / 40ch from 960; 17px below |
| Photograph | ≤500px wide (38vw) | 7/12 of the measure, ≈686×457 at 1440, ≈510×340 at 1024; `sizes` updated |
| Primary | 48px, radius 4px | 52px, radius 2px, trailing arrow |
| Secondary | text link | text link, trailing arrow |
| Index | flex row of underlined links, hairline above | ruled rows, `01`–`04` in Plex Mono (PrivacyPage's `toc-list` counter idiom), the cell is the link, 4 columns from 960, 2 below, 1 at ≤420; numerals muted at rest, cobalt under the hand |
| Top padding | `clamp(104px, 10vw, 144px)` | `clamp(96px, 9vw, 128px)` — the headline's own size supplies the air |

Measured before implementing, against the self-hosted Plex Sans SemiBold widths: the Polish
second line is ~7.3em with the tracking, so it holds on one line from 390px up and breaks
"miała / ciąg dalszy." at 320 (the `em` stays whole); the French first line "Pour que la
musique" is ~8.5em, inside the measure at every size the clamp reaches. The 960 threshold is
§8's lever for 1024: the row now forms there with a 364px lead column and a 510px photograph.

Trade-off, stated rather than solved: at 1440×900 the index's rule sits near y≈1000, just below
the fold. The poster scale is this iteration's point; §2 says "aim", and forbids shrinking
readable text to meet a fold. If the review finds the opening too tall, the lever is the H1 cap
(132 → 112) before anything else.

For the browser review: the 1024 row (narrow lead beside the photo — does it read as a row or as
two orphans); FR at ≤420, where the first line wraps and the H1 runs to three lines; EN's
"The foundation and its documents" wrapping to two lines in its 286px index cell at 1440; the
arrows — decoration §2 allowed and §8 omitted, added here because the acts now sit under a
21px lead and a 124px headline and need a direction of their own.
