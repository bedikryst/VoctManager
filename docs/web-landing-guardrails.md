# Landing (`web/`) — settled decisions and landmines

Record of what has already been tried, decided or rejected on the public site, so it is not
re-proposed. Companion to `.ai/07_marketing_public_site.md` (rules) — this file is the
*negative* space: the things that look like good ideas and are not.

Last consolidated: 2026-07-30.

---

## 1. Copy — the tells that were removed, and must not creep back

The landing's form was always authored; its **language** was the part that read as generated.
Two sweeps (2026-07-12, 2026-07-29) removed six measurable tics. Counts are the "after" state.

| Tic | Rule now |
|---|---|
| Em-dash as the all-purpose pause | Was in 11 of 12 paragraphs. Now 3 deliberate uses only: two inside the quoted founding text (Florent's voice), one in the VoxMoment reprise. Reach for a full stop, colon or semicolon first. |
| `od X po Y` range frame | Was 9×. Two homes left: the hero pitch, and the Isaiah→Simeon arc in the *Wcielenie* note. Anywhere else, list proper names instead. |
| `wybrzmienie` as a noun for "concert" | Was 8×. One home left: the verb in the CTA "Pomóż mu wybrzmieć". It is a nominalisation; used as a label it reads as translated Polish. |
| `nie X — Y` (apophasis) | Exactly one on the whole site: the manifest's "Sacrum nie zdobi. / Odsłania." Everything else states positives. |
| The silence motif | It is the page's best idea and was stated six times. The form already enacts it (`tacet.`, the coda fermata). Adding a seventh sentence about silence weakens the first six. |
| Headings as short declaratives + period | 9 of 10 were "abstract noun + verb + full stop". That cadence *is* the premium-AI-landing signature. At least a couple of headings should be names, numerals or fragments — the reason DirectorSection reads most human is that its h2 is simply "Florent de Bazelaire". |

**The meta-rule that generates most of the above:** a model explains its own metaphor in the next
sentence; an editor states it and stops. The deleted ImageRite paragraph ("światło ma własną
reżyserię… bo nawa jest tu instrumentem") was the clearest case — the photograph already showed
the beam, the nave and the listeners.

### Content that is deliberately absent

- **Florent's personal biography** (Warsaw, studies, Jesuit years) — stays out until he supplies
  an authorised biogram. Never publish unconfirmed life details.
- **Collaborator names** — consent first.
- **Donation amounts mapped to line items** — the tiers stay qualitative. Publishing anything
  implying musician rates was ruled out and is not a copy problem to "fix".
- **A future date.** As of 2026-07 nothing is scheduled. The register's open card states the two
  real preconditions (a host, and fees for the singers) rather than implying a date exists.
- **The Bobola Mass** — real and already sung, but a liturgy, not a Koncert Duchowy. Putting it in
  the register would falsify the roman numbering. It belongs on `/koncerty`.

---

## 2. Landmines — verified, do not re-propose

**`SilenceMoment` never takes the scroll.** An enforced ~2.8s scroll-lock was built and then
deleted: on touch (and in DevTools device emulation, where `pointer` can still report `fine`) a
page that ignores a swipe reads as broken. `scripts/landing.ts` says `no scroll-lock, ever`. The
pause is spatial — section height and reveal timing. General principle: a musical rest is measured
time, but on a page the reader holds the clock, so the only honest rest is space.

**`BrandGlyph` is a masked PNG, not SVG.** Any stroke-draw, morph or path animation of the mark is
impossible until a real vector logo exists. Fade and scale are the only options today, and neither
is worth doing. Do not generate a *new* logo variant as a workaround: the mark is already
consistent across chrome, threshold, vault and modals, and two almost-identical marks read worse
than one static one.

**`transitions.css` — never animate the incoming layer.** The model is "turned leaf": the outgoing
page drifts and dissolves on top, the incoming is drawn fully opaque underneath the whole time.
Sliding the new layer in from an offset uncovers a strip of `#080807` bedrock along one edge —
a dark band flashing across the parchment pages. Both paths (native `::view-transition` *and* the
attribute-driven `data-astro-transition-fallback`) must always be choreographed together, or the
"mobile menu doesn't fade" bug returns.

**Movement inscriptions must stay short (~13 characters).** `13-spine.css` hides the spine label
below 1440px because the gutter is narrow; a longer inscription pushes that breakpoint up until
the label effectively never shows. This is why `Lumen quaerit` → `Lumen Christi` and not
`Lumen ad revelationem`.

**`Vox memoriae` and `Sustinete nos` stay.** Both are grammatical. `Sustinete nos` is site-wide nav
vocabulary (`SiteChrome.astro`, `StickyHeader.tsx`), and `Vox` anchors `data-movement="vox"` plus
the VoxMoment eyebrow. Only movement I was actually broken Latin (a verb with no subject).

**`.primary-link` / `.secondary-link` are identical *by design* in the hero** — two parallel
invitations, not a hierarchy. The one place they are a real hierarchy is `.final-actions`, which
has its own candle-gold rule. Do not "fix" the hero to match.

**`public/polityka-prywatnosci.html` is outside the Astro pipeline.** It carries its own
`@font-face`, preloads and tokens. Any font or asset change must touch it by hand — deleting the
old font files without it silently drops that page to a system font.

**`--sans` is declared in two files**: `styles/tokens.css` and `styles/landing/01-foundation.css`.
Changing one leaves the landing on the old face.

**WebGL hero: abandoned.** Do not re-pitch.

---

## 3. Micro-typography

Polish one-letter prepositions (`a i o u w z`, `we`, `ze`) must never end a line, and it is most
visible at display sizes. Two mechanisms, per `lib/typo.ts`:

- **Data strings** (YAML, `paths.ts`, tile labels, donation rows) → wrap at render: `{nbsp(value)}`.
- **Hand-written markup** → `&nbsp;` entity directly in the template.

Do not embed a literal U+00A0 in source; formatters eat it.

**Verification gotcha:** in Python, `\s` matches U+00A0, so a naive orphan-check regex reports the
*fixed* text as still broken. Match an explicit ordinary space (`[ \n\t]`) when auditing `dist/`.

The vault and the donation terms (`Regulamin`) are the one surface not yet swept — mostly legal
fine print, where orphan control matters least.

---

## 4. Open — worth doing next

- **Logo as SVG.** Unlocks a once-per-session draw-in of the mark in the preloader threshold,
  using the existing `.knot-draw` mechanism. Waiting on the file.
- **Coda caption.** A fermata over a whole rest already instructs "hold the silence"; the caption
  "Cisza brzmi dalej." restates it in words and is the fourth statement of the motif. Ending on the
  sign alone is the stronger close. Flagged in `CodaSection.astro`, awaiting a decision.
- **Vault + Regulamin copy** — has its own untouched series of negations ("Bez pośredników, bez
  zakładania konta.", "Bez prowizji.").
- **Open the first register entry by default.** The expanded programme is the best-designed thing
  on the page and it is hidden behind an 11px accordion label. Not done blind because
  `scripts/landing.ts` replaces the native `<details>` with an exclusive animated accordion.
- **IBM Plex Sans line-height pass.** Plex has different metrics from Inter; body copy density
  across all 13 pages wants a human look before it is called finished.

---

## 5. The motion language

The site has exactly two motion idioms: **ink being drawn** (`.knot-draw` — interludes, coda,
finalis, register rules) and **light passing** (gilding sweep, rite spotlight, manifest edge).
Anything added in one of those two will look native at any strength; anything outside them will
look bolted on however subtle it is. Coherence is the filter against showreel, not restraint —
which is why a strong page-turn is fine and a tasteful generic fade-up would not have been.
