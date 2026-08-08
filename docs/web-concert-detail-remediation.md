# Concert detail page (`/koncerty/[id]`) — remediation

Written 2026-08-08, after a full audit of [`web/src/pages/koncerty/[id].astro`](../web/src/pages/koncerty/%5Bid%5D.astro).

**Etap 1 shipped in that session; Etap 2 on 2026-08-08, after re-auditing Etap 1 against the built
output.** What is left is in `Still open` below, and it is left there because every item in it needs
a decision that is the owner's, not the implementer's — not because it ran out of time. Do not treat
this file as a queue to burn down: read `Decided, do not re-litigate` first, then pick ONE open item
and settle its question before writing code.

Two of the remaining items (§2's last two sections, §3) are blocked on **written Polish copy about
real concerts and real people**, which is the owner's under `concert-detail-pages-spec.md` §0.5 and
must not be generated.

Companion documents, in the order they outrank this one: `web-landing-guardrails.md` §5 (register
doctrine), `web-reveal-remediation.md` (the timing budget and why the constants are what they are),
`web-register-audit.md` (what the build-time gate does and does not catch), `concert-detail-pages-spec.md`
(the page's editorial contract — consent, `hasPage`, no fabrication).

---

## Etap 1 — shipped 2026-08-08

Verified by `astro check` (0 errors) and a full build: the register audit went from **908 to 956
register nodes across 16 pages, clean**.

**Contrast.** `candleInkFrom()` in `lib/candle.ts` derives the station's accent at `--candle-ink`'s
luminance; `<main>` now carries `--candle` and `--candle-ink` together. Six small-gold-on-parchment
rules moved to the ink (`.kd-band-soft .kd-section-label`, `.kd-program-num`, `.kd-text summary`,
`.kd-clasp-rule`, `.kd-voces-voice`, `.kd-spotify-link`). Measured before: **2.06–2.13 : 1** on
`--paper` across all five stations. After: **4.55–4.80 : 1**. Hairlines, the rubric lozenge and its
wash, and display gold deliberately stayed on `--candle` — the split is by ROLE, not by band.

**Voces cadence.** `(i % 3) + 1` → `(i % 4) + 1`. `.kd-voces-grid` is `auto-fit minmax(180px, 1fr)`,
which lays **five** columns across `.kd-wrap` (1180px, 40px gap). Cells in one grid row share a top
edge exactly, so they cross the trigger in a single observer callback at any scroll speed; modulo 3
handed out `1 2 3 1 2` — two pairs in unison, on every page that renders a roster. Modulo 4 uses the
fourth step `registers.css` already declares and leaves one collision at the row's two ends.

**Three reveals.** `.kd-prologue-mark` took ink and now leads its band (label and text stepped down
one each); `.kd-verbum-note` took a register at all; `.kd-verbum-bridge` stopped carrying delay 0
behind two `data-d="2"` siblings.

**LEAD register**, first adoption on this page: `.kd-program-item`, `.kd-movement`, `.kd-cite`,
`.kd-voces-note`, `.kd-run-head`, `.kd-gallery-foot` as ink+lead pairs, `.kd-tour-list` as lead
alone. All seven are TOP-anchored, which is the whole reason it is these seven and not more —
`.kd-tour-row`'s `border-bottom` would draw a rule below the line that fired it and was left alone.

Two things about that adoption are worth carrying forward:

- **`.kd-program-item.is-bis` is excluded.** Its hairline is `dashed` — a notation saying the encore
  stands outside the programme — and the pseudo-rule is a solid 1px background, so handing the
  border over promoted the bis row to an ordinary one for every visitor with motion on. Found only
  by dumping the emitted `<ol>` and reading it row by row. **The register audit does not check
  `border-style`.**
- **The four suppression cases are unverifiable by tooling.** `collect.mjs` keeps no sibling order,
  so nothing notices if the `content: none` list and the `border-top: 0` list stop agreeing. They
  must be changed together, by hand. The note is in the CSS at the rule.

---

## Etap 1 — re-audited 2026-08-08, second pass

Every claim in the section above was re-checked against the emitted HTML and the built CSS rather
than against the source. **Four of the five held exactly. The fifth had two misses, both of them
small text on parchment, and both are fixed in Etap 2 below.**

- **The four suppression cases are correct and complete.** All 95 `<li>` of the five
  `<ol class="kd-program">` were dumped and walked: for every row, whether the layout keeps a
  hairline and whether the pseudo-rule draws agree, including the flat 9-Kart list (nine sung
  clasps, no movements, bis last) and the two rows where a *bare* clasp precedes the next item.
  The `content: none` list matches the `border-top: 0` list one for one. `:first-child` really
  does match — Astro's fragments emit the `<li>`s as direct children with nothing between them.
- **No second `is-bis`-style divergence exists.** All seven LEAD hairlines are `1px solid`, all
  seven `--rule-ink` values are byte-identical to the border they replace, and — the check that
  actually mattered and was not asked for — all seven hosts have **zero horizontal padding**, so
  the pseudo-rule spans the full border width rather than a short inset copy of it. `is-bis` was
  the only one.
- **The 1px drop is uniform and does not depend on `padding-top`.** `inset: 0` resolves against
  the padding box, and the suppression sets `border-top-COLOR: transparent` — the 1px *width*
  stays. So the offset is exactly one border-width on every node, and `.kd-run-head`'s 16px,
  `.kd-gallery-foot`'s 20px and `.kd-cite`'s 18px never enter the geometry. (Had the rule blanked
  the border with `border-top: 0` instead, every row would have shifted up 1px and a 17-row
  programme would have lost 17px the moment JS loaded. It doesn't.) Nowhere on the page does a
  drawn rule sit near enough to a real one to be compared against it.
- **The Voces cadence is right, and `mod 4` is never worse than `mod 3` at any width.** Computed
  from the real cascade (`.kd-band` padding `max(28px, 5vw)` → `.kd-wrap` ≤1180 → column gap
  `clamp(24px, 3vw, 40px)`): **5** columns at ≥1180, **4** at ~912–1024, **3** at ~720–820, **2**
  at 480–640, **1** below ~430. Collisions per row, mod 3 → mod 4: 2 → **1** at five columns,
  1 → **0** at four, 0 → 0 everywhere else. One correction to the note above: the "1180px, 40px
  gap" measure is only true from ~1333px viewport up; at a 1180px viewport the wrap is 1062 and
  the gap 35.4. The column count is 5 either way. Emitted `data-d`: wcielenie `1 2 3 4 1 2`,
  wolanie-gor `1 2 3 4 1`, aeternam `1 2 3 4 1 2 3 4 1 2 3` — one collision, at the row's ends.
- **`candleInkFrom()` clears AA on `--paper` for all five**, verified independently of `candle.ts`
  by reading the hex the build wrote into `<main style>`: **4.55 / 4.66 / 4.67 / 4.67 / 4.80**.
  Full candle on the same ground: 2.06–2.13. Both figures reproduce the note above exactly.

**But the sweep for "small gold on parchment" missed two strings, and one of them is inside the
very rule that was supposed to fix it:**

- **`.lat` — "Programma" and "Voces" — stayed at full candle, 2.06–2.13 : 1.**
  `.kd-band-soft .kd-section-label { color: var(--candle-ink) }` colours the label; the Latin tier
  is a **child**, and `base.css`'s two-tier rubric rule matches it directly (`:is(…, .kd-section-label,
  …) .lat`, 0-2-0) — a declared value on the child always beats an inherited one from the parent,
  whatever the parent's specificity. So on the two parchment bands the gloss read at 4.6 : 1 while
  the Latin word beside it sat at 2.1, in Cinzel 500 caps at 10.5px. On the dark bands both tiers
  have always been the same colour; parchment was the only ground where they diverged, and the
  divergence was an accident of the cascade, not the "colour" carrier of the two-tier shape.
- **`.kd-cite-about`, 4.11 : 1** — 10.5px caps in `--ink-muted` on `--paper-soft`. Not gold, which
  is exactly why a gold-shaped sweep walked past it. `--ink-muted` measures 4.53 on `--paper` and
  **4.11 on `--paper-soft`**; `.kd-pullquote` is the page's only paper-soft band.

Two further defects surfaced while checking, neither of them contrast:

- **`.kd-movement-pl` rendered at Cinzel 700.** It sets no `font-weight` and lives inside the act's
  `<h3>`, so it took the UA's `bold` — the only bold micro label on the page. Its Latin sibling
  escaped only because it happens to set a weight of its own.
- **A bare clasp followed by an act header keeps both rules.** `.kd-clasp:not(.is-sung) +
  .kd-program-item` drops the item's hairline so two lines don't stack; `.kd-clasp:not(.is-sung) +
  .kd-movement` has no such rule, so on wolanie-gor row 11→12 the clasp's own seam and the act
  divider land ~44px apart. Not a register mismatch — border and pseudo-rule agree — and 44px is
  more than the 20px the item case was written against. **Left alone: whether that reads as two
  rules or as an intermission followed by a new act is a judgement about the page, not about the
  cascade.**

---

## Etap 2 — shipped 2026-08-08

Verified by `astro check` (0 errors) and a full build: **956 register nodes across 16 pages,
clean** — unchanged, as it must be, since no register was added or removed.

**The type-scale question is settled: subpages own their own scale. The landing's
`--h1/--h2/--h3/--body` do not apply and are not going to.** See §1 below for the evidence; the
dead copies are gone from `vault.css`.

**Contrast, finishing Etap 1's own sweep.** `base.css`'s `.lat` colour became
`var(--lat-ink, var(--candle))` — unset everywhere, so nothing changes anywhere else on the site —
and `.kd-band-soft .kd-section-label` now sets `--lat-ink` on the same line as the colour it
already set, so the two tiers cannot drift again. `.kd-cite-about` took `--ink-soft`: 4.11 → 10.5
against the citation name's 15, so the step between them survives.

**Heading outline (was `Still open` §2).** The eight `.kd-section-label`s are `<h2>`, styling
unchanged; `.kd-section-title` is a `<p>`. The outline is now **h1 → h2 per section → h3 per act**
on every page, with no level hanging off an optional YAML field — the latent `h1 → h3` bug is gone
because there is no longer a conditional heading. The lede is a lede: `programLede` by name, and it
scopes nothing its section's `<h2>` does not already scope, so a heading level there would have
bought an outline step that holds no content. Two weights had to be written down to keep the
rendering byte-identical (`.kd-section-label`) or to correct it (`.kd-movement-pl`) — see the note
above. `text-wrap: balance` is restated on `.kd-section-title` because a `<p>` would otherwise take
`pretty` from `base.css`.

Not done, and deliberately: the **micro band** (§1) and the **dead clamps**. Both now depend on a
fact Etap 1 did not have — see §1.

---

## Still open

### 1. The type scale — the big one, and the only one that is genuinely a design decision

**SETTLED 2026-08-08: subpages own their own scale.** Not a preference — the landing tokens fail
three separate tests:

- **Nothing outside `styles/landing/` reads `--h1/--h2/--h3/--body`.** On the seven subpages that
  import `vault.css` they were declared and never read. They are now deleted from that file.
- **The two copies were not the same values.** `vault.css` carried `--h1: clamp(64px, 12vw, 178px)`
  against the landing's `clamp(56px, 10vw, 138px)`, which `landing/07-responsive.css` narrows again
  to `clamp(58px, 19vw, 92px)` at ≤640. Its own docstring claimed the tokens were "kept verbatim so
  this shim stays a faithful superset of the landing environment". They were not. Adopting them
  would have meant adopting a scale whose two copies disagree about its largest step.
- **They are the wrong sizes.** `--h1` would take `.kd-hero-title` from `clamp(48px, 9vw, 124px)`
  to `clamp(56px, 10vw, 138px)`; `--h2` would take `.kd-section-title` from a 68px ceiling to 104.
  Those are one-screen hero sizes. This page is 8000px of programme book.

**`--micro` is the exception and it is live.** `vault.css` keeps it, because `.micro` in that same
file reads it — so **every `class="micro"` element on this page is already carrying an 11px token**,
and the page then overrides it 31 times. The band is not "no rule"; it is *a rule that is silently
overridden*, which is worse, and it is the reason the next label added picks its size by coin flip.

**Before touching the 31, know that `.micro` brings more than a size.** It also sets
`padding-bottom: 8px`, `line-height: 1.45`, `letter-spacing: .24em` and `text-transform: uppercase`.
Roughly fourteen element types on this page take that 8px, and the page's own margins were tuned
with it in place — `.kd-voces-voice`'s `margin: 0 0 12px` is a 20px gap on screen. **So the micro
decision is really two:** which sizes the roles get, *and* whether this page keeps leaning on an
atom that lives in the donation vault's shim. The second one moves vertical rhythm in fourteen
places and is the owner's.

Measured on the page as it stands: **63 `font-size` declarations, zero page-authored tokens.**

**The micro band is 31 of those 63, across four sizes, assigned inconsistently by role:**

| size | count | same role, different size |
|---|---|---|
| 10px | 10 | `.kd-voces-voice`, `.kd-credit dt`, `.kd-poster figcaption`, `.kd-vianav-dir` |
| 10.5px | 11 | `.kd-section-label`, `.kd-vianav-label`, `.kd-movement-pl`, `.kd-shot figcaption` |
| 11px | 9 | `.kd-hero-eyebrow`, `.kd-verbum-cite`, `.kd-program-num`, `.kd-spotify-link` |
| 11.5px | 1 | `.kd-program-composer` |

Eyebrows exist at 10, 10.5 **and** 11. Figcaptions at 10 and 10.5. Attributions at 10.5 and 11. The
0.5px differences are at the edge of visibility — **the defect is not that they are seen, it is that
there is no rule, so the next label added picks its size by coin flip.**

None of the four is the 11px the `.micro` atom already hands every one of these elements — the
10.5px band, the largest of the four, is eleven declarations spent walking half a pixel away from
a token that was already there.

**Below ~1030px viewport the page is a fixed ladder.** Every `clamp()` but three (`hero-title` at
533px, `interlude-lat` 650, `section-title` 654) is pinned at its `min`, so on every phone and most
tablets the reading hierarchy is:

```
23  .kd-program-work / .kd-reflection-text     16    .kd-text-orig / .kd-inscriptio
22  .kd-quote / .kd-verbum-quote               16    .kd-movement-line / .kd-interlude-pl
19  .kd-prologue-text / .kd-tour-date          16    .kd-reflection-note
18  .kd-program-arc                            15.5  .kd-clasp-pl
17.5 .kd-clasp-lat                             15    .kd-voces-note
17  .kd-verbum-bridge / .kd-tour-venue         14    .kd-program-inscriptio / .kd-program-note-work
17  .kd-credit dd                              13    .kd-voces-detail
```

**Nine registers inside 2.5px** (17.5 → 15). They cannot read as distinct, so those differences buy
no hierarchy at all.

**Nine clamps do nothing** — the three below 2px, plus six more once the bar is 2px — and they can
go whatever the scale decision is. Each is a two-value declaration whose two values differ by less
than the ladder's own smallest step, so it is a fluid rule that never reads as fluid:

| selector | fluid only between | travel |
|---|---|---|
| `.kd-voces-detail` | 1300–1400px | **1.0px** |
| `.kd-program-note-work`, `.kd-program-note-lead` | 1333–1476px | **1.5px** |
| `.kd-hero-meta` | 1150–1300px | **1.5px** |
| `.kd-verbum-body p` | 1143–1286px | 2.0px |
| `.kd-program-inscriptio` | 1167–1333px | 2.0px |
| `.kd-text-orig`, `.kd-text-pl` | 1103–1241px | 2.0px |
| `.kd-voces-note` | 1154–1308px | 2.0px |

**One ratio worth a look while deciding:** `.kd-hero-title` maxes at 124px against `.kd-section-title`'s
68 — a **1.82** step. The landing's `--h1`/`--h2` is **1.33**. The gap is filled, but by
`.kd-interlude-lat` (52) and `.kd-movement-lat` (42), which are programme elements, not section heads.

### 2. ~~Heading outline~~ — done in Etap 2

Two sections still have no heading and are reachable only as `aria-label`led regions:
`.kd-pullquote` and `.kd-coda`. Neither carries a `.kd-section-label` to promote, so giving them
one means **writing visible Polish copy**, which on this page is the owner's under
`concert-detail-pages-spec.md` §0.5. That is the whole of what is left here.

### 3. Meta description

`description = c.essence` goes straight into `<meta name="description">`, `og:description` and
`twitter:description`. Measured:

```
wcielenie      138  ok
wolanie-gor    174  over
hymn-poleglym  219  over
9-kart         242  over
aeternam       263  over
```

`index.astro:42-43` records this project's own rule — *"Kept under ~160 characters: Google truncates
past that"*. Four of five pages break it, one by 65%.

**`essence` cannot simply be shortened**: it is also the lede on `/koncerty`, where its length is
doing real work. The fix is an optional `metaDescription` in the schema falling back to `essence`,
plus four written strings. **Those strings are copy about real concerts and real people — they get
written or approved by the owner, not generated.** See `concert-detail-pages-spec.md` §0.5.

### 4. Deliberately not done in Etap 1 — decide, then act or close

- **`.kd-clasp-lat` contrast.** 17.5–23px of `--candle` on parchment at 2.10 : 1. It is under the
  24px large-text threshold, so it is a real AA failure — but it is the page's most expressive
  element (a psalm verse returning, centred, candle-lit) and `.kd-movement-lat` at 27px fails the
  large-text bar (3 : 1) on exactly the same terms while `tokens.css` explicitly exempts display
  gold. **Left on `--candle` for consistency with that exemption. This is a decision, not an
  oversight — either extend the exemption in writing or move both.**
- **Two vertical lead candidates**, `.kd-inscriptio` and `.kd-program-arc` (`border-left` in candle).
  `.reveal-rule-v` would fit mechanically. Not adopted because a candle accent rule on display text
  is a different aesthetic proposition from a structural hairline, and Etap 1 had no read on whether
  seven drawn rules was already enough. **Look at the page first, then decide.**
- **Breakpoints.** `tokens.css:183-197` declares the convention 480 / 640 / 768 / 980. This page uses
  `820px` and `720px` (invented) alongside `640px` (canonical); `720` also appears in the poster's
  `sizes`. Cheap to align, but it re-tests three layouts.
- **`--gutter` unused.** `.kd-band` hardcodes `max(28px, 5vw)`, the token's exact value.
  `/o-nas`, `/kontakt`, `/kolofon`, `/404` all use `var(--gutter)`; this page and `/koncerty` do not.
- **`VideoPlayer` is `client:load`** on a section several screens down; the landing's `VoxMoment` is
  `client:visible`. The in-file comment justifies it by ClientRouter swaps, but `client:visible`
  re-arms after a swap too. **Verify the claim before changing it** — it may be protecting something
  the comment states badly.

### 5. `--ink-muted` on `--paper-soft`, site-wide — not this page's to settle

`--ink-muted` measures **4.53 : 1 on `--paper` and 4.11 on `--paper-soft`**, so any small text that
moves from one parchment to the other silently crosses the AA line. On this page that was one
selector (`.kd-cite-about`, fixed in Etap 2 by taking `--ink-soft`). It is not one selector on the
site: `--paper-soft` bands exist on `/press` (four of them), `/kontakt`, `/koncerty` and `/o-nas`,
and none of them was audited here. **Either `--ink-muted` gets a darker sibling for that ground, or
each band states `--ink-soft` the way this page now does.** A token is the better answer and it is a
`tokens.css` decision, so it is recorded here and not acted on.

### 6. R10 note, informational only

Three of the six site-wide photographs the veil cannot visibly move are on this page:
`kd-hymn-0.jpg` (30 sRGB levels), `poster-wcielenie.webp` (34), `kd-aeternam-4.jpg` (35), against a
35 bar. **Doctrine says the light register is granted by ROLE** — a dark frame is a note about a
photograph, not a reason to move a component. Recorded so nobody re-opens it. Do not act on it.

---

## Decided, do not re-litigate

- **The gallery is fully migrated to `galleryRuns`** and is consistent. `.kd-shot figcaption` renders
  from `g.caption`, which is empty across the whole archive today — `content.config.ts` states that
  this is the *correct resting state*, not a gap. It is not dead code.
- **The `--candle` / `--candle-ink` split is by role, not by band.** Rules, marks, the rubric wash and
  display gold keep `--candle` on parchment even though they measure 2.1 : 1, because the contrast
  minimum does not apply to them. Do not "finish the job" by converting them. The one thing that WAS
  missing from the split is `.lat`, and it is now carried by `--lat-ink` (Etap 2) — because that one
  is a child the parent's colour never reached, not a role that was decided differently.
- **The LEAD suppression list is verified against the emitted DOM, not just read.** All 95 rows of
  the five programmes were walked; the `content: none` list and the `border-top: 0` list agree one
  for one. Re-verify by dumping the `<ol>` again if either list is touched — the audit still cannot
  do it, and the check takes minutes, not hours.
- **A page rule that recolours a rubric does NOT reach its `.lat` child.** `base.css` paints `.lat`
  directly, and a declared value on a child beats an inherited one from the parent at any
  specificity. This is why the parchment labels were half-fixed for a month. Set `--lat-ink` beside
  the colour, on the same rule, every time.
- **`.kd-tour-row` keeps its `border-bottom` and takes no lead register.** Bottom-anchored rules draw
  below the trigger that fired them. This is `web-reveal-remediation.md`'s anchor defect.
- **`--veil-delay` is correctly absent** on `.kd-shot-media` and `.kd-poster-media`: both are hosts
  smaller than the viewport, which is the case `registers.css` says needs no delay.
- **The 100vw breakout on `.kd-interlude` is safe.** `base.css` hides the scrollbar
  (`scrollbar-width: none`) and sets `body { overflow-x: hidden }`.
- **Spotify stays private.** `.kd-spotify-link` never renders; the code path is kept deliberately.
  `concert-detail-pages-spec.md` §0.1.

---

## Environment, before you start

`serve dist` holds file handles on `dist/`. With one running, `astro build` crashes mid-write with a
libuv assertion (`!(handle->flags & UV_HANDLE_CLOSING)`) and `rm -rf dist` fails with "Directory not
empty" — and the failure looks like a code error, because Astro reports it as a missing
`prerender-entry` module. **Check for stray `serve` processes before concluding a build is broken.**

Do NOT build to an alternate `--outDir`: only `dist` is gitignored, so anything else dumps a whole
build into source control.

More than one session has been editing this tree at once, `[id].astro` included. **Re-read before
editing; do not trust line numbers in any document, including this one.**
