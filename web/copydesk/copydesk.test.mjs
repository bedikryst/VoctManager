// @ts-check
/**
 * @file copydesk.test.mjs
 * @description `npm run test:copydesk`. Four things are checked here and each of them fails
 *  silently in production if it is not:
 *
 *  - **Hash parity.** The fixture is generated from `backend/copydesk/hashing.py` and read by both
 *    sides. A drift makes every translation in the corpus read as stale, or a moved Polish read as
 *    fresh, and nothing else says so.
 *  - **Reversibility.** §4 requires a key to work in both directions. Every emitted key resolves
 *    back to the exact string it was read from, so `apply-copy` can address the same scalar.
 *  - **Complete accounting.** Every path in the YAML is either copy or explicitly not copy — in
 *    BOTH corpora, `concerts.yaml` and every `content/pages/<page>.yaml`. A new field cannot enter
 *    one without somebody deciding which, the trap §7 records as "a key named `pl` under a foreign
 *    original".
 *  - **Determinism.** Two runs over unchanged corpora are byte-identical, so a diff of the
 *    artifact is a diff of the site's text and nothing else.
 * @architecture Astro islands 2026
 * @module copydesk/copydesk.test
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

import YAML from "yaml";

import { collapse, plan } from "./apply.mjs";
import { CONCERT_CONTRACT, NOT_COPY } from "./contract.mjs";
import { extractAll } from "./extract.mjs";
import { extractAllPages, extractPage, PAGE_SPECS, pageSource, readPage } from "./extractPages.mjs";
import { normalizeForHash, sourceHash } from "./normalize.mjs";
import { OVERLAY_LOCALES, parseOverlay, renderOverlay } from "./overlay.mjs";
import { SITE_LOCALES } from "./segment.mjs";
import { collectScalars, commentLines, detectEol, replaceScalars } from "./yamlEdit.mjs";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const CONCERTS = "src/content/concerts.yaml";
const CORPUS = new URL(`../${CONCERTS}`, import.meta.url);
/** @param {string} locale */
const overlayUrl = (locale) => new URL(`../src/content/concerts.${locale}.yaml`, import.meta.url);

const readRaw = async () => readFile(CORPUS, "utf8");
const readCorpus = async () => YAML.parse(await readRaw());

/**
 * The overlays as the extractor takes them: locale → key → value.
 *
 * @returns {Promise<Record<string, Map<string, string>>>}
 */
async function readOverlays() {
  /** @type {Record<string, Map<string, string>>} */
  const overlays = {};
  for (const locale of OVERLAY_LOCALES) {
    overlays[locale] = parseOverlay(await readFile(overlayUrl(locale), "utf8"), locale);
  }
  return overlays;
}

// --------------------------------------------------------------------------------------------- //
// Hash parity                                                                                     //
// --------------------------------------------------------------------------------------------- //

test("normalize.mjs reproduces hashing.py on every fixture case", async () => {
  const fixture = JSON.parse(await readFile(`${HERE}fixtures/hash-parity.json`, "utf8"));
  assert.ok(fixture.cases.length >= 20, "the fixture should not shrink");

  for (const testCase of fixture.cases) {
    assert.equal(
      normalizeForHash(testCase.input),
      testCase.normalized,
      `normalize: ${testCase.id} — ${testCase.why}`,
    );
    assert.equal(sourceHash(testCase.input), testCase.sha256, `hash: ${testCase.id}`);
  }
});

test("the two divergences between Python's strip() and JavaScript's trim() are held", async () => {
  // Named explicitly so that deleting them from the fixture is a visible act rather than a
  // shrinking loop: these are the only two cases a naive `.trim()` mirror gets wrong.
  const fixture = JSON.parse(await readFile(`${HERE}fixtures/hash-parity.json`, "utf8"));
  /** @param {string} id */
  const caseFor = (id) => fixture.cases.find((/** @type {{id: string}} */ c) => c.id === id);

  const bom = caseFor("bom");
  assert.ok(bom, "the fixture must keep a U+FEFF case");
  assert.equal(normalizeForHash(bom.input), bom.normalized);
  assert.notEqual(bom.input.trim(), bom.normalized, "U+FEFF: trim() would strip what Python keeps");

  const nel = caseFor("nel");
  assert.ok(nel, "the fixture must keep a U+0085 case");
  assert.equal(normalizeForHash(nel.input), nel.normalized);
  assert.notEqual(nel.input.trim(), nel.normalized, "U+0085: trim() would keep what Python strips");
});

