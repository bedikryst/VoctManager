# Project Hub — design remediation

**Phase 0, all ten Phase 1 tab passes, Phase 2 §5.1–§5.3, the primitive unification (D4, D5) and the
first five Phase 3 passes are SHIPPED** (2026-07-25 → 2026-07-27). Written 2026-07-25 · surface:
`/panel/projects/:id/*` (hub shell + 10 tabs) and the shared primitives it exposes, now widening per
feature (§8). `StatePanel` adoption and the `SegmentedTabs` unification are both closed.

## How to read this file

**Everything below "## 1. Diagnosis" is a RECORD, not a plan** — what each pass found, what it
declined and why. It is ~1200 lines; do not load it to do ordinary work.

- **Doing a design pass anywhere in the panel?** The rules this project produced were promoted into
  `.ai/04_design_system.md` — that is the canon, and it is 12 KB. Read it, plus the two short
  sections below.
- **Picking up the remaining work?** Everything open is listed below. §5.4 no longer duplicates it.
- **Reading the record?** Only when you need the reasoning behind a specific tab's shape — e.g.
  before re-proposing something a pass already declined. Jump to the tab's section in §4, or to a
  feature's section in §8.

## Still open

- **17 raw uppercase micro-labels remain**, re-measured 2026-07-27 after the auth pass (which
  cleared all 12 of its own). Recipe: `uppercase` co-occurring with a `tracking-*` or `text-[0…]`
  class, minus the primitives that own the recipe (`Typography`, `Eyebrow`, `Badge`, `Button`,
  `SegmentedTabs`). What is left: `widgets/utility` 3, annotations 3, `shared/ui` 6
  (`typography` 2 — the role's own declarations — plus kinematics, feedback, composites,
  repertoire on 1 each), materials 3, schedule 1, rehearsals 1. The widest outliers in the tree
  are still `UserLocalClock`'s `tracking-[0.4em]` / `[0.2em]`.
- **Radius/hairline tokens are applied in `shared/ui`, `features/projects`, `features/archive`,
  artists+crew+logistics, settings+dashboard+notifications+contracts, messages and auth.** This is
  **not** a sweep — see the note opening §5 — it rides along with per-feature passes. The auth pass
  re-measured the number the way the next pass actually needs it, **counting rules and fills
  separately**, because the old figure (38) mixed them: greping for a `border-`/`divide-`/`ring-`
  prefix leaves **19 true 1px rules** — rehearsals 14, annotations 2, and schedule, projects and
  chorister-hub on 1 each. Everything else at those alphas is a bar track, a dot, a groove or a
  scrim — a *fill*, which stays. Auth now greps 2 and both are fills.
- ~~`SegmentedTabs` has five hand-rolled copies left~~ — **closed 2026-07-27.** All eight private
  copies of the gold-pill-on-alabaster track are gone; `grep "bg-ethereal-gold text-ethereal-ink
  shadow-sm"` returns the composite and nothing else. The composite gained `iconOnly` for the two
  density toggles that were never mechanical adoptions (§8).
- ~~`StatePanel` adoption~~ — **closed 2026-07-27** with the messages pass. `features/dashboard`'s
  `ArtistEmptyState` is the one deliberate exception: a named scene with its own breathing-ring
  scenography, not the ad-hoc icon stack the rule targets, and `StatePanel` cannot carry a
  `backgroundElement`.
- **`Eyebrow size="caption"` is used 42× and is off-role.** The overline has exactly two declared
  sizes (`overline`, `overline-sm`); `caption` is an 11px escape hatch that half the panel reaches
  for, the archive pass included. Deciding it is a `shared/ui` call, not a feature pass's — either
  legitimise it in `Eyebrow` or migrate the 42 to `overline-sm`. The messages pass deliberately
  left the size alone and removed only the local letter-spacing override.
- **Diacritic-folding search is now universal and should stay that way.** Every user-facing search in
  the panel goes through `shared/lib/text.foldDiacritics`; the archive follow-up swept the last three
  (both archive lists, plus `useMaterialsData` and `ProjectLedgerRail`, which were found while
  checking whether the rule in `.ai/04` was actually true — it was not). A new search box is the one
  place this regresses silently, because an unfolded search fails only for the users whose names
  carry the diacritics.
- **The rest of `features/rehearsals` wants a copy pass.** §5.3 fixed the shared status vocabulary;
  the module's own headings and empty states have not been read end to end. Small companion defect:
  the Frekwencja matrix computes `isPast` / `isLive` once per data change rather than on a timer, so
  a tab left open across the downbeat keeps the previous state until it remounts.
- ~~Two companion defects left for the passes that own them~~ — both fixed by the
  settings+dashboard+notifications+contracts pass (§8). See that section for what the second one
  turned out to be underneath.
- **~120 dead `archive.*` i18n keys predate this work** and were left alone: the whole
  `archive.card.*`, `archive.hero.*`, `archive.metrics.*`, `archive.tracks.*`, `archive.editor.*`
  nodes and most of `archive.form.placeholders.*` — fossils of the pre-2026-07 panel/slide-over
  archive. §8 pruned only what it killed itself. This belongs to the dead-key sweep the i18n
  remediation already has open, not to a design pass.

Suggested split for what is left: **rehearsals next** — 14 of the 19 remaining hairline rules, plus
the copy pass and the `isPast`/`isLive` timer above, all in one module. Then `shared/ui` last, since
its 6 overlines sit in composites every feature renders and a change there is a change everywhere
(two of them are `typography`'s own declarations of the role and are not defects). Run them
sequentially, not in parallel: they all touch the three locale files.

## Decisions, settled

- **D1 — display figures stay serif.** The `metric` variant is `font-serif lining-nums` at weight
  400; `tabular-nums` is deliberately absent. What made `15` read as `I5` was the oldstyle figure
  set plus `font-light`, not the family. Sans + `tabular-nums` is for figures that genuinely align
  down a column. **Do not re-propose moving metrics to Inter.**
- **D2 — settled against this file's original recommendation: the picker was built.**
  `shared/ui/composites/DateTimeField` (Radix Popover on a pointer, the same panel in a
  `BottomSheet` on touch, typed HH/MM segments, domain markers). No `type="date|time|
  datetime-local"` remains anywhere in the tree.
- **D3 — Select migration staged**, as recommended: primitive + `features/projects` in Phase 0, the
  remaining 17 files in §5.2. `NativeSelect.tsx` is deleted.
- **D4 — `fieldShell` is the only field surface** (2026-07-26). `Input` and `Textarea` no longer
  carry copies of it. Every difference between the three was either lifted into the shell or
  deleted, and `shared/ui/primitives/fieldShell.test.ts` freezes the three old recipes and asserts
  on resolved `cn()` output that nothing else moved:
  - LIFTED — the glass focus fill (`focus:bg-ethereal-marble`; the shell's `dark` already had one,
    so glass lacking it was drift *inside* the shell) · the placeholder colours (inert on a button
    or a div, but one copy beats three) · `solid`'s hover border (a hover is the surface's answer,
    on every variant). `Input` gains `solid`, `Textarea` gains `dark`, for free.
  - DELETED — `backdrop-blur-md` on glass: the fill is 90% opaque, so it bought a compositing layer
    per field and nothing else — the same call `GlassCard` made · the ghost variant's second hover
    and focus tint (`incense/10`, `marble`), keeping the pair with live callers · crimson VALUE text
    on error: the border, the tint and the message are the alarm, and on the dark field ink-on-ink
    was unreadable.
  - CONTRACT — `className` now merges LAST in both, as it already did in `Select`. Three call sites
    had layout classes that were being silently dropped and now apply: `PasswordInput`'s `pr-12`
    (the secret no longer runs under the eye toggle) and the two ledger fee inputs' `py-2`.
  - BUG — `Input` declared `hasError` and then ignored it (it fell through to the DOM as an unknown
    attribute). Two settings fields asked for a crimson field and got nothing; they work now.
