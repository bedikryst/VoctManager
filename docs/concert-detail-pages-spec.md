# Spec: dedicated concert pages `/koncerty/[id]` — texts, reflections, clasp, tour dates, prev/next

Status: READY TO IMPLEMENT · Written 2026-07-12 · Frontend only (`web/` Astro app) · No backend, no migrations.

All work happens in `web/`. Panel conventions (Ethereal tokens) do NOT apply — `web/` owns its CSS
(`.ai/07_marketing_public_site.md`). The `/koncerty` list page was refactored the same day this
spec was written (its "soul audit"); this spec extends the SAME data layer (`concerts.yaml`) and the
SAME `[id].astro` skeleton. Line numbers below were verified against the tree on 2026-07-12; trust
them, re-verify only if off by a few.

Companion memory: `project_web_concert_data_ssot_2026-07`, `project_landing_soul_copy_2026-07`.
The list-page refactor established the vocabulary this spec keeps: **"Obraz N · Latin"** register,
one-negation discipline, documented facts over brochure abstractions, incipits as "first sung words".

---

## 0. Decisions locked with the owner (do not re-litigate)

1. **Spotify playlists stay PRIVATE** — indefinitely. Do NOT render any "Posłuchaj / nagrania"
   affordance, do NOT uncomment the `spotify:` lines in `concerts.yaml`, do NOT promise recordings.
   The existing `.kd-program-foot` Spotify link ([id].astro:161-170) simply never renders (field
   stays absent). Leave the code path in place for a possible future public release; ship nothing.
2. **Consent granted** (owner, 2026-07-12) to name, where documented in the ensemble's own programme
   books: the Jesuit speakers (o. Jarek Naliwajko SJ, o. Przemysław Wysogląd SJ), Ada Bystrzycka
   (light), Radu Ropotan (violin, Wołanie Gór), the Aeternam instrumentalists, the Hymn organists,
   and the Bobola celebrant/homilist. Use them only where the booklet already credits them.
3. **`hasPage` still gates pages — editorial restraint is structural.** A concert earns a page only
   when it carries real depth: a reflection, an incipit, per-work source notes. After this spec:
   **Wcielenie, Aeternam, 9 Kart, Wołanie Gór, Hymn Poległym** get pages. **Bobola gets NO page** —
   a liturgy serves, it does not market itself; its station links (transmission, photo gallery) are
   enough. Do not set `hasPage: true` on Bobola.
4. **Implementation order = Aeternam first.** It is the richest booklet (full texts + translations,
   durations, voicings, a whole-ensemble "Cel koncertu", a promise-bearing Tavener finale) and it is
   the moral centre of the cycle. Build + review Aeternam end-to-end as the one hero page, THEN
   replicate to the other four. This mirrors the site's "juror-review one moment before building the
   rest" rule (`.ai/07`).
5. **No fabrication.** Every text/translation/credit below is transcribed from a booklet in
   `docs/about/extracted/`. Where a booklet is silent (e.g. a Florent-signed reflection for a
   concert that never had one written), the field stays EMPTY — see §6 "still needed from Florent".
   Never invent a quote and attribute it to a real person (the attribution bug this spec fixes).

---

## 1. The attribution bug to fix first (Wcielenie)

`concerts.yaml` Wcielenie `reflection` currently ends with a sentence that is **ours**, not
Florent's, yet the whole block is signed "Florent de Bazelaire · 20 stycznia 2024":

> …możemy odzyskać zmysł obecności Boga w naszym życiu. **Repertuar — od proroctw Izajasza po kantyk
> Symeona, od zimowego półmroku Sandströma po jasność Monteverdiego — układa się jako droga do samej
> istoty tego, co niewysłowione.**

Sentences 1–2 ARE from the founding text (`wcielenie.txt` p.14, lightly tightened) — keep them
signed. Sentence 3 (the repertoire walk, bold above) is editorial — it must NOT sit under his
signature. Fix: move it to a new unsigned `reflectionNote` field (see §2), rendered as a quieter
paragraph with no attribution. Same rule as the landing: **verbatim under the signature, our prose
un-signed.**

---

## 2. Schema additions (`web/src/content.config.ts`)