// --------------------------------------------------------------------------------------------- //
// Keys                                                                                            //
// --------------------------------------------------------------------------------------------- //

test("every key is legal, unique, and scoped to its own concert", async () => {
  const concerts = await readCorpus();
  const { segments, paths } = extractAll(concerts);
  const ids = new Set(concerts.map((/** @type {{id: string}} */ c) => c.id));

  const seen = new Set();
  for (const key of Object.keys(paths)) {
    const parts = key.split(".");
    assert.ok(parts.length >= 3, `${key}: a key needs a namespace, a concert and a field`);
    assert.equal(parts[0], "concert");
    assert.ok(ids.has(parts[1]), `${key}: names a concert that is not in the corpus`);
    assert.ok(!seen.has(key), `${key}: emitted twice`);
    seen.add(key);
  }

  // The scope is the first two parts and nothing else derives it — `scope_from_key` on the
  // backend has to agree with this without either side being told.
  for (const segment of segments) {
    const scope = segment.key.split(".").slice(0, 2).join(".");
    assert.ok(ids.has(scope.split(".")[1]), `${segment.key}: scope ${scope} is not a concert`);
  }
});

test("every key carries exactly the three site locales, at one order", async () => {
  const { segments } = extractAll(await readCorpus());
  /** @type {Map<string, string[]>} */
  const byKey = new Map();
  /** @type {Map<string, Set<number>>} */
  const orders = new Map();

  for (const segment of segments) {
    byKey.set(segment.key, [...(byKey.get(segment.key) ?? []), segment.locale]);
    orders.set(segment.key, (orders.get(segment.key) ?? new Set()).add(segment.order));
  }
  for (const [key, locales] of byKey) {
    assert.deepEqual([...locales].sort(), [...SITE_LOCALES].sort(), `${key}: locale set`);
    assert.equal(orders.get(key)?.size, 1, `${key}: one key, one place in the reading order`);
  }
});

test("Polish is never empty and a translation is only ever a repository value", async () => {
  const overlays = await readOverlays();
  const { segments } = extractAll(await readCorpus(), overlays);
  for (const segment of segments) {
    if (segment.locale === "pl") {
      assert.ok(segment.value.length > 0, `${segment.key}: a Polish segment with no value`);
    }
  }
  // Every non-empty en/fr row comes from an overlay file and from nowhere else; the rest are the
  // empty columns the desk offers for editing. A row with a value the overlays do not hold means
  // the extractor has started reading a translation out of the Polish corpus again.
  for (const segment of segments) {
    if (segment.locale === "pl" || !segment.value) continue;
    assert.equal(
      overlays[segment.locale].get(segment.key),
      segment.value,
      `${segment.key} [${segment.locale}]: a value that is not in the overlay`,
    );
  }
  // Counted against the overlays rather than a frozen number: this asserted 28 (what stage C3
  // moved out of the about blocks) and went red the moment stage E's import wrote 830 more. The
  // invariant it was reaching for is the one above — a translated row exists exactly where an
  // overlay holds one — so state it as the identity it is.
  const translated = segments.filter((s) => s.locale !== "pl" && s.value.length > 0);
  assert.equal(
    translated.length,
    overlays.en.size + overlays.fr.size,
    "one translated row per overlay entry, and none from anywhere else",
  );
});

test("the corpus is Polish-only, and a stray translation in it is refused", async () => {
  const corpus = await readCorpus();
  // The `*Gloss` maps keep their shape — they mark the vernacular of a foreign original — but §8
  // settled that no locale but Polish is STORED here. A value smuggled back into one would be a
  // fact with two homes, and the reader would never learn which of them had gone stale.
  const glossed = corpus.find((/** @type {any} */ c) => c.inscriptioGloss);
  assert.ok(glossed, "the corpus should still have a gloss to test against");
  glossed.inscriptioGloss.en = "smuggled";
  assert.throws(() => extractAll(corpus), /concerts\.yaml holds a en value/u);
});

// --------------------------------------------------------------------------------------------- //
// Reversibility — §4's requirement that a key work in both directions                             //
// --------------------------------------------------------------------------------------------- //