- **D5 — `Badge` is the only chip** (2026-07-26). `StatusBadge.tsx` is deleted; its four call sites
  (contracts ×3, dashboard ×2) render `Badge` with the same colours. The differences did NOT earn a
  second component: `rounded-full` is off the radius scale, and the `0_0_12px` glows were ad-hoc
  shadows on three of four variants. What survives is one axis, `pulse` — the light sweep, kept
  because "this is live right now" is a real signal, and documented so it stays one. Chips are
  ~2px tighter (the shell's `px-2.5`) and no longer blur their backdrop. `EditionStatusBadge` was
  the third copy of the chip (a fourth tracking value at `0.18em`) and now composes `Badge` too;
  its ready/failed tones shift by one alpha step to the shared tones.

## The finding that shaped the project

**Almost nothing here was a layout problem.** The compositions were sound — the hub, the KPI strip,
the two-column tabs, the divisi board all held up. What read as "glued together in a hurry" was a
small set of micro-decisions (a label, a corner, a hairline, a card header) taken slightly
differently in every file: 16 letter-spacing values and 5 font sizes for one typographic role. The
eye reads that as sloppiness without being able to name it. So this was an **enforcement** job, not
a redesign — which is why the durable output is `.ai/04_design_system.md`, not this document.

Two passes proved the diagnosis incomplete: Próby and Frekwencja had real structural problems
(a flat list that should have been a runway; a grid turned ninety degrees from its data). When a
pass finds that, say so and reorganise — but check the micro-decisions first.

This was a **staged plan, not a line-exact spec**. Read the code, disagree where the code says
something different, and update this file when you do.

---

## 1. Diagnosis

### 1.1 The micro-label problem — the single biggest cause

The uppercase overline ("eyebrow") is the most repeated element in the whole panel: every card
header, every field label, every tab, every KPI caption, every group divider. It is currently built
**six different ways**:

| Recipe | Size | Tracking | Colour | Example |
| --- | --- | --- | --- | --- |
| `Eyebrow` default | 11px | `0.14em` | `incense/60` | `Eyebrow.tsx:4` |
| `Eyebrow color="graphite"` | 11px | `0.14em` | `graphite` | `WidgetCard.tsx:60`, `DetailsTab.tsx:63` |
| raw span | 10px | `widest` (.1em) | `graphite/55` | `ProjectStatusStrip.tsx:79`, `CastTab.tsx:259` |
| `Caption` + uppercase | 11px | `0.16em` | `graphite/60` | `ProjectFactsCard.tsx:40` |
| `Input`'s own `<label>` | 10px | `0.1em` | `graphite` | `Input.tsx:63` |
| `ProjectTabs` nav item | 11px | `wider` (.05em) | inherit | `ProjectTabs.tsx:139` |

Counted app-wide: **16 distinct `tracking-*` values** and **5 distinct uppercase sizes**
(8/9/10/11/12px) across ~84 hand-rolled instances. `Select` labels its field with `Eyebrow`;
`Input` hand-rolls a different one — so two fields sitting side by side in the Szczegóły tab carry
labels that differ in size, tracking and colour.

Note also that `Eyebrow`'s **default is wrong**: `color="incense-muted"` is overridden at nearly
every call site, which is why so many callers gave up and wrote a raw span instead.

### 1.2 No radius scale

Five radii in `features/projects` with no rule governing which goes where:
`rounded-3xl` (24px, GlassCard) · `rounded-2xl` (16px, KPI tiles, tab bar) · `rounded-xl` (12px,
Button, Input, Select) · `rounded-lg` (8px) · `rounded-md` (6px, Badge).

The mismatches are visible, not theoretical: the `W PRZYGOTOWANIU` badge (`rounded-md`) sits in the
same row as `rounded-xl` buttons; the KPI tiles (`rounded-2xl`) sit directly above cards
(`rounded-3xl`). Same surface, two corner languages.

### 1.3 No hairline token

Seven values in use for "a 1px divider": `border-ethereal-ink/6`, `/8`, `/10`,
`divide-ethereal-ink/5`, `border-ethereal-incense/15`, `/20`, `border-glass-border`. Two card
headers three files apart use `/6` and `/15` on different base colours.

### 1.4 The card header is hand-rolled 13× — in two opposite placements

`WidgetCard.tsx:53` already encodes the canonical header (icon + `Eyebrow` + optional action, on a
`border-b`, `px-5 py-3.5`). It is then re-typed by hand in `DetailsTab`, `BudgetTab` (×2),
`CrewTab` (×2), `ProgramTab` (×2), `RehearsalsTab` (×2), `MicroCastingTab` (×2),
`AttendanceMatrixTab`, `ProjectAttentionPanel` — in four flavours (`pb-3` vs `py-3.5`, `px-5` vs
none, `ink/6` vs `ink/8` vs `incense/15`).

Worse, the **placement** is inconsistent: Program / Rehearsals / Budget / Crew / Attention put the
header **inside** the card on a rule; Cast puts it **outside**, floating above a bare card. Those
two tabs read as two different products.

### 1.5 Native controls — where the design language stops

There is **no custom listbox anywhere in the app.** `Select.tsx` is a styled *trigger* wrapped
around a native `<select>`; the popup is drawn by the OS. That is the Windows-blue highlight in the
Szczegóły screenshot, and it is the least premium pixel in the product. 96 occurrences across 26
files.

Same for `type="datetime-local"` / `type="time"` (Szczegóły, Próby): native calendar chrome,
`dd.mm.rrrr --:--` placeholders, no relation to the Ethereal language.

The irony: `DropdownMenu.tsx` **already contains the exact popover skin** a listbox needs (Radix,
portalled, `rounded-2xl`, `bg-ethereal-alabaster/95`, `backdrop-blur-ethereal`,
`z-(--z-nav-sheet)`, enter/exit animations). `@radix-ui/react-dialog|dropdown-menu|tooltip|switch`
are already dependencies; `@radix-ui/react-select` is the missing sibling.

### 1.6 Rules already decided — and already violated

From `.ai/04_design_system.md`:

- *"`MetricBlock` — any KPI/statistic. **Don't hand-build number flexboxes**."* →
  `ProjectStatusStrip.tsx:90` and `ProjectFactsCard.tsx:142` both hand-build number flexboxes.
  `MetricBlock` has 2 users in the whole app.
- *"`StatePanel` — the standard for 'nothing here yet'."* → **zero** of the ten project tabs use it.
  ~20 hand-rolled centred empty states instead (`ProgramTab` ×2, `RehearsalsTab`, `CastTab` ×2,
  `DetailsTab`, `MicroCastingTab`…), each with its own icon size and copy structure.
- *"Clickable tiles hover = gold border highlight, **NO translate-lift**."* →
  `ProjectStatusStrip.tsx:74` lifts (`hover:-translate-y-0.5`), and `GlassCard`'s `isHoverable`
  (default **true**) lifts by `-translate-y-1`, which `WidgetCard` inherits for every activatable
  overview card.
- *"No stock Tailwind palette colors."* → `Button.tsx:28`, `variant="destructive"`:
  `bg-red-50 text-red-600 border border-red-900/10`. Should be `ethereal-crimson`.
- `TabHeader` is documented as a composite but has **zero users** — it is dead code. Meanwhile three
  competing tab visuals ship: `ProjectTabs` (marble pill on a marble track), `SegmentedTabs` (gold
  pill on alabaster), and `CastTab.tsx:303` (two `Button`s inside a `GlassCard`, a third look for
  the same control).

### 1.7 Concrete rendering defects (root-caused, not opinions)

1. **Przegląd → Szczegóły card, the time floats.** `ProjectFactsCard.tsx:109` passes
   `containerClassName="inline-flex items-center gap-1"` into `DualTimeDisplay`, whose own base is
   `flex flex-col`. tailwind-merge replaces `flex`→`inline-flex` but keeps `flex-col` (different
   group), so the result is `inline-flex flex-col items-center`: the box shrink-wraps to the date's
   width and **centres `20:02` under the date**. The caller was written for a row; the component is
   a column.

2. **Próby → the cross-timezone rehearsal row breaks.** Same component, same mistake, one file over
   (`RehearsalsTab.tsx:450`): `localTimeClassName="ml-2 border-l border-current pl-2"` styles the
   local-time row as if it sat *beside* the primary time. It stacks underneath, so the left border
   renders as a stray vertical rule inside the pill.
   Compounding it: `DualTimeDisplay.tsx:145` decides `hasDiffTz` by comparing **IANA names**, not
   offsets. Europe/Paris and Europe/Warsaw always share an offset, so the Paris rehearsal prints
   `01:45 CEST` and, directly below, `01:45 CEST (twój czas)` — the same instant, twice, as noise.

3. **Divisi → the count and the list disagree.** `MicroCastingTab.tsx:421` badges
   `unassignedParticipations.length`, but the list at `:435` does `return null` for any
   participation missing from `artistMap`. The board says 4 unassigned and shows 2, silently. This
   is a correctness bug, not a cosmetic one — the conductor is being told about holes they cannot
   see.

4. **KPI numerals are illegible.** `Metric` is serif (Cormorant Garamond) at `font-light`; at
   `text-3xl` its `1` reads as `I` and its `0` as `O` — the strip literally shows `I5 dni`, `O/2`,
   `O PLN`. `tabular-nums` is applied but Cormorant almost certainly ships no `tnum` table (needs
   verifying against the woff2), so the columns are not aligned either. See open decision D1.

5. **Icon buttons are under the touch minimum.** `Button.tsx:38`, `size="icon"` = `h-10 w-10`
   (40px). The codebase defines 44px as the floor via `size="touch"`. The rehearsal edit/delete
   pair, and every icon action in the tabs, is 40px.

6. **`Button` locks its type size with `!important`** (`Button.tsx:15`, `!text-[11px]`), so a caller
   cannot size button text without fighting the primitive. That is why several call sites reach for
   raw spans instead.

### 1.8 Chip inflation

The rehearsal row carries five chips of identical weight — date `Badge`, bespoke time pill,
`Zakończona`, `TUTTI` / `Wezwanych: N`, `Opcjonalna` — in two different chip languages (a `Badge`
and a hand-built bordered pill). Nothing is more important than anything else, so nothing reads.
Same pattern, milder, in the Program setlist and the Partytura panel (three stacked advisory lines,
all the same colour and weight).

---

## 2. Working model — recommendation

**Foundations first, in one pass, then tab by tab.** Not tab by tab from the start.

Reasoning: ~80% of what looks unfinished in the screenshots is §1.1–§1.4 — one repeated
micro-decision, made ten times. Going tab-first means re-deciding the label recipe, the corner
radius and the header shell ten more times, and drifting again. After Phase 0 each tab pass becomes
small and mostly about hierarchy and copy, which is the part worth doing calmly.

The honest cost: Phase 0 is a wide, low-drama sweep touching ~100 files with little visible progress
for a day or so, and it is the one part with real regression surface. Mitigated by splitting it into
five independently shippable commits, each with `npm run typecheck` + `npm run build`.

**Phase 0 — Foundations** (§3). One chat, sequential, do not parallelise: the commits touch the same
primitives.

**Phase 1 — Tab passes** (§4). One tab per chat, parallelisable *after* Phase 0 lands, each against
the fixed checklist so the results are comparable.

**Phase 2 — App-wide sweep** (§5). The same debt exists in settings, archive, logistics, crew — the
Project Hub is just where it was noticed.

---

## 3. Phase 0 — Foundations (SHIPPED)

Five steps. Each one mechanical; none of them changed a composition.

What actually landed, measured over `shared/ui` + `features/projects`: raw uppercase micro-labels
84 → 10 (the remainder dense in-chip markers, left to the tab passes); raw `rounded-*` steps → 0;
ad-hoc ink hairlines → 0 in card chrome; hand-rolled card headers 13 → 0; native `<select>` in
projects → 0. Two defects from §1.7 were fixed on the way (the `DualTimeDisplay` orientation bug and
its false timezone comparison); §1.7-3, the count/list desync, was left to the Divisi pass, because
fixing it meant deciding what to render for a participation with no artist record. Also fixed while
in the files: `projects.rehearsals.form.location_placeholder` read "np. Sala 102, Akademia" — an
input hint used as a listbox placeholder — now "Wybierz salę" in all three locales.

Two things were deliberately **descoped** from what this section originally proposed:

- **`Eyebrow`'s default colour was left at `incense-muted`.** The plan said to change it to whatever
  the majority passes (`muted`, 141 call sites). But 65 sites rely on the default, and the claim
  that the "wrong" default is what pushed callers to raw spans was speculation the numbers do not
  support — passing `color="muted"` is not hard. Changing it would have been a wide, unrequested
  visual change. The drift was in the *recipes*, not the colour, and the recipes are fixed.
- **KPI tiles were not moved onto `MetricBlock`.** That changes where the icon sits and which tone
  the label carries — a composition decision, so it belongs to the Przegląd pass (§4), not to a
  mechanical foundations sweep.

### 0.1 Tokens (`app/styles/panel.css`)

Add to `@theme`:

- **Radius scale, three steps.** `--radius-surface` (cards, sheets, panels) ·
  `--radius-control` (buttons, inputs, selects, tiles) · `--radius-chip` (badges, pills).
  Rule to write into the doc: *a nested surface steps down exactly one level; a chip is always
  `--radius-chip`.* Suggested 20 / 12 / 8px, but pick by eye against the current 24 and adjust —
  the current 24px card corner is part of the look and probably wants to stay near where it is.
- **Hairlines.** `--color-hairline` (the default rule; today's `ink/6`) and `--color-hairline-strong`
  (table heads, section splits; today's `ink/8`). Delete the `incense/15` and `/20` rules on
  in-flow surfaces — incense hairlines belong to floating overlays only.
- **Micro-label scale, two steps.** `--text-overline` (the card-header / field-label size) and
  `--text-overline-sm` (dense contexts: table heads, group dividers) with **one** tracking value
  each. Everything currently at 8px and 12px collapses into these.

### 0.2 `Eyebrow` becomes the only overline

- Give it a `size` axis (`default | sm`) bound to the two tokens above, and change the default
  `color` from `incense-muted` to whatever the majority of call sites actually pass (currently
  `graphite`). Keep `incense-muted` reachable.
- Sweep the ~84 raw uppercase spans onto it. `Input.tsx:63` must use `Eyebrow as="label"` exactly as
  `Select.tsx:59` already does — that alone fixes the Szczegóły form.
- Enforcement note for CLAUDE.md: *uppercase micro-labels come from `Eyebrow`; a raw
  `uppercase tracking-*` class is a bug.*

### 0.3 `SectionCard` — one card-header shell

Extract `WidgetCard`'s header into a shared shell (or generalise `WidgetCard` itself with a
`padding`/`scroll` axis — check which fits the Program/Rehearsals scroll-body pattern before
choosing). Requirements it must serve, since these are the real call sites:

- header inside the card, on a `--color-hairline` rule, `px-5 py-3.5`, icon + `Eyebrow` + action slot;
- a body that can be `p-5` **or** a `min-h-0 flex-1 overflow-y-auto` scroll region;
- an optional footer rail.

Then delete the 13 hand-rolled headers, and move `CastTab`'s floating headers **inside** the cards.

### 0.4 A real `Select`

Add `@radix-ui/react-select`. Rebuild `shared/ui/primitives/Select.tsx` on it, reusing
`DropdownMenu.tsx`'s content skin verbatim so the two popovers are siblings, not cousins. Keep the
current prop surface (`label`, `error`, `leftIcon`, `variant`) so the 26 call sites migrate without
API churn — but they *do* need migrating from `<option>` children to items, so budget for that.

Must handle: long lists (timezones — needs search or at least virtualised height), the empty
`--- Wybierz… ---` placeholder convention, and `required`/`aria-invalid` parity with today.

Date/time inputs are **out of scope for Phase 0** — flag as a separate follow-up (§6, D2).

### 0.5 Primitive cleanup

- `Button`: `destructive` → `ethereal-crimson` tokens, drop the two `!important` type sizes, raise
  `size="icon"` to 44px (or make `icon` inherit the `touch` floor).
- `Badge`: adopt `--radius-chip`; replace `transition-all` with the properties that actually change.
- `GlassCard`: flip `isHoverable` to default **false** (per the GlassCard audit note in memory — a
  default-true "everything is clickable" is the smell), and replace the lift with the gold-border
  hover the design system already locks. Expect fallout at call sites that relied on the default;
  that fallout is the point.
- Delete `TabHeader` (dead) or give it the one job `ProjectTabs` is doing by hand — decide, don't
  leave both.
- Fix `DualTimeDisplay`: give it an explicit `orientation: row | column` axis so callers stop
  fighting `flex-col` with `items-center`, and change the `hasDiffTz` guard to compare the
  **formatted result at that instant**, not the IANA name.

---

## 4. Phase 1 — Tab passes

Suggested order (visibility × pain):
**Przegląd → Szczegóły → Próby → Divisi → Program → Obsada → Partytura → Frekwencja → Ekipa →
Budżet.**

Fixed checklist per tab, so passes done in different chats stay comparable:

1. **Structure** — every card is `SectionCard`; header inside, never floating above.
2. **Hierarchy** — exactly one primary element per card. Demote chips: what is status, what is
   metadata, what is an action? Collapse anything that is three chips saying one thing.
3. **Labels** — zero raw uppercase spans; `Eyebrow` only, one size per context.
4. **Empty states** — `StatePanel`, no hand-rolled centred icon stacks. Inside a card body use
   `variant="inline"`; the default `page` variant brings its own surface and would nest a card.
5. **Numbers** — the figure recipe is `Metric` + `Unit` (serif, `lining-nums`), pre-composed as
   `MetricBlock` wherever a label sits above a plain number; never a hand-typed span. `tabular-nums`
   only where figures actually align down a column — and there they are sans, never `Metric`.
6. **Controls** — new `Select`; icon buttons ≥44px; destructive actions crimson-tokened.
7. **Motion** — no hover lift; gold border on hover; `transform`/`opacity` only.
8. **i18n** — every touched string keyed in **pl + en + fr** (Polish primary, must read natively).
9. **Verify** — `npm run typecheck`, then `npm run build` before calling the tab done.

### Przegląd (SHIPPED 2026-07-26)

Almost nothing here was structural — Phase 0 had already put all eight widgets on `SectionCard`,
killed the tile lift and fixed the facts-card `DualTimeDisplay`. What was left was hierarchy: too
many things on one screen said the same thing at the same volume.

What landed:

- **The gap count stopped being said three times.** The KPI tile printed `0/6` *and* `6 luk`, the
  attention panel printed the same 6, and every setlist row wore a `NIEOBSADZONY` chip. The tile
  now carries the ratio only (`projects.overview.kpi.gaps_*` deleted from all three locales), and
  the setlist trades its chip column for a per-piece figure — `useProgramFulfillment` already
  computed the missing-singer total and threw it away, so it now returns `missingCount` and a row
  reads `4 luki`. A covered piece gets a quiet sage tick; a piece with no casting requirements
  says nothing. The card's strongest elements are the piece titles again.
- **Names stopped being statuses.** `Badge` gained a `casing` axis (`overline` default,
  `natural`). Uppercase at 0.1em tracking is the recipe for a machine-written status; a person's
  name set that way reads as a system label. The Ludzie chips are `casing="natural"`.
- **The crew chip printed a truncated enum.** `person.specialty.substring(0, 4)` → `SOUN` whenever
  an assignment had no role description. Now the translated label from
  `features/crew/constants/crewSpecialties`.
- **In-card empty states have a shell.** `StatePanel` gained `variant="inline"` — no surface, no
  ring, no 2xl heading, `description` optional — because a page-level `StatePanel` nested in a
  `SectionCard` body is a card inside a card. Rehearsals / Program / Run sheet were three
  hand-rolled centred icon stacks in three flavours; they are one component now. **Every remaining
  tab pass should use this rather than inventing a fourth.**
- **The run sheet stopped rendering as orphaned pills.** `title` is optional in this data (the
  Szczegóły editor never required it), so a seeded project showed four bordered time chips and
  nothing else — it read as a failed render. The time is now set as time, the title is conditional.
- Smaller: `Unit` (serif italic) for every KPI and money unit, matching `MetricBlock` and the
  dashboard, instead of three hand-typed sans spans; the facts-card date and time share a size
  (the clock was a size larger than the day it belongs to); dress-code labels are one colour, not
  amethyst-vs-sage; the remaining raw number spans (`text-sm font-bold`) come from `Text`;
  `bg-ethereal-ink/6|8` → hairline tokens; `crew.title` was literally "Ekipa (Crew)" in Polish.

Two things were **declined**, with reasons:

- **KPI tiles onto `MetricBlock`.** The tile is a link with a progress rail and a trailing icon;
  `MetricBlock` would have needed a tone axis, a size axis, an icon-placement axis and an escape
  from its own `cursor-default` to host it — three new knobs on a composite with three call sites,
  to serve one. The rule §1.6 protects is *one recipe for a figure*, and that recipe is
  `Metric` + `Unit`, which is exactly what `MetricBlock` is made of and what the tile now uses.
  `MetricBlock` stays the pre-composed form for plain label-above-number blocks.
- **`DualTimeDisplay`'s local-time default.** Its recipe (`9px`, uppercase, `tracking-[0.25em]`,
  incense) is overridden at **7 of its 9 call sites**, in two families — light surfaces re-type
  `normal-case tracking-normal` + a graphite tone, dark ones add a `border-l` + parchment. That is
  the `Eyebrow`-default problem again and the fix is one `tone`/`density` axis plus deleting seven
  overrides, but it spans schedule, dashboard and rehearsals. Phase 2, not a tab pass. See §5.

Left open on this surface: the run-sheet editor still accepts a timeless/titleless row (Szczegóły
pass), and `crew.assign.title` is still "Skład Ekipy (Crew)" (Ekipa pass).

### Próby (SHIPPED 2026-07-26)

The one tab where the diagnosis at the top of this file was **wrong**: this was not only
micro-decisions. The schedule and the form each had a structural problem, and both were worth
reorganising.

**The schedule is now one runway, not a flat list.** Rehearsals and the concert are merged into
a single chronological timeline (`RehearsalTimelineEntry`, `rehearsal: null` marks the concert)
and split at *now* into `Najbliższe` / `Zakończone` under sticky group headers. Two things fall
out of that for free: the actionable half is at the top instead of below a pile of dead rows, and
a rehearsal scheduled *after* the concert renders below the concert row — the ordering carries the
warning, so no advisory copy and no validation rule had to be written for it.

**The row got an anchor.** It was five chips of identical weight (date `Badge`, bespoke time pill,
`Zakończona`, `TUTTI`, `Opcjonalna`) — §1.8 exactly; nothing could be scanned. Now a calendar
stamp (serif `Metric` day + `overline-sm` month, per D1) owns the left edge, the time is the row's
primary line, and venue / focus / who-is-called sit under it as metadata at metadata weight.
`Zakończona` is deleted — the group header says it once instead of once per row. `TUTTI` stopped
being a green success chip: "everyone is called" is the default case, and stating the default in
the loudest colour on every row is what buried the actual facts. Only `Opcjonalna` still earns a
chip. The next upcoming stop carries a gold rail; the row bound to the form carries an amethyst
one, because "edit mode" is invisible when the row being edited is in the other column.

**The form asks four things and states one.** The three target-type buttons were full-width,
stacked, and the active one was a filled gold `primary` — *louder than the submit button*, a
literal inversion of checklist item 2. They are `SegmentedTabs` now (one row, ~150px reclaimed),
and the group around them lost its nested `GlassCard`: a card inside a card is what made the
form read as two stacked panels. A hairline and an `Eyebrow` divide it for a tenth of the ink.
The picker also reports what the selection actually *costs* — `invitedCount`, live, gold at zero.

**The timezone became a fact instead of a control.** It is derived from the room in every real
booking, and the raw list is ~420 IANA entries with no search in `Select`. It now reads
`Czas w strefie: Europe/Warsaw · ZMIEŃ` under the room field and only becomes a listbox on demand.

Defects fixed on the way, all of them visible in the screenshot that started this pass:

- **Doubled map pin** on every venue line — the row drew a `MapPin` *and* `LocationPreview` draws
  its own. Same bug latent on the date field, where a `datetime-local` already renders a picker
  glyph; that is why the field takes no `leftIcon`.
- **`Textarea` and `Input` were two materials.** `Textarea`'s `glass` was `alabaster/60` under an
  **outer** `shadow-glass-ethereal`; `Input`'s is `marble/90` under an **inset** one. Two fields
  in one form in two skins. `Textarea` now carries `Input`'s glass byte-for-byte (13 call sites
  app-wide, all light surfaces). Its placeholder was graphite where every other field's is incense.
