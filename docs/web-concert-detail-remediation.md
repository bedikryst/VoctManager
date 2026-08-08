# Concert detail page (`/koncerty/[id]`) — remediation

Written 2026-08-08, after a full audit of [`web/src/pages/koncerty/[id].astro`](../web/src/pages/koncerty/%5Bid%5D.astro).

**Etap 1 shipped in that session.** What is left is in `Still open` below, and it is left there because
every item in it needs a decision that is the owner's, not the implementer's — not because it ran
out of time. Do not treat this file as a queue to burn down: read `Decided, do not re-litigate`
first, then pick ONE open item and settle its question before writing code.

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

## Still open

### 1. The type scale — the big one, and the only one that is genuinely a design decision

**The question to settle first, before any code: do the landing's `--h1/--h2/--h3/--body/--micro`
apply to subpages at all, or do subpages own their own scale?** Every other decision here follows
from that answer, and answering it wrongly costs a second sweep. Today the tokens live in
`landing/01-foundation.css` and `vault.css` (two copies, same values) and **no subpage reads them**.

Measured on the page as it stands: **63 `font-size` declarations, zero tokens.**

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

**Three clamps do nothing** and can go whatever the scale decision is:

| selector | fluid only between | travel |
|---|---|---|
| `.kd-voces-detail` | 1300–1400px | **1.0px** |
| `.kd-program-note-work`, `.kd-program-note-lead` | 1333–1476px | **1.5px** |
| `.kd-hero-meta` | 1150–1300px | **1.5px** |

**One ratio worth a look while deciding:** `.kd-hero-title` maxes at 124px against `.kd-section-title`'s
68 — a **1.82** step. The landing's `--h1`/`--h2` is **1.33**. The gap is filled, but by
`.kd-interlude-lat` (52) and `.kd-movement-lat` (42), which are programme elements, not section heads.

### 2. Heading outline

On ~8000px of programme book the document emits: `h1` (title), **one** `h2` (`.kd-section-title`,
and only when `c.programLede` exists), `h3` per act. Ten sections are headed by
`<span class="kd-section-label">`. `aria-label` on each `<section>` gives region navigation, but
heading navigation — how most screen-reader users skim a long page — returns almost nothing.

Minimal fix: make `.kd-section-label` an `<h2>` with the styling unchanged, and decide what
`.kd-section-title` then is. Appearance need not change at all. **Latent bug in the same place:** the
only `h2` is conditional, so the first concert shipped without a `programLede` goes `h1` → `h3`. All
five current pages have one.

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

### 5. R10 note, informational only

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
  minimum does not apply to them. Do not "finish the job" by converting them.
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