test("every key resolves back to the exact string it was read from", async () => {
  const concerts = await readCorpus();
  const { segments, paths } = extractAll(concerts);
  const byConcert = new Map(concerts.map((/** @type {{id: string}} */ c) => [c.id, c]));

  for (const segment of segments) {
    if (segment.locale !== "pl") continue;
    const record = paths[segment.key];
    assert.ok(record, `${segment.key}: no path recorded`);

    let node = byConcert.get(segment.key.split(".")[1]);
    for (const step of record.pl) node = node?.[step];
    assert.equal(
      node,
      segment.value,
      `${segment.key}: path [${record.pl.join(", ")}] does not lead back to the emitted value`,
    );
  }
});

test("every overlay key addresses a field the corpus still holds", async () => {
  // The overlay is keyed by the desk's key and nothing binds the two files together, so a key that
  // left the corpus leaves a translation with nothing to translate. `extractAll` reports those
  // rather than deleting them: with positional keys (§6d), a key that vanished may be the same
  // sentence three lines further down.
  const { orphans } = extractAll(await readCorpus(), await readOverlays());
  assert.deepEqual(orphans, {}, "an overlay value whose key is no longer in concerts.yaml");
});

// --------------------------------------------------------------------------------------------- //
// Complete accounting                                                                             //
// --------------------------------------------------------------------------------------------- //

/**
 * Every leaf in the corpus, as a shape path: array indices collapse to `[]`, so `program[].note`
 * stands for all fifty-eight of them.
 *
 * @param {unknown} node
 * @param {string} prefix
 * @param {Set<string>} into
 */
function collectLeaves(node, prefix, into) {
  if (Array.isArray(node)) {
    for (const item of node) collectLeaves(item, `${prefix}[]`, into);
    return;
  }
  if (node !== null && typeof node === "object") {
    for (const [key, value] of Object.entries(node)) {
      collectLeaves(value, prefix ? `${prefix}.${key}` : key, into);
    }
    return;
  }
  into.add(prefix);
}

/**
 * The shape paths the contract claims.
 *
 * A locale map's `en`/`fr` siblings are deliberately NOT covered: since stage C3 the corpus holds
 * no translations, so a path ending in `.en` is a field nobody has accounted for — and the
 * accounting test below is then the mechanical guard that says so.
 */
function contractPaths() {
  /** @type {Set<string>} */
  const covered = new Set();

  for (const entry of CONCERT_CONTRACT) {
    if (entry.kind === "field") {
      covered.add(entry.path);
      continue;
    }
    for (const field of entry.fields ?? []) {
      covered.add(field.path === null ? `${entry.path}[]` : `${entry.path}[].${field.path}`);
    }
  }
  return covered;
}

test("every path in concerts.yaml is either copy or explicitly not copy", async () => {
  const concerts = await readCorpus();
  /** @type {Set<string>} */
  const present = new Set();
  for (const concert of concerts) collectLeaves(concert, "", present);

  const covered = contractPaths();
  const unaccounted = [...present].filter((p) => !covered.has(p) && !(p in NOT_COPY));
  assert.deepEqual(
    unaccounted,
    [],
    "a field in the corpus that nobody has decided about — add it to CONCERT_CONTRACT or to NOT_COPY, with the reason",
  );
});

test("no path is claimed as copy and as not-copy at once", async (t) => {
  const covered = contractPaths();
  const contradictions = Object.keys(NOT_COPY).filter((p) => covered.has(p));
  assert.deepEqual(contradictions, [], "a field cannot be both translatable and not");

  // The reverse direction — a table row for a path the corpus does not hold — is REPORTED and
  // not asserted, and the reason is that it cannot distinguish the two cases it would have to.
  // Most of these are optional fields that six concerts simply have not used yet (`spotify`, a
  // `chapterAlt`, an interlude with a named source), and declaring them ahead of the data is
  // right. Only the schema knows which of them has actually been removed, and the schema is a
  // zod object in `content.config.ts` rather than something this walk can read. Printed so the
  // list stays visible in the run.
  const concerts = await readCorpus();
  /** @type {Set<string>} */
  const present = new Set();
  for (const concert of concerts) collectLeaves(concert, "", present);

  const declaredButUnused = [...covered, ...Object.keys(NOT_COPY)]
    .filter((p) => !present.has(p))
    .sort();
  t.diagnostic(`declared but unused in this corpus: ${declaredButUnused.join(", ") || "none"}`);
});