- **The mandatory checkbox wore an `Eyebrow`** — an uppercase machine-status recipe on a sentence
  a human reads, which wrapped onto two lines beside the submit button. It is `Text`, and the
  action rail moved into `SectionCard`'s `footer` slot instead of a hand-rolled `border-t`.
- **`RehearsalsWidget` labelled a named-singer call `SEKCYJNA`.** A partial call is not necessarily
  a sectional one. It states the headcount now, through the same keys as the tab.
- Hand-rolled empty state → `StatePanel variant="inline"`; delete buttons are graphite until hover
  (eight permanently red bins read as eight alarms); the disclosure animations dropped their
  `height: auto` keyframes for `opacity`/`y`, per the motion rule.

i18n: `status.tutti` was stored as `"TUTTI"` and `sectional` as `"SEKCYJNA"` — shouting belongs to
the style, not to the locale file, and both now render through `Badge`/`Eyebrow` casing.
The four `status.invited_*` plural forms collapsed into one invariant `Wezwanych: {{count}}`.
Polish Title Case ("Data i Godzina", "Harmonogram Prób", "Próba Sekcyjna") is an anglicism and is
gone; so are the English glosses in Polish labels ("Plan Próby / Repertuar **(Focus)**",
"Lokalizacja **(Sala)**" → "Sala próby"). Dead after this pass and removed: `rehearsals.tutti`,
`.sectional`, `.optional`, `status.finished`.

**Declined:** a custom date-time picker (still D2 — the native field is now the only OS chrome
left on this tab), and collapsing the past group behind a toggle (a project carries ~6–12
rehearsals; a control to hide six rows is not worth its own state).

Tab-specific work already identified:

- **Frekwencja** — the matrix is the one place a *denser*, more table-like treatment is right;
  check the sticky header hairline against the new tokens. *(Answered by the Frekwencja pass
  below — and the premise was wrong: density was never the problem, orientation and the
  honesty of the figures were.)*

### Divisi (SHIPPED 2026-07-26)

The two items §4 listed for this tab were both real, but neither was the tab's main problem. The
board could not answer the question a conductor opens it with — *which piece is still short?* —
because the whole programme was hidden inside a dropdown, and because two of the three things on
screen were saying something that was not true.

**Correctness, first.** §1.7-3 is fixed at the root: casting now runs on a `CastMember` derived
from the participation, not on a lookup into the artists dictionary that silently dropped whatever
it could not resolve. A participation always yields someone — falling back to the name the
participation itself carries, then to a marked "unknown member" — so the pool's counter and the
pool's list can no longer disagree. The same bug had a quieter second half: a *saved* casting whose
artist did not resolve disappeared from its voice line while staying in the payload, invisible but
still persisted.

**Two voice families could not be cast at all.** Free-assignment mode grouped lines by string
prefix over an enum that mixes divisi lines with roles, so `SOLO` filed under the sopranos, `ACC`
under the altos, `TUTTI` under the tenors, `BACK` under the basses — and `VP` and `PRON` matched no
group, which made those two lines unreachable on the board. Three more headers (mezzo,
countertenor, baritone) rendered with nothing under them, because those are voice *types*: there is
no such voice *line*, and the sopranos/altos header was where those singers were always going to be
cast. `features/projects/lib/voiceFamilies.ts` now declares the membership, and the non-choral
lines get a group of their own.

**The dropdown became a rail.** The programme is a worklist, and casting state belongs on it:
`ProgramCastingRail` lists every piece with its gap count, in the Overview setlist's row language
(`02` gold ordinal, `4 luki`, sage tick, nothing at all for a piece with no requirements), so the
state of the whole concert is visible without opening anything and switching piece is one click.
That also removed the duplicated piece title and composer from the sidebar — they now open the
board itself, pinned above the scrolling buckets and set as a serif heading rather than repeated
under the control that selects them.

**The bucket stopped shouting.** `crimson/3` + `gold/5` + `sage/4` tinted surfaces → one neutral
marble surface; the state rides on the figure. A deficit is **gold**, and reads `Brakuje N` in one
dashed slot instead of an unnumbered "UPUŚĆ TU" — deficit is ordinary work in progress, and crimson
stays with the one thing that is actually wrong (a decline). Complete is a sage tick, over-cast
says `Ponad plan: N`. The bucket figure also stopped counting a declined singer as cover; the hook
had applied that rule to the piece status since the beginning, but the bucket beside it had not.

**"CZEKA" on every chip was the `TUTTI` mistake again.** On an unpublished project nobody has been
asked anything, so an "awaiting" chip on all forty people states the default in the loudest way the
chip vocabulary has, and buries the one singer who declined. The answer state now renders only once
the project is published; a decline always renders.

**The chip became a row.** It was a `GlassCard` — a backdrop-blur per person, on a board that can
hold forty — carrying a 10px bold name, an 8px uppercase note pill and a 20px pencil, with
`shrink-0` on every child so a long name overflowed the bucket instead of truncating. It is a plain
surface now: name at 12px medium, the note as a caption line under it (a note is human text and
was being set in the recipe for a machine status), and the two edits as 28px actions — 36px on a
coarse pointer — that appear on hover. 44px cannot fit inside a row this dense, and these are
secondary edits on an already-chosen person, not the screen's primary action.

**`gives_pitch` finally has a UI.** The flag is read by the call sheet, the score package, the
artist dossier and the singer's own piece page — and until now it could only be set in the Django
admin, so in practice it was always false. It is a toggle on the assigned chip, in the same draft
as everything else on the board.

**Loading stopped rendering as a fact.** With a half-warm cache the tab drew "this piece declares
no voice requirements" plus eighteen empty buckets, which is a different screen from the one the
data actually describes.

Smaller: the pool is grouped by voice section under sticky headers and gains a search field above
six people (the toolbar slot `SectionCard` already had); three hand-rolled empty states →
`StatePanel variant="inline"`; the action bar names the piece it will save instead of counting
drags into a sentence too long for the bar; `DroppableBucket`'s drop highlight moved from an
outward ring (clipped away by the card that contains it) to an inset one.

i18n: `sections.unassigned` was "Nieprzypisani (Baza Osobowa)" — a parenthetical gloss that
truncated in its own header; `status.free` was "Wolny Wakat", a vacancy that is vacant, in Title
Case. `buttons.play_reference` had lost its `{{platform}}` interpolation in all three locales, so
the button said "Odtwórz Referencję" while the code passed a platform name. Dead after this pass
and removed: `header.*`, `meta.*`, `select_piece`, `empty.section`, `empty.no_requirements`,
`status.deficit`, `status.free`, `status.drop_here`, `voices.mezzos|countertenors|baritones`.

**Declined:** a popover for the note and the pitch toggle (a portalled surface over a dnd board,
for two fields, with the focus handling that implies), and one dashed placeholder per missing seat
— honest, but eight dashed rows per line at the start of casting is a wall, so the count is stated
once instead.

### Partytura (SHIPPED 2026-07-26)

§4 listed one item for this tab — "three stacked advisory lines, undifferentiated" — and it was
real but small. The tab's actual problem was **rank**: one card carried four different jobs (produce
the book, configure the book, bind each piece, write per-piece card copy) at one depth, and the
rarest of the four — six free-text override fields per piece — was physically the largest thing on
screen. A second card of equal weight held the hand-upload fallback. Nothing said what to look at.

**The hero states the book's condition once.** It used to say "stale" four times over: the headline
word, the meta line, a gold advisory, and the button labels ("Wygeneruj ponownie" / "Pobierz mimo
to"). Now: a word, a stamp under it (`Wersja N · data`), a figures rail, and at most one advisory.

**The tab has figures now — it had none.** `7 z 7 utworów ma dołączone nuty` was prose with two
warning chips wedged into the same line. It is a rail of `Metric` + `Eyebrow` at `text-2xl`
(`7/7` utwory z nutami · `12` stron w książce · `2` bez egzemplarzy), gold when the ratio is short.
A figure only appears when it exists: `0 bez nut` would state the resting case in the loudest slot
on the screen, which is the mistake `TUTTI` and `CZEKA` already taught twice.

**"Wersja 0" was being printed as a fact.** `build_version` starts at zero and only a completed
build raises it, so a book carried over from before the counter existed stamps `Wersja 0` — a
version that means "no build behind this file". Guarded in the cockpit and in `ScorePackageBridge`,
which had the same line.

**The legend explained dots that were nowhere near it.** Four dot+label pairs sat above the piece
list, weighing as much as its heading — but in the list every dot already carried its own label.
The dots that are *unlabelled* live on the card-element pills, inside an opened row. The legend
moved there (`CardElementLegend`, exported beside the pills it decodes), and the list header now
carries something actionable instead: `Wymaga uwagi: N` — pieces with no bound edition, a copies
shortfall, or low-confidence card data.

**"Niekompletna" on six of seven rows.** `incomplete` is the resting state of un-enriched
repertoire and, by the readiness module's own philosophy ("warn, never block — a missing element is
simply omitted"), it is not a warning at all. The collapsed row now states the *binding* first —
the page range, or `brak nut` in gold, which is the book-level fact — and only escalates card data
when it is `low` (gold dot, links to the archive) or complete (a sage tick). The ordinal became the
gold `02` the Overview setlist and the Divisi rail already use; a grey circle was a second row
language for the same object. `is_encore` was in the payload and dropped on the floor — the row
wears the amethyst `BIS` badge the Program tab uses.

**Three surfaces deep became one.** `SectionCard` → item row → a `parchment/40` card-designer panel
with its own border and `shadow-glass-solid`: a card inside a card inside a card, the exact thing
the Próby pass killed. The open row is now one flat stack divided by hairlines, in the order the
work is done — advisories, **Oprawa** (edition + page range + trim strip), **Karta przed utworem**.

**The overrides collapsed.** Six free-text fields (tłumaczenie, wykonawcy, sekcja, rola, tekst,
nota) opened on every row; they are per-concert exceptions almost nobody sets. They sit behind one
disclosure that states `Nadpisania: N` and opens itself on any item that already carries one — so
nothing set is ever hidden. This is *not* a return to the nested disclosure Phase 0 removed: the
card decision and the element pills, which are the common controls, stay in view; only the
exceptions fold.

**Two label languages in one form.** `Wydanie` and `Zakres stron` were hand-rolled `Caption`s while
`Wykonawcy / obsada` two rows below came from `Input`'s own `Eyebrow as="label"` — §1.1, alive
inside a single grid. Every field label on the tab is now the primitive's own, and where a group
needs one (the two page-number inputs) it is `Eyebrow` at the same `gap-1.5 ml-1` metrics.

**The AI page suggestion was stated three times** — a sparkle badge on the thumbnail, the strip's
hint line, and a separate "Nuty od s. 5 — przytnij opis wydawcy" button. The row now owns the
thumbnail manifest query (the strip is presentational), so it knows whether the strip can render at
all: the button appears only where it cannot, and clicking the flagged page is the apply gesture
everywhere else.

**One toggle grammar.** `TogglePill` and `CardElementPills` were two components with byte-identical
class strings, and they disagreed about how "on" looks — a filled check on the structure pills, a
bare gold fill on the element pills, side by side in the same drawer. The element pills are
`TogglePill`s now, with the confidence dot as a trailing marker.

**The settings drawer is legible while shut.** A collapsed bar that said only `USTAWIENIA` now
summarises itself: `Koncert · PL · Karty: 5`.

**The hand-upload card became a footer rail.** Both paths write the same `project.score_pdf` and
the hero already describes whichever book exists, so a full second card gave a rare alternative the
generator's weight. It is one line in `SectionCard`'s `footer` slot — and it dropped its own
`useScorePackageState` call and its duplicate "Podgląd" button, since the hero has one.

Defects fixed on the way:

- **The book preview served a stale blob after a rebuild.** `PdfViewer` caches on
  `["pdf", docKey]` at `staleTime: Infinity`; the panel's key was `book-<project>-<generated_at>`,
  which is fine — but the *hub's* viewer (`openScore`, reached from Materials and the overflow
  menu) keys on `score-pdf-<id>` alone and the generator overwrites the file under the same name,
  so it shows the previous book for the rest of the session. The panel's key now also carries
  `build_version`, and it no longer routes through `openScore`. **The hub's key is still wrong —
  Phase 2.**