All new fields are OPTIONAL — existing entries keep validating. Add to the `concerts` schema.

**Concert-level** (add near the existing `reflection` block, ~lines 61-77):

```ts
/** The founder's own name for the programme, shown instead of a bare work count
    (e.g. "Dziesięć spojrzeń — i bis"). Falls back to the "Programma" label alone. */
programLede: z.string().optional(),
/** OUR editorial bridge paragraph — rendered UNSIGNED, beneath the signed `reflection`.
    Never place editorial prose under `reflectionAttribution`. */
reflectionNote: z.string().optional(),
/** Multi-city tour dates. When present, the page shows the tour and JSON-LD emits one
    MusicEvent per date (single-date concerts keep using `date`/`venue`). */
dates: z
  .array(
    z.object({
      date: z.string(),            // ISO YYYY-MM-DD
      venue: z.string(),           // full venue + city
      time: z.string().optional(), // e.g. "20:00"
    }),
  )
  .optional(),
```

**Program-item-level** (add inside the `program` array object, ~lines 80-93):

```ts
/** Vocal scoring as printed in the score, e.g. "a 8", "a12: SAATBB + SAATBB". */
voicing: z.string().optional(),
/** Duration as printed, e.g. "10′". */
duration: z.string().optional(),
/** Sung text in the original language (Latin / English / Ukrainian…). */
text: z.string().optional(),
/** Polish translation of `text`. */
textPl: z.string().optional(),
/** A clasp/refrain label rendered as a slim hairline row AFTER this item — used for
    "9 Kart", where Miserere returns between the psalms (e.g. "Miserere — część II"). */
clasp: z.string().optional(),
```

`inscriptio`/`inscriptioPl`/`inscriptioRef` already exist at BOTH levels — reuse them, don't
duplicate. (The list-page refactor already added concert-level incipits to every non-liturgy entry.)

---

## 3. `[id].astro` rendering changes

Reference the current file as the baseline; every hook below already exists.

### 3.1 Programme title → founder's name (kill the inventory voice)
[id].astro:128 currently:
```astro
<h2 class="kd-section-title">{c.program.length} utworów{c.program.some((p) => p.bis) ? " + bis" : ""}</h2>
```
Replace with:
```astro
{c.programLede && <h2 class="kd-section-title">{c.programLede}</h2>}
```
When `programLede` is absent, the section shows only its "Programma · Program koncertu" label
([id].astro:123-127) — no count. ("11 utworów + bis" is an inventory; "Dziesięć spojrzeń — i bis" is
the work.)

### 3.2 Unsigned editorial note under the reflection
In the reflection band ([id].astro:102-116), after the signed `reflectionAttribution` paragraph, add:
```astro
{c.reflectionNote && <p class="kd-reflection-note">{c.reflectionNote}</p>}
```
Style `.kd-reflection-note`: same measure as `.kd-reflection-text` but smaller, upright (not italic),
`rgba(244,241,233,.62)`, `margin-top: clamp(28px,4vw,44px)`. It reads as a caption, clearly not part
of the signed quote.

### 3.3 Per-work voicing + duration chips
On the `.kd-program-work` line ([id].astro:140-144), after the year, append the scoring/duration as
mono micro chips (same treatment as `.kd-program-year`):
```astro
{p.voicing && <span class="kd-program-voicing micro">{p.voicing}</span>}
{p.duration && <span class="kd-program-duration micro">{p.duration}</span>}
```
`.kd-program-voicing` / `.kd-program-duration`: mono, 11px, `.14em` tracking, `--ink-muted`, a thin
left divider (`border-left: 1px solid var(--line)`; `padding-left: 10px; margin-left: 10px`). These
chips are the concert-page equivalent of the landing's "44 śpiewaków" — the honesty of the craft
(a4 vs a12 is the whole drama of this ensemble).