// --------------------------------------------------------------------------------------------- //
// The second corpus — the static pages                                                            //
// --------------------------------------------------------------------------------------------- //

/**
 * The shape paths one page's contract claims. A page's lists are keyed by an explicit `id` (§6r)
 * rather than by position, but the SHAPE of a list field is the same `<list>[].<field>` the corpus
 * uses, so `collectLeaves` above serves both.
 *
 * @param {import("./extractPages.mjs").PageSpec} spec
 * @returns {Set<string>}
 */
function pageContractPaths(spec) {
  /** @type {Set<string>} */
  const covered = new Set();
  for (const entry of spec.contract) {
    if (entry.kind === "field") {
      covered.add(entry.path);
      continue;
    }
    for (const field of entry.fields) covered.add(`${entry.path}[].${field.path}`);
  }
  return covered;
}

/**
 * The paths in a page's parsed YAML that neither of its two tables names.
 *
 * @param {import("./extractPages.mjs").PageSpec} spec
 * @param {unknown} data
 * @returns {string[]}
 */
function unaccountedPaths(spec, data) {
  /** @type {Set<string>} */
  const present = new Set();
  collectLeaves(data, "", present);
  const covered = pageContractPaths(spec);
  return [...present].filter((p) => !covered.has(p) && !(p in spec.notCopy)).sort();
}

test("every path in a page's YAML is either copy or explicitly not copy", async () => {
  // The same accounting the corpus gets, and it is NOT made redundant by the page's zod schema.
  // `.strict()` refuses a field the schema does not know about; this refuses a field the schema
  // DOES know about that nobody has classified — a new line of prose that renders on the page and
  // is invisible to the desk, so no editor is ever offered it and no locale ever gets it.
  for (const spec of PAGE_SPECS) {
    assert.deepEqual(
      unaccountedPaths(spec, await readPage(spec)),
      [],
      `${pageSource(spec.id)}: a field nobody has decided about — add it to the page's contract or to its notCopy table, with the reason`,
    );
  }
});

test("the accounting names an unclassified field rather than passing over it", async () => {
  // The test above can only ever go green on a file somebody has already accounted for, so this is
  // what says it would go RED. Both shapes, because they reach `collectLeaves` differently: a plain
  // field arrives as its own path, a list field as one `[]` path standing for every entry.
  //
  // The page is named rather than taken by position: the doctored paths below are `kontakt`'s own
  // shape, so a registry that grew a page at the front would break this on a change that has
  // nothing to do with the accounting it is testing.
  const spec = PAGE_SPECS.find((s) => s.id === "kontakt");
  assert.ok(spec, "kontakt is the page this test doctors");
  const data = /** @type {any} */ (await readPage(spec));
  const doctored = structuredClone(data);
  doctored.coda.farewell = "Do zobaczenia.";
  doctored.channels.items[0].tagline = "Nowa linijka, której nikt nie sklasyfikował.";

  assert.deepEqual(unaccountedPaths(spec, doctored), ["channels.items[].tagline", "coda.farewell"]);
});

test("a page declares no path as copy and as not-copy at once, and keys its lists by a non-copy field", async (t) => {
  for (const spec of PAGE_SPECS) {
    const covered = pageContractPaths(spec);
    const contradictions = Object.keys(spec.notCopy).filter((p) => covered.has(p));
    assert.deepEqual(contradictions, [], `${spec.id}: a field cannot be both translatable and not`);

    // The rule `copySpec.ts` states in prose: a list's `keyBy` is its identity, and an identity an
    // editor is about to translate is not one. Nothing but this asserts it.
    for (const entry of spec.contract) {
      if (entry.kind !== "list") continue;
      const path = `${entry.path}[].${entry.keyBy}`;
      assert.ok(path in spec.notCopy, `${spec.id}: ${path} keys a list and is not declared not-copy`);
    }

    // Reported rather than asserted, for the reason the corpus's version gives: an OPTIONAL field
    // a page has not used yet is a legitimate declaration ahead of the data, and only the zod
    // schema knows which of these has actually been removed.
    /** @type {Set<string>} */
    const present = new Set();
    collectLeaves(await readPage(spec), "", present);
    const declaredButUnused = [...covered, ...Object.keys(spec.notCopy)]
      .filter((p) => !present.has(p))
      .sort();
    t.diagnostic(`${spec.id}: declared but unused: ${declaredButUnused.join(", ") || "none"}`);
  }
});