- Hand-rolled dashed empty box → `StatePanel variant="inline"` with a link to the Program tab;
  a bare `Ładowanie…` caption that rendered *nothing else* while the state loaded → `EtherealLoader`.

i18n: `manual.remove` was "Usuń" in a rail whose neighbour is "Wgraj" — it removes the book, not
the upload, so it says "Usuń partyturę". `item.over_copies_short` was the truncation "za mało
egz." from when it was a chip; as a tooltip it can afford the word. Dead after this pass and
removed: `intro`, `meta`, `meta_versioned`, `readiness`, `missing_count`, `over_copies_count`,
`language.{pl,en,fr}`, `cards.{text,translation,note}`, `readiness_state.{incomplete,no_edition}`,
`item.advanced`, `item.customized`.

**Declined:** making the hero's `bez nut` / `bez egzemplarzy` figures filter the list below (a
20-piece programme would want it; a control with its own state to skip five rows on a real
programme would not), and a live inline preview of the card being designed (the card preview is a
real PDF render round-trip — it belongs in the viewer it already opens, not inlined per row).

### Szczegóły (SHIPPED 2026-07-26)

The best-looking tab before the pass, and the one with the most *broken* code behind the surface.
Nothing here was a layout problem in the §1 sense; the composition was two balanced columns of
cards and stayed that way. What was wrong was that **five cards were named after field types
rather than jobs**, and that the run sheet — the thing the tab is really for — was an editor for a
timeline that neither looked like nor knew about the timeline it edits.

**Three sections, by job.** `Wydarzenie` (identity, hour, venue, conductor) · `Plan dnia koncertu`
(the call time and the run sheet it opens) · `Informacje dla zespołu` (attire, reference playlist,
notes). Two of the five cards were carrying one and two fields — a whole card for a single Spotify
URL is the weight problem the Partytura pass fixed by demoting its upload card to a footer rail.
The merge also resolved a contradiction: the notes card was headed *Notatki Produkcyjne* while the
field inside it is `Opis wydarzenia` — and that text, like the dress code and the playlist, is
published straight to the singers. Nothing in that card is production-internal, so it no longer
says it is.

**The run sheet became the day it plans.** The two anchors a producer works between — the call time
and the downbeat — were in two *other* cards, so the plan was built blind. They are now fixed stops
inside the timeline itself (`buildDayTimeline`, `features/projects/lib/dayTimeline.ts`): filled gold
dots among the editable rings, placed chronologically. That inherits the Próby trick — **the
ordering is the warning.** A point typed before the call, or after the downbeat, simply renders
outside the anchors; no advisory copy and no validation rule had to be written for either. When the
call sits on another day the anchor carries its date. The row language is the Overview
`RunSheetWidget`'s (one spine, gold clock, optional title), because this edits what that displays.

**The row was three equal boxes; it is now two lines.** A 170px column for prose, all three fields
in the same glass, nothing to scan. The clock and the name share a baseline (they *are* the point)
and the description sits under them as a `ghost` field — genuinely optional, and visibly so.

**The empty state states the frame it is empty inside** — `Zbiórka 09:28, koncert 12:28 — ułóż
przebieg pomiędzy.` (`StatePanel variant="inline"`, replacing a hand-rolled dashed icon stack).
It falls back to a generic hint when either anchor is unset, so it never invents a time.

**The timezone became a fact, and the recipe got one owner.** Same field, same ~420 unsearchable
IANA entries, one tab over — so it reads `Czas w strefie: Europe/Warsaw · ZMIEŃ` exactly as Próby
does. Rather than type that a second time, Próby's version was extracted to
`features/projects/components/TimezoneField.tsx` and both tabs now call it; a second copy of a
recipe is how this whole document's problem started. Retired with it:
`projects.rehearsals.form.timezone` and `.timezone_resolved`, now `projects.timezone_field.*`.
Unlike Próby, this tab also **adopts the venue's timezone on selection** — every hour on the tab is
wall-clock in it, so the venue owning it is what keeps the stated hour and the stored instant the
same event.

Defects fixed on the way, all of them dead or actively harmful code:

- **The run sheet's clock icon rendered nothing and its padding was discarded.** A hand-rolled
  `Clock` at `left-3` without `z-10` — `Input`'s own header explains why that is invisible (the
  field's `backdrop-blur` makes it a stacking context, and the icon precedes it in the DOM, so the
  near-opaque marble paints over it). Its companion `className="pl-9"` was dropped too: cva emits a
  caller's `className` *before* `cn` appends `Input`'s own `pl-4`, so tailwind-merge keeps the
  primitive's. **A layout class passed to `Input` via `className` loses to the primitive — check
  `cn()` output, not the source.** And `type="time"` draws its own picker glyph regardless, which is
  the doubled-marker bug the Próby pass fixed on the venue rows.
- **Rows jumped under the cursor.** The list was sorted by `time.localeCompare` on every render, and
  a native `time` input reports `""` for every partial value — so editing an hour threw that row to
  the top of the day mid-keystroke. The day is now re-sorted on the time field's **blur**
  (`handleCommitRunSheetOrder`), never on change, and the reorder animates via `layout="position"`.
  The dirty check compares both sides chronologically, so a project stored out of order no longer
  opens the save bar on load.
- **Every added point was `12:00`.** Three clicks gave three identical times in an unstable order.
  `suggestRunSheetTime` continues the day instead: last point + 30 min, else the call time + 15,
  else an hour before the downbeat.
- **The title was `required`, which blocked the whole tab.** Legacy and seeded projects carry
  titleless rows; until one was named, no save on this tab could go through — the browser reports
  the first invalid field, but "Please fill out this field" on an unlabelled time box in row six is
  not a usable diagnosis. Dropped, per the readiness module's own rule (*warn, never block*): the
  footer states `Bez nazwy: N` once for the day rather than badging each row, because a freshly
  added point is nameless by definition. `required` stays on the time — that one is load-bearing.
- **Nothing checked the call time against the concert.** It now reads its own offset
  (`3 godz. 30 min przed koncertem`) and goes gold with `Zbiórka nie wypada przed koncertem` when
  the two are the wrong way round. The arithmetic runs on the calendar fields, not on a parsed
  `Date`: the values are already wall-clock in the project's timezone, so an instant would
  re-introduce the browser's own offset and let a DST boundary distort the difference.
- `font-mono` on the time field — a third type family on the tab, and mono is the tree's convention
  for machine strings (ids, coordinates, hashes), not for a clock. Sans + `tabular-nums`, per D1's
  rule for figures that align down a column. Also gone: `className="italic"` on an input value.

i18n: Polish Title Case again — *Tytuł i Opis, Data i Czas, Strefa Czasowa, Zbiórka i Dress Code,
Referencje Muzyczne, Harmonogram Dnia Koncertu, Notatki Produkcyjne, Zapisz Zmiany,
`--- Wybierz Dyrygenta ---`*. `Zbiórka (Call Time)` was an English gloss inside a Polish label, the
same shape as the `Lokalizacja (Sala)` Próby removed; `Lokalizacja / Miejsce` was the same field
named twice. `Dress Code: Panie|Panowie` → `Ubiór: panie|panowie`. The dress and description fields
gained placeholders, since an empty text field with only an overline gives no idea what belongs in
it. Dead after this pass and removed: `header.*`, `score_pdf.*` (the PDF moved to Partytura long
ago), `fields.conductor_placeholder`, `fields.timezone`, `sections.{title_desc,logistics,references,
notes,run_sheet}`.

**Scope note, deliberately taken:** the action-bar copy on this tab read *"Zmodyfikowałeś ustawienia
projektu."* — second person singular, masculine, to a choir that is mostly not. Budget and Program
carried the same construction, so fixing only this one would have created the inconsistency this
document exists to remove; all three are impersonal now. They also stopped restating the bar's own
eyebrow ("Niezapisane zmiany") and name what is pending instead.