### 3.4 Sung text + translation (`<details>`, zero JS)
Inside `.kd-program-body`, after the `inscriptio` block ([id].astro:145-154), add:
```astro
{(p.text || p.textPl) && (
  <details class="kd-program-text">
    <summary><span>Tekst i przekład</span><span class="kd-detail-icon" aria-hidden="true" /></summary>
    <div class="kd-text-cols">
      {p.text && <p class="kd-text-orig">{p.text}</p>}
      {p.textPl && <p class="kd-text-pl">{p.textPl}</p>}
    </div>
  </details>
)}
```
Two-column at ≥720px (`.kd-text-cols { display:grid; grid-template-columns:1fr 1fr; gap:clamp(20px,3vw,44px) }`),
stacked below. `.kd-text-orig` serif italic; `.kd-text-pl` serif upright muted. Preserve line breaks
by storing texts as YAML block scalars (`text: |-`). This is the single biggest transfer of the
booklets' soul onto the site — the sung word itself, finally visible.

### 3.5 Clasp rows (9 Kart)
In the program `<ol>` loop ([id].astro:132-157), after each `<li>`, render the clasp when present:
```astro
{p.clasp && (
  <li class="kd-clasp" aria-hidden="true"><span>{p.clasp}</span></li>
)}
```
`.kd-clasp`: full-width, centered, a hairline before/after the label; mono micro gold; NOT a numbered
program item (`list-style:none`, no `.kd-program-num`). It re-creates Miserere weaving the psalms
together — the structural identity of that concert (see §5, 9 Kart).

### 3.6 Tour dates
Where a concert has `c.dates`, render a small "Wykonania" list under the hero meta (or as its own
slim band before the program): each row = date · venue · time. Keep `c.meta` as the headline city;
`dates` is the full itinerary. JSON-LD ([id].astro:40-50): when `c.dates` exists, emit an array of
`MusicEvent`s (one per date) instead of the single event; each with its own `startDate` + `location`.
Keep `eventStatus: EventCompleted`.

### 3.7 Prev / next Obraz navigation
Replace the lone back-link ([id].astro:194-201) with a three-slot foot: ← previous Obraz · "Wszystkie
Koncerty Duchowe" · next Obraz →. Derive neighbours in `getStaticPaths` (or in-page) by sorting the
`concerts` collection on `order` and finding entries with `hasPage` adjacent to the current one. Skip
a slot when there is no page-bearing neighbour. The Via is a road — it should run through the detail
pages too, not dead-end at each one.

---

## 4. Aeternam — the flagship (build + review this one FIRST)

Source: `docs/about/extracted/aeternam.txt`. Set `hasPage: true`. Data to add to the Aeternam entry:

- `programLede: "Muzyczna modlitwa — dziewięć ogniw i bis"`
- `reflection` (whole-ensemble "Cel koncertu", `aeternam.txt` p.1 — this concert's reflection is
  corporate, not Florent-signed; sign it to the ensemble):
  > „Epitafium dla Gazy" jest wyrazem modlitwy i gestem solidarności wobec zranionej ludzkości w
  > Gazie. Stając wobec cierpienia jej mieszkańców, szukamy w muzyce najczystszego języka współczucia
  > — wierząc, że kontemplacja, cisza i śpiew mogą unieść zarówno ból, jak i światło nadziei tam,
  > gdzie słowa już nie wystarczają.
- `reflectionAttribution: "VoctEnsemble · wrzesień 2025"` (the booklet asks that no separate
  conductor bio be published — `aeternam.txt` p.3; honour it, sign the ensemble not Florent).
- `dates`: Mistrzejowice (dolny kościół, Kraków) 2025-09-14 18:00 · Niedzica (kościół św. Bartłomieja
  Apostoła) 2025-10-18 18:00.
- Concert-level incipit already set by the list refactor (Requiem aeternam). Keep.

Program (add `voicing`/`duration`/`text`/`textPl` to the existing items; texts verbatim from
`aeternam.txt` pp.6-9). Order stays as the booklet's numbered `informacje` list:
1. Vivancos — **Aeternam** (2014) · a8 · 10′ — *Requiem æternam dona eis, Domine…*
2. Zieleński — **Vox in Rama** (1611) · a4 · 4′ — *Vox in Rama audita est… Rachel plorans filios
   suos, noluit consolari, quia non sunt.* (the cycle's most piercing line — do not omit)
3. Pärt — **Da Pacem Domine** (2004) · a4 · 6′
4. Gjeilo — **Serenity** (2010) · a8 + wiolonczela · 6′
5. Havrylets — **Prayer / Молитва** (2004) · a8 · 5′
6. Lotti — **Crucifixus** (~1717–19) · a8 · 4′
   — Pärt — **Psalom** · kwartet smyczkowy (instrumental, bez słów). The booklet prose pairs it with
     the Lotti as the passion's wordless silence; seat it here and mark it instrumental (no `text`,
     `voicing: "kwartet smyczkowy"`).