test("every page key resolves back to the exact string it was read from", async () => {
  for (const spec of PAGE_SPECS) {
    const data = await readPage(spec);
    const { segments, paths } = extractPage(spec, data);

    for (const segment of segments) {
      if (segment.locale !== "pl") continue;
      const record = paths[segment.key];
      assert.ok(record, `${segment.key}: no path recorded`);
      assert.equal(record.source, pageSource(spec.id), `${segment.key}: names the wrong file`);

      let node = /** @type {any} */ (data);
      for (const step of record.pl) node = node?.[step];
      assert.equal(
        node,
        segment.value,
        `${segment.key}: path [${record.pl.join(", ")}] does not lead back to the emitted value`,
      );
    }
  }
});

test("a page's keys are scoped to the page, carry the three locales, and take their kind from the field's name", async () => {
  const { segments } = await extractAllPages();
  const labels = new Map(PAGE_SPECS.map((spec) => [`page.${spec.id}`, spec.label]));
  /** @type {Map<string, string[]>} */
  const byKey = new Map();

  for (const segment of segments) {
    const scope = segment.key.split(".").slice(0, 2).join(".");
    assert.ok(labels.has(scope), `${segment.key}: scope ${scope} is not a registered page`);
    assert.equal(segment.scope_label, labels.get(scope), `${segment.key}: scope label`);
    // The whole markup contract in one line: the `…Html` suffix IS the kind, so a field cannot
    // render through `set:html` while the desk edits it as plain text, or the reverse.
    assert.equal(
      segment.kind,
      segment.key.endsWith("Html") ? "HTML" : "TEXT",
      `${segment.key}: kind does not follow the field's name`,
    );
    byKey.set(segment.key, [...(byKey.get(segment.key) ?? []), segment.locale]);
  }
  for (const [key, locales] of byKey) {
    assert.deepEqual([...locales].sort(), [...SITE_LOCALES].sort(), `${key}: locale set`);
  }

  // Without this the assertion above would also pass on a corpus with no markup in it at all —
  // and these are the rows §7's sanitizer exists for.
  assert.ok(
    segments.some((segment) => segment.kind === "HTML"),
    "the pages corpus should hold the HTML segments the concerts corpus never had",
  );
});

test("the two corpora share a key space and no key", async () => {
  // `lib/copyOverlay` refuses at module load a key that two overlays both translate; this is the
  // same rule one step earlier, where the key is minted rather than read.
  const concerts = extractAll(await readCorpus());
  const pages = await extractAllPages();
  const shared = Object.keys(pages.paths).filter((key) => key in concerts.paths);
  assert.deepEqual(shared, [], "a key both corpora claim would be one fact with two homes");
});

// --------------------------------------------------------------------------------------------- //
// Determinism                                                                                     //
// --------------------------------------------------------------------------------------------- //

test("two runs over unchanged corpora are byte-identical", async () => {
  assert.equal(
    JSON.stringify(extractAll(await readCorpus())),
    JSON.stringify(extractAll(await readCorpus())),
  );
  assert.equal(JSON.stringify(await extractAllPages()), JSON.stringify(await extractAllPages()));
});

// --------------------------------------------------------------------------------------------- //
// The write direction — the one operation that can destroy the corpus                             //
// --------------------------------------------------------------------------------------------- //

/**
 * Where each YAML style actually occurs, so the round trip is tested on the real file.
 *
 * @type {{at: (string|number)[], style: string, mutate: (value: string) => string}[]}
 */
const STYLE_SAMPLES = [
  { at: [0, "title"], style: "PLAIN", mutate: (v) => `${v} (poprawka)` },
  { at: [0, "essence"], style: "QUOTE_DOUBLE", mutate: (v) => v.replace("Próba", "Próba wejścia —") },
  { at: [0, "video", "caption"], style: "QUOTE_SINGLE", mutate: (v) => `${v} · zapis` },
  {
    at: [0, "prologue"],
    style: "BLOCK_FOLDED",
    mutate: (v) => `${v} Zdanie dopisane przez redakcję, dostatecznie długie, by wymusić ponowne złamanie wierszy.`,
  },
  { at: [0, "verbum", "text"], style: "BLOCK_LITERAL", mutate: (v) => v.replace("Dobry wieczór", "Dobry wieczór Państwu") },
];