**Declined:** a custom date-time picker (still D2 — `datetime-local` on the concert hour and the
call time is the only OS chrome left here), and per-row gap hints between consecutive points ("+30
min") — the anchors already give the day its frame, and a derived figure on every row is the chip
inflation of §1.8 in a new costume.

### Program + Obsada (SHIPPED 2026-07-26)

**Done as one pass, deliberately.** These are not two tabs that happen to look alike — they are
the *same composition* built twice: a pool column beside the work product, a search, a per-row
add, a per-row remove. Everything that made them read as two different products was a
micro-decision taken twice, differently: the search floated outside the cards on Obsada and sat in
the toolbar slot on Program; the pool was left on one and right on the other; the add control was
a labelled `DODAJ` button here and an icon there; "already taken" was a strikethrough here and
nothing there. Doing them in separate chats would have re-decided all of it a third time.

The shared answer is `PickerRow` — **the whole row is the control.** Thirty rows each carrying
their own bordered button is chrome competing with the names it lists, and the row is a far larger
target than the button ever was. Both pools are now flat `divide-y` lists of full-row buttons in
`ProgramCastingRail`'s language, both work products are flat divided lists in the Overview
setlist's, and both searches live in `SectionCard`'s `toolbar` slot with the pool pinned on the
right. Obsada's floating right-aligned search field was §1.4 alive after Phase 0 — a control
belonging to a card, rendered above it.

**The Obsada roster was sorted by an enum that does not exist.** `VOICE_ORDER` in `CastTab` read
`["S","M","A","C","T","BAR","B"]`; the values are `SOP/MEZ/ALT/CT/TEN/BAR/BAS`. Only `BAR` ever
matched, so every other section tied for last and fell back to insertion order — which is why the
screenshot that started this pass opens with **BARYTON** in both columns. `voiceFamilies.ts`
already exported `VOICE_TYPE_ORDER` / `voiceTypeRank` from the Divisi pass; the local table is gone
and the roster reads top staff downwards again.

**"ZAPROSZONY" on twelve people on a draft is the `CZEKA` mistake, a fourth time.** Nothing is
sent before publication, so an answer chip on every row states the resting case in the loudest
slot the row has and buries the one singer who declined. Gated on `showAnswerState`
(`status !== DRAFT`), exactly as `CastMemberChip` already was — which meant passing `project`
rather than `projectId` into the tab. A decline always renders. The same rule killed the
readiness strip's `0/12 zna partię` on the Program rows: it appears only once somebody has
actually reported something.

**The cast counted rows it did not show.** `assignedIds` came from the participations but the list
was rendered by intersecting the roster dictionary, so a participation whose artist has since been
archived was counted in the header and drawn nowhere — §1.7-3 in a second tab. The cast is derived
from the participations now, falling back to the name the participation itself carries, so the
badge and the list can no longer disagree.

**Obsada gained the figure it was missing: balance.** The tab could not answer *is this cast
whole?* — the distribution was only legible by scrolling, and a voice with nobody in it rendered
no section at all, so it was invisible by construction. The cast card's footer is a rail of
per-voice counts in score order. A count reads gold at zero **only when the roster actually holds
candidates for that voice** — nobody cast with nobody available is an ensemble without that voice,
not a hole in the casting, and flagging it would be the `TUTTI` error inverted. Declines do not
count as cover, the rule the divisi buckets already use.

**Program gained the figure it was lying about: duration.** `~ 35 min muzyki` was summed over
pieces the archive gives no duration for, silently, so half an unmeasured programme still printed
a confident total. The per-piece figure left the metadata line — where it read
`Mozart · SATB · 3 min 30 sek`, a number buried mid-sentence — for a right-aligned `m:ss` column
shared by both lists, so a piece can be weighed before it is added and the shape of the concert
can be read down the edge. This is one of the few figures in the panel that genuinely aligns down
a column, so it is sans + `tabular-nums`, per checklist item 5. The footer rail states
`7 utworów · ~ 35 min muzyki · 2 bez podanego czasu`, the last in gold.

Smaller, both tabs:

- **Two chips of equal weight in the Program header** (`7 ŚCIEŻEK`, `~ 35 MIN MUZYKI`) became the
  footer rail; a running total is the quietest thing on the card, as on the Overview widget.
- **The encore said itself three times** — amethyst tint, italic title, `BIS` badge. The badge
  alone now, matching the row `ScorePackageItemRow` already uses.
- **The ordinal was a bordered circle**; it is the bare gold `02` of the Overview setlist, the
  Divisi rail and the Partytura list. A grey circle was a second row language for one object.
- **Strikethrough on a taken piece** means cancelled, not chosen. A taken row is muted with a sage
  tick, and it stays in place so the list does not reshuffle under the pointer between two picks.
- **Icon soup on the roster row**: a `MicVocal` pill and a `BookOpen` pill per singer put sixty
  glyphs on a screen whose content is forty names. One caption line, `A2–G4 · a vista 4/5`.
- **The voice initial badge said what the sticky group header says**, thirty times over — and said
  it wrongly, since `Baryton` and `Bas` both start with B. Gone; the row starts with the name.
  (The Divisi chip keeps its badge: it travels in a `DragOverlay` away from its header, and its
  voice is the fact you need at the moment of the drop.)
- **Six red `USUŃ` buttons stacked down the cast column** read as six alarms — the Próby lesson.
  Delete is a graphite icon that turns crimson on hover, 28px growing to 36px on a coarse pointer.
- The dragged setlist row lifts onto its own surface **on an inner element**: the list's `divide-y`
  writes `border-top` through a higher-specificity selector, so a border declared on the `<li>`
  came out gold on three sides and hairline on the fourth.
- Four hand-rolled empty states → `StatePanel variant="inline"`.
- Both searches are diacritic-insensitive now (`zielinska` finds Zielińska, `gorecki` finds
  Górecki), and Program's also matches the composer — it was already the visible second line and
  was the one thing you could not search by. The fold moved to `shared/lib/text.ts`; Divisi's
  local copy is gone. **Two copies remain** (`MessagesPage`, `navSearch`) — see §5.
- Searching stopped filtering the cast column. It answers "who can I add?"; filtering both hid
  people who *are* cast and left the two header counters counting different universes.
- On mobile the switcher opens on **Obsada**, the column it holds on desktop.

i18n: `badges.tracks_count` was `{{count}} ścieżek` — a recording-studio word for a concert
programme. Polish Title Case ("Baza Kompozycji", "Setlista Wydarzenia", "Obsada Projektu",
"Casting Główny") is gone; EN and FR were already sentence-case or legitimately capitalised.
`empty.setlist_desc` said "z bazy **po prawej stronie**", which is false on mobile where the
database is below. `cast.card.a_vista` was the fragment `"A vista:"` concatenated in JSX; it
interpolates now. `card.add_aria`/`remove_aria` passed a `{{name}}` the strings never had a slot
for. Dead after this pass and removed: `program.badges.tracks_count_*`, `program.format.minutes`,
`program.format.seconds`, `cast.card.{add,remove}`, `cast.employed`, `cast.toast.*`, and
`cast.header.*` — whose subtitle read *"Zarządzaj wokalistami. Ustawienie [scrollbar-gutter]
neutralizuje skoki układu."*, an implementation note shipped to the user in three languages.

**Declined:** an "ask again" action on a declined singer (re-inviting has real notification
consequences and belongs to the announcement-queue design, not to a visual pass — the
`DEC → INV` path in the hook still handles it if that button is ever built), and a `layoutId`
flight for a singer moving between the two columns (the columns are now different widths and the
lists re-sort into voice sections on arrival, so the flight lands somewhere the eye did not
follow; the appearing row fades in instead).

### Frekwencja (SHIPPED 2026-07-26)

§4 asked for one thing here — *"the matrix is the one place a denser, more
table-like treatment is right; check the sticky header hairline against the new
tokens"* — and that was the wrong question. The table was already dense. What was
wrong is that **it was turned ninety degrees from the data**, and that **every
figure on it was false.**

**The grid is transposed.** Rows were the rehearsals (2–12 of them), columns were
the singers (44). So the axis with the most entries *and* the longest labels was
the one behind a horizontal scrollbar, in `min-w-15` columns that truncated every
surname — on a roster holding three Zielińskas. Rows are the singers now, columns
the rehearsals: the long axis scrolls the way the page already does, a name has
room to be a name, and the aggregate a conductor actually opens this tab for —
*who keeps missing* — finally has somewhere to live (a frozen right-hand column;
the per-rehearsal rate moved to a sticky `tfoot`). The roster is grouped into
vocal sections under sticky headers, as the Divisi pool is.

**Every rate was a lie, in the same direction.** `present / everyone invited`
counts a cell nobody has marked yet as an absence — so the screenshot that opened
this pass shows `20%` and `8%` in crimson on a draft project where almost nothing
has been recorded, which is not a low attendance rate, it is *no data*. A rate is
now taken over what has actually been **recorded**, and is `null` rather than 0%
while nothing has been: the cell prints an em-dash, and the card header prints no
figure at all. The shortfall is its own fact (`· 25 bez wpisu`), counted over
**past rehearsals only** — a rehearsal three weeks out cannot be missing its
entries, and saying it is was the same mistake `TUTTI` and `CZEKA` made twice
before.

**The tab was a second implementation of a module that already exists.**
`features/rehearsals` (Centrum Obecności) owns `attendanceMeta` — labels, icons,
tokens, vocal sections — and `attendanceStats`. This tab had its own copy of all
of it, and the two disagreed: the same record was "Zwolniony" here and
"Usprawiedliwiony" there, "Spóźnienie" here and "Spóźniony" there. Worse, this
tab's five status labels **existed only as code fallbacks** — no key in any
locale file — so the English and French panels rendered them in Polish. The
vocabulary now comes from the rehearsals module; only the *density* is local
(`AttendanceMarker`), and that is deliberate.

**The mosaic became a field with marks on it.** ~350 cells each carrying a
saturated fill meant the two absences that matter were no louder than the
thirty-eight people who simply turned up. Presence — the expected outcome — is a
quiet sage tick with no surface; an unmarked seat is a 4px dot; crimson is spent
only on an absence. The whole cell is the button now (44px, the touch floor
§1.7-5 flagged) instead of a 28px swatch in an inert box.

**A roll call is one gesture, not forty.** A past or currently-live column
carries a fill action that marks every still-blank summoned seat present, so the
conductor corrects the exceptions instead of clicking the rule; it never
overwrites a mark somebody made on purpose. Shift-click walks the cycle
backwards, which is what makes a five-step cycle survivable when you overshoot.
Above eight singers the card's toolbar slot carries the same diacritic-folding
search the Divisi pool uses.

Defects fixed on the way:

- **A background refetch silently destroyed unsaved work.** The draft was a full
  local copy re-seeded from the query on every change of its data reference, and
  attendance is fetched with `RECONCILING_REFETCH` — so alt-tabbing away and back
  mid-roll-call discarded every unsaved mark, with no warning. The draft is an
  **overlay** now: only touched cells, so a refetch updates the rest underneath
  it and cannot destroy anything, and after a partial save the flushed cells stop
  differing from the server and leave the diff on their own.
- **Saving fired N requests and 2N invalidations.** Each cell went through its own
  mutation, and each mutation's `onSettled` invalidated two query keys; a filled
  column would have meant ~90 refetches for one save. The save now writes through
  `ProjectService` in small waves and invalidates once. `record_attendance` is an
  upsert, so creates and edits are the same POST — the update path was never
  needed. `project.attendance.mutations.ts` is deleted (dead).
- **Declined singers were still in the roster**, occupying a row and dragging the
  rate down, although `features/rehearsals` has excluded them from attendance
  since it was written.
- **A participation with no artist record vanished**, silently — §1.7-3's bug in
  its third home. It yields a row now, named from the participation.
- **Surnames sorted by `localeCompare` with no tie-break**, so the three
  Zielińskas sat in payload order. Collator + given name.
- **The row hover never reached the frozen columns** (an opaque background on the
  sticky cell wins over the `tr`), and `border-collapse` detaches a border from a
  sticky cell mid-scroll — the table is `border-separate` with per-cell rules.
- Hand-rolled `<td colSpan>` italic empty states → `StatePanel variant="inline"`
  with a link to the tab that fixes the emptiness; the card is a `SectionCard`
  (it was a bare `GlassCard` with a whole second card above it holding nothing
  but the legend, which is now a footer rail).

i18n: the Polish plural was wrong in all four forms — `description_one` read
"Zmieniono 1 **wpisów** frekwencji". Retired: `header.*` (never rendered),
`legend.title`, `not_invited`, `table.rehearsal_date`, `empty.{cast,rehearsals}`,
`toast.save_error` (dead). Added `rehearsals.voices.other` in all three locales —
`voiceSectionLabelKey` has been returning that key since it was written and no
locale defined it, so Centrum Obecności printed the literal string `OTHER` as a
section header. Same function was reaching for `dashboard.layout.roles.*`, which
is **one singer's voice type** ("Sopran") — a section header names a group, so it
now takes the plural set (`rehearsals.voices.sopranos` …) that was sitting unused
in the same namespace. That changes Centrum Obecności too, deliberately: a second
copy of the fix is what this document exists to prevent.

**Declined:** a per-cell status popover (four statuses, several hundred cells —
the cycle plus a reverse step is cheaper than a portalled surface per seat), a
destructive "clear column" beside the fill action (a one-click way to delete
forty saved records, undoable only by discarding *everything* pending), and a
column/row cross-hair on hover (rebuilding ~350 elements per pointer move to
light up one header; the frozen name rail and the sticky stamps already answer
"which cell am I in").

Left open on this surface: `isPast` / `isLive` are computed once per data change,
not on a timer, so a tab left open across the downbeat keeps the previous state
until it remounts or the query moves — the fill action is gated on the live
window (opens 2h before) precisely so this is not felt in practice. And the
shared status labels are gendered masculine ("Obecny", "Spóźniony",
"Usprawiedliwiony") for a choir that is mostly not — the same construction the
Szczegóły pass fixed in the action bar, but it lives in `features/rehearsals` and
belongs to a copy pass over that module, not to this tab.

### Ekipa + Budżet (SHIPPED 2026-07-26)

**Done as one pass, deliberately** — the same reasoning as Program + Obsada. The
crew a producer books on one tab is half the ledger they price on the other, and
both tabs were reading the same two rosters through the same broken lookup.

#### Ekipa — the third copy of a composition the hub already had twice

The tab was a **form column beside a list**: a `Select` of collaborators, a text
field for the role, and a full-width gold `PRZYPISZ` — which, because nothing was
selected yet, meant *the loudest element on the screen was inert*. That is
checklist item 2 inverted, the same way the Próby target-type buttons were.

Meanwhile Program and Obsada had already settled what this job looks like: a pool
column beside the work product, search in the card's toolbar, the whole row as
the control. Ekipa is that board now — third instance, one recipe. The pool is
grouped by specialty under sticky headers, and the search folds diacritics over
name, company *and* specialty.

The role was the only thing the form added over a pick, so it moved onto the
assigned row as an `InlineEditable`. A booking with no role reads as its
specialty; nothing needs a form.

**The sticky group header is now shared.** Cast had it inline
(`VoiceSectionHeader`), and this tab needed the same thing one more time —
`components/ListGroupHeader.tsx`, used by both. A second copy of a recipe is how
this document's problem started. (Frekwencja's is a `<tr>` in a `border-separate`
table and cannot be the same element; that one stays local on purpose.)

**The crew booking state finally has a UI.** `CrewAssignment.status`
(INV *Tentatively Booked* / CON *Confirmed*) is read by the call sheet, which
prints `Pokrycie crew: N · M wstępnie` — and the panel had no way to set it, so
every booking made here stayed tentative forever and that metric always read 0.
It is a sage tick on the row now, and the card footer states
`Potwierdzonych: N · Wstępnie: M`. This one is **not** gated on publication, and
that is the distinction worth keeping: a singer's status is an *answer the system
solicits* (so it stays silent on a draft — the `CZEKA` lesson), while a crew
booking is confirmed by the producer on the phone and recorded here. It is theirs
to set from the first minute. Same shape as `gives_pitch` on the divisi board.

Defects fixed on the way:

- **§1.7-3, in its fourth home.** The list did `crewMap.get(...)` and
  `return null` for a miss while the header badge counted every assignment — so a
  booking whose collaborator record was deleted was counted and not drawn. The
  crew is derived from the assignments now, falling back to the
  `collaborator_name` the payload already carried. (Cast, Divisi, Frekwencja and
  now Ekipa: **every list in the hub that resolved through a dictionary had this
  bug.** If a fifth one turns up, that is the first thing to check.)
- **The raw enum shipped to the user.** With no role written, the row printed
  `person.specialty` — the literal `SOUND`. `getCrewSpecialtyOption` has held the
  translated label since the crew module was written, and the Przegląd pass had
  already fixed the same line in `ProjectPeopleCard` (where it read `SOUN`).
- **The role and company were set as an `Eyebrow`** — uppercase at 0.14em, the
  recipe for a machine-written status, on text a producer typed by hand. It is a
  `Caption`, the same demotion the divisi note and the Ludzie chips got.
- Hand-rolled centred empty state → `StatePanel variant="inline"` ×2; the pool's
  empty state distinguishes *filtered to nothing* from *the base itself is empty*
  and links to `/panel/crew` in the second case, because the base is managed
  outside the project and was otherwise a dead end.
- The delete button was `size="icon"` (44px) in a dense row; it is the 28px →
  36px-on-coarse-pointer action the Program and Divisi rows use.
- Loading no longer renders as a fact (`EtherealLoader`, per the Divisi pass) —
  "nobody is running this concert" on a warm-cache flash is a claim, not a wait.

#### Budżet — the tab could not see money that had already been paid

The composition was sound; what it **said** was not.

**`is_paid` was invisible.** Both `Participation` and `CrewAssignment` carry
settlement state, the contracts workspace writes it, and the server refuses to
bulk-rewrite a settled fee for exactly this reason — but this tab offered a live,
editable input on money already out the door, with nothing to mark it. A settled
row is now a stated figure with a sage tick and no field, and the summary gained
the dimension the tab was missing: `Rozliczone` / `Do wypłaty`, both appearing
only once money has actually moved.

**One rate, not fifteen keystrokes.** `PATCH /api/{participations,crew-assignments}/bulk-fee/`
has existed, been permission-gated and been tested since the settlement work, and
no frontend call site ever reached it — the `gives_pitch` situation again. A
foundation pays one rate per concert and adjusts a couple of exceptions, so
`Stawka dla wszystkich` sits in each ledger's toolbar. It fills the **draft**, so
the rows below preview exactly what would change and the shared save bar still
owns the commit; on save the bulk statement goes first and the per-person
exceptions land after it, which is the only order in which an exception typed in
the same draft survives.

**The card headed `Kalkulacja` was the last hand-rolled header on this surface** —
a `GlassCard` with an icon and an `Eyebrow` typed into its body, which is what
§1.4 was about. It is a `SectionCard` titled by its job (`Koszty osobowe`).

**The KPI strip stated the resting case and coloured a cost as a success.**
`BRAKI 0` occupied a quarter of the strip on a fully priced concert, and
`SUMA KOSZTÓW` sat in a sage-tinted box — a box inside a box, in the colour this
vocabulary spends on *complete*. A total is not good news. The headline is one
neutral figure that never changes meaning, and everything qualifying it rides the
`Metric` + `Eyebrow` rail the Partytura hero introduced, each figure appearing
only when it exists.

**`Brak stawki` on every row was the `TUTTI` mistake, a sixth time** — on a fresh
project that is a warning badge on all fifteen rows. The empty field already
reads as empty, unpriced rows already sort to the top, and the count is stated
once in the rail and once in the card footer. The row says nothing.

**Fifteen boxes became a column of figures.** The fee was a full `glass` `Input`
with `font-bold`, left-aligned, spin buttons hidden by two arbitrary selectors,
and a `PLN` label floating inside it. It is a `ghost` field under one hairline —
still a real input, because pricing a concert means typing and tabbing, not
clicking fifteen times to open an editor — right-aligned, `tabular-nums`, with
the unit outside so a settled row's plain figure lines up with an editable one's.
Sans + `tabular-nums` is right here for the reason checklist item 5 gives: this
is a column that genuinely aligns.

Defects fixed on the way:

- **The cast subtitle printed the raw voice enum** — `MEZ`, `BAS`, `SOP` — while
  every other tab in the hub translates it through `dashboard.layout.roles.*`.
  The crew subtitle printed `SOUND` for the same reason as on the Ekipa tab.
- **A native `type="number"` silently ate Polish decimals.** `400,50` typed on a
  Polish keyboard reports an *empty* value from a number input. The field is
  `type="text"` + `inputMode="decimal"` with one sanitizer
  (`features/projects/lib/money.ts`), which also removed the two
  `[&::-webkit-*-spin-button]:hidden` selectors.
- **`bg-white/50!` on the dirty row** — a stock palette colour (§1.6) forced with
  `!important` from a call site. Gone; the row and field carry gold tokens.
- **The crew ledger vanished entirely when a project had no crew**, so the tab
  silently omitted the concept; the cast's empty state was a bare `GlassCard`
  with a centred icon. Both cards always render, both empties are
  `StatePanel variant="inline"` naming the tab that fixes them.
- Per-section footers state `Razem N PLN`, plus the gaps and settlements — the
  strip had the split but neither card could be read on its own.

