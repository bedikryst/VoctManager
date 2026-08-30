# Dark mode — specification (2026-08)

Status: **Stages 0–3 shipped; Stage 4 is next** · Audited 2026-08-30 · Surface: `frontend/` (panel
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

**B · Player & docks** (3) — `MiniPlayerBar`, `RehearsalDock`, `VoiceMixerPanel`. Same rename.

**C · The "premium dark" surfaces** (5) — `NextEventHero`, `TimelineProjectCard`,
`ConcertDayPlan`, plus `BottomSheet tone="dark"` and `SegmentedTabs tone="dark"`.
→ **A design question, not a rename** (§9): on a dark ground, "the premium dark card" no longer
distinguishes itself from anything. Either it becomes the *brightest* rung on dark (inverting its
relationship to the page, which is what the concert sheet is actually saying) or it keeps a gold
hairline and drops the fill. Decide once, apply to all five.

**D · Primitives carrying both tones** (11) — `GlassCard` (`dark`/`surface` variants), `Button`,
`Badge`, `Checkbox`, `Divider` (`solid-dark`), `Typography` (`marble-muted` colour),
`MetricBlock`, `DateTimeField/CalendarGrid`, `SegmentedTabs`, `Select`, `accents.ts`.
→ Do these **first**: fixing the primitive fixes most of its call sites. `accents.ts` is already
correct by construction — `ACCENT_MARKER` reads `var(--color-ethereal-*)`, so Google Maps pins
follow the theme with no code change.

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
- **Light-theme accent contrast** (§1.2) — a real finding, a separate pass.

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

**Stage 3 — the primitives** (group D). `GlassCard`, `Button`, `Badge`, `Divider`, `Typography`,
`Checkbox`, `MetricBlock`, `CalendarGrid`, `SegmentedTabs`, `Select` + the three inverse tokens
and their `tailwindMerge.ts` entries. *Exit:* `fieldShell.test.ts` and `InlineEditable.test.ts`
still green; a form, a modal and a bottom sheet read correctly in both themes.

**Stage 4 — the score & document chrome** (groups A + B, 21 files). The largest group and the
most mechanical. *Exit:* the score viewer, annotation toolbar and player dock are identical in
both themes, and the page canvas is still white.

**Stage 5 — the one-offs** (group E + §4 arbitrary values). Route-by-route sweep. *Exit:* a grep
for `-white`/`-black` outside the allowlist returns only the QR card and the PDF canvas.

**Stage 6 — the premium dark surfaces** (group C). Needs the §9 decision first. *Exit:* the five
surfaces state their hierarchy the same way in both themes.

**Stage 7 — guardrails.** §10.

**Deferred, own spec: the dark map.**

---

## 9. Decisions needed before Stage 6

1. **What is a "premium dark card" on a dark ground?** The concert hero, the timeline project
   card and the day plan currently say *"this is the important one"* by being darker than the
   page. On dark that reads as a hole. Options: (a) it becomes the *brightest* rung — the
   inversion is honest, since the card's real claim is "distinct and elevated"; (b) it keeps the
   fill and states itself with a gold hairline plus the noise grain. **(a) is the recommendation**
   — it is the same claim in the same grammar.
2. **Does the noise grain survive on dark?** (§2.3) — a look-and-decide, not an analysis.
3. **Is the dark map worth a second Cloud map ID?** Three call sites (`LocationsAtlas`,
   `LocationMapPicker`, `VenueMiniMap`). A light map inside a dark panel is the single loudest
   seam dark mode will have.

---

## 10. Guardrails

- **Token parity test** (vitest, `app/styles/panel.css` parsed as text): every custom property
  declared inside `[data-theme="dark"]` must exist in `@theme`/`:root`, and every ladder token
  listed in the test's own manifest must appear in both. Catches the classic "forgot one token"
  — which in this architecture shows up as one element still light, three routes away.
- **`tailwindMerge.ts`**: the three inverse tokens go in the ledger in the same commit that
  creates them. A token missing there is deleted at runtime with no error (`panel.css` already
  carries the warning).
- **Literal-colour guard**, as an npm script rather than an eslint plugin (cheap, and it is a
  grep either way):
  `rg -n '(bg|text|border|ring|fill|stroke|divide)-(white|black)' frontend/src` with an
  allowlist file. Wire it into `npm run lint`.
- **`theme-color` parity**: `THEME_COLOR` in `shared/theme/themeController.ts` and the media-keyed
  pair in `index.html` both hard-code `--color-ethereal-canvas` per theme — a meta cannot read a
  CSS variable. Change the ground and all three move together, or a seam opens along the top edge
  of an installed iOS app. Cheapest home for this is the §10 token-parity test, which already
  parses `panel.css` as text.
- **Contrast**: re-run the ratio table (§1.1/§2) after any palette tweak. Target AA 4.5 for text
  and 3.0 for icons/marks on **both** the ground and the card — the card is always the tighter of
  the two and is the one to check.
- **`npm run typecheck` + `npm run build`** per stage; the developer verifies visually.
