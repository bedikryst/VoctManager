// @ts-check
/**
 * @file contract.mjs
 * @description The key contract: which text in `concerts.yaml` is COPY, what its stable key is,
 *  what an editor sees it called, and in what order it is read. This table is the real output of
 *  the extractor stage — `extract.mjs` is a walk over it — and it is the thing §4 of the copy-desk
 *  spec means by "the key must be derivable in BOTH directions": the extractor builds the key from
 *  a path here, and `apply-copy` finds the path from the key.
 *
 *  THREE RULES THIS FILE HOLDS.
 *
 *  1. **Declaration order IS reading order.** `order` is a counter over this list, so the desk
 *     renders a concert in the sequence /koncerty/[id] prints it — hero, próg, słowo, refleksja,
 *     program, cytat, głosy, zapis, obrazy, koda — and the two fields that appear on OTHER pages
 *     (the /o-nas milestone) sit at the end and say so in their label. Re-ordering this list
 *     re-orders the desk; it never changes a key.
 *  2. **`scope` is never written here.** It is `scope_from_key` on the backend and the first two
 *     parts of the key everywhere else. A scope this file could set would be a second, quietly
 *     divergent answer to "which page is this on".
 *  3. **Every field in the file is accounted for, in one of the two tables.** `NOT_COPY` is not
 *     documentation — `extract.test.mjs` walks the YAML and fails if a path appears that neither
 *     table names. A field added to a concert without a decision about whether it is copy is
 *     exactly the trap §7 records (`movements[].pl` was a locale wearing a nested key), and this
 *     is the only place that trap can be caught mechanically.
 *
 *  WHERE A TRANSLATION LIVES. Polish is the only locale `concerts.yaml` holds (spec §8, option b):
 *  `en` and `fr` are read from and written to the per-locale overlay files (`concerts.en.yaml`,
 *  `concerts.fr.yaml`) under these same dotted keys, so the Polish source file is never
 *  restructured again and `apply-copy`'s line-level path — the one operation that can destroy the
 *  corpus — only ever REPLACES a Polish scalar in place. `shape` therefore says how the extractor
 *  READS a Polish value, not where its translation goes: `map` is one of the `*Gloss` locale maps
 *  stage A introduced, whose `en`/`fr` slots are now empty by rule and whose Polish sits at `.pl`.
 *  Stage C3 emptied the last exception, the `about.en`/`about.fr` block, into the overlays.
 * @architecture Astro islands 2026
 * @module copydesk/contract
 */

/** Mirrors `SiteLocale` on the backend and `LOCALES` in `src/i18n/config.ts`. */
export const SITE_LOCALES = /** @type {const} */ (["pl", "en", "fr"]);

/**
 * Every segment in this corpus is plain text: `grep` finds no `<em>`, `<strong>` or `<a>` anywhere
 * in `concerts.yaml`. The `HTML` kind and §7's `contenteditable` sanitizer trap arrive with stage
 * G, where the static pages bring inline markup with them.
 */
const TEXT = "TEXT";

/**
 * @typedef {object} Field
 * @property {string|null} path Path to the value inside the list entry; `null` means the entry
 *  itself is the scalar (`facts[]`).
 * @property {string} key Key part appended after the entry's own part; `""` for a bare scalar.
 * @property {string} label What the editor sees, appended to the list's label.
 * @property {"plain"|"map"} [shape] `map` = the path ends at `.pl` of a `LocalizedText`.
 * @property {string} [note] A constraint the translator has to know about this field.
 */

/**
 * @typedef {object} Entry
 * @property {"field"|"list"} kind
 * @property {string} path Dotted path from the concert root (`verbum.quote`, `program`).
 * @property {string} [key] Key part; defaults to `path`.
 * @property {string} label
 * @property {"plain"|"map"} [shape]
 * @property {string} [note]
 * @property {string|null} [keyBy] For a list: the entry field carrying a stable id, or `null` to
 *  key by position.
 * @property {Field[]} [fields] For a list.
 */