7. Caroline Shaw — **and the swallow** (2017) · a8 · 4′ — Ps 84
8. Tavener — **Mother of God, here I stand** (2003) · a4 · 3′
9. Tavener — **A Hymn to the Mother of God** (1985) · a12: SAATBB + SAATBB — the promise-bearing
   finale: *In you, O Woman full of grace… all creation rejoices.*
- BIS: **Rihards Dubra — O Crux ave** (a4) — set `bis: true`.

Both the Pärt **Psalom** and the **O Crux ave** bis are absent from today's YAML program — add them.
(Owner confirmed 2026-07-12: where the booklet names a piece, it was performed — the Psalom appears in
the booklet prose, so it counts.)

Instrumentalists to credit (`realizacja` or a dedicated line, `aeternam.txt` p.4): Joanna Indyk
(wiolonczela solo) + kwartet smyczkowy (Paulina Niemiec, Maria Tur, Magdalena Prześlica, Joanna Indyk).

---

## 5. The other four pages (replicate the pattern)

### Wcielenie (already `hasPage`) — enrich + fix
- Apply §1 attribution fix (`reflection` = sentences 1–2; move sentence 3 to `reflectionNote`).
- `programLede: "Dziesięć spojrzeń — i bis"` (founder's "Obraz Pierwszy: Tajemnica Wcielenia — 10
  spojrzeń", `wcielenie.txt` pp.10/14).
- Add `voicing` per work from `wcielenie.txt` p.1 (Es ist ein Ros' a8+4; Le cri des bergers a12;
  Canite tuba a5 TTTBB; A Child is born a4; Alma Redemptoris a8; O gloriosa a8/10; Lully Lullay a4;
  Cantate Domino SSATBB; Gaudete SATTBB). Several already carry `inscriptio` — keep.
- Texts available for: Es ist ein Ros' (2 stanzas DE+PL), Canite tuba (LA+EN), Lully Lullay (EN+PL),
  Nunc dimittis (PL), Cantate Domino (LA), Gaudete (LA+PL) — `wcielenie.txt` pp.3-9. Transcribe into
  `text`/`textPl`. The existing `pullQuote` (Vivancos on Le cri des bergers) stays — it is this
  concert's home for that quote; do NOT reuse the Vivancos quote on Wołanie Gór.

### 9 Kart — the clasp is the whole point
- Set `hasPage: true`. Source: `docs/about/extracted/9-kart.txt` (harmonogram pp.21-22).
- `programLede: "Dziewięć psalmów, oplecionych Miserere"`.
- Restructure program to the performed order with `clasp` rows: Miserere is item 01 (a9); items
  02-09 are the psalms in booklet order (Laudate Dominum a12 · Ps 117; Os Justi a8 · Ps 37; Beati
  quorum via a6 · Ps 119; Singet dem Herrn a8 · Ps 149; O clap your hands a8 · Ps 47; Barukh habba
  a6 · Ps 118; Jauchzet dem Herrn a8 · Ps 100; Cantate Domino a6 · Ps 98). Give items 01-08 a
  `clasp: "Miserere — część II"` … `"…część IX"`, and item 09 (Cantate) `clasp: "Miserere — część IX
  + epilog"`. That reproduces "each psalm framed by a Miserere fragment, the evening closing on the
  last part" (`9-kart.txt` p.21). Add the psalm numbers into each item (use `inscriptioRef` "Ps NN").
- `dates`: Rybnik 2024-09-08 16:30 · Łódź 2024-09-17 19:00 · Kraków (NSPJ) 2024-11-16 20:00.
- Speaker credit: o. Przemysław Wysogląd SJ (introduction); Ada Bystrzycka (light) — `9-kart.txt`
  p.25. No Florent-signed reflection exists → leave `reflection` empty (the `essence` carries it).

### Wołanie Gór
- Set `hasPage: true`. Source: `docs/about/extracted/wolanie-gor.txt` (very rich — 38 pages).
- `programLede: "Trzynaście pieśni gór — i bis"`.
- Add `voicing`/`year` per work (already partly in YAML). Texts + composer voices available for:
  Salve Regina (LA+PL + the Occitan "Zdrowaś Maria" recitation, p.5), MacIntyre Ave Maria (his
  Medjugorje story, pp.6-7 — a strong `pullQuote` candidate for THIS page), Ešenvalds Stars
  (Teasdale poem EN+PL, pp.12-13), Sykulski "Stoi lód na Prośnie" (his own note + full lyric,
  pp.26-28), Ken Steven Dawn and Dusk (his poem, p.29). Enescu Ménétrier + the Bach Preludium are the
  two solo-violin works (Radu Ropotan) — credit him prominently (`realizacja` already does).
- Concert-level incipit set by list refactor (Salve Regina — Ad te clamamus). Keep.
- No Florent reflection in the booklet → `reflection` empty; use a MacIntyre `pullQuote` instead.

### Hymn Poległym — the altar moment carries the page
- Set `hasPage: true`. Source: `docs/about/extracted/hymn-poleglym.txt` (6 pages).
- `programLede: "Modlitwa o pokój — przebieg wieczoru"`.
- This concert was quasi-liturgical: add the ORGAN items to the program so the arc is honest —
  entrance Bach *Fantazja i fuga g-moll BWV 542* (Krzysztof Michałek), Buxtehude *Ach Herr, mich
  armen Sünder BuxWV 178* (Michał Piechnik), and the climactic **organ impression on "Szcze ne
  wmerła Ukrajina" during the OPENING OF THE ALTAR** (Michał Piechnik). Mark the organ works with a
  distinct field or `voicing: "organy"`. The altar-opening line is the page's hero moment — render it
  with weight (a short prose beat, not just a list row).
- `date` already set (2025-02-22). Organists via `realizacja` (already set). Ukrainian-prayer incipit
  set by list refactor. Keep.
- No Florent reflection → `reflection` empty; `essence` (now naming the altar moment) carries it.

### Bobola — NO page (confirm)
Leave `hasPage` unset. The station on `/koncerty` already links the Mass transmission + Episcopate
photo gallery. A liturgy is a service; giving it a marketing page would also falsify the cycle's
numbering (the roman numerals count Koncerty Duchowe, and a liturgy sits apart). Do not build it.

---

## 6. Still needed from Florent / Anna (page copy blocked on these)

- **Signed reflections** for 9 Kart, Wołanie Gór, Hymn Poległym — or explicit approval to use the
  organiser-materials prose UNSIGNED (as `reflectionNote`). Until then those pages run on `essence`
  + texts only, which is enough to ship.
- **Bis identification, 9 Kart**: the printed bis text is *Drop, drop, slow tears* ("Spływajcie… łzy
  powolne", `9-kart.txt` p.22) — confirm composer (likely Walford Davies / Gibbons setting) before
  listing it.
- **Aeternam Psalom (Pärt, string quartet)** — performed or not (see §4).
- **Photography**: current pages are text-only by design (parchment "programme book"). If the owner
  wants a single documentary photo per concert hero, source consented images; otherwise keep the
  full-bleed station bg + veil (already the hero).

---

## 7. Verification

- `cd web && npx astro check` → 0 errors (the repo baseline has pre-existing deprecation *hints* in
  unrelated islands; ignore those). `npm run build` → all pages build.
- Every new/changed user-facing string is Polish-primary and reads natively (no MT feel). Latin/EN/UK
  texts are transcribed verbatim from the booklet — do not "correct" historical spelling.
- One-negation discipline holds on the detail pages too: reflections/notes stay positive and concrete
  except where a negation is a genuine thought (e.g. Aeternam's "język współczucia, nie komentarza").
- Owner verifies visually in-browser (do not screenshot built output).
- After Aeternam ships and is reviewed, replicate to the remaining three; keep Bobola page-less.