/** @type {(tree: unknown, at: (string|number)[]) => string} */
const valueAt = (tree, at) =>
  at.reduce((node, step) => /** @type {any} */ (node)?.[step], /** @type {any} */ (tree));

test("a Polish scalar is replaced in place, in every style the corpus uses", async () => {
  const raw = await readRaw();
  const tree = YAML.parse(raw);
  const edits = STYLE_SAMPLES.map((sample) => ({
    path: sample.at,
    expected: valueAt(tree, sample.at),
    value: sample.mutate(valueAt(tree, sample.at)),
    label: sample.at.join("."),
  }));

  const { text, changes } = replaceScalars(raw, edits);

  // The style is kept: a diff that also reflows a paragraph hides the sentence that changed.
  assert.deepEqual(changes.map((c) => c.style), STYLE_SAMPLES.map((s) => s.style));

  const after = YAML.parse(text);
  for (const edit of edits) assert.equal(valueAt(after, edit.path), edit.value, edit.label);

  // What §7 is actually afraid of: the comments, and everything nobody asked to change.
  assert.deepEqual(commentLines(text), commentLines(raw), "comment lines");
  const before = collectScalars(tree);
  const now = collectScalars(after);
  const edited = new Set(edits.map((e) => e.path.join(" ")));
  assert.equal(now.size, before.size);
  for (const [at, value] of before) {
    if (!edited.has(at)) assert.equal(now.get(at), value, `${at} changed and nobody asked it to`);
  }

  // The file is CRLF on a Windows checkout and stays that way (§7).
  assert.equal(detectEol(raw), "\r\n");
  assert.equal(/(?<!\r)\n/u.test(text), false, "a bare LF was written into a CRLF file");
});

test("a replacement that would change a field's TYPE is quoted instead", async () => {
  // The trap a naive in-place write walks into: `facts: - 2024` is a number, and the schema that
  // rejects it does so three steps away from the file that caused it.
  const raw = await readRaw();
  const tree = YAML.parse(raw);
  const at = [0, "facts", 0];
  const { text } = replaceScalars(raw, [
    { path: at, expected: valueAt(tree, at), value: "2024", label: "fact" },
  ]);
  assert.equal(valueAt(YAML.parse(text), at), "2024");
  assert.match(text, /- "2024"/u);
});

test("the write refuses a pre-image it does not recognise", async () => {
  const raw = await readRaw();
  assert.throws(
    () => replaceScalars(raw, [{ path: [0, "title"], expected: "coś innego", value: "x", label: "t" }]),
    /does not hold the value the desk recorded/u,
  );
});

test("an empty value is refused rather than deleting a field", async () => {
  const raw = await readRaw();
  const tree = YAML.parse(raw);
  assert.throws(
    () => replaceScalars(raw, [
      { path: [0, "title"], expected: valueAt(tree, [0, "title"]), value: "", label: "t" },
    ]),
    /would delete the field/u,
  );
});

test("two edits addressing one scalar are refused", async () => {
  const raw = await readRaw();
  const tree = YAML.parse(raw);
  const expected = valueAt(tree, [0, "title"]);
  assert.throws(
    () => replaceScalars(raw, [
      { path: [0, "title"], expected, value: "A", label: "t" },
      { path: [0, "title"], expected, value: "B", label: "t" },
    ]),
    /two edits address one scalar/u,
  );
});

// --------------------------------------------------------------------------------------------- //
// The overlays                                                                                    //
// --------------------------------------------------------------------------------------------- //

test("an overlay round-trips every shape a translation can take", () => {
  const entries = new Map([
    ["concert.x.essence", "A single line with \"quotes\", a colon: and a # hash."],
    ["concert.x.verbum.text", "Two paragraphs.\n\nThe second one, with a trailing word."],
    ["concert.x.facts.0", "12"],
    ["concert.x.a", "Un français : avec espaces insécables !"],
  ]);
  const text = renderOverlay("en", entries, "\r\n");
  assert.deepEqual([...parseOverlay(text, "en").entries()], [...entries.entries()].sort());
});

// --------------------------------------------------------------------------------------------- //
// The apply plan — the patch turned into writes, with everything but the HTTP                     //
// --------------------------------------------------------------------------------------------- //

/**
 * @param {Partial<import("./apply.mjs").PatchRow>} row
 * @returns {import("./apply.mjs").PatchRow}
 */
