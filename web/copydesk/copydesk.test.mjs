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

import { CONCERT_CONTRACT, NOT_COPY, SITE_LOCALES } from "./contract.mjs";
import { extractAll } from "./extract.mjs";
import { normalizeForHash, sourceHash } from "./normalize.mjs";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const CORPUS = new URL("../src/content/concerts.yaml", import.meta.url);

const readCorpus = async () => YAML.parse(await readFile(CORPUS, "utf8"));

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
  const { segments } = extractAll(await readCorpus());
  for (const segment of segments) {
    if (segment.locale === "pl") {
      assert.ok(segment.value.length > 0, `${segment.key}: a Polish segment with no value`);
    }
  }
  // Today only the legacy `about` block holds translations; every other en/fr row is the empty
  // column the desk offers for editing. If this number moves without stage C3 having run, the
  // extractor has started reading a translation from somewhere it should not.
  const translated = segments.filter((s) => s.locale !== "pl" && s.value.length > 0);
  assert.equal(translated.length, 28, "the 28 values in the about.en / about.fr blocks");
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

test("a seeded translation points at the slot it came from", async () => {
  const concerts = await readCorpus();
  const { segments, paths } = extractAll(concerts);
  const byConcert = new Map(concerts.map((/** @type {{id: string}} */ c) => [c.id, c]));

  for (const segment of segments) {
    if (segment.locale === "pl" || segment.value.length === 0) continue;
    const at = paths[segment.key]?.seeded?.[segment.locale];
    assert.ok(at, `${segment.key} [${segment.locale}]: a value with no source path`);

    let node = byConcert.get(segment.key.split(".")[1]);
    for (const step of at) node = node?.[step];
    assert.equal(node, segment.value, `${segment.key} [${segment.locale}]: path does not lead back`);
  }
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

/** The shape paths the contract claims, including a locale map's `en`/`fr` siblings. */
function contractPaths() {
  /** @type {Set<string>} */
  const covered = new Set();
  /** @param {string} path @param {"plain"|"map"|undefined} shape */
  const add = (path, shape) => {
    covered.add(path);
    if (shape === "map") {
      const stem = path.slice(0, -".pl".length);
      covered.add(`${stem}.en`);
      covered.add(`${stem}.fr`);
    }
  };

  for (const entry of CONCERT_CONTRACT) {
    if (entry.kind === "field") {
      add(entry.path, entry.shape);
      if (entry.seed) for (const path of Object.values(entry.seed)) covered.add(path);
      continue;
    }
    for (const field of entry.fields ?? []) {
      add(field.path === null ? `${entry.path}[]` : `${entry.path}[].${field.path}`, field.shape);
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
    .filter((p) => !present.has(p) && !p.endsWith(".en") && !p.endsWith(".fr"))
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
