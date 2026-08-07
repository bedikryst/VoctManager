# The register audit (`web/audit/`)

A build-time conformance gate for the entrance-register language — `styles/registers.css`,
`scripts/reveal.ts`, and the rules `web-landing-guardrails.md` §5 states in prose.

Written 2026-08-08. It enforces nothing new. Every rule in it was already decided, already
documented, and already broken at least once.

---

## Why a tool, when the rules are written down

The register language has one property that no amount of care fixes: **it fails silently.**

A `transition` shorthand that replaces another parses and builds. A page rule that out-specifies
the register leaves its node observed, flipped, settled and motionless. A comment that swallows a
rule passes `astro check`. A press resting on the wrong weight is invisible until someone turns
motion off. `--wght` registered twice makes the descriptors a function of bundle order.

None of it errors. None of it looks wrong in review. Each one was found weeks later, by eye,
usually by someone hovering something. That is the entire case for the tool — and it is also the
reason the audit is written to be **loud when it cannot read**, see R0.

## Running it

```
npm run build              # runs as an Astro integration, fails the build on an error
npm run audit:registers    # standalone, against whatever dist/ is already there
npm run test:audit         # 19 tests: every check, fired at the defect it exists for
VOCT_AUDIT_SOFT=1 npm run build   # report instead of fail, for a bisect
```

~2s warm. Photograph measurements are memoised on size and mtime under
`node_modules/.cache/voct-register-audit/`.

## It reads the FINISHED BUILD

This is the load-bearing decision and it is guardrails §5's own: *"None of this is visible in the
source; measure the emitted CSS."*

Astro scopes a page's styles by appending `[data-astro-cid-…]` to **every compound**, so a
two-class page rule is emitted at (0,4,0) and silently outranks `html.voct-motion .reveal` (0,2,1)
and its `.is-in` (0,3,1). The contest a register actually loses exists only in the bundle. Source
is read for exactly the three things the build erases: comments, `@property` registrations, and
the timing tokens.

## The checks

| id | level | what it catches | where it came from |
|---|---|---|---|
| **R0** | error | the audit read *nothing* — no rules, no pages, no comments, no tokens | the bug below, found while building this |
| **R1** | error | a CSS comment holding an unclosed rule block | the `ACT I` comment that swallowed `.site-footer-head`'s centring |
| **R2** | error | `@property` registered more than once | `--wght` in `tokens.css` **and** `landing/09-kinetic.css`, different `inherits` |
| **R3** | error/warn | a `transition` colliding with a register, **either direction** | `.path-entry-title`'s hover, dead a month; `/koncerty`'s `.rep-row` |
| **R4** | error | a page rule pinning the value a register animates | `.station--memoriam .station-poster { opacity: .8 }` |
| **R5** | error | a `.reveal-cue` node also wearing a register | registers.css's own prohibition |
| **R6** | error | an `.ink-press` node resting off `--wght-rest` | `/press`, 380 against a declared 300, for months |
| **R7** | error/warn | a choreography longer than `SETTLE_FALLBACK_MS` | the 3.20s knot and its 4.10s gilding sweep |
| **R8** | warn | a hidden dimension declared outside `html.voct-motion` | the no-motion gate un-hides opacity and transform, nothing else |
| **R9** | error | a bare `transition` shorthand on a two-dimension node | `.section-title` is the ink node *and* the press node |
| **R10** | info | a photograph the veil cannot visibly move | the six night frames of the Etap 5 census |

### R3 reports both directions, and they are different bugs

- **page rule wins** → the register is inert. Observed, flipped, settled, never moved.
- **register wins** → the element's own hover stops easing and starts snapping. Nothing looks
  wrong until someone hovers.
- **tie** → reported as a warning, because bundle order decides and that is not a decision anyone
  made.

The documented fix is accepted without a finding: restate the element's list together with the
register's, as longhands, at a specificity clearing both the register and `.is-settled`. There is
a test for that (`R3 accepts the documented fix`).

### R0 exists because the audit shipped broken for one build

Astro bundles `astro.config.mjs` — and everything it imports — into a temp module before running
it, so `import.meta.url` is **not** this file's path during a build. The site root was derived from
it, which put every source-side read on a directory that does not exist. Every one of those checks
returns nothing when its input is empty, so the audit reported **clean** while reading nothing at
all. The root is located by searching for `src/styles/registers.css` now, and R0 fails the build if
any input arrives empty. *An audit that reports clean because it read nothing is the one failure
this tool may never have.*

## What it deliberately does not do

- **It does not compose a host's scrim.** R10 measures the ASSET. `.final-support` crushes its
  photograph under a 0.78–0.88 gradient before the veil arrives, and composing a CSS gradient with
  its blend mode and z-order is not something a static reader can do honestly. R10 is `info`,
  never an error, and the register is granted by ROLE — a dark frame is a note about a photograph,
  not an instruction to move a component into another register.
- **It does not resolve bundle-order ties.** It reports them.
- **It assumes runtime classes are satisfiable.** `voct-motion`, `is-in`, `vt-nav`, `menu-open` are
  never in the static artifact, and every register rule is gated on one. A selector asking for one
  matches.
- **It does not verify sibling combinators.** The element scanner keeps no sibling order, so `+`
  and `~` are accepted without proof. Both imprecisions fail toward a finding, not toward silence.
- **It says nothing about taste.** Whether a node should carry a register at all is editorial —
  §5's height question, the role question for the light register, the cadence. Not automatable and
  not attempted.

## Calibration of R10

The guardrails measured by hand *"on one mid-bright photo pixel at each section's lightest
point"* — a statistic no whole-frame average reproduces. p97 of luma is what agrees with the one
host that can be mapped to a file: `.portrait` is `florent.jpg`, hand-measured at 82 levels, p97
reports 75. **Read the number as ~10% conservative, not as theirs.**

The bar (35 levels) sits between the two hand measurements that bracket it: `.ensemble` at 27 does
not clear, `.image-rite` at 46 does. On the current asset set that flags 6 of 85, against the
census's "six of the site's fifty".

The veil is `rgba(8,8,7,0.58)`, so a source level L composites to `0.42·L + 0.58·8` and the delta
is exactly `0.58·(L − 8)` — linear in how bright the photograph already is. That part is not an
estimate.

## Adding a check

The bar is the one every check here clears: **the defect must have shipped, must be invisible in
review, and must produce no error anywhere in the toolchain.** A check for something a human
notices immediately is noise in the block that will one day carry a real error.

Then: write it in `checks.mjs`, give it a finding `id`, and add a test in `audit.test.mjs` that
fires it on the defect *and* one that stays silent on the documented fix. Fixtures compose the real
`styles/registers.css` with a synthetic page sheet, so a test also fails when the register language
is edited into a shape the audit no longer reads correctly — which is the failure a hand-written
stub would hide.

## Files

- `audit/collect.mjs` — CSS rule collection, selector parsing, specificity, the element matcher,
  the HTML scanner. No parser dependency: a full DOM is never needed.
- `audit/checks.mjs` — R1–R9. The discriminator that keeps them precise is OWNERSHIP: a rule whose
  key compound speaks only in register and runtime classes is the register talking about itself
  (including through `:is()`, which `registers.css` leans on throughout); a rule naming a page
  object is a page talking about a register node.
- `audit/assets.mjs` — R10.
- `audit/index.mjs` — orchestration, the Astro integration, the report.
- `audit/audit.test.mjs` — the proof it fires.
