# Dark mode — specification (2026-08)

Status: **Stages 0–7 shipped; the dark map (§9.3) is the only thing left in this spec** · Audited
2026-08-30, §1.2 re-measured and half-shipped 2026-08-31 (the light theme's own contrast, which
§7 hands to a separate pass — the accents turned out to be the smaller half of it) · Surface:
`frontend/` (panel
PWA only). `web/` (Astro marketing site), the WeasyPrint PDFs and the e-mail templates are out of
scope — see §7.

## The finding first

The panel has no dark mode and no semantic colour layer. It has something more useful than
either: **a palette that is already an ordered value ladder, declared entirely as CSS custom
properties, and referenced through `var()` by every compiled utility.** That is verified against
the built stylesheet, not assumed (§1.3).

So this is not a "sprinkle `dark:` across 266 files" job. Measured against the tree as it stands:

| | occurrences | files | flips for free? |
|---|---|---|---|
| `*-ethereal-*` colour classes | 2 932 | 266 | mostly — see below |
| …of which carry an alpha modifier (`/60`) | 1 722 | — | yes, via `color-mix` |
| `border-hairline` / `divide-hairline` | 233 | — | yes |
| `bg-glass-surface` / `border-glass-border` | 16 | 9 | yes |
| `shadow-glass-*` / `shadow-button-*` | 127 | — | **no — build-time inlined (§1.4)** |
| stock `white` / `black` literals | 194 | 46 | no — hand work |
| `text-ethereal-marble` (ink on a dark island) | 83 | — | no — hand work |
| `bg-ethereal-ink` at ≥20% (a dark island's surface) | 134 | — | no — hand work |
| arbitrary `shadow-[…]` | 53 | — | no — hand work |
| arbitrary gradient `bg-[linear/radial-gradient…]` | 10 | — | no — hand work |
| stock palette (`red-500`, `slate-…`) | 2 | 2 | delete them |
| hard-coded hex in `.ts`/`.tsx` | 17 | 7 | mostly legitimate (§6) |

The work is (a) re-declaring **~30 custom properties** under one selector, (b) replacing the
shadow mechanism, and (c) fixing the **~430 occurrences across 62 files** where a token is used
against its position on the ladder. Everything else changes theme without being touched.

## How to read this file

Sections 1–2 are the architecture and the palette; read them before writing any CSS. Sections
3–7 are the inventory of what does *not* come for free. Section 8 is the staging — each stage is
independently shippable and has an **Exit** line. Section 9 is what still needs the developer's
decision.

The developer verifies every visual change in their own browser; `npm run typecheck` +
`npm run build` green is the automated bar (verification policy in `CLAUDE.md`).

---

## 1. Architecture

### 1.1 The ladder principle

The palette's neutral half is already an ordered ladder, and the `@theme` block says so in prose:
*"Canvas is intentionally a few shades deeper than the card surfaces so panels separate by VALUE."*

```
marble  ── brightest surface (popover, pinned bar, inset "paper")
alabaster ─ the card
parchment ─ the sunken tile
canvas  ── the ground the cards sit on
   ⋮
graphite ─ secondary / supporting ink
ink     ── the statement
```

**A name here declares a rung, not an absolute lightness.** `marble` means *the brightest
surface*; on a dark ground the brightest surface is `#2A2521`. Under that reading, re-declaring
the six neutral values inverts the whole panel and every call site stays correct — including all
1 722 alpha washes, because a wash inherits the direction of its base: `bg-ethereal-ink/5` is a
5 % darkening on light and a 5 % lightening on dark, which is the correct idiom on both.

The chromatic half behaves oppositely and this is the part that is easy to get wrong. Measured
(WCAG, sRGB) against the proposed dark ground `#14120F` / card `#221E1A`:

| accent | unchanged, on dark canvas | on dark card | verdict |
|---|---|---|---|
| gold `#C2A878` | 8.16 | 7.23 | **keep as is** |
| sage `#8F9A8A` | 6.37 | 5.64 | **keep as is** |
| incense `#A69279` | 6.24 | 5.52 | **keep as is** |
| amethyst `#8C7A9E` | 4.80 | 4.25 | lift slightly |
| crimson `#A95E59` | 3.95 | 3.49 | **fails AA — must lift** |
| graphite `#4A4744` | 2.03 | 1.79 | it is a ladder rung, it flips |

So the rule that governs the whole implementation:

> **The six ladder rungs flip. The five accents hold their hue.** Only `crimson` and `amethyst`
> need a dark value at all, and `crimson`'s is already in the file (`crimson-light`).

That the brand's warm accents survive the inversion untouched is the reason this is worth doing
at all — dark mode here is not a second design, it is the same design on a different ground.

### 1.2 Pre-existing defect the measurement exposed

The same table computed for the **current light theme** reads:

| accent as text, on `alabaster` | ratio | AA (4.5) |
|---|---|---|
| gold | 2.01 | fails |
| incense | 2.63 | fails |
| sage | 2.58 | fails |
| amethyst | 3.42 | fails (AA-large only) |
| crimson | 4.16 | fails |

`text-ethereal-gold` has 289 call sites and `text-ethereal-crimson` 93. Most are icons or
`Eyebrow`s, where the accent is a mark rather than prose — but the alarm colour failing AA on the
panel's main card surface is a real finding independent of this project.

Two consequences for this spec, and they must not be quietly conflated:

1. **Do not tune the dark accents "to look like the light ones".** They would have to be dragged
   back below AA on purpose. Dark mode will be measurably more legible than light; that is a
   correct outcome, not a mismatch to fix.
2. The light-theme accent contrast is **out of scope here** and belongs in its own pass. Noted so
   the next reader does not discover it as a dark-mode regression.

The same pass owns one more finding, from the other side of the accent — **what is written ON
gold**. `Checkbox`'s tick is `text-white` on the gold fill: **2.29**, below even the 3.0 an icon
wants, and theme-invariant (both halves hold their hue), so dark mode neither causes it nor fixes
it. It was left alone in Stage 3 for exactly that reason. Note that the primary button's label,
which *was* a dark-mode defect, now reads `text-surface-inverse` at 8.0 — so if this finding is
ever taken up, the answer is already in the palette.

**Taken up 2026-08-31, and the table above turns out to understate it.** Two of the three shipped;
the third is a bigger question than the accents, and it is why the other accents did not.

*Shipped.* `crimson` → `#92504B`: hue and saturation held to the unit, lightness alone moved 7.5
points, **4.71 on the tightest surface** and no call site touched. It is the one accent the panel
writes sentences in (`Button variant="destructive"` is crimson type on its own 8 % wash; `color=
"crimson"` is 25 Text/Caption against 6 Eyebrows), and the only one that could be fixed **in
place** — it failed by 0.8 of a step where the rest fail by a colour. And `Checkbox`'s tick →
`text-surface-inverse`, 2.29 → 8.0, with the two hand-rolled ticks in chorister-hub following it
off `ink-on-inverse`; its allowlist entry is gone, the decision being made.

*The correction the measurement forced.* The surface that constrains a light-theme value is
`parchment`, **not the card**. A dark accent gains contrast on a brighter ground, so here the
ladder's dimmest rung is the tight one — the exact inverse of the dark theme, and the reverse of
what §10's contrast bullet says. Read without the flip it picks a value half a step short: crimson
reads 4.16 "nearly AA" on the card against a real 3.69 on parchment.

*Why gold did not follow, and this is the finding.* Gold cannot be fixed in place — AA costs it 27
points of lightness (`#796237`), which is bronze, and gold is a FILL (primary button, glass rim,
selection) before it is ever type. So it needs a second token, and the second token is cheap: the
whole of gold-as-prose is **48 call sites** (39 `Eyebrow`, 4 `Text`, 4 `Caption`, 1 `Heading`),
all through one tone map. It was not spent, because the accents are not where this defect lives:

| role | value | worst of the four surfaces | call sites |
|---|---|---|---|
| `color="muted"` | `graphite/60` | **2.86** | **516** |
| `Eyebrow`'s own default | `incense/60` | **1.62** | ~90 of 371 |
| gold as prose | `#C2A878` | 1.79 | 48 |
| raw `text-ethereal-graphite/α` | 13 distinct alphas | 1.8–4.5 | 219 |

The panel's **neutral secondary ink** is below AA in 516 places and its most repeated text element
defaults to something *dimmer than gold*. Recolouring 39 Eyebrows to bronze beside 189 `muted`
ones that are equally illegible would not fix a section header, it would make the inconsistency
visible. Gold is not the centre of mass and is not where this starts.

What §1.2 should be read as saying, then: the accents were the half that got measured, and they
are the smaller half. The real question is **whether the secondary role gets a legibility floor at
all** — technically one line in the tone map, but `graphite/60` has to reach `/85` to clear 4.5,
which trades the panel's soft wash for near-solid graphite in 516 places at once. That is a
decision about the panel's voice, not a bug fix, and it belongs to its own pass with the developer
looking at the render.

One more thing the sweep settled rather than found: **the icon half of the 289 is not a defect.**
43 of the 283 raw `text-ethereal-gold` are explicitly `aria-hidden`, and the hypothesis that gold
carries active-tab *labels* is false — in `ArchiveTabs`, `ProjectTabs`, `SettingsLayout`,
`MobileNavSheet` and `CommandPalette` the gold is the icon only, `aria-hidden`, with the label in
`ink`. A decorative icon beside its own label is outside 1.4.11 by the standard's own carve-out.

### 1.3 Why the token swap actually works (verified, not assumed)

Read out of `dist/assets/index-*.css`:

```css
.bg-ethereal-gold        { background-color: var(--color-ethereal-gold) }
.border-hairline         { border-color: var(--color-hairline) }
.bg-glass-surface        { background-color: var(--color-glass-surface) }
.text-ethereal-graphite\/20 { color: #4a474433 }                                  /* fallback */
.text-ethereal-graphite\/20 { color: color-mix(in oklab, var(--color-ethereal-graphite) 20%, transparent) }
```

Tailwind v4 emits `var()` for every `@theme` **colour**, and alpha modifiers resolve through
`color-mix` — so a value re-declared under `[data-theme="dark"]` reaches all of them.

Two conditions on that, both to be stated in the implementation's own comments:

- **`@theme`, never `@theme inline`.** `inline` bakes the value into the utility and silently
  disables the whole mechanism.
- **The `color-mix` fallback freezes the light value.** The alpha rules ship twice: a literal
  hex, then the `color-mix` version inside the sheet's single `@supports (color: color-mix(…))`
  guard. On a browser without `color-mix` (pre-2023: Chrome <111, Safari <16.2, Firefox <113),
  dark mode renders 1 722 washes in light-theme colour on a dark ground — unreadable. The panel
  already floors at iOS 16.4 for install (`.ai` / install docs), so this is inside the supported
  range, but it is a floor that is now load-bearing and should be written down.

### 1.4 The one mechanism that does *not* work: shadows

`--shadow-*` theme values are resolved at **build** time:

```css
.shadow-glass-ethereal { --tw-shadow: inset 0 1px 1px var(--tw-shadow-color,#ffffffe6), … }
```

`#ffffffe6` is `rgba(255,255,255,.9)` inlined. Re-declaring `--shadow-glass-ethereal` under a
theme selector does **nothing**, with no error and nothing visible in the source. This matters
because that white inset is the panel's glass bevel — left alone on a dark ground it draws a
bright top edge on every one of ~130 cards and the whole surface reads as a light card someone
tinted.

Fix: **mechanism A — settled, verified 2026-08-30 (Stage 0).** Keep the `@theme --shadow-*`
tokens and write their colours as `var(--glass-highlight)` / `var(--glass-shade)`, re-declared per
theme. Tailwind passes the `var()` through unresolved into the fallback slot:

```css
/* --shadow-glass-ethereal: inset 0 1px 1px var(--glass-highlight), … */
.shadow-glass-ethereal { --tw-shadow: inset 0 1px 1px var(--tw-shadow-color,var(--glass-highlight)), … }
```

and `@property --tw-shadow` is `syntax:"*"`, an unresolved token stream — so the substitution
happens on the element and inherits whatever `[data-theme="dark"]` declares. Declare the two new
variables in the `:root` base block (not `@theme`: they are not a `--shadow-*` namespace value and
generate no utility).

*Rejected, no longer needed:* **B** — moving the four glass shadows out of `@theme` into
hand-written `@utility` blocks and re-filing them in `tailwindMerge.ts` from `theme.shadow` to a
named `classGroups.shadow` entry. Recorded so it is not re-proposed.

The 53 arbitrary `shadow-[…]` values are unreachable by either and are hand work (§4).

### 1.5 Rejected alternatives

- **A full semantic-role migration** (`bg-surface-raised`, `text-ink-muted`, …). Correct in the
  abstract, and it is what you would build greenfield. Here it means rewriting ~1 250 neutral
  call sites plus collapsing an alpha ramp that currently runs to twelve distinct values on
  `text-ethereal-graphite` alone — for an outcome the ladder swap already delivers. It buys
  naming clarity, and naming clarity is not worth a 266-file diff on a working panel. If it is
  ever wanted, it is a mechanical follow-up that dark mode does not block.
- **`dark:` variants at the call sites.** Doubles every colour decision in the tree, and the
  second half is invisible to anyone reading a component in light mode. Tailwind's own guidance
  for a themed design system is the variable swap.
- **A global `filter: invert()`.** Destroys the brand hues, inverts photographs and avatars, and
  turns the score's white paper black. Not credible; named here so it is not re-proposed.
- **Storing the theme on `UserProfile`.** See §5.1.

---

## 2. The palette, both themes

Values below are the **starting point**, chosen so the dark rungs keep the light theme's own
separation (adjacent-surface contrast 1.06–1.09 dark vs 1.10 light) and the warm cast that
distinguishes the brand from a generic grey dark mode. They are to be judged on the render.

### 2.1 The ladder — flips

| token | light (today) | dark (proposed) | role |
|---|---|---|---|
| `--color-ethereal-marble` | `#FBFAF7` | `#2A2521` | brightest surface — popover, pinned bar |
| `--color-ethereal-alabaster` | `#F2F0EB` | `#221E1A` | the card |
| `--color-ethereal-parchment` | `#E6E3DA` | `#1B1815` | the sunken tile |
| `--color-ethereal-canvas` | `#EBE5D9` | `#14120F` | the ground (`body`) |
| `--color-ethereal-graphite` | `#4A4744` | `#A8A199` | secondary ink |
| `--color-ethereal-ink` | `#161412` | `#F3F0EA` | the statement |

Resulting text contrast on the dark card: ink 14.6, graphite 6.5. Both comfortably AA.

Note: `canvas` and `parchment` are near-identical in the light theme (`#EBE5D9` vs `#E6E3DA`) —
the ladder has a flat spot there today. The dark values separate them properly; if that reads as
a change of character, flatten the dark pair to match rather than re-tuning the light one.

Never a pure `#000` ground: it kills the warm cast, and on OLED it smears on scroll.

### 2.2 The accents — hold

| token | light | dark | note |
|---|---|---|---|
| `--color-ethereal-gold` | `#C2A878` | unchanged | 8.16 on the ground |
| `--color-ethereal-sage` | `#8F9A8A` | unchanged | 6.37 |
| `--color-ethereal-incense` | `#A69279` | unchanged | 6.24 |
| `--color-ethereal-amethyst` | `#8C7A9E` | `#A695B8` | 4.25 → 6.00 on the card |
| `--color-ethereal-crimson` | `#A95E59` | `#D6A19F` | i.e. today's `crimson-light`; 7.46 |
| `--color-ethereal-crimson-light` | `#D6A19F` | `#EAB5B1` | stays the softer half of the pair |

The crimson swap is the one role change in the accents and it is worth stating plainly: **on
dark, the alarm colour is the lighter of the existing pair.** No new hue is introduced.

### 2.3 Hairlines, glass, noise

| token | light | dark |
|---|---|---|
| `--color-hairline` | `rgba(22,20,18,.06)` | `rgba(243,240,234,.08)` |
| `--color-hairline-strong` | `rgba(22,20,18,.10)` | `rgba(243,240,234,.14)` |
| `--color-glass-surface` | `rgba(243,243,243,.62)` | `rgba(42,37,33,.62)` |
| `--color-glass-border` | `rgba(194,168,120,.28)` | `rgba(194,168,120,.22)` |
| `--glass-highlight` *(new, §1.4)* | `rgba(255,255,255,.9)` | `rgba(255,255,255,.05)` |
| `--glass-contact` *(new, Stage 2)* | `rgba(22,20,18,.05)` | `rgba(0,0,0,.35)` |
| `--glass-shade` *(new)* | `rgba(120,104,82,.14)` | `rgba(0,0,0,.45)` |
| `--glass-shade-lifted` *(new, Stage 2)* | `rgba(120,104,82,.22)` | `rgba(0,0,0,.55)` |
| `--glass-shade-strong` *(new, Stage 2)* | `rgba(120,104,82,.45)` | `rgba(0,0,0,.6)` |

A dark hairline is not the light one inverted at the same alpha — light needs more alpha to read
against a dark ground, hence .08/.14 against .06/.10.

**The shadow mapping, as settled in Stage 2.** Two variables were not enough, and the reason is
that "themed" is a question about what a layer paints *on*, not what colour it happens to be:

- Layers cast onto the **page** are themed — three shade rungs plus the highlight. The rungs exist
  because one alpha cannot carry rest, hover and a control standing proud of the page; `.14 / .22
  / .45` is the ramp the panel already had, and flattening it costs the card its hover lift and
  the primary button its footing. `--glass-contact` is the fourth: the tight `0 1px 2px` line,
  ink rather than warm, which §1.4 counted ("four ink inner lines") without naming.
- Layers painting on the **primary button's own gold fill** are *not* themed and stay literal —
  gold is an accent and holds, so a white specular line on its top edge and an ink line on its
  bottom are correct on either ground. These are the exception to the "never a literal" rule
  written above the `@theme` shadow block, and the block names them.
- A **gold glow** is an accent, not a shadow: `--shadow-glass-outline-hover` and the primary
  button's hover cast say "gold", and say it the same way on dark. Literal.

Dark compresses the shade ramp (`.35/.45/.55/.60` against `.05/.14/.22/.45`): black over a
`#14120F` ground stops buying separation past ~`.45`, so on this theme it is the geometry that
distinguishes resting from raised. The light theme moves by three alpha points in total
(contact `.04→.05`, glass-solid drop `.16→.14`, hover highlight `1→.9`) — all sub-2 % and all
deliberate collapses.

**`bg-noise` blend mode.** `GlassCard` and `PdfViewer` composite the grain with
`mix-blend-color-burn`; burn against a near-black ground crushes to nothing. `EtherealBackground`
and `ErrorScreen` already use `mix-blend-overlay`, which survives both. Either move all five to
`overlay`, or gate the blend mode per theme. The grain is 2–3 % opacity — if it disappears on
dark and nobody misses it, dropping it there is a legitimate answer.

### 2.4 The mechanism

```css
/* panel.css — after @theme, inside @layer base */
:root { color-scheme: light; }

[data-theme="dark"] {
  color-scheme: dark;
  --color-ethereal-canvas: #14120F;
  /* …the six rungs, two accents, four hairline/glass values… */
}
```

`color-scheme` is not cosmetic: it is what makes the UA paint form controls, the scrollbar
gutter, and the autofill wash dark. The autofill override in `panel.css` hard-codes
`--color-ethereal-marble` as the inset box-shadow, so it follows the ladder for free.

No `@media (prefers-color-scheme: dark)` block anywhere. The OS preference is read **once**, in
JS, and resolved into the same `data-theme` attribute (§5.2) — otherwise "system" and an explicit
override fight each other in CSS and the loser is whichever the cascade happens to favour.

---

## 3. The inverse-surface problem — the actual work

Six tokens flip. Two of them — `ink` and `marble` — are also used as **materials**: `ink` is the
surface of every deliberately-dark island in the panel, and `marble` is the ink written on it.
Those call sites mean "dark surface" and "light text on it" *regardless of theme*, so a ladder
flip turns them inside out: the PDF chrome becomes a white bar with invisible white icons.

That is the entire hand-written scope: **62 files, ~430 occurrences.**

### 3.1 New tokens

Three, and they are the only semantic-role tokens this project introduces:

| token | light | dark |
|---|---|---|
| `--color-surface-inverse` | `#161412` (today's ink) | `#2A2521` — a raised rung, not a second black |
| `--color-ink-on-inverse` | `#FBFAF7` (today's marble) | `#F3F0EA` |
| `--color-line-on-inverse` | `rgba(255,255,255,.10)` | `rgba(255,255,255,.08)` |

Emitted as `bg-surface-inverse` / `text-ink-on-inverse` / `border-line-on-inverse`, **and added
to `shared/lib/tailwindMerge.ts`** — a token missing from that ledger is read as a colour and
silently deleted by `cn()` at runtime, with no error and the class still present in the built CSS.

Why `surface-inverse` *rises* on dark rather than staying `#161412`: on a `#14120F` ground an
island at `#161412` is invisible. Its job is "distinct from the page", not "black".

**As built (Stage 3), three things the table did not say:**

- `surface-inverse` has a **second role the inventory missed: ink on a gold fill.** An accent
  holds its hue through the swap, so whatever is written on it has to hold its darkness alongside
  — and every neutral the panel had for that job (`ink`, `graphite`) is a rung that inverts
  underneath it. This is the token that fixes the primary button (§8, Stage 2's note), and it is
  the same fix for the segmented tab's active pill, its count chip, and the calendar's chosen day.
- **A `@theme` colour with no call site does not reach the stylesheet.** Tailwind tree-shakes it,
  so `--color-line-on-inverse` shipped its `[data-theme="dark"]` half (hand-written CSS, never
  shaken) against a `:root` half that had been dropped — the §10 parity failure, inverted. Caught
  on the built sheet, fixed by giving the token its first consumer in the same commit
  (`GlassCard variant="surface"`'s rim). Worth knowing for the parity test: it must read
  `panel.css` as text, never the compiled output.
- **A scrim is not a surface** and does not belong to any of the three. It is the absence of
  light — black on both themes — so `ConfirmModal` and `BottomSheet` carry a literal `bg-black/4x`
  and go on §10's allowlist. `bg-ethereal-ink/45` had put it one rung off black on light and
  inverted it into a *white* veil on dark, brighter than the sheet standing on it.

### 3.2 The inventory

Grouped by why they are dark, because each group has one decision, not one per file.

**A · Score & document chrome — dark in both themes, by design** (18 files)
`shared/ui/composites/PdfViewer/*` (4), `PdfViewerModal`, `pages/panel/DocumentViewerPage`,
`features/annotations/*` (6: `AnnotationToolbar`, `AnnotationSidebar`, `AnnotationOverlay`,
`AnnotationGuide`, `IncomingMarksNotice`, `ScoreProgramBar`), `EditionThumbnailStrip`,
`ScoreMarksToggle`, `LocationPreview`, `PieceRow`, `PiecePage`, `DocumentCategoryCard`.
→ Mechanical rename to the three inverse tokens. **The page canvas stays `#ffffff`** — a score is
paper, and dark mode does not print on black. Annotation inks (5 fixed hex, mirrored in
`backend/archive/annotation_palette.py`) are marks on that paper and do not change either.

*Corrected in Stage 4:* **only eleven of these eighteen are dark chrome.** `EditionThumbnailStrip`,
`LocationPreview`, both `PieceRow`s, `PiecePage` and `DocumentCategoryCard` are ordinary light
surfaces that the ladder flips correctly on its own; they are in the inventory because they *touch*
the score, not because they are dark. Their real defects were a different and much smaller set —
see the accent rule in Stage 4's entry. Read the surface, not the file list.

**B · Player & docks** (3) — `MiniPlayerBar`, `RehearsalDock`, `VoiceMixerPanel`. Same rename.
*Also corrected in Stage 4:* only `RehearsalDock` is dark. The other two are `alabaster` cards on
the ladder, and each needed exactly one line changed.

**C · The "premium dark" surfaces** (5) — `NextEventHero`, `TimelineProjectCard`,
`ConcertDayPlan`, plus `BottomSheet tone="dark"` and `SegmentedTabs tone="dark"`.
→ **A design question, not a rename** (§9): on a dark ground, "the premium dark card" no longer
distinguishes itself from anything. Either it becomes the *brightest* rung on dark (inverting its
relationship to the page, which is what the concert sheet is actually saying) or it keeps a gold
hairline and drops the fill. Decide once, apply to all five.

*Settled in Stage 6 — **(a), plus the gold hairline (b) was going to carry.*** The measurement is
what decided it, and it is worth keeping because it applies to any future "make this one stand
out" on this theme:

| | light | dark |
|---|---|---|
| premium card vs the page | **14.65** | (a) 1.23 · (b) 1.02–1.04 |
| ordinary card vs the page | 1.10 | 1.13 |
| premium vs ordinary card | 13× | **1.09** |

On a `#14120F` ground no fill buys more than ~1.2 in *either* direction, so the choice was never
"loud or quiet" — it was **slightly up or slightly down**. Up has somewhere to go; down runs into a
floor two points below the page (§2.3 already said black stops buying separation past ~.45).
So the fill takes `surface-inverse` and the emphasis the value can no longer carry moves to a gold
rim — which is what (b) proposed to do *instead of* the fill, and works better alongside it.

Three things the entry above did not have, all found by reading the surfaces:

- **The ink moves under BOTH options, so it was never the tiebreaker.** Only the headlines were on
  `ink-on-inverse` after Stage 5; the second plane — ~20 `color="parchment{,-muted}"` and ~25
  `text-ethereal-parchment/*` in `className` — was still a rung, and a rung follows the PAGE.
  `parchment` on dark is `#1B1815`: 1.17 against (a)'s card and 1.10 against (b)'s. Stage 5 wrote
  the rule for fills (*ink and its ground move together*); it holds for ink as well, in both
  directions.
- **The scope is nine files, not five.** Four satellite components exist only to sit on these
  islands and carry the same rung ink — `OnSiteFacts`, `ReadinessRing surface="dark"`,
  `AddToCalendar tone="dark"`, `DualTimeDisplay variant="dark"` — plus `AuthCredential` and
  `AuthBrand`, whose `tone="marble"` was the same defect wearing a rung's name (now `on-inverse`).
- **`GlassCard variant="dark"` had FOUR call sites and three different claims.** §3.2 D counted
  three and missed `PieceRow`'s `variant={isArchived ? "dark" : "ethereal"}` — the ternary the grep
  for `variant="dark"` cannot see. More importantly the variant meant "premium" (hero, timeline),
  "the nave" (activation) and **"retired"** (an archived piece), and (a) merges those into one rung:
  the archived row would have become the *brightest* row in the songbook. It was written out of the
  decision and sank onto the ladder instead (`parchment`, no cast), which is what "still here, no
  longer in play" looks like on either theme. **A variant carrying more than one claim cannot be
  renamed; it has to be split first.**

**D · Primitives carrying both tones** (11) — `GlassCard` (`dark`/`surface` variants), `Button`,
`Badge`, `Checkbox`, `Divider` (`solid-dark`), `Typography` (`marble-muted` colour),
`MetricBlock`, `DateTimeField/CalendarGrid`, `SegmentedTabs`, `Select`, `accents.ts`.
→ Do these **first**: fixing the primitive fixes most of its call sites. `accents.ts` is already
correct by construction — `ACCENT_MARKER` reads `var(--color-ethereal-*)`, so Google Maps pins
follow the theme with no code change.

*Settled in Stage 3.* The group split three ways, and the split is the reusable part:

- **Broken and self-contained** — the surface and the ink on it live in the same file, so both
  move at once: `Button` (primary label; the `white/4x` fills on `secondary`/`outline` are a
  brighter *rung*, so they became `marble`), `SegmentedTabs` (active pill + count chip),
  `CalendarGrid` (chosen day + its marker dot), `Badge` (`glass`: fill, rim and the white bevel in
  its arbitrary shadow, which took `var(--glass-highlight)` / `var(--glass-shade)`), `MetricBlock`
  (hover fill), `Divider` (`solid-dark` → `bg-ink-on-inverse/15`; the alpha is load-bearing on a
  busy toolbar and stays where the eye put it), and the two scrims.
- **Correct already** — `GlassCard`'s four in-flow variants, `Checkbox`, `Select`, and every
  ladder colour in `Typography`. The ladder did exactly what §1.1 said it would. `Typography`
  gained `ink-on-inverse` / `ink-on-inverse-muted` (unused until Stage 4 renames the 83
  `color="marble"` sites off the rung).
- **Deferred, and not for the reason the inventory gave** — `GlassCard`'s `dark` and `surface`
  variants are the FILL of the islands in groups A/B/C, and their ink is in those files. Flipping
  a fill here alone leaves the PDF chrome dark-on-dark: strictly worse than the inside-out state
  it replaces, which is at least readable. They move in Stage 4 (`surface`) and Stage 6 (`dark`).
  ~~**`variant="dark"` is shared by `RehearsalDock` (group B) and `NextEventHero` /
  `TimelineProjectCard` (group C)** — so part of Stage 4 is blocked on the §9 decision.~~
  **Wrong, and checked in Stage 4: `RehearsalDock` never uses `GlassCard` at all** — it hand-rolls
  its own pill. `GlassCard variant="dark"` has three call sites and all of them are outside Stage 4
  (`NextEventHero`, `TimelineProjectCard`, `ActivationNave`), so nothing in Stage 4 was blocked on
  §9. What is shared is `fieldShell`'s own `dark` variant plus `Select`'s dark chevron — and those
  have exactly two call sites in the whole tree, both of them `RehearsalDock`'s pitch selects, so
  they travelled with it. `variant="surface"` likewise has only the two PDF toolbars.
  The lesson generalises: **grep the variant before believing a coupling the inventory asserts.**

**E · One-off `white` / `black`** (~25 files) — `AuthBrand`, `AuthCredential`, `ActivationNave`,
`PasswordRequirements`, `LegalModals`, `LegalPage`, `WelcomeMoment`, `SeasonSetupConcierge`,
`ArtistEmptyState`, `ProjectInvitationsSheet`, `MapPinShell`, `LocationsAtlas`,
`SightReadingStars`, `KineticActionCue`, `DesktopSidebar`, `OfflineStatusBadge`,
`AppUpdatePrompt`, `InstallAppPrompt`, `AppTab`, `NotificationsTab`, `SettingsIdentityCard`,
`NotificationCenter`, `CardElementPills`, `AttendanceMarker`, `ArchiveComposersPage`,
`CategoryFormModal`, `DocumentUploadModal`.
→ Each `bg-white/40` is one of two things: a raised tile on a light card (→ ladder token) or a
raised tile on a dark island (→ `bg-ink-on-inverse/10`). Read the surrounding surface; there is
no rule that decides it from the class alone. **`AppTab`'s QR card stays literal `bg-white`** —
a scanner needs a light quiet zone (§6).

*Settled in Stage 5.* Every light-card tile took `marble` — the rung Stage 3 already chose for
`Button`'s own `white/4x` fills. Three things the list did not say:

- **A third destination the two-way split missed: a light MARK on an accent that holds.** A tick
  on gold, a count on a gold disc, a label on a sage button — the ink there is not a tile on
  anything, it is the other half of Stage 4's rule, and `ink-on-inverse` renders `#FBFAF7` on
  light, i.e. exactly what the literal did. That is what `Typography`'s `color="white"` variant
  had been for, alongside a second and unrelated job (ink on a premium dark card), which is why
  the variant is gone and its 18 call sites now name one role or the other.
- **`LegalPage`'s `print:bg-white` is paper**, not an unconverted literal — the printable document
  leaves the ladder at the printer exactly as the score's canvas does, and dark mode makes the
  rule load-bearing rather than decorative. On the §10 allowlist.
- **The Google raster is a second paper.** `MapPinShell`, `MapAtmosphere`, `VenueMiniMap` and the
  atlas's pin badge paint directly on tiles that stay light in both themes (§6 defers the dark
  map), so their neutrals hold — a ladder token there inverts the pin into a dark disc casting a
  pale halo over a map that never moved. Same exception as the score, one surface further out.

### 3.3 Dead code found on the way

- ~~`App.tsx:242` adds `bg-ethereal-snow` to `document.body`.~~ **Deleted in Stage 1.**
  `ethereal-snow` was not a token — it compiled to nothing — and the same effect (`bg`, `text`,
  `selection`) is declared by `body.theme-panel` in `panel.css`. The `classList.remove` half named
  four marketing classes (`theme-marketing`, `page-o-nas`, …) that exist nowhere in `frontend/`;
  they belong to the Astro document. The whole effect re-ran on every `location.pathname` change.
- 2 stock-palette classes (`text-emerald-200`, `bg-emerald-500/20`) — delete, use `sage`.

---

## 4. Arbitrary values

53 `shadow-[…]` and 10 `bg-[linear-gradient…]` / `bg-[radial-gradient…]` carry literal colour
that no token swap reaches. Named ones to handle:

- `EtherealBackground.tsx:32` — `rgba(253,253,250,.55)` top wash and `:95` the vignette
  `rgba(22,20,18,.05)`. The app-shell aura is the largest painted surface in the panel; both
  literals become variables.
- `PdfViewer.tsx:796` — `shadow-[0_8px_32px_rgba(0,0,0,.4)]` on the page-number pill. Already
  dark-correct, leave it.
- The rest: sweep with `rg -o 'shadow-\[[^]]+\]'` and decide per site. Most are a drop shadow
  under a floating element and want `--glass-shade`.

**Done in Stage 5.** The sweep sorted every one of them by *what the layer paints on*, the same
question §2.3 asked of the theme shadows, and it answered itself in four groups:

| what it is | how many | verdict |
|---|---|---|
| black cast inside a `surface-inverse` island (score chrome, dock, annotations) | 19 | literal — already dark-correct on both grounds |
| gold glow, gold rim, gold focus cast | 11 | literal — an accent says "gold" the same way on either ground (§2.3) |
| ink or warm cast onto the PAGE, and the white bevels on glass | 19 | `--glass-contact` / `--glass-shade{,-lifted,-strong}` / `--glass-highlight` |
| painted on the light Google map | 2 | literal — see §3.2 E's third note |

Two of those need their reasoning on the record:

- **The five aura variables.** The four ambient fields (`EtherealBackground`, `ErrorScreen`'s
  distilled copy, `WelcomeMoment`'s ceremony, `AuthShell`) are two jobs at two strengths each:
  `--aura-light` / `--aura-shaft` (+`-soft`) for daylight entering the nave, `--aura-vignette`
  (+`-deep`, the auth screen's) for the edges receding. The hues hold and the alphas move an order
  of magnitude, because light entering a dark nave is a fraction of the light entering a bright
  one. The vignette additionally stops being ink on dark: the ink rung has flipped to near-white
  and would paint a halo around the edges rather than let them recede.
- **"Warm" did not mean "accent".** `LocationPreview`'s 64px `rgba(166,146,121,.25)` cast reads as
  an incense statement and is not one — every shadow in the light theme is warm, including
  `--glass-shade` itself. Stage 4 had parked it as literal-on-purpose on a misreading of §2.3,
  whose exception is the *gold glow*, a hue the surface is deliberately wearing. A cast that is
  warm only because the light theme's casts are warm composites LIGHTER than a near-black ground
  and reads as a glow, which is the opposite of what a shadow says. The test: does the surface
  mean to say "gold", or does it just mean "raised"?

Also converted, being the same defect one layer down: **`fieldShell`'s `glass` inset**, the most
repeated surface in the panel. 6% of ink over a dark fill is nothing, so every field in the app
would have lost its sunken read; `fieldShell.test.ts` carries the change as a `DECIDED` entry.

---

## 5. The control

### 5.1 Where the preference lives — **device-local, not the account**

`localStorage`, key `voct.theme`, values `system | light | dark`, default `system`.

Not on `UserProfile`, and the contrast with `language` is the argument. `language` is on the
profile because the **server consumes it** — every push, e-mail and digest is rendered in it, so
it must survive the device. No server-side artefact of VoctManager has a theme: not a
notification, not a call sheet, not a contract. A theme that followed the account would also be
wrong in the one case that actually happens — dark on the phone held in a dim rehearsal room,
light on the laptop at a desk.

Consequence to accept: a fresh browser starts at `system`. That is the correct default anyway.

### 5.2 Applying it without a flash

The bundle is lazy; by the time React runs, the light ground has already painted. The resolution
must happen during parse, in an inline script in `index.html` — beside the existing
`beforeinstallprompt` buffer, which is there for the same class of reason:

```html
<script>
  (function () {
    var pref = "system";
    try {
      pref = localStorage.getItem("voct.theme") || "system";
    } catch (e) {}
    var dark =
      pref === "dark" ||
      (pref !== "light" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  })();
</script>
```

`try/catch` because a locked-down browser throws on `localStorage` access, and a throw here
leaves the page unstyled — so only the read is guarded, and the stamp happens either way.

Two details as built (2026-08-30): the attribute is stamped **explicitly on both themes**, not
only on dark. `data-theme="light"` costs one selector nothing and makes the DOM say whether the
theme was resolved or the script never ran. And an unrecognised stored value falls back to
following the OS in both the snippet and the controller (`pref !== "light"`, `isPreference()`) —
the two resolutions have to agree exactly or the boot stamp and the first React render disagree.

The React side owns three jobs and nothing else: write the preference, re-stamp the attribute,
and keep a `matchMedia` listener alive while the preference is `system` (the OS can flip while
the app is open — an Android auto-dark schedule does exactly that at dusk, mid-rehearsal). Put it
in `shared/theme/` (domain-free, so `shared/` stays clean per FSD).

### 5.3 `theme-color` and the manifest

`index.html` today:

```html
<meta name="theme-color" content="#f6f5f2" media="(prefers-color-scheme: light)" />
<meta name="theme-color" content="#060607" media="(prefers-color-scheme: dark)" />
```

Media-keyed metas follow the **OS**, so a member who forces light inside a dark-mode phone gets a
black status bar over a cream app. The theme controller must set a single un-keyed
`<meta name="theme-color">` from JS whenever it resolves the theme. Keep the media pair as the
pre-boot default.

Also: the light value `#f6f5f2` does not match `--color-ethereal-canvas` (`#EBE5D9`) — a
pre-existing seam at the top of the screen on installed iOS. Fix it in the same pass.

As built: the controller inserts its meta **immediately before** the media pair rather than at the
top of `<head>` — the UA takes the first matching meta in tree order, so that is enough to win,
and `<meta charset>` stays the first child. Both HTML values were repointed at the canvas per
theme (`#EBE5D9` / `#14120F`), and `THEME_COLOR` in `themeController.ts` mirrors them; the pair
now has to be kept in step with `--color-ethereal-canvas`, which §10 should check.

`manifest.webmanifest` is static and cannot follow a runtime preference. Leave
`theme_color` at the light value and `background_color` at `#060607`; the splash is a one-second
surface and not worth a second manifest. Its `theme_color` carried the same stale `#f6f5f2` and
was corrected to `#EBE5D9` alongside the metas — the seam it opens is the installed Android window
chrome rather than the iOS status bar, but it is the same defect. Already-installed devices pick
it up on the next manifest refresh, not immediately.

### 5.4 The UI

`features/settings/components/AppTab.tsx` — the **device** tab ("Aplikacja"), where install and
sharing already live. Not `GeneralTab`, which is account-scoped (language, timezone) and would
imply the wrong persistence.

A `SectionHeader` + `SegmentedTabs` with three segments. `SegmentedTabs` is THE local view
switcher and this is exactly its job — do not hand-roll a track, and do not use `iconOnly`: a
switcher between three *states* keeps its words.

i18n keys, all three locales (`shared/config/locales/{pl,en,fr}/translation.json`):

| key | pl | en | fr |
|---|---|---|---|
| `settings.app.theme.title` | Wygląd | Appearance | Apparence |
| `settings.app.theme.subtitle` | Ustawienie dotyczy tego urządzenia. Nie przenosi się na inne — na telefonie i na komputerze możesz mieć różny. | Applies to this device only; your phone and your computer can differ. | Ce réglage ne concerne que cet appareil ; votre téléphone et votre ordinateur peuvent différer. |
| `settings.app.theme.system` | Jak w systemie | Match system | Comme le système |
| `settings.app.theme.light` | Jasny | Light | Clair |
| `settings.app.theme.dark` | Ciemny | Dark | Sombre |

The subtitle is doing real work: without it the first support question is "why is my laptop still
light". Polish is primary and must read natively.

**Two more entry points, added 2026-08-31 — and what was rejected matters more than what was
built.** A permanent sun/moon in the nav dock or the sidebar rail was considered and declined: a
theme is set about once per device, the default follows the OS and flips at dusk on its own, and
those slots are daily navigation. The problem worth solving was never *access*, it was
**discoverability of a feature that had just shipped** — so both additions cost zero permanent
chrome.

- **CommandPalette (⌘K), search-only.** Three rows, one per preference, that never appear in the
  resting list — they answer the word that gets typed (`motyw`, `ciemny`, `theme`), via a
  `settings.app.theme.keywords` alias string per locale, and stay out of the way of the navigation
  the member uses daily. This is the first row in the palette that *acts* rather than navigates, so
  `CommandItem` gained `run?: () => void` beside a now-optional `to`, and both `go()` handlers take
  the item rather than its destination. An acting row **leaves the palette open** on purpose: the
  panel behind the dialog is the only place a theme can actually be judged, and closing on select
  would hide the thing being chosen.
- **`MobileNavSheet` footer.** A `SegmentedTabs` above the log-out row — the browse path, since a
  search-only row is only findable by someone who already knows the feature exists. The sheet is
  the phone's command surface and the phone in a dim rehearsal room is the case dark mode was built
  for; this puts it two taps from the dock without spending one of the dock's slots.

The settings control stays canonical — it is the one that carries the subtitle explaining the
per-device scope, and neither of the two above has room for that sentence. All three read the same
`useTheme()` snapshot, so they cannot disagree.

---

## 6. Surfaces outside CSS

| surface | what happens | action |
|---|---|---|
| **PDF page canvas** | `PdfViewer` renders `canvasBackground="#ffffff"` | **unchanged** — a score is paper |
| **Annotation inks** | 5 hex, parity-tested against `backend/archive/annotation_palette.py` | **unchanged** — marks on that paper |
| **Google Maps** | vector `mapId`; styling comes from the Cloud console, so JS styles are ignored (`docs/logistics-map-style.md`) | needs a **second map ID** for dark + `colorScheme` on the map; a dark map under a light panel is worse than no dark map — **defer to its own stage** |
| **Map pins** | `ACCENT_MARKER` → `var(--color-ethereal-*)` | free |
| **sonner toasts** | `<Toaster richColors>` in `App.tsx:259` picks its own light skin | pass `theme={resolved}` |
| **QR code** (`InstallQrCode`) | needs a light quiet zone to scan | keep the white card, literal |
| **Avatars / logo** | `logo_gold.png`, WebP avatars — gold on transparent | check `logo_gold` on the dark ground; likely fine |
| **`EtherealBackground`** | two literal gradients + the clef draw-in | §4 |
| **Favicon / splash** | static | unchanged |

---

## 7. Explicitly out of scope

- **WeasyPrint PDFs** (call sheet, contract, score book). `.ai/04_design_system.md` settles it:
  *"print has no dark mode, no hover, no viewport, and its ink scale is its own."* Do not thread
  a theme through `print_fonts.py` or the templates.
- **E-mail templates.** Gmail and Apple Mail auto-invert on their own; that behaviour predates
  this work and is not a dark-mode deliverable.
- **`web/`** — the Astro marketing site has its own language (`.ai/07_marketing_public_site.md`)
  and shares no tokens with the panel.
- **Light-theme accent contrast** (§1.2) — the two fixable halves shipped 2026-08-31 (crimson, the
  tick on gold). What is left is not an accent question at all: the panel's secondary ink
  (`color="muted"`, 516 sites at 2.86) and `Eyebrow`'s default (1.62). That is a pass of its own,
  and it is a decision about the panel's voice before it is a contrast fix — see §1.2.

---

## 8. Staging

Each stage is shippable on its own and touches files no other stage touches.

**Stage 0 — the shadow spike. DONE (2026-08-30).** Mechanism **A** holds (§1.4); the constraint
is written into `panel.css` above the `--shadow-*` block. The conversion of the six shadow tokens
to `var(--glass-highlight)` / `var(--glass-shade)` belongs to Stage 2, where the dark values that
justify it are declared — the light theme's own literals map onto more than two colours (four
white highlights, four ink inner lines, six warm drops), so collapsing them is a palette decision,
not a mechanical rewrite.

**Stage 1 — the switch, on the light theme only. DONE (2026-08-30).** `data-theme` attribute, the
inline boot script, `shared/theme/{themeController,useTheme}.ts`, the `AppTab` control, the i18n
keys, `theme-color` from JS, the sonner `theme` prop. `[data-theme="dark"]` declares nothing yet.
Two things do respond to the toggle already and are expected to until Stage 2: the browser-chrome
colour (it points at the eventual dark ground) and sonner's own skin.

Also swept, being dead in the same function: the `document.body.classList` block in `App.tsx`
(§3.3) — with it, `useLocation`/`useEffect` there.

*Exit met:* the stylesheet `<link>` is emitted at the END of `<head>`, ~250 lines after the boot
script, so the attribute is on `<html>` before the CSS is fetched; `index.html` is precached, so
a cold PWA start replays the same parse. Final visual check is the developer's.

**Stage 2 — the ladder. DONE (2026-08-30).** The six rungs, two accents, hairlines, glass,
`color-scheme`, and the shadow mechanism from Stage 0 — one `[data-theme="dark"]` block in
`panel.css`, 19 declarations, no call site touched. The shadow mapping settled at five variables,
not two (§2.3).

*Verified against the compiled sheet:* `@layer base` is emitted after `@layer theme`, so the block
outranks `@theme`'s `:root` on layer order alone — no `!important`, no heavier selector. Every
`var()` reaches the utility unresolved (`--tw-shadow: … var(--tw-shadow-color,var(--glass-shade))`),
and the alpha washes compile to `color-mix(in oklab, var(--color-ethereal-*) N%, transparent)` with
the light hex as the pre-`color-mix` fallback — §1.3's browser floor, now load-bearing.

*Exit is the developer's:* the ground, cards, hairlines and body text on the dashboard and one list
page. The palette is a starting point to be judged on the render (§2); if a rung moves, the three
inverse tokens in §3.1 move with it, since two of them are rungs.

Expected and NOT a Stage 2 defect: every inverse island is inside out (§3), and **the primary
button's label is unreadable** — `Button.tsx:24` is `bg-ethereal-gold text-ethereal-graphite`, and
graphite is a rung, so the label flips to `#A8A199` on gold: contrast 3.98 → **1.10**. It is the
loudest thing on the first dark screen and it is group D, first item of Stage 3.

**Stage 3 — the primitives. DONE (2026-08-31).** The three inverse tokens, their `tailwindMerge.ts`
entries (under `theme.color`) and the group-D split recorded in §3.2. Eleven files.
`fieldShell.test.ts` and `InlineEditable.test.ts` are green **untouched** — the shell needed no
change at all, so there is no new `DECIDED` entry to read.

*Verified against the compiled sheet:* `text-surface-inverse` resolves to
`color:var(--color-surface-inverse)` and the alpha modifiers to `color-mix(… var(--color-*) N%…)`,
so all three tokens flip with the attribute. Both halves of each token are emitted (see §3.1 on
what happens when they are not).

*Left standing on purpose, and both are one grep:* **solid gold carrying a rung as its ink**
survives in six places outside group D — `attendanceMeta.tsx:49` and `PitchPipe.tsx:345`
(`text-ethereal-graphite`, i.e. the button's own 1.10), `RehearsalDock` ×2 and `AnnotationSidebar`
/ `AnnotationToolbar` (`text-ethereal-ink` on `gold/90`). They are Stage 4/5 files; the token they
need already exists. A `gold/10`-style wash is NOT this defect — there the ink reads against the
composited surface, not against the accent.

**Stage 4 — the score & document chrome. DONE (2026-08-31).** Groups A + B plus the primitives
they own: `GlassCard variant="surface"`, `fieldShell`'s `dark` variant (with its `DECIDED` entries
— three, one fact each, because an errored field shows only one of them), `Select`'s dark chevron
and `SectionLabel tone="dark"`. Twelve of the twenty-one files are dark chrome and took the
mechanical rename; the other nine are light surfaces the ladder already handled and needed one or
two lines each. Nothing was blocked on §9 (see §3.2 D).

*Three findings the inventory did not have, and they are the reusable part:*

- **Ink on an accent splits by whether the accent holds.** §1.1's rule governs the fill; it does
  not say what to write ON one, and the answer is not the same for all five. gold / sage / incense
  hold their hue, so the ink on them must hold its value too — `surface-inverse` where it has to
  stay dark (the gold count chips, the primary pill, the calendar's chosen day) and
  `ink-on-inverse` where it has to stay light (the sage play buttons, "Otwórz partyturę"). But
  **`crimson` FLIPS** to `crimson-light` on dark (§2.2), so ink on crimson has to flip with it —
  which makes it a plain ladder rung. `AnnotationToolbar`'s "Na pewno?" is the one live case:
  `marble` reads 5.4 on light and 5.8 on dark, where every inverse token fails one side or the
  other. Stated as a rule: *the ink follows whatever its ground does.*
- **§8's "six places" was eight.** `RehearsalDock` had five gold-ink sites, not two, and
  `EditionThumbnailStrip` carries two more (`color="alabaster"` on a gold fill, which the grep for
  `ink`/`graphite` missed). All are now `surface-inverse`. The grep to use next time is the FILL —
  `bg-ethereal-gold` — not the ink.
- **`AnnotationOverlay` is mostly not chrome, and had to be split.** The mark on the stave, its
  lock badge and the pin are *paper-side*: they live on a page that is white in both themes, so
  their literals (`bg-white`, `ring-black/10`, `rgba(255,255,255,.82)`) are correct as they stand
  and their ink took `surface-inverse`. The note composer, its phrase chips and the read-only
  popover are *controls*, so they ride the ladder like the rest of the chrome and go dark on dark —
  which is also what makes them read as a panel over the score rather than a second sheet of paper.
  Left alone, that file would have shipped a white card with invisible white text on it: the
  loudest thing dark mode had left.

*Also swept, being in the same files:* §3.3's two stock-palette classes (`text-emerald-200` /
`bg-emerald-500/20` in `AnnotationToolbar`, now `sage`); the `bg-white/x` washes **inside** the
dark islands, which are the same role as `bg-ink-on-inverse/x` and would otherwise have fallen
between Stage 5's named-file list and §10's grep with nobody owning them; and the `hover:text-white`
pairs that sat on a `marble` resting colour, i.e. were a no-op on both themes. Two more scrims
joined §10's allowlist (`PdfViewerModal`, `AnnotationGuide`) — `bg-ethereal-ink/7x` there would
have inverted into a white veil over the score.

*Verified against the compiled sheet:* every new utility resolves to `var(--color-*)` and every
alpha wash to `color-mix(in oklab, var(--color-*) N%, transparent)`, `ring-offset-surface-inverse`
included — so the whole set flips with the attribute. 182 vitest tests, `typecheck`, `lint` and
`build` green.

*Exit is the developer's:* the score viewer, annotation toolbar and player dock in both themes,
and the page canvas still white.

*Deliberately left for later, all named elsewhere:* `PdfViewer`'s `mix-blend-color-burn` grain
(§9.2 — a look-and-decide, and the viewer's ground barely moved), `MiniPlayerBar`'s arbitrary ink
drop shadow and `LocationPreview`'s warm 64px cast (§4 / Stage 5 — an accent-coloured cast is
literal on purpose, §2.3).

**Stage 5 — the one-offs. DONE (2026-08-31).** Group E + §4's arbitrary values, swept route by
route. 43 `white`/`black` literals in 20 files, 40 arbitrary shadows and gradients, and the
`Typography` variant that was one of them wearing a name. *Exit met:* the grep returns the
allowlist and nothing else.

*Three findings, and the first is the one that generalises:*

- **The route-by-route walk crossed a defect class the inventory never counted: the scrims.**
  §3.1 settled the rule in Stage 3 — a scrim is the absence of light, black on both themes — and
  Stage 3 applied it to the two primitives it happened to be editing. There were **twenty-one**,
  and the other fifteen were still `bg-ethereal-ink/3x…/55`: every editor slide-over, every modal
  in projects, messages, archive, notifications and chorister-hub, the mobile nav sheet, the
  command palette, and the veil that carries the camera glyph over an avatar. All of them would
  have inverted into a white sheet BRIGHTER than the dialog standing on it, and no grep in this
  spec would ever have found them — the exit criterion looks for `white`/`black`, and these were
  written in `ink`. Swept here, one token each. **The lesson: an inventory built from literals
  cannot see a defect written in tokens.**
- **`Typography`'s `color="white"` was two roles sharing a literal**, which is why neither the
  group-C nor the group-E entry claimed it. Its 18 call sites split into ink on a hue-holding
  accent (a count on gold, a label on sage → `ink-on-inverse`, which renders the same `#FBFAF7`
  the literal did) and ink on a premium dark card (→ `ink-on-inverse`, naming today's role; the
  fill is Stage 6's and, under §9's recommendation (a), the ink does not move again).
- **Ink and its ground move together, in both directions.** `AuthCredential`'s dark tone kept its
  `parchment-muted` ink deliberately: its island is `GlassCard variant="dark"`, still unconverted,
  and a rung is *accidentally readable* against a fill that has flipped to near-white, where the
  inverse token would be invisible. Stage 3 made this call for fills; it holds for ink as well.
  Only the literal moved, to `line-on-inverse`, which is near-white either way.

*Verified against the compiled sheet:* all five `--aura-*` are emitted in both blocks and reach
their gradients unresolved (`background-image:linear-gradient(180deg,var(--aura-light) 0%,…)`);
every converted arbitrary shadow lands in the fallback slot
(`--tw-shadow:0 28px 70px -20px var(--tw-shadow-color,var(--glass-shade-strong))`); every new
utility resolves to `var(--color-*)` or a `color-mix`. 182 vitest tests, `typecheck`, `lint` and
`build` green.

*Exit is the developer's:* a modal and a slide-over in dark (the scrims), the dashboard's welcome
ceremony, the auth screen, and the logistics atlas — the map is the one surface deliberately left
light under a dark panel, and §9.3 is the decision about that.

*Deliberately left, and both are look-and-decide rather than analysis:* the `mix-blend-multiply`
glows in `EtherealBackground` / `WelcomeMoment` crush to nothing over a near-black ground, exactly
as §9.2's `color-burn` grain does — same question, same answer needed, so they belong to the same
look; and `NotificationsTab`'s hand-rolled tooltip keeps a full ladder inversion
(`bg-ethereal-ink` / `text-ethereal-marble`), which is correct but makes it the one tooltip in the
panel that does not match the `Tooltip` primitive's parchment.

**Stage 6 — the premium dark surfaces. DONE (2026-08-31).** Group C on decision **(a) + the gold
hairline** (§3.2 C, §9.1). Nine files plus the two primitives that own the fill (`GlassCard`'s
`dark` variant, `BottomSheet`/`SegmentedTabs` `tone="dark"`), `PieceRow` written out of the
decision, and §9.2's answer applied.

*Two things settled here that outlive the stage:*

- **The fill stays translucent, and the 90% is load-bearing.** `bg-surface-inverse/90` rather than
  a solid, because the inner bands are washes of that same fill (`/20`, `/30`, `/60`) and a wash of
  an opaque surface over itself is invisible. At 90% the band still separates on light exactly as
  it did, and on dark it separates the other way — the incense hairline is what actually draws the
  edge on both, which is why the bands survive the swap at all.
- **`Typography`'s rung-named light inks are gone**, the same way `color="white"` went in Stage 5
  and for a sharper reason: `marble`, `marble-muted`, `parchment`, `parchment-muted` and
  `alabaster` had zero call sites left once group C moved, and every one of them had been a trap —
  a light ink that follows the page while the island it is written on does not. There is now no
  rung-named light ink in the primitive; a call site that wants one has to answer what its GROUND
  does.

*Verified against the compiled sheet:* every new utility resolves through `var()`
(`bg-surface-inverse/90` → `color-mix(in oklab,var(--color-surface-inverse) 90%,transparent)` with
the light hex as the pre-`color-mix` fallback), and both new blend utilities emit their
`[data-theme="dark"]` half (`[data-theme=dark] .light-ground-film{display:none}`). 189 vitest tests,
`typecheck`, `lint` and `build` green.

*Exit is the developer's:* the schedule's hero and timeline card in both themes, the concert sheet
it opens, the activation screen, and an archived row in the songbook.

**Stage 7 — guardrails. DONE (2026-08-31).** §10 as built: `themeParity.test.ts` (7 assertions) and
`scripts/check-literal-colours.mjs` + its allowlist, wired into `npm run lint`.

*The guard found two defects on its first run, which is the argument for having written it:*
`NotificationCenter`'s desktop veil was still `bg-ethereal-ink/10` — a scrim in the one rung that
inverts, i.e. Stage 5's defect surviving at low alpha in the one file where the geometry and the
fill sit on different lines of the same `cn()`. And its own first rule was too broad: an inset
`bg-ethereal-alabaster/60` over a map that has not loaded is the CARD's colour and follows the
ladder correctly, so the veil rule narrowed to `ink` and `graphite` — the only two rungs that are
dark on light and light on dark.

**Deferred, own spec: the dark map.**

---

## 9. Decisions needed before Stage 6

1. ~~**What is a "premium dark card" on a dark ground?**~~ **Decided 2026-08-31: (a), and the gold
   hairline from (b) alongside it.** The card takes `surface-inverse` and rises with the ground;
   the emphasis its value can no longer carry moves to the rim. Reasoning, measurements and the
   three findings the question did not anticipate are in §3.2 C.
2. ~~**Does the noise grain survive on dark?**~~ **Decided 2026-08-31: no, and it is not missed.**
   Looked at on the real dashboard — neither the `color-burn` grain nor the `multiply` glows were
   visible. Both are films whose entire content is the darkening they perform, so they are dropped
   on dark rather than left painting an invisible full-surface composite: `light-ground-film` in
   `panel.css`, on the two grains (`GlassCard`, `PdfViewer`) and the six glow blobs
   (`EtherealBackground`, `WelcomeMoment`, `ErrorScreen`).
   The sweep turned up a third case the question had not named and it needed the opposite answer:
   `ArtistEmptyState`'s resonance rings carry their own accent colour and only *borrow* multiply to
   sit into a bright ground. Hiding them would leave an empty empty-state, so there the blend steps
   aside instead (`blend-multiply-light`). **The distinction to reuse: does the layer HAVE marks, or
   is it only the darkening?**
3. **Is the dark map worth a second Cloud map ID?** Three call sites (`LocationsAtlas`,
   `LocationMapPicker`, `VenueMiniMap`). A light map inside a dark panel is the single loudest
   seam dark mode will have. **Still open — the only thing left in this spec.**

---

## 10. Guardrails

**Built in Stage 7.** Two files, both cheap, both run by `npm run lint` / `npm run test`:
`src/shared/theme/themeParity.test.ts` and `scripts/check-literal-colours.mjs` with
`scripts/literal-colours.allow.json`. What each of the bullets below became is noted under it.

- **Token parity test** (vitest, `app/styles/panel.css` parsed as text): every custom property
  declared inside `[data-theme="dark"]` must exist in `@theme`/`:root`, and every ladder token
  listed in the test's own manifest must appear in both. Catches the classic "forgot one token"
  — which in this architecture shows up as one element still light, three routes away.

  *As built, 7 assertions.* The manifest lists only what has to MOVE (26 tokens) — gold, sage and
  incense are deliberately absent, because an accent holding its hue is the finding the palette
  rests on and listing them would fail the day someone honours it. A third assertion catches the
  case the spec did not name: a token **copied into the dark block unchanged**, which is the same
  defect as one left out, wearing the shape of a decision. The dark block is brace-matched from its
  own selector, so the `[data-theme="dark"] &` nested inside the two blend utilities is not mistaken
  for it.
- **`tailwindMerge.ts`**: the three inverse tokens go in the ledger in the same commit that
  creates them. A token missing there is deleted at runtime with no error (`panel.css` already
  carries the warning).
- **Literal-colour guard**, as an npm script rather than an eslint plugin (cheap, and it is a
  grep either way):
  `rg -n '(bg|text|border|ring|fill|stroke|divide)-(white|black)' frontend/src` with an
  allowlist file. Wire it into `npm run lint`. Allowlist as it stands after Stage 5 — 18 hits in
  8 files, each a colour that is correct in both themes rather than an unconverted one:
  - the QR card's quiet zone and the PDF page canvas (§6);
  - **`LegalPage`'s `print:bg-white`** — paper has no theme (§7), and this is the one printable
    route in the panel;
  - **every modal scrim.** Stage 5 found fifteen more written in `ink` rather than a literal and
    converted them, so the rule now has one shape across the panel: a full-viewport veil is
    `bg-black/2x…/8x`. Only the four the spec had already named appear in this grep
    (`ConfirmModal`, `BottomSheet`, `PdfViewerModal`, `AnnotationGuide`) plus `LegalModals`,
    `DocumentUploadModal` and `CategoryFormModal`; the rest were never `white`/`black` classes;
  - `Checkbox`'s tick and `Badge`'s pulse sweep — a specular mark on an accent fill, the same
    exception the primary button's shadow carries. Note the seam Stage 5 left here on purpose:
    the two hand-rolled checkboxes in chorister-hub took `text-ink-on-inverse` (identical pixels,
    `#FBFAF7` on gold) while `Checkbox` itself stayed literal because the allowlist named it. If
    §1.2's white-on-gold finding is ever taken up, `Checkbox` is where it starts;
  - `AnnotationOverlay`'s **paper-side** literals: the lock badge's disc, the inline mark's
    `ring-black/10` and the pin's `text-white` / `ring-white/80` over a fixed annotation ink.
    Those are on the score, which is white in both themes, so they are the same exception as the
    canvas they sit on rather than a separate category.

  Two things the guard cannot see, both proved by Stage 5 and worth a second grep in the same
  script: a scrim written as `bg-ethereal-ink/4x`, and an arbitrary `shadow-[…]`/gradient carrying
  a raw `rgba()`. Both are unconverted literals wearing a token's clothes.

  *As built, four rules — and the shape of it is the part to keep.* **The rules encode the canon so
  that correct code needs no allowlist entry**, which is what stops the list from growing into
  something nobody reads: a full-viewport veil (`inset-0`) IS black; a cast written `rgba(0,0,0,…)`
  lands inside a `surface-inverse` island, because a cast onto the PAGE is warm here and warm casts
  became variables in Stage 5; a `rgba(194,168,120,…)` / `rgba(166,146,121,…)` literal is an accent
  and an accent holds. That leaves **19 allowlisted classes in 9 files**, in three families — paper
  (score canvas, printable route, the marks on them), the Google raster, and a specular mark on an
  accent fill — plus **3 lines** for the bracket rule. Rule 3, the one the spec asked for, is the
  only one that cannot be allowlisted at all: there is no correct case for a veil in `ink` or
  `graphite`.

  Four things learned building it, each worth more than the rule it produced:
  - **A stale allowlist entry fails the check.** A list nobody prunes stops being a record of
    decisions and becomes a list of things that used to be true.
  - **The veil rule reads back to the enclosing `className`, not a window of lines.** A fixed
    lookback broke the moment a comment was added between the geometry and the fill — which is
    exactly the shape of the one file that was still wrong.
  - **Surface rungs are NOT part of rule 3.** An inset `bg-ethereal-alabaster/60` over a map that
    has not loaded is the card's own colour and follows the ladder correctly. Only `ink` and
    `graphite` invert direction.
  - **Tests are excluded from the scan.** `fieldShell.test.ts` asserts on the light theme's own
    inset literal: it is quoting the stylesheet, not painting with it.
- **`theme-color` parity**: `THEME_COLOR` in `shared/theme/themeController.ts` and the media-keyed
  pair in `index.html` both hard-code `--color-ethereal-canvas` per theme — a meta cannot read a
  CSS variable. Change the ground and all three move together, or a seam opens along the top edge
  of an installed iOS app. Cheapest home for this is the §10 token-parity test, which already
  parses `panel.css` as text.

  *As built:* three assertions there, and the third is `manifest.webmanifest`'s `theme_color` —
  static by nature, so it stays on the light ground, but it drifts the same way and opens the
  installed Android window chrome instead of the iOS status bar.
- **Contrast**: re-run the ratio table (§1.1/§2) after any palette tweak. Target AA 4.5 for text
  and 3.0 for icons/marks on **both** the ground and the card.

  *Corrected 2026-08-31:* which of the two is tighter **flips with the theme**, and the original
  wording ("the card is always the tighter") is the dark-theme half only. A light accent on a dark
  ground loses contrast as the surface rises, so on dark the card is tight; a dark accent on a
  light ground GAINS contrast as the surface rises, so on light the tight surfaces are the ladder's
  dimmest rungs — `parchment` and `canvas`, not the card. Measuring a light value against the card
  reads about half a step high, which is the difference between crimson's 4.16 and its real 3.69.
- **`npm run typecheck` + `npm run build`** per stage; the developer verifies visually.