const patchRow = (row) => ({
  id: "00000000-0000-0000-0000-000000000000",
  key: "concert.wcielenie.essence",
  locale: "pl",
  kind: "TEXT",
  value: "",
  base_value: "",
  source_hash: "",
  ...row,
});

test("a patch is planned into a Polish write, an overlay write, and a refusal", async () => {
  const raw = await readRaw();
  const corpus = YAML.parse(raw);
  const overlays = await readOverlays();
  const { paths } = extractAll(corpus, overlays);
  const index = new Map(corpus.map((/** @type {any} */ c, /** @type {number} */ i) => [c.id, i]));

  const key = "concert.wcielenie.essence";
  const at = [/** @type {number} */ (index.get("wcielenie")), ...paths[key].pl];
  const rows = [
    patchRow({ id: "a", key, locale: "pl", value: "Nowa esencja.", base_value: valueAt(corpus, at) }),
    // A translation written over what the overlay currently holds, sourced from the overlay so
    // the row cannot go stale again. It used to be a FIRST rendering against an empty column,
    // which stopped being reachable in this corpus when stage E filled all 428 keys in both
    // locales — an empty pre-image is now a stale one, and the plan refuses it.
    patchRow({
      id: "b",
      key,
      locale: "en",
      value: "A first English rendering.",
      base_value: overlays.en.get(key),
    }),
    // A translation of a value the overlay already holds.
    patchRow({
      id: "c",
      key: "concert.9-kart.title",
      locale: "en",
      value: "Nine Leaves of the Psalter",
      base_value: "Nine Leaves from the Book of Psalms",
    }),
    // A key retired from the site after its proposal was accepted: refused, never guessed at.
    patchRow({ id: "d", key: "concert.wcielenie.nosuchfield", locale: "pl", value: "x" }),
    // A Polish row written against a value the file no longer holds: the un-synced tree.
    patchRow({ id: "e", key: "concert.wcielenie.title", locale: "pl", value: "y", base_value: "stare" }),
  ];

  const { winners, superseded } = collapse(rows);
  assert.equal(superseded.length, 0);

  const planned = plan(winners, {
    paths,
    index,
    overlays: { concerts: overlays, pages: {} },
    documents: { [CONCERTS]: corpus },
  });
  assert.equal(planned.scalarEdits.length, 1, "one Polish edit");
  assert.equal(planned.overlayEdits.length, 2, "two translations");
  assert.equal(planned.problems.length, 2, "the retired key and the stale pre-image");
  assert.match(planned.problems[0], /has no such key/u);
  assert.match(planned.problems[1], /does not hold the value the desk recorded/u);
  // Nothing refused is stamped as applied: the file never received it.
  assert.deepEqual(planned.writable.map((row) => row.id), ["a", "b", "c"]);

  const { text } = replaceScalars(raw, planned.scalarEdits);
  assert.equal(valueAt(YAML.parse(text), at), "Nowa esencja.");
});

test("two accepted proposals for one segment collapse to the last decision", () => {
  const rows = [
    patchRow({ id: "first", value: "Wcześniejsza" }),
    patchRow({ id: "second", value: "Późniejsza" }),
    patchRow({ id: "other", locale: "en", value: "Later" }),
  ];
  const { winners, superseded } = collapse(rows);
  // The patch arrives oldest-decision-first, so the last row is what reaches the file — and the
  // one it superseded is still stamped, or it would be written over that value tomorrow.
  assert.deepEqual(winners.map((row) => row.id), ["second", "other"]);
  assert.deepEqual(superseded.map((row) => row.id), ["first"]);
});

test("an overlay is sorted and deterministic", () => {
  const entries = new Map([["concert.b.x", "B"], ["concert.a.x", "A"]]);
  const once = renderOverlay("fr", entries, "\r\n");
  const twice = renderOverlay("fr", new Map([...entries].reverse()), "\r\n");
  assert.equal(once, twice, "key order in the map must not reach the file");
  assert.ok(once.indexOf("concert.a.x") < once.indexOf("concert.b.x"));
});

// --------------------------------------------------------------------------------------------- //
// The write direction over the SECOND corpus — the branch a page's row takes                      //
// --------------------------------------------------------------------------------------------- //

