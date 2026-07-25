# Project Hub — design remediation

Status: **Phase 0 SHIPPED** (2026-07-25) · Phases 1–2 open · Written 2026-07-25 · Surface under
review: `/panel/projects/:id/*` (hub shell + 10 tabs), plus the shared primitives it exposes.

Decisions D1–D3 were taken as recommended: KPI numerals moved to Inter with lining + tabular
figures (§6 D1a), native date/time pickers deferred (D2), the `Select` migration covered the
primitive plus `features/projects` only (D3).

**Phase 0 is done — §3 below is now a record, not a plan.** What actually landed, measured over
`shared/ui` + `features/projects`: raw uppercase micro-labels 84 → 10 (all remaining are dense
in-chip markers, deliberately left to the tab passes); raw `rounded-*` steps → 0; ad-hoc ink
hairlines → 0 in card chrome; hand-rolled card headers 13 → 0; native `<select>` in projects → 0.
Two defects from §1.7 were fixed on the way (the `DualTimeDisplay` orientation bug and its
false timezone comparison); §1.7-3, the Divisi count/list desync, is deliberately still open —
it belongs to the Divisi pass because fixing it means deciding what to render for a participation
with no artist record.

Also fixed while in the files: `projects.rehearsals.form.location_placeholder` read
"np. Sala 102, Akademia" — an input hint used as a listbox placeholder — now "Wybierz salę"
in all three locales.

This is a **staged plan, not a line-exact spec**. Read the code, disagree where the code says
something different, and update this file when you do.

The finding that shapes everything below: **almost nothing here is a layout problem.** The
compositions are sound — the hub, the KPI strip, the two-column tabs, the divisi board all hold up.
What reads as "glued together in a hurry" is a small set of micro-decisions (a label, a corner, a
hairline, a card header) taken slightly differently in every file. There are 16 distinct
letter-spacing values and 5 distinct font sizes in the panel for what is one typographic role. The
eye reads that as sloppiness without being able to name it.

So this is mostly an **enforcement** job, not a redesign. `.ai/04_design_system.md` already locks
most of the right answers; the Project Hub violates several of them, and three of the composites the
doc points to (`StatePanel`, `MetricBlock`, `TabHeader`) are barely or never used on this surface.

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
4. **Empty states** — `StatePanel`, no hand-rolled centred icon stacks.
5. **Numbers** — `MetricBlock`, never a hand-built flexbox; tabular figures on anything in a column.
6. **Controls** — new `Select`; icon buttons ≥44px; destructive actions crimson-tokened.
7. **Motion** — no hover lift; gold border on hover; `transform`/`opacity` only.
8. **i18n** — every touched string keyed in **pl + en + fr** (Polish primary, must read natively).
9. **Verify** — `npm run typecheck`, then `npm run build` before calling the tab done.

Tab-specific work already identified:

- **Przegląd** — fix the `DualTimeDisplay` centring (§1.7-1); KPI tiles to `MetricBlock` + the
  numeral decision (D1); drop the tile lift; `ProjectAttentionPanel` onto `SectionCard`.
- **Szczegóły** — `Input`/`Select` label parity; the run-sheet rows are three bare inputs in a
  bordered strip and need a real row rhythm; native datetime inputs flagged (D2).
- **Próby** — the five-chip row (§1.8) and the timezone pill (§1.7-2). This is the ugliest tab.
- **Divisi** — the count/list desync (§1.7-3) **first**, it is a correctness bug; then the bucket
  cards' `crimson/3`, `gold/5` tint soup, which is decorative crimson and violates the alarm-only
  rule.
- **Program** — setlist rows and database rows are two different row languages for the same object.
- **Obsada** — headers inside cards; the mobile switcher onto `SegmentedTabs`.
- **Partytura** — three stacked advisory lines, undifferentiated; needs one primary state + details.
- **Frekwencja** — the matrix is the one place a *denser*, more table-like treatment is right;
  check the sticky header hairline against the new tokens.

---

## 5. Phase 2 — App-wide sweep

After the tabs: settings, archive, logistics, crew, messages carry the same `<select>`, raw-overline
and hand-rolled-empty-state debt. Cheapest as three mechanical sweeps (Select migration; Eyebrow
sweep; StatePanel adoption) rather than another per-feature tour.

Concrete inventory left after Phase 0:

- **22 files still on `NativeSelect`** (settings ×3, archive ×7, artists ×3, crew ×2, logistics ×2,
  messages, schedule, materials, rehearsals). `NativeSelect.tsx` exists only to hold them; the file
  header says so. Phase 2 ends with that file deleted.
- **~74 raw uppercase micro-labels outside the Phase 0 scope**, plus `UserLocalClock`'s
  `tracking-[0.4em]` / `[0.2em]` — the widest outliers left in the tree.
- **`Badge` and `StatusBadge` are two components for one job.** Phase 0 unified their type; their
  shapes (tag vs pill) and glow still differ. Decide whether that distinction earns two components.
- **Radius/hairline tokens are applied in `shared/ui` + `features/projects` only.** The rest of the
  tree still carries raw `rounded-*` and `ethereal-ink/6|8|10`.

---

## 6. Open decisions — need the developer

- **D1 — KPI numerals.** Cormorant Garamond at `font-light` is why `15` reads as `I5`. Two ways out,
  and they change the product's character differently: (a) load-bearing numbers move to Inter with
  real tabular/lining figures, serif stays for headings and prose — safest, most legible, slightly
  less editorial; (b) numbers stay serif but move off `font-light` and get explicit
  `lnum`/`tnum` feature settings — *if* the woff2 carries them, which must be checked first.
  Recommendation: (a) for anything that answers a question (days, counts, money), (b)'s discipline
  applied to whatever stays serif.
- **D2 — Native date/time inputs.** A custom date-time picker is a genuine build (calendar popover,
  keyboard entry, timezone display, mobile behaviour), not a Phase 0 item. Ship it as its own
  project after the tabs, or accept native chrome on those three fields.
- **D3 — Phase 0 blast radius.** Does the `Select` migration cover all 26 files at once, or only
  `features/projects` + the primitive, leaving the rest for Phase 2? Recommendation: primitive +
  projects in Phase 0, rest in Phase 2 — keeps the foundations commit reviewable.

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
- **`Button` has `!important` on type size.** Until 0.5 lands, `className="text-xs"` on a Button is
  a no-op — this is why call sites drifted to raw spans.
- **`ProjectTabs` is a `NavLink` nav, not a tablist.** If it is unified with `SegmentedTabs`, keep
  the routing semantics (`NavLink` + `end`) — do not convert it to a controlled tablist.
- **The Windows checkout is CRLF**: ruff-style import-order noise has a frontend analogue in
  spurious whole-file diffs. Keep sweeps mechanical and per-commit so review stays possible.
