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
 *  - **Complete accounting.** Every path in the YAML is either copy or explicitly not copy. A new
 *    field cannot enter the corpus without somebody deciding which — the trap §7 records as
 *    "a key named `pl` under a foreign original".
 *  - **Determinism.** Two runs over an unchanged corpus are byte-identical, so a diff of the
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
import { CONCERT_CONTRACT, NOT_COPY, SITE_LOCALES } from "./contract.mjs";
import { extractAll } from "./extract.mjs";
import { normalizeForHash, sourceHash } from "./normalize.mjs";
import { OVERLAY_LOCALES, parseOverlay, renderOverlay } from "./overlay.mjs";
import { collectScalars, commentLines, detectEol, replaceScalars } from "./yamlEdit.mjs";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const CORPUS = new URL("../src/content/concerts.yaml", import.meta.url);
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
// Determinism                                                                                     //
// --------------------------------------------------------------------------------------------- //

test("two runs over an unchanged corpus are byte-identical", async () => {
  const first = extractAll(await readCorpus());
  const second = extractAll(await readCorpus());
  assert.equal(JSON.stringify(first), JSON.stringify(second));
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

  const planned = plan(winners, { paths, index, overlays, corpus });
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