/**
 * KEYING A LIST. Where the data already carries a stable identifier that is NOT itself copy, the
 * key uses it — `gallery[].img` and `movements[].id` — so inserting a frame or an act re-keys
 * nothing. Everywhere else the key is the position, which is stable only under APPEND: inserting a
 * work in the middle of a programme silently re-keys every work below it, and the desk loses their
 * proposals and their first-seen date. That is a real cost, accepted here because a past concert's
 * programme does not gain a work, and guarded in stage C2 rather than prevented: a run that
 * retires many keys at once has the signature of a shifted list and must say so loudly instead of
 * pruning quietly. `roster.groups[].voice` and `credits[].role` look like natural keys and are
 * not — they are the very values an editor is about to translate.
 *
 * @type {readonly Entry[]}
 */
export const CONCERT_CONTRACT = [
  // ── Hero ────────────────────────────────────────────────────────────────────────────────────
  {
    kind: "field",
    path: "title",
    label: "Tytuł koncertu",
    // The ONE fact this corpus used to hold in two homes: `about.en.title` was the English of
    // this exact string. This key owns it now, in the overlay, and the /o-nas milestone reads it
    // from there. Nothing else in `about` duplicated a concert field — `about.place` ("Bazylika
    // NSPJ · Kraków") and `metaPlace` ("Bazylika NSPJ, Kraków") are different lines for different
    // surfaces, and `about.blurb` is a shorter register than `essence`.
  },
  { kind: "field", path: "metaPlace.pl", key: "metaPlace", label: "Nagłówek · miejsce", shape: "map" },
  {
    kind: "field",
    path: "dateLabel.pl",
    key: "dateLabel",
    label: "Nagłówek · określenie czasu",
    shape: "map",
    note: "Copy, not a date — used only where the day is genuinely vague (\"jesień 2025\").",
  },
  {
    kind: "field",
    path: "inscriptioGloss.pl",
    key: "inscriptioGloss",
    label: "Inskrypcja · przekład",
    shape: "map",
    note:
      "Two jobs in one slot (§6a): the vernacular of the Latin above it where there IS an " +
      "`inscriptio`, and a standalone editorial note where there is not. Render the second per " +
      "locale rather than translating it back against a Latin that is not there.",
  },
  {
    kind: "field",
    path: "inscriptioRef.source.pl",
    key: "inscriptioRef.source",
    label: "Inskrypcja · źródło",
    shape: "map",
    note:
      "A named source, not a verse: \"Salve Regina\" stays itself, \"Introit Requiem\" is " +
      "\"Requiem Introit\" in English. Knowing which is which is part of the job.",
  },
  { kind: "field", path: "essence", label: "Esencja (hero i karta na /koncerty)" },
  { kind: "list", path: "facts", keyBy: null, label: "Fakt", fields: [{ path: null, key: "", label: "" }] },

  // ── Próg wieczoru ───────────────────────────────────────────────────────────────────────────
  { kind: "field", path: "prologue", label: "Próg wieczoru" },

  // ── Słowo wprowadzające ─────────────────────────────────────────────────────────────────────
  {
    kind: "field",
    path: "verbum.speaker.pl",
    key: "verbum.speaker",
    label: "Słowo · mówca",
    shape: "map",
    note: "The name and title alone — \"o.\" is \"Fr\" in English and \"P.\" in French. The date is appended at render.",
  },
  { kind: "field", path: "verbum.quote", label: "Słowo · cytat" },
  { kind: "field", path: "verbum.text", label: "Słowo · transkrypcja" },
  { kind: "field", path: "verbum.bridge", label: "Słowo · przejście" },

  // ── Refleksja ───────────────────────────────────────────────────────────────────────────────
  { kind: "field", path: "reflection", label: "Refleksja" },
  {
    kind: "field",
    path: "reflectionAttribution",
    label: "Refleksja · podpis",
    note:
      "CARRIES A POLISH DATE (\"· 20 stycznia 2024\"), which §6a's sweep missed. Until it is " +
      "split the way `verbum.speaker` was, a translator must render the month — and it will " +
      "drift from the concert's own `date`.",
  },
  { kind: "field", path: "reflectionNote", label: "Refleksja · nota redakcji" },

  // ── Program ─────────────────────────────────────────────────────────────────────────────────
  { kind: "field", path: "programLede", label: "Program · nazwa wieczoru" },
  { kind: "field", path: "programArc", label: "Program · lede" },
  {
    kind: "list",
    path: "movements",
    keyBy: "id",
    label: "Akt",
    fields: [
      { path: "gloss.pl", key: "gloss", label: "nazwa", shape: "map" },
      { path: "line", key: "line", label: "wers prowadzący" },
      { path: "interlude.gloss.pl", key: "interlude.gloss", label: "interludium · przekład", shape: "map" },
      {
        path: "interlude.ref.source.pl",
        key: "interlude.ref.source",
        label: "interludium · źródło",
        shape: "map",
      },
    ],
  },
  {
    kind: "list",
    path: "program",
    keyBy: null,
    label: "Program",
    fields: [
      { path: "inscriptioGloss.pl", key: "inscriptioGloss", label: "incipit · przekład", shape: "map" },
      { path: "inscriptioRef.source.pl", key: "inscriptioRef.source", label: "incipit · źródło", shape: "map" },
      { path: "note", key: "note", label: "nota" },
      {
        path: "rubric",
        key: "rubric",
        label: "rubryka",
        note: "A stage direction, printed as a missal prints one: short, past tense, attestable.",
      },
      {
        path: "textGloss.pl",
        key: "textGloss",
        label: "tekst · przekład",
        shape: "map",
        note:
          "Where a canonical published translation of the hymn exists, use it and credit it " +
          "rather than inventing one; where its author died under 70 years ago, flag the rights " +
          "question instead of pasting.",
      },
      { path: "clasp", key: "clasp", label: "klamra" },
      { path: "claspTextGloss.pl", key: "claspTextGloss", label: "klamra · przekład", shape: "map" },
    ],
  },
  { kind: "field", path: "programNote", label: "Program · nota do całości" },
  { kind: "field", path: "textNote", label: "Program · nota o tekstach" },
  {
    kind: "list",
    path: "credits",
    keyBy: null,
    label: "Obsada",
    fields: [{ path: "role", key: "role", label: "rola" }],
  },

  // ── Cytat ───────────────────────────────────────────────────────────────────────────────────
  { kind: "field", path: "pullQuote.text", label: "Cytat · treść" },
  { kind: "field", path: "pullQuote.attribution", label: "Cytat · podpis" },
  { kind: "field", path: "pullQuote.about", label: "Cytat · o czym" },

  // ── Głosy wieczoru ──────────────────────────────────────────────────────────────────────────
  {
    kind: "list",
    path: "roster.groups",
    keyBy: null,
    label: "Głosy",
    fields: [
      { path: "voice", key: "voice", label: "grupa" },
      { path: "detail", key: "detail", label: "dopisek" },
    ],
  },
  { kind: "field", path: "roster.note", label: "Głosy · nota" },

  // ── Zapis wieczoru ──────────────────────────────────────────────────────────────────────────
  { kind: "field", path: "video.caption", label: "Zapis · podpis" },
  { kind: "field", path: "video.note", label: "Zapis · proweniencja" },

  // ── Obrazy wieczoru ─────────────────────────────────────────────────────────────────────────
  {
    kind: "list",
    path: "gallery",
    keyBy: "img",
    label: "Obraz",
    fields: [
      {
        path: "alt",
        key: "alt",
        label: "opis alternatywny",
        note: "621 words of it across the corpus. Leaving it Polish on the English page is an accessibility regression, not a cosmetic one.",
      },
      { path: "caption", key: "caption", label: "podpis" },
    ],
  },

  // ── Koda ────────────────────────────────────────────────────────────────────────────────────
  { kind: "field", path: "posterAlt", label: "Plakat · opis alternatywny" },
  {
    kind: "field",
    path: "realizacja",
    label: "Koda · realizacja",
    note: "A label and a name in one string (\"Skrzypce: Radu Ropotan\"). The label translates; the name never does.",
  },
  {
    kind: "list",
    path: "links",
    keyBy: null,
    label: "Odnośnik",
    fields: [{ path: "label", key: "label", label: "etykieta" }],
  },

  // ── Poza stroną koncertu ────────────────────────────────────────────────────────────────────
  { kind: "field", path: "about.place", label: "/o-nas · miejsce kamienia milowego" },
  { kind: "field", path: "about.blurb", label: "/o-nas · nota kamienia milowego" },
];