test("a page's Polish goes to the page's own file, and its translation to the pages overlay", async () => {
  // The defect this closes: before it, `plan` built its paths from the concerts extractor alone, so
  // a `page.` row was refused with "the corpus has no such key" — a true sentence about the wrong
  // corpus, which would have sent a reviewer to restore a field that never left.
  // Named rather than taken by position: the registry is a reading order for the desk, and the
  // page added at the front of it turned both of these tests red for addressing a field it has
  // not got. The test means THIS page.
  const spec = PAGE_SPECS.find((s) => s.id === "o-nas");
  const source = pageSource(spec.id);
  const raw = await readFile(new URL(`../${source}`, import.meta.url), "utf8");
  const data = await readPage(spec);
  const { paths } = extractPage(spec, data);

  const key = `page.${spec.id}.hero.lede`;
  const at = paths[key].pl;
  const rows = [
    patchRow({ id: "pl", key, locale: "pl", value: "Nowe zaproszenie.", base_value: valueAt(data, at) }),
    patchRow({ id: "en", key, locale: "en", value: "A new invitation.", base_value: "" }),
  ];

  const planned = plan(rows, {
    paths,
    index: new Map(),
    overlays: { concerts: {}, pages: {} },
    documents: { [source]: data },
  });

  assert.deepEqual(planned.problems, []);
  assert.equal(planned.scalarEdits.length, 1);
  assert.equal(planned.scalarEdits[0].source, source, "a page's Polish must never reach concerts.yaml");
  assert.deepEqual(planned.overlayEdits.map((edit) => edit.corpus), ["pages"]);

  // And the write itself is the same splice the corpus gets, over a much smaller file.
  const { text } = replaceScalars(raw, planned.scalarEdits);
  assert.equal(valueAt(YAML.parse(text), at), "Nowe zaproszenie.");
});

test("a path record that contradicts its key's namespace is refused, not written to the other corpus", async () => {
  // `paths` tells the corpora apart by SHAPE and the key tells them apart by NAMESPACE. They agree
  // by construction, which is why the disagreement is worth catching: a `segments.json` older than
  // this stage carries page records with no `source`, and guessing would splice a paragraph into
  // whichever file happened to have something at that path.
  // Named rather than taken by position: the registry is a reading order for the desk, and the
  // page added at the front of it turned both of these tests red for addressing a field it has
  // not got. The test means THIS page.
  const spec = PAGE_SPECS.find((s) => s.id === "o-nas");
  const source = pageSource(spec.id);
  const data = await readPage(spec);
  const { paths } = extractPage(spec, data);
  const key = `page.${spec.id}.hero.lede`;

  const stripped = { ...paths, [key]: { pl: paths[key].pl } };
  const planned = plan(
    [patchRow({ key, locale: "pl", value: "x", base_value: valueAt(data, paths[key].pl) })],
    { paths: stripped, index: new Map(), overlays: { concerts: {}, pages: {} }, documents: { [source]: data } },
  );

  assert.equal(planned.scalarEdits.length, 0);
  assert.deepEqual(planned.writable, []);
  assert.match(planned.problems[0], /names no file/u);
});

test("each corpus's overlay header names its own Polish source", () => {
  // The four overlays are the same shape and are written by the same run, so the header is the only
  // thing that tells them apart — and it is what an emergency edit reads before touching a file.
  const pages = renderOverlay("en", new Map([["page.kontakt.hero.lede", "A line."]]), "\n", "pages");
  const concerts = renderOverlay("en", new Map([["concert.x.essence", "A line."]]), "\n", "concerts");

  assert.match(pages, /^# pages\.en\.yaml — the EN overlay over .*src\/content\/pages\/\./u);
  assert.match(concerts, /^# concerts\.en\.yaml — the EN overlay over src\/content\/concerts\.yaml\./u);
  assert.ok(
    !pages.includes("concerts.yaml"),
    "a pages overlay must not send an emergency edit to the concert corpus",
  );
  assert.throws(
    () => renderOverlay("en", new Map(), "\n", "koncerty"),
    /not a corpus this desk overlays/u,
  );

  // The one thing a French overlay has to say that an English one does not (§7): `lib/typo.ts`
  // inserts the narrow no-break spaces at build, so a hand-typed hard space doubles up.
  assert.match(renderOverlay("fr", new Map(), "\n", "pages"), /narrow no-break/u);
  assert.doesNotMatch(pages, /narrow no-break/u);
});