i18n: Polish Title Case again — *Suma Kosztów, Obsada Wykonawcza, Ekipa
Realizacyjna, Skład Ekipy (Crew)*. That last one was flagged as open by the
Przegląd pass and is retired here along with the parenthetical English gloss.
`projects.crew.form.*`, `list.*`, `header.*`, `employed` and five never-fired
toasts went with the form; `budget.{input_placeholder,missing_fee,title,
aria_label}`, `budget.kpi.{calculation,missing_desc}` and
`budget.sections.{description,estimated}` were either dead already or died with
the strip. Verified after the pass: every `projects.{crew,budget}.*` key defined
is reached by a call site, every key reached is defined, and the three locales
carry identical key sets.

**Declined:** applying the standard rate straight to the server on click (it
would have split this tab across two save models — an immediate write beside a
deferred draft — and made "Anuluj" mean two different things on one screen), and
a payment control on the budget rows (`is_paid` is written through a dedicated
`payment` action that keeps `paid_at` consistent, and the contracts workspace
owns that flow; this tab prices, it does not settle).

---

## 5. Phase 2 — App-wide sweep

After the tabs: settings, archive, logistics, crew, messages carry the same `<select>`, raw-overline
and hand-rolled-empty-state debt.

The framing this section shipped with — *"three mechanical sweeps"* — held for two of the three and
was wrong about the third. Re-measured before starting: `rounded-*` + `ethereal-ink/6|8|10` are
**739 occurrences across 183 files**, and most of them are not drift. `rounded-full` on an avatar is
correct; `rounded-2xl` on a sheet is correct. The radius rule is *"a nested surface steps down one
level"*, which cannot be applied without reading the composition it sits in. A blind pass over 183
files is an unreviewable diff with real regression surface, so that item is **not** a sweep — it
rides along with the per-feature passes below.

### 5.1 Defect batch (SHIPPED 2026-07-26)

The items on this list that were bugs rather than style, done first because none of them are visible
to `npm run build`:

- **The popovers never animated.** `Select`, `DropdownMenu` and `Input`'s error line carried
  `animate-in` / `fade-in-0` / `zoom-in-95` — `tailwindcss-animate` is not a dependency and never
  was, so those classes produced nothing in the built CSS. They are a real `popover-motion` utility
  now (`panel.css`, keyframes bound to Radix's `data-state`, transform+opacity, honouring
  `prefers-reduced-motion`). It has to be a CSS *animation*, not a transition: Radix holds the node
  in the tree until the exit animation ends and detects nothing else.
- **`Input`'s `ghost` declared a border colour and no width**, so `focus:border-ethereal-gold/30`
  had never rendered and the field sat 2px shorter than the glass field beside it. Worse, `ghost`
  in `Input`, `Textarea` and `fieldShell` set `focus:ring-2` with **no ring colour** — Tailwind v4
  defaults that to `currentColor`, so focusing the budget fee field drew a 2px ink halo. Both fixed
  at the variant. `Textarea` also carried a different error fill (`crimson-light/20` + crimson text)
  from `Input`'s; it is `Input`'s now, and both error lines come from `Text` instead of a
  `text-[10px]` span.
- **`PdfViewer`'s `docKey` was documented as an identity and used as one.** It is the cache identity
  of the *bytes*, at `staleTime: Infinity` — so `score-pdf-<projectId>`, on a file the generator
  overwrites under the same name, served the previous book for the rest of the session. The three
  score viewers now carry `updated_at` (the completed build saves the project, and
  `ScorePackagePanel` invalidates `projects.all`), and a `volatile` prop marks the documents the
  server *assembles per request* — call sheet, day sheet, run sheet, the per-item card preview —
  which no client-side key can version. Focus-refetch is off for all of them: alt-tabbing is not a
  request to re-download a book.
- **Two more copies of the diacritic fold** (`MessagesPage`, `navSearch`) now call
  `shared/lib/text.ts`. `MessagesPage`'s had a literal combining-mark range typed into source — the
  exact thing that helper's comment warns about.
- **Three tabs painted a claim before their data landed.** The gate is
  `tabs/components/TabLoadingCard` — Divisi, Ekipa and Budżet had three copies of it inline, Program
  and Obsada had none. (§5's claim that Partytura flashes was stale: `ScorePackagePanel` already
  gated on `isLoading && !state`.)

### 5.2 Select migration (SHIPPED 2026-07-26) — `NativeSelect.tsx` is deleted

All 17 call sites plus one §5 never counted: `RehearsalDock` had two **raw** `<select>` elements,
not even the primitive. Every OS-drawn dropdown in the panel is gone.

Two things the primitive needed and did not have, both found by the call sites rather than guessed:

- **`fieldShell` gained a `dark` variant** (byte-for-byte `Input`'s dark) and `Select` a `size="sm"`
  density, because the practice dock's pitch editor is a 32px row on ink. The chevron follows the
  variant — graphite disappears into ink.
- **The `<option value="">` convention had to be read, not translated.** Radix reserves `""` for
  "nothing selected", so an empty first option becomes a `placeholder`; where returning to it is a
  real choice — a filter meaning "everything", a thread with no recipient meaning "the shared
  queue" — it also becomes a `clearLabel`. Where it is not (a required voice type), the placeholder
  alone says it.

`react-hook-form` call sites moved from `{...register()}` to `Controller` (artists, archive ×2,
logistics), which is what the codebase already does in `features/chorister-hub`.

Dropped on the way: `ArchivePieceCardPage`'s `FIELD_SELECT_CLASS`, a page-scoped override that
existed *only* because `NativeSelect`'s glass differed from `Input`'s. `Select` draws from
`fieldShell`, which is `Input`'s glass — so the override was dead the moment the field was
migrated. `className="font-bold"` on the four artist-editor selects went with it: a select's value
is not a heading, and no other field in the tree sets its value bold.

i18n: `artists.editor.no_rating` was `— Brak oceny —` and the archive pickers `— wybierz —`; the
em-dash wrapper was how an option row said "this one is the empty one", and a placeholder does not
need it. Added `settings.logistics.clothing_size_clear` in all three locales.

### 5.3 `DualTimeDisplay` + the attendance vocabulary (SHIPPED 2026-07-26)

**The local time is a time, so it is set as one.** Its default was `9px` bold uppercase at
`0.25em` — the recipe for a machine-written status label — which is why **seven of nine** call sites
re-typed their way out of it, in two families that had drifted apart (light: `normal-case
tracking-normal` + graphite at three sizes; dark: `border-l` in two different border colours). Two
named axes replace all seven: `local="quiet" | "paired"` (is the local reading a footnote, or a
fact of comparable standing — the facts card and the rehearsal rows are `paired`) and `divider`,
for the dark pills where both times sit on one line inside a tinted chip. The rule colour comes
from the variant, so the two hero pills stopped disagreeing about it.

`localTimeClassName` is **deleted**, not left as an escape hatch — an unused way back is how the
seven copies happened. The two call sites that never overrode anything (`NextRehearsalAlert`,
`RehearsalInspector`) were the ones actually rendering the broken default; they are fixed by
getting a sane one.

Fixed on the way: the `(twój czas)` suffix was set at **12px beside a 9px time** — an annotation
outweighing the datum it annotates.

**The attendance vocabulary was gendered masculine** — "Obecny", "Spóźniony", "Usprawiedliwiony",
"Nieobecny", "Nieoznaczony" — for a choir that is mostly not, and it is shared by two surfaces
(Centrum Obecności and the hub's Frekwencja matrix), which is exactly why it could not be fixed
from a tab pass. The label now names the **record, not the person**: `Obecność` · `Spóźnienie` ·
`Nieobecność` · `Usprawiedliwienie` · `Bez wpisu`. A register writes down what happened, so the
noun is both the honest form and the genderless one — and it is the form the matrix had already
reached for on its own. French carried the same masculine inflection and took the same turn
(`Présence` · `Retard` · `Absence` · `Absence justifiée` · `Aucune saisie`); English was already
genderless and idiomatic, so it stays adjectival. `rehearsals.reliability.not_summoned` went with
them — "Nie wezwany" was masculine *and* misspelled (Polish writes `nie` + participle as one word);
it is `Bez wezwania`.

`RehearsalInspector`'s stat strip was typing all five labels inline — a second copy of a vocabulary
its own module owns. `StatPill` reads them from `ATTENDANCE_STATUS_META` now and lost its `label`
prop.

### 5.4 Still open

**Moved to "Still open" at the head of this file**, with the counts re-measured after the passes —
a second copy of a list is how this document's problem started.

---

## 6. Open decisions — need the developer

- **D1 — KPI numerals. SETTLED (b).** Serif stays; `lining-nums` at weight 400, no `tabular-nums`.
  See the note at the top of this file.
- **D2 — Native date/time inputs. SETTLED (build it).** `shared/ui/composites/DateTimeField`
  shipped between Phase 1 and Phase 2 — Radix Popover on a pointer, the same panel in a
  `BottomSheet` on touch, a six-week calendar that never changes the panel's height, typed HH/MM
  segments, and domain markers (gold on the concert day, sage on booked rehearsals). Adopted by
  Szczegóły, Próby and the run-sheet rows. No native date/time input remains in the tree.
- **D3 — Select blast radius. SETTLED (staged).** Primitive + `features/projects` in Phase 0, the
  remaining 17 files in Phase 2 §5.2. `NativeSelect.tsx` is deleted.

---

## 7. Traps found while surveying

- **A `@theme` token that `tailwind-merge` has not been taught is a token that can be DELETED at
  runtime.** This bit Phase 0 itself. tailwind-merge ships knowing stock Tailwind only; an
  unrecognised `text-*` / `bg-*` / `shadow-*` value falls through to the COLOUR group, where the
  next real colour removes it. `Eyebrow` emits `text-overline` next to `text-ethereal-incense/60`,
  so **every overline in the panel silently lost its font-size** — with the class present in the
  built CSS, no error, and nothing to see in `npm run build`. The fix is
  `shared/lib/tailwindMerge.ts`, the ledger `cn()` now runs through.
  **A token added to `panel.css` and not to that ledger is only half-added.** There is a second,
  quieter failure mode too: a custom value read as *nothing* never conflicts with its stock
  counterpart, so `rounded-nested` and a caller's `rounded-xl` both survive and CSS source order
  decides. Verify tokens by asserting on `cn()` output, not by grepping the bundle.
- **`tailwind-merge` does not merge across groups.** `flex-col` survives an `inline-flex` override.
  Any component whose base is `flex flex-col` will silently accept a caller's `items-center` and
  centre its children. `DualTimeDisplay` is bitten twice; check `GlassCard` `contentClassName` call
  sites for the same shape.
- **`GlassCard`'s `className` reaches the surface only** — layout classes belong in
  `contentClassName`. (Already recorded from the 2026-07-24 audit; still true, still easy to get
  wrong.)
- **A `@utility` is safe from the tailwind-merge ledger; a `@theme` token is not.** `popover-motion`
  survives `cn()` untouched because tailwind-merge only groups classes whose first segment it
  recognises. The ledger trap above applies to values slotted into stock namespaces
  (`text-*`, `rounded-*`, `shadow-*`) — a distinct name is inert. Assert it anyway; the assertion
  costs one test.
- **`Button` has `!important` on type size.** Until 0.5 lands, `className="text-xs"` on a Button is
  a no-op — this is why call sites drifted to raw spans.
- **A layout class passed to `Input`/`Textarea`/`Select` through `className` loses to the
  primitive.** cva emits the caller's `className` inside its own output, and `cn` then appends the
  component's `pl-4 pr-4 py-3` *after* it — so tailwind-merge resolves in the primitive's favour for
  padding, width and anything else in the same group. Szczegóły carried a `pl-9` that had never once
  applied. Colour, `tabular-nums` and the like are unaffected (different groups). Verify by asserting
  on `cn()` output.
- **`ProjectTabs` is a `NavLink` nav, not a tablist.** If it is unified with `SegmentedTabs`, keep
  the routing semantics (`NavLink` + `end`) — do not convert it to a controlled tablist.
- **The Windows checkout is CRLF**: ruff-style import-order noise has a frontend analogue in
  spurious whole-file diffs. Keep sweeps mechanical and per-commit so review stays possible.

---

## 8. Phase 3 — per-feature passes

Each of these carries all three concerns at once (raw overlines, `StatePanel`, radius/hairline
tokens) over one feature, read screen by screen rather than swept by regex. They run sequentially:
they all touch the same three locale files.

### `pages/auth` + `features/auth` — the threshold (SHIPPED 2026-07-27)

The oldest code in the tree and the first thing a new member sees. All 12 raw overlines are gone,
every off-scale radius with them, and `grep` over both directories for `uppercase.*tracking`,
`border-ethereal-incense/[0-9]+`, `rounded-(lg|xl|2xl|3xl)` and stock-palette colours now returns
nothing. What the reading found underneath was mostly not typography.

**One thing on several voices.** The login card called the same secret three names in one
viewport — the field label said *Klucz dostępu*, the button said *Autoryzuj dostęp*, and the
recovery link two lines below said *Zresetuj hasło*. It is a password; every surface now says so
(`Hasło` · `Zaloguj się` · `Logowanie…`). The activation success screen said "you are done" five
times — an overline, a headline, a sentence, a paragraph of instructions and a button — where the
composition already said it: the paragraph is deleted and the one surviving sentence does the work
the instructions used to (`success.instruction` gone). The activation form carried a static
*Standard bezpieczeństwa* box repeating the 8-character rule that the live checklist two elements
below already enforced; the box is gone and `PasswordRequirements` now renders from first paint
instead of waiting for the first keystroke, so the rule is stated once and is visible to the person
who has not typed yet.

**The loudest control was inert, and it hid the form's own validation.** All three forms disabled
their gold full-width submit on exactly the conditions their submit handler validated. The
consequence was not only the inverted hierarchy: five translated error strings were unreachable,
because the guard that would have rendered them sat behind the guard that hid the button —
`auth.reset.errors.email_required`, `password_too_short` and `password_mismatch`, and both
activation password errors, had never once appeared on screen. The submits are live, validation
runs on submit, and every failing rule is named at once rather than one refusal at a time.

**`error` vs `hasError`, finally used as documented.** `Input`'s own comment claimed the auth
screens used the flag; none of them did. Now the login card tints *both* fields and states the one
sentence in the banner (the server cannot say which half was wrong without disclosing which
accounts exist), while a verdict on one field — too short, mismatched, a server-side password rule
— goes to that field's `error`. `PasswordInput` gained the `hasError` flag it was missing, so the
password half of that pair was even possible.

**The message said less than it knew, and in the wrong language.** `AuthProvider.login` returned
SimpleJWT's `detail` verbatim, so a Polish member could be told *"No active account found with the
given credentials"* — and `auth.login.error_default` was dead, because `result.error || t(…)` never
reached the fallback. The provider now maps `parseApiError().kind` to an i18n key and the page says
it. The `bad_credentials` copy also names the one case the endpoint deliberately cannot
distinguish: an account that exists but has never been activated (`has_usable_password()` is
false), whose owner should use the invitation link rather than keep guessing.

**Loading painted as a fact, inverted.** The activation screen treated "the signed preview is still
in flight" as "the link is fine": it drew the full password form and the generic headline, then
replaced both with a crimson dead-end, or swapped *Aktywuj swój panel artysty* for *Witaj,
Krzysztofie*, once the answer arrived. `linkStatus` gained `checking` and the page waits on
`EtherealLoader` — the headline here IS the personal greeting, so there is nothing honest to say
before it resolves. A link with no parameters at all used to render that same form, disabled, under
an amber advisory box (the only stock-Tailwind colour left in auth); it is simply an invalid link
and now says so, which retired `form.missing_params` and `errors.incomplete_link`.

**Crimson on a state that is not a failure.** `PASSWORD_STRENGTH_LEVELS` spent the alarm colour on
rung one, so a member three characters into their first password wore it while still typing. The
ramp is now incense → gold → gold → sage: three colours for three meanings, with the lit-segment
count carrying the measurement. This lives in `shared/lib`, so security settings got the same fix.

**Hand-rolled surfaces where a primitive existed.** The crimson error banner was typed three times
(→ `AuthAlert`, which owns its live region). Four outcome scenes — reset link sent, reset done,
activation done, activation link dead — were four copies of one medallion-and-headline stack, two
of them inside a tinted box nested in the card that already was the surface (→ `AuthOutcome`; the
tone lives in the medallion now). The consent control was a hand-drawn `peer sr-only` checkbox
beside the real `Checkbox` primitive. The kamerton and the copy-login control were `<button>`s
dressed as buttons (→ `Button variant="outline" size="sm"`).

**Two ways in, told apart.** "I forgot my password" and "I have no account at all" shared one
accordion, one question and three competing controls — a `<Link>` dressed as a gold pill, a
paragraph and a mailto. The common need is now a plain link under the submit; the rare one is one
sentence below the rule. Related: the help sentence pointed a locked-out member at
`auth.legal.privacy.contact_email`, i.e. the **RODO mailbox** — the privacy policy's own text names
`kontakt@voctensemble.com` as general contact, and that is what `auth.login.support_email` holds.
`footer_security` ("Zabezpieczone przez JWT Auth • 2026") is deleted: it named an implementation to
a chorister and hard-coded a year into a translated string.

**Rendering defects found by reading.** `LegalModal` was `fixed z-20` *inside* `AuthShell`'s
`<main z-10>`, below the shell's own `z-20` header — the back link and the language switcher
floated over the modal's own scrim. It portals to `document.body` at `z-focus-trap` now, closes on
Escape, is `aria-labelledby` its title, and its `AnimatePresence` sits outside the `isOpen` guard so
the exit animation it declared can actually run. Companion defect in `shared/ui`: `Checkbox`'s focus
ring is a sibling styled with `peer-focus-visible:`, but the input it reads was never marked
`peer` — the ring had never rendered, on every checkbox in the panel.

**Copy carried along.** Login's legal links were inflected accusatives left over from a sentence
they no longer sit in (*Politykę Prywatności* standing alone) and set as uppercase machine labels;
they are natural-case document names now. The consent line joined its two documents with `&`, an
anglicism in Polish prose (`terms_and` → " oraz " / " and " / " et ").

**Declined.** The dark Nave rail and its three highlight tiles stay — activation is deliberately
more ceremony than login, and the rail's copy is about the invitation, not marketing filler; only
its three hand-rolled tile overlines became `Eyebrow`. `AuthLanguageSwitcher` was not migrated to
`SegmentedTabs`: a gold pill on an alabaster track is a view switcher inside a work area, not a
three-glyph nav in a page corner — it kept its shape and only handed its type to `Eyebrow`. The
`ethereal-ink/8` behind an unmet checklist dot stays: it is a fill, not a rule.

### `features/messages` + the last five `SegmentedTabs` copies (SHIPPED 2026-07-27)

All 13 raw hairline rules are on the tokens, every off-scale radius with them, and `grep` over
`features/messages` for `ethereal-ink/6|8|10|12`, `rounded-(lg|xl|2xl)`, `z-[…]` and stock-palette
colours now returns nothing. The three hand-rolled empty states are `StatePanel variant="inline"` —
that was the tree's last holdout, so `StatePanel` adoption is closed except for `dashboard`'s
`ArtistEmptyState`, which stays a named scene on purpose. Two token violations were carried along
because they were sitting in the same lines: `NewThreadModal` painted its panel at a hand-written
`z-9999` above every declared layer (`z-toast` now, matching `ConfirmModal`), and its close button
was the last `text-stone-400` in the feature — a stock Tailwind grey on an Ethereal surface.

The semantics were read out of `backend/messaging/views.py`, not guessed, and nothing about them
moved: a manager's queryset is `Q(assignee=me) | Q(assignee__isnull=True)`, so 1:1 threads stay
private to their assignee with no cross-manager visibility and no superuser override, and channels
stay in-app + opt-in push (`ChannelService`, not the notifications router). **One premise in the
brief did not hold:** threads are not paginated. Both viewsets set `pagination_class = None`
deliberately, to mirror the notifications inbox and the 30 s polling model. The only narrowing in
the feature was a `slice()`, below.

But the pass found four things that were not micro-decisions, all of them in the same file.

**`ConductorDeck` computed a bucket it never rendered.** `mineOpen` — open threads the manager has
claimed and already read — was built in the `useMemo`, returned in the object, and used nowhere. So
the deck's answer to "what am I responsible for" was: for a manager whose queue is claimed and read,
a sage "Skrzynka czysta" banner and a list of project channels. Their entire caseload was
invisible on the one screen built to show it. It renders now as *Pod Twoją opieką* (artists get
*Twoje rozmowy*, the same bucket without the assignee test).

**The four buckets were four independent filters over one list, so rows appeared two and three
times.** A thread that was unassigned *and* unread was drawn under both *Wymaga przydziału* and
*Wymaga uwagi*; an unread channel was drawn under *Wymaga uwagi* and again under *Kanały projektów*.
Nothing was wrong with any single filter — the sharing did it, the same shape as the contracts tone
table. The buckets are a partition now: a precedence, a `claimed` set, and each bucket skipping what
the one above it took. That rule is in `.ai/04`.

**Three voices for one number, and the wrong one was chosen.** The deck printed the headline
(`3 czeka na przydział`), a row of three `StatChip`s (`3 bez opieki`, and `0 nieprzeczytane` on a
calm inbox — the resting default in the loudest slot), and then the three rows themselves. Two of
the chips spent `ethereal-crimson` on "unread" and "unassigned", which are ordinary work in
progress, not alarms; a fourth crimson came from `Section tone="alarm"`. The chips are gone and the
figures moved to the inbox filter tabs, on the argument that decided it: **the deck is desktop-only
and evaporates on the first click, while the tabs are on screen at both breakpoints and never
leave** — a count that vanishes when you start working is a count that is not there when you need
it. The deck's headline is now a lead with no figure, and its sections state the work by listing it.

**A tab count is only as honest as the predicate behind it.** Adding `count` to five filters is
where the archive header bug gets re-introduced, so `MessagesPage` now has one `select` memo
exposing `threads(filter)` and `channels(filter)`, and the visible list and every count call the
same two functions — the counts respect the active search, and `Nowe` counts the channels it will
actually render. Counts go only on `Nowe` / `Bez opieki` / `Moje`, and only above zero: `Wszystkie`
is the resting default and `Zamknięte` is an archive, not a backlog. Writing that predicate surfaced
a defect underneath: `Moje` had no status test at all, so it listed `ARCHIVED` threads that
`Wszystkie` excludes — the default view hid a thread a sibling tab put back. All five now agree on
scope.

Smaller, in the same pass: `recentChannels.slice(0, 6)` was a silent narrowing under its own heading
and now states `{{visible}} z {{total}}` (managers see *every* channel, so the cap is worth keeping);
the all-clear sage banner said what the headline two lines above already said; `ThreadList`'s empty
branch was dead (all four callers gate on length) and was the second, conflicting default for
`messages.list.empty`; the thread-status pill and the project-context chip were three hand-rolled
`rounded-full` chips and are now `Badge` (the context chip had been two chips — gold for a manager,
neutral for an artist — for one fact whose only real difference is that the manager's is a link);
`ChannelRow` and `MessageBubble` drew the same object at two radii; the back button, the channel
push toggle and the modal close were hand-rolled `<button>`s where `Button variant="icon"` exists;
and `SectionLabel`'s `tracking-[0.12em]` was a 17th letter-spacing for the overline role.

Two searches were widened while the predicate was being written: channels searched `project_name`
but not the `snippet` the row displays, and a manager's thread search could not find the assignee's
name. Both still fold through `shared/lib/text`. `FilterTokens` was **declined** here: the two
narrowings are the search input and the gold tab pill, and both are already legible as themselves.
`Badge`'s `pulse` was audited and is correctly absent — the feature's only pulse is the optimistic
send's clock, which resolves in a heartbeat and passes the "still true in an hour?" test.

**The `SegmentedTabs` follow-up closed all five copies**, so the composite is now the only gold pill
on an alabaster track in the tree. Three were mechanical (`DashboardFilterMenu`, which also had a
`rounded-full` count pill off the radius scale; `RehearsalRail`; `Rehearsals`). **Two were not, and
the brief's "adopcja jest mechaniczna" did not hold for them:** `RosterToolbar` and `CrewToolbar`
are icon-only 36px density toggles, and `SegmentedTabs` always rendered a visible `Label`. Rather
than make two toolbars grow word labels that would push the search field off a phone, the composite
gained `iconOnly` — square segments, label as `aria-label` + `title` — documented so it stays a
*density* affordance and never becomes a licence to hide the name of a content view.

### `features/settings` + `dashboard` + `notifications` + `contracts` (SHIPPED 2026-07-27)

One pass over four features, because they share the three locale files and because the same two
questions ran through all of them: what does this surface say twice, and what does it say on every
row. All 17 raw overlines are gone, all 41 raw hairline rules and every off-scale radius are on the
tokens, and `grep -E "rounded-(xl|2xl|3xl|lg|md|sm)"` over the four now returns only three fills —
a progress-bar track, a slider groove and a scrim, which are not 1px rules. Both companion defects
the earlier passes had parked here are fixed. But the pass found five things that were **not**
micro-decisions.

**The contracts ledger was not painting the status backwards — it had one tone table for two
taxonomies.** `STATUS_TONE_VARIANT` mapped `active → warning` and `upcoming → success`, and *both*
`getContractStatusMeta` (a person's RSVP) and `getProjectStatusMeta` (a production's lifecycle) read
from it. The contract states had been squeezed into words built for the project axis, so `CON`
became "active" and got gold, `INV` became "upcoming" and got sage — a confirmed contract in the
work-pending colour and a pending one in the settled colour. The same squeeze had also painted a
DRAFT project sage, i.e. `success` for a production nothing has happened to yet.

The fix is structural, not two swapped strings. The tables are split: `PROJECT_STATUS_VARIANT` keeps
the lifecycle (`active` gold, `draft` and `archived` neutral, `cancelled` amethyst), and the contract
RSVP returns its own variant inline — **or `null`**. Because the real finding underneath was that
`Potwierdzony` sat on every row of a healthy cast, which is the `TUTTI` bug with a colour error on
top. What survives is the pair that touches the money: somebody who has not answered and is about to
be paid (gold), and somebody who withdrew and is therefore not billable at all (amethyst). The CSV
needs the plain word for all three states, so `getContractStatusText` wraps the same function and
fills the silent case back in — a spreadsheet has no colours and no exceptions.

**Four surfaces were announcing the resting state, in four different shapes.** All the same bug as
the archive's `AI ✓`, and none of them adjacent enough to have been caught together:

- The rail put a sage `ROZLICZONO` on every settled project, so a healthy season was a column of
  sage. `SignalChip` returns `null` now; a row speaks only when it is short.
- `ContractLedger`'s header put a sage `Rozliczone` on a section with nothing outstanding — on a
  finished project, both sections.
- `ProductionPipeline` put a sage `komplet` opposite the gold pending count, one or the other on
  every production. The completion ring already reads full when the cast is.
- `NextRehearsalAlert` printed `100% Obecności` whenever `absent_count` was 0 — which on an upcoming
  rehearsal also means *nobody has answered yet*, so it was a claim about the future dressed as a
  measurement.

**Two figures were counted over sets their neighbours were not**, both in the family the archive
pass named. `ProductionPipeline`'s header sums confirmed/pending/declined across every non-archived
production while the rows below are `slice(0, 6)` — the file's own comment claimed "the same
non-archived set the totals are summed over", which was true right up until the cap. On a
nine-project season the census read as the count of what was on screen. `invitationStats` now
carries `projectCount` and the strip states `Pokazano {{visible}} z {{total}}` when it is showing
fewer. And `SettlementSummary`'s coverage rails drew an empty bar over `0 / 0` for a project with
nobody cast — a rate over data nobody has entered, which is not a low rate. Em-dash, no bar.

**`pulse` was spent on three resting states.** It is the one axis `Badge` kept from D5, and D5
documented it as "this is happening right now". It was on `NextRehearsalAlert` unconditionally, on
`SpotlightProjectCard` for every ACTIVE project, and on `LedgerHeader` for the same. A production
sits at ACTIVE for months and the rehearsal card is on screen for the fortnight before the
rehearsal, so all three swept permanently and none of them meant anything. Only the rehearsal earns
it back, and only on the day: `resolveImminence(...) === "TODAY"`, gold — the taxonomy in
`logistics/constants/eventImminence.ts` had already settled that today is gold, not crimson, and had
already declared `pulse: true` for exactly that bucket. The chip reads `Najbliższa próba` (neutral)
until the morning of, then `Próba dziś`.

**The notification centre sat on `z-[100]`, tying with `z-toast`.** Its scrim was `z-[99]`, above
`z-focus-trap` (90). This is the archive pass's `EditionUploadDrawer` bug exactly — a portalled
panel numbered by hand, ending up level with the toasts it raises itself. It is a focus-trapped
dialog, so both are `z-focus-trap` now and toasts sit above it again. Its drawer and sheet were also
on `rounded-[26px]` and `rounded-[12px]`, off the scale in both directions.

Smaller, but the same job: `SettingsIdentityCard` hard-coded amethyst for the singer's voice while
the roster and the welcome moment both read that same voice through `accents.ts` — the exact
disagreement `accents.ts` was extracted to prevent; it goes through `ACCENT_BADGE` now ·
`dashboard.admin.absences` had **no key in any locale**, so the one chip on that card had been
rendering its English code default in Polish and French · the notification header built its subtitle
by concatenating `${count} ${t("notifications.unread")}`, which cannot inflect — a real plural key
now, with the Polish `_one/_few/_many` forms · `CustomAdminMessageToast`'s "mark read" button was
`bg-ethereal-sage hover:bg-emerald-600`, a stock Tailwind palette colour in a tree that forbids them
· `SeasonSetupConcierge` stated its progress three ways at once (`Krok 1 z 3`, `33%`, and the bar),
so the percentage — a precision a three-item list does not have — is gone · `NotificationItem`
rendered its four text lines as raw `<p>`/`<span>` at `text-[13.5px]`, `text-[12px]` and
`text-[10.5px]`, three sizes that exist nowhere in the type scale · `NotificationsTab`'s "you must
change this in the browser" line was a crimson sentence set as an overline, padded by an invisible
`Loader2` used as a spacer, and its switch thumb still carried a `will-change-transform` the 2026-06
perf audit had removed everywhere else · the notification centre's loading state was a hand-rolled
rotating bell and its empty state a hand-rolled centred icon stack (`EtherealLoader` and
`StatePanel` now) · `ContractRow` tinted paid rows sage, so a settled project opened as forty sage
rows with the one row that still owed money left untinted; only unpriced work is tinted now ·
`ProjectLedgerRail`'s search box was a second copy of the field surface, hand-rolled against the
D4 rule, and is the `Input` primitive now.

`shared/ui/composites/SegmentedTabs` gained an optional `count` per item. Contracts had hand-rolled
the gold-pill-on-alabaster track three times, twice in one file, each with its own count pill; the
recipe exists in eight places tree-wide and the remaining five are listed in "Still open".

**Declined:** turning `ProductionPipeline`'s pending chip into plain type. It sits beside a
completion ring showing the same shortfall, which is close to saying it twice — but the ring is a
measure and the chip is the count of what is *outstanding*, and the row is the conductor's triage
list. Also declined: rebuilding `ArtistEmptyState` on `StatePanel` (see "Still open"), and
converting the ledger's voice/specialty column to a chip — it went the other way, to `Caption`,
because unlike the rosters this ledger is neither sorted nor filtered by voice, and a column of
chips under a column header that already names them is chrome.

### `features/artists` + `features/crew` + `features/logistics` (SHIPPED 2026-07-27)

One pass, because the three share a shape — a person/venue row, a card, an editor with a sticky
footer, a dossier — and the same three locale files. All 12 raw overlines are gone, both
hand-rolled empty states are `StatePanel`, and `grep -E "rounded-(xl|2xl|3xl|lg|md|sm)"` over the
three features now returns nothing. But the pass found three things that were **not**
micro-decisions.

**Three taxonomies were spending the alarm colour on a resting category.** Sopranos were
`ethereal-crimson`. So was the "Wizualizacje" crew specialty, and so was every HOTEL — chip *and*
atlas pin. On a 44-voice roster that is a dozen crimson chips beside the one singer whose
invitation had actually expired; on the map it is a crimson pin for every night the ensemble sleeps
somewhere. `eventImminence.ts` had already written the rule down ("crimson stays an alarm, so
'today' reads as gold") and the three dictionaries next to it had never been told.

The fix is structural rather than three edits: `shared/ui/primitives/accents.ts` is now the SSOT for
a **category accent** — `gold | amethyst | sage | graphite | incense | ink`, and *the type has no
crimson*, so a taxonomy cannot reach for it. It carries the chip variant, the `Eyebrow` colour, the
balance-bar fill, the active/idle tile treatment and the raw CSS variable for a Google Maps pin, so
a chip can no longer disagree with the marker for the same thing. The three dictionaries had
independently typed the same class table three times; those copies are gone. `Badge` gains one tone,
`incense`, which is what the scale needed to reach six.

- artists: S → `incense`; A/T/B unchanged.
- crew: VISUALS → `ink`; the rest unchanged.
- logistics: **eight categories, five accents, deliberately.** The accent says what KIND of place
  it is (a stage, a sanctuary, our own rooms, a transfer point, a bed); the icon says which one.
  Chasing eight distinct colours is what put a hotel in crimson — and it had already failed anyway,
  since two pairs shared a colour by accident.

**The roster said "not activated" four times.** A gold/crimson dot on the avatar, a chip beside the
name, a gold `Wysłano {date}` caption, and a whole tinted panel with a resend button — all for one
singer, on one row. Worse, the *resting* case was painted too: a sage dot on every activated
account, i.e. on almost every row of a healthy roster. That is the archive's `AI ✓` and the hub's
`TUTTI` again.

- The avatar dots are **deleted**, both of them. The sage one was the resting default in the
  loudest slot; the gold one restated the chip 40px away.
- The row keeps the chip (the exception) and the resend button (the work). The `Wysłano …` stamp
  loses its tint — when the invitation went out is a fact, and the chip already carries the alarm.
- The chip and the `Archiwum` badge were `hidden sm:inline-flex`, so on a phone the row had *only*
  the dot; with the dots gone they show at every width. They are rare, which is the point.
- The card keeps the one panel that carries the resend, and nothing else.
- `Skala` / `A Vista` were `Eyebrow`s repeated on all 40 rows, each with an em-dash when empty.
  In the list they are gone: the range reads as a plain `Caption` where one exists, the stars
  appear where somebody was rated, and an unrated singer says nothing. The grid card keeps the
  labels — a card has no column context to inherit them from.

**Three figures were counted over sets their neighbours were not.** All in the same family as the
archive's `awaitingCount`:

- The atlas legend printed a per-category count over the **whole** base while the map drew the
  **filtered** one — filter to "Kościoły" and the legend still cheerfully reported twelve concert
  halls with no pin on screen. The legend now shows colour ↔ meaning only, for the categories
  actually on the map, and drops a category the map has none of. The census lives in the overview
  bar, which has one denominator.
- `N aktywnych` was stated twice with two denominators — the overview bar over every venue with
  something booked, a badge over the map over the geo-tagged filtered ones. The map badge is gone;
  in its place the map speaks only when it *disagrees* with the bar, i.e. `N bez współrzędnych`
  when some venues cannot be drawn at all. Silent otherwise.
- The SATB tiles count singing members while the list below them also shows the archived, so
  "44 w zespole" sat above 51 rows. The strip header now states `N w archiwum` when there is one,
  and the arithmetic closes.

Smaller, but the same job: **the two search boxes did not fold diacritics** (`zielinska` found
nothing, `kosciol` found nothing) — all four searches now use the one `foldDiacritics` · the crew
strip printed `e-mail 0%` over an empty base, which is not a low rate but no data, and now prints an
em-dash · `LocationPreview` — the venue chip used on the dashboard, the schedule, rehearsal rows and
project cards — printed `location.category` **verbatim**, so a reader saw the string `CONCERT_HALL`
set as a sage overline; it resolves through the dictionary now · that same popover labelled its
footer "Wyznacz trasę" and ran a *place search*, so the two Maps deep-links moved into
`lib/mapsLinks.ts` and the footer became a real `<a>` to a route while the card opens the venue ·
both editors carried a "Wybrana specjalizacja / kategoria" preview restating the select two rows
above it, deleted · the location editor printed the record's raw UUID under its title · `Nie
aktywowano`'s prose hints in the artist editor were set as `Eyebrow`s, i.e. sentences in a label's
clothing · the artist editor's raw `<input type="checkbox">` is now the `Checkbox` primitive (via
`Controller` — the primitive draws its tick from the prop, so it cannot ride on `register`) ·
`LogisticsTimezoneBand` counted the zones above the list of the zones · the venue row printed an
em-dash for "no events" on every quiet venue.

Three components were extracted, each because the tree already had two or three copies:
`shared/ui/primitives/accents.ts` (above), `shared/ui/composites/FilterTokens` (crew, logistics and
archive each hand-rolled the same removable `rounded-full` pill — off the radius scale, and the
shape `Badge` exists to prevent; archive's copy is still there and switches over with its own pass)
and `features/logistics/lib/mapsLinks.ts`.

`CrewSpecialtyBadge` and `LocationCategoryBadge` were the fourth and fifth private copies of the
chip, both at `rounded-md` and `tracking-[0.18em]`. They are domain wrappers over `Badge` now —
they map a state to a tone, an icon and a sentence, and own no surface. `CrewEmptyState.tsx` is
deleted; both rosters now render `StatePanel` inline, so the two mirror each other exactly.

**Declined:** giving each of the eight location categories its own colour (see above), and turning
the crew/artists specialty and section chips into plain type. A voice part and a trade are the
primary axis those two rosters are sorted, filtered and balanced by — the same call the archive
pass made for voice-part labels.

### `features/archive` (SHIPPED 2026-07-27)

Biggest single debt in the tree at the 2026-07-26 measurement: 21 raw overlines, zero radius or
hairline tokens, hand-rolled empty states. All 21 are gone, both empty states are `StatePanel`, and
`grep -E "rounded-(xl|2xl|3xl|lg|md|sm)"` over the feature now returns nothing. But the pass found
two things that were **not** micro-decisions.

**The list said "something needs review" four times.** A gold gradient banner
(`ArchiveAwaitingBanner`), a gold shortcut in the stat strip, a gold chip on every awaiting row,
and a count inside the expanded row. Above it sat a second full-width gradient section
(`ActiveIngestionsPanel`) with the same anatomy in amethyst — so on any day with an upload in
flight, two hero banners pushed the actual library below the fold. This is the Przegląd tab's
"the gap count stopped being said three times", at four:

- `ArchiveAwaitingBanner` is **deleted**. Its whole content was a restatement plus a button that
  went where the stat line's own count already went.
- The stat line keeps the facts as a sentence and promotes the backlog to a real `Button`
  (`Sparkles` + `N do przeglądu`), because it is the one thing on the page that is *work*. A gold
  underline pretending to be a control was part of how this got said four times.
- `ActiveIngestionsPanel` is a `SectionCard` — header on the hairline rule, count in the `action`
  slot. Its title was a full sentence set as an `Eyebrow`; card headers are a label slot.

**The row wore chips for its resting state.** `StatusChip` (a third private copy of
`EditionStatusBadge`, at `rounded-full`) printed a sage `AI ✓` on every approved piece, and a
`PDF` chip on every piece that had one — i.e. on nearly every row of a healthy archive. Composers
had the same bug spelled as a pair: `MB ✓` **or** `MB?`, so every composer wore a chip and none
stood out. Now:

- `StatusChip` is deleted; the row renders `EditionStatusBadge` and only for a phase that has **not
  settled** (READY drops out of the priority list entirely).
- The PDF chip is inverted: silence when a score exists, a gold `bez nut` when it does not — which
  is also the exception the stat line's `% z PDF` is counting.
- Intrinsic facts (duration, voicing, track count) lost their chip chrome and read as `Caption`
  beside the title, matching the comment the file already carried and had stopped honouring.
- Composers keep only the gold `bez MB`.

**One real defect, found while wiring the stat line.** `awaitingCount` was computed from the
*filtered* list while `totalPieces` and `pdfCoverage` came from `libraryStats` (unfiltered) — three
figures on one line, two denominators. Filtering to a composer who happened to have nothing pending
reported an empty review queue. Now `useArchiveData` exposes `awaitingPieces` over the library, and
`isPanelOpen` / `editingPiece` — dead since the slide-over was removed — went with it.

Smaller, but the same job: `ArchiveTabs` now mirrors `ProjectTabs` exactly (it was its own
recipe) · `EditionUploadDrawer`'s panel sat on `z-toast`, so every toast its own uploads raised
rendered *behind* it (now `z-focus-trap`) · the merge-target cards had a `hover:-translate-y-px`,
against the locked no-lift rule · `ProvenanceChip` had four tones for three trust tiers, two of them
one alpha step apart · `ComposerRowExpanded`'s MusicBrainz/Wikidata links were chips (a catalogue's
brand set as an overline reads as a status) and are now `Button asChild` · the filter tokens,
divisi pills, language codes, voice-part labels and the section count are all `Badge` now.

Two components were extracted because the archive had typed them twice:
`ArchiveStatLine` (both list pages hand-rolled the same `<strong>` sentence) and
`InlineConfirmAction` (arm-then-confirm, previously in two heights and two radii for delete and for
abort-ingestion).

**Declined:** converting `ArchiveTabs` to `SegmentedTabs`. These are routes, and `SegmentedTabs` is
a controlled tablist — the switch would have traded real `<a>` semantics (middle-click, open in new
tab) for a shared file. `ProjectTabs` already made this call; archive now matches it instead.

#### Follow-up: what the archive pass did not carry over (SHIPPED 2026-07-27)

The two Phase 3 passes were written in parallel and committed one after the other, so neither could
see what the other had extracted. Re-reading the five archive screens against the findings the
roster pass had already settled turned up four things — and, worth saying plainly, **no fifth**: the
archive's taxonomies (epochs, languages, domains) carry no colour at all, so the crimson-on-a-resting-
category bug that drove `accents.ts` genuinely does not exist here. Every crimson in the feature is
a delete hover or a real error.

**Neither archive search folded diacritics.** `foldDiacritics` had reached artists, crew, logistics,
messages and projects. The one feature it skipped is the one whose index *is* Polish surnames:
`gorecki` returned nothing, and so did `lukaszewski`. Both the piece list (title + composer) and the
composer list fold now, on both sides of the `includes()`.

That pulled a real defect out of the shared helper. It was built on `.normalize("NFD")`, which peels
combining marks off `ó` and `ń` — but `ł` is an atomic codepoint (U+0142) with **no decomposition**,
so it survived the fold untouched and Łukaszewski was unreachable in *every* feature that had already
adopted the helper, including the roster pass that introduced it. Stroked letters now go through an
explicit map. `shared/lib/text.test.ts` exists to pin exactly that case, because a hand-rolled NFD
fold passes every other assertion in the file.

**The filter row was the fourth hand-rolled copy.** `FilterTokens` was extracted for this and landed
one commit later, so the archive could not have used it. Adopted now; `archive.search.clear_token`
retires into `common.filters.remove_token`. One deliberate difference from the crew call site: the
summary sits behind a guard instead of using the composite's summary-only mode, because crew's
`{{visible}} z {{total}} osób` is a permanent census while the archive's is the *effect* of a
filter — the library total is already in the stat line, so unfiltered it would only say `128 z 128`.

**Two figures were still said twice.** The review meter printed `Zweryfikowano 4 z 9` and then, two
lines below, a legend reading `Zweryfikowane: 4` — one number, twice, in two inflections of the same
word. The legend's actual job is decoding the provenance dots on the fields underneath, so it keeps
colour ↔ meaning and hands the arithmetic back to the sentence. This is the atlas-legend call from
the roster pass, arrived at from the opposite direction: there the legend contradicted the census,
here it repeated it. Both are now one rule in `.ai/04`.

And the composers stat line printed `0 bez utworów` on a healthy library — the resting state
announcing itself, which is the locked rule the piece row already follows for `bez nut`. The segment
appears only when there is an orphan to go and look at. While a search narrows that list it now says
`{{visible}} z {{total}}`, so the library-wide `128 kompozytorów` above it is never read as the count
on screen.