/**
 * Everything else in `concerts.yaml`, with the reason it is not copy. Paths use `[]` for an array.
 *
 * The point of writing them down is the test: a path in the file that is in NEITHER table fails
 * the extractor's suite, so a new field cannot enter the corpus without somebody deciding which of
 * §5's two meanings its name carries. Three groups recur — a foreign original (printed unchanged
 * in every locale), a proper name, and a structured fact the page FORMATS rather than prints.
 *
 * @type {Readonly<Record<string, string>>}
 */
export const NOT_COPY = {
  id: "identity — it is the first half of every key on this page",
  order: "sequence of the cycle",
  roman: "the station's numeral",
  latin: "the station's Latin name — content, printed unchanged in every locale",
  hasPage: "flag",
  variant: "layout enum",
  reverse: "layout flag",
  accent: "colour token",
  bg: "asset name",
  heroImg: "asset name",
  heroFoot: "veil depth, 0–1",
  poster: "asset name",
  spotify: "URL",
  venue: "venue name — schema.org Place.name, and the landing reads its tail as a town",
  date: "ISO date; every visible form of it is FORMATTED per locale (lib/dates)",
  time: "clock time",
  address: "street address — JSON-LD only",
  admission: "enum, JSON-LD only",
  viaDate:
    "A POLISH DATE IN A STRING (\"sty 2024\", \"jesień 2025\") — §6a's rule says no date is ever " +
    "written into copy, and this is the one the sweep left. It is excluded from the desk because " +
    "it is a date, not because it is harmless: the via-rail will print \"sty 2024\" on the " +
    "English page until it is derived from `date`/`dateLabel`. Stage F.",
  inscriptio: "Latin original — content, not a locale (§5)",
  "inscriptioRef.scripture[].book": "structural citation — lib/scriptureRef formats it per locale",
  "inscriptioRef.scripture[].chapter": "structural citation",
  "inscriptioRef.scripture[].chapterAlt": "structural citation (Septuagint numbering)",
  "inscriptioRef.scripture[].verses[]": "structural citation",
  "about.img": "asset name",
  "video.asset": "asset id",
  "video.poster": "asset name",
  "video.portrait": "player flag",
  "credits[].name": "a person's name",
  "roster.groups[].names[]": "the singers' names — consent scope is this page only (§ schema)",
  "dates[].date": "ISO date per evening",
  "dates[].venue": "venue name per evening",
  "dates[].time": "clock time",
  "dates[].address": "street address — JSON-LD only",
  "dates[].admission": "enum, JSON-LD only",
  "links[].href": "URL",
  "gallery[].img": "asset name",
  "gallery[].credit": "the photographer's name",
  "gallery[].source": "the outlet a frame comes from — a masthead, not prose",
  "gallery[].moment": "enum (rehearsal / concert)",
  "gallery[].venue": "venue name for one frame",
  "gallery[].date": "ISO date for one frame",
  "gallery[].plate": "layout flag",
  "movements[].id": "identity — it is this act's key part",
  "movements[].lat": "Latin original",
  "movements[].interlude.lat": "Latin original",
  "movements[].interlude.ref.scripture[].book": "structural citation",
  "movements[].interlude.ref.scripture[].chapter": "structural citation",
  "movements[].interlude.ref.scripture[].chapterAlt": "structural citation",
  "movements[].interlude.ref.scripture[].verses[]": "structural citation",
  "program[].composer": "a person's name",
  "program[].years": "life dates",
  "program[].work": "the work's title — content, printed unchanged in every locale",
  "program[].year": "year of composition",
  "program[].movement": "the act id this work belongs to",
  "program[].voicing": "scoring as printed in the score (\"a 8\", \"SAATBB\")",
  "program[].duration": "duration as printed",
  "program[].bis": "flag",
  "program[].text": "foreign original — sung text, verbatim (§5)",
  "program[].claspText": "foreign original — the clasp's sung words",
  "program[].inscriptio": "Latin original",
  "program[].inscriptioRef.scripture[].book": "structural citation",
  "program[].inscriptioRef.scripture[].chapter": "structural citation",
  "program[].inscriptioRef.scripture[].chapterAlt": "structural citation",
  "program[].inscriptioRef.scripture[].verses[]": "structural citation",
};
