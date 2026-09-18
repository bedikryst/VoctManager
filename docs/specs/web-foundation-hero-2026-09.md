# VoctFoundation — hero design and implementation plan

Date: 2026-09-18.
Status: design recommendation ready for implementation in a fresh session; no application code changed and no browser review performed.
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
