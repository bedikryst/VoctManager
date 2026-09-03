// @ts-check
/**
 * @file apply.mjs
 * @description `npm run copy:apply` — the write direction. Everything a reviewer has accepted and
 *  not yet committed is fetched from `GET /api/copydesk/proposals/patch/`, written into the
 *  repository, and reported back through `POST /api/copydesk/proposals/applied/`, which stamps
 *  `applied_at` and carries each proposal's provenance onto its segment. Then it is an ordinary
 *  `git diff`: nothing here commits, and nothing reaches a reader without passing through one.
 *
 *  DRY RUN IS THE DEFAULT. `--write` is the flag that touches the disk, because the thing being
 *  written is a hand-made file whose comments are half its value and whose prose nobody can
 *  reconstruct from the database.
 *
 *  TWO KINDS OF DESTINATION, AND ONLY ONE OF THEM IS DANGEROUS. Polish goes into a hand-written
 *  Polish corpus — `concerts.yaml` for an evening, `content/pages/<page>.yaml` for a static page —
 *  through `yamlEdit.mjs`, which replaces a scalar in place and proves four things about the result
 *  before a byte is written (see that file). English and French go into the overlays, which are
 *  machine written, carry no comments, and are rewritten whole. That asymmetry is the whole point of
 *  §8's overlay decision: the operation that could destroy a corpus never has to insert a key.
 *
 *  THE KEY'S NAMESPACE SAYS WHICH CORPUS, and `paths` says where inside it. The two records have
 *  different shapes on purpose (`index.mjs`): a page's names the file it lives in, a concert's is a
 *  location inside `concerts.yaml` that still wants its concert's index in front of it. Both are
 *  checked against the namespace rather than trusted, because the silent version of that
 *  disagreement is a page's prose spliced into the concerts corpus.
 *
 *  WHAT A ROW HAS TO PROVE BEFORE IT IS WRITTEN. Its `base_value` — the value the desk believes the
 *  repository currently holds — must be exactly what the file holds. A mismatch means the tree and
 *  the mirror disagree: somebody hand-edited the corpus, or the last `copy:sync` predates it. The
 *  run stops rather than overwrite an edit nobody proposed.
 *
 *  AND AFTER WRITING, the files are read back FROM DISK and checked again — every edited value
 *  where it should be, every untouched field byte-identical, the comment count unchanged. A write
 *  that fails that check is rolled back to the bytes it started from, every file of it.
 * @architecture Astro islands 2026
 * @module copydesk/apply
 */

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import YAML from "yaml";

import { apiBase, authenticate, credentials, getJson, postJson } from "./client.mjs";
import { extractAll } from "./extract.mjs";
import { extractAllPages, PAGE_SPECS, pageSource, readPage } from "./extractPages.mjs";
import { mergePaths, readConcerts } from "./index.mjs";
import { OVERLAY_LOCALES, overlaySource, readOverlay, writeOverlay } from "./overlay.mjs";
import { CONTENT_DIR, describeTree } from "./tree.mjs";
import { collectScalars, commentLines, detectEol, replaceScalars } from "./yamlEdit.mjs";

const WEB_ROOT = fileURLToPath(new URL("..", import.meta.url));
const CONCERTS = "src/content/concerts.yaml";

/** Which corpus a key belongs to, from the namespace it opens with. */
const CORPUS_OF_NAMESPACE = /** @type {Record<string, string>} */ ({
  concert: "concerts",
  page: "pages",
});

/** How much of a value a report line shows before it stops being readable. */
const PREVIEW = 90;

/** @param {string} value */
const preview = (value) =>
  JSON.stringify(value.length > PREVIEW ? `${value.slice(0, PREVIEW)}…` : value);

/**
 * @param {unknown} tree
 * @param {readonly (string|number)[]} at
 * @returns {unknown}
 */
const valueAt = (tree, at) =>
  at.reduce((node, step) => /** @type {any} */ (node)?.[step], /** @type {any} */ (tree));

/**
 * @typedef {object} PatchRow
 * @property {string} id
 * @property {string} key
 * @property {string} locale
 * @property {string} kind
 * @property {string} value
 * @property {string} base_value
 * @property {string} source_hash
 */

/**
 * Reduce the patch to one row per key+locale, keeping the last decision.
 *
 * Two accepted proposals can compete for one segment — §6b keeps both on purpose, so that a
 * reviewer's choice between two editors is never made silently. The patch arrives
 * oldest-decision-first, so the last row wins, and BOTH are reported as applied: the earlier one
 * was decided and superseded, and leaving it unstamped would put it back in tomorrow's patch to be
 * written over the value that replaced it.
 *
 * @param {PatchRow[]} rows
 * @returns {{winners: PatchRow[], superseded: PatchRow[]}}
 */
export function collapse(rows) {
  /** @type {Map<string, PatchRow>} */
  const winners = new Map();
  /** @type {PatchRow[]} */
  const superseded = [];
  for (const row of rows) {
    const at = `${row.key} ${row.locale}`;
    const standing = winners.get(at);
    if (standing) superseded.push(standing);
    winners.set(at, row);
  }
  return { winners: [...winners.values()], superseded };
}

/**
 * @typedef {object} PlanState
 * @property {Record<string, any>} paths Both corpora's path records, merged by `mergePaths`.
 * @property {Map<string, number>} index Concert id → its position in `concerts.yaml`.
 * @property {Record<string, Record<string, Map<string, string>>>} overlays corpus → locale → overlay.
 * @property {Record<string, unknown>} documents Polish source (relative to `web/`) → its parsed tree.
 */

/**
 * Which file a Polish row is written into, and where inside it — or the reason it cannot be.
 *
 * The two path-record shapes are checked against the key's namespace rather than sniffed, because
 * the failure mode of guessing is silent and expensive: a page's paragraph spliced into a concert,
 * or a concert's title written to a file that has no such path and so refuses the whole run.
 *
 * @param {PatchRow} row
 * @param {string} corpus
 * @param {any} record
 * @param {Map<string, number>} index
 * @returns {{source: string, at: (string|number)[]} | {problem: string}}
 */
function locate(row, corpus, record, index) {
  const namesAFile = typeof record.source === "string";
  if (corpus === "pages") {
    if (!namesAFile) {
      return {
        problem:
          `${row.key}: a page key whose path record names no file. The extractor and the writer ` +
          "disagree about which corpus this key belongs to; re-run `npm run copy:extract`.",
      };
    }
    return { source: record.source, at: [...record.pl] };
  }
  if (namesAFile) {
    return {
      problem:
        `${row.key}: a concert key whose path record names ${record.source}. The extractor and ` +
        "the writer disagree about which corpus this key belongs to; re-run `npm run copy:extract`.",
    };
  }
  const concert = index.get(row.key.split(".")[1]);
  if (concert === undefined) {
    return { problem: `${row.key}: names a concert that is not in the corpus.` };
  }
  return { source: CONCERTS, at: [concert, ...record.pl] };
}

/**
 * Sort the patch into what each destination has to do, refusing nothing quietly.
 *
 * @param {PatchRow[]} rows
 * @param {PlanState} state
 */
export function plan(rows, state) {
  /** @type {{source: string, path: (string|number)[], expected: string, value: string, label: string}[]} */
  const scalarEdits = [];
  /** @type {{corpus: string, locale: string, key: string, value: string, before: string}[]} */
  const overlayEdits = [];
  /** @type {PatchRow[]} */
  const unchanged = [];
  /** @type {string[]} */
  const problems = [];
  /** @type {PatchRow[]} */
  const writable = [];

  for (const row of rows) {
    const namespace = row.key.split(".")[0];
    const corpus = CORPUS_OF_NAMESPACE[namespace];
    if (corpus === undefined) {
      problems.push(
        `${row.key} [${row.locale}]: \`${namespace}\` is not a corpus this repository holds. ` +
          "Nothing can be written for it; reject the proposal.",
      );
      continue;
    }

    const record = state.paths[row.key];
    if (!record) {
      problems.push(
        `${row.key} [${row.locale}]: the ${corpus} corpus has no such key. It was retired from ` +
          "the site after this proposal was accepted; reject the proposal or restore the field.",
      );
      continue;
    }

    if (row.locale === "pl") {
      const placed = locate(row, corpus, record, state.index);
      if ("problem" in placed) {
        problems.push(placed.problem);
        continue;
      }
      const inFile = valueAt(state.documents[placed.source], placed.at);
      if (inFile !== row.base_value) {
        problems.push(
          `${row.key}: ${placed.source} does not hold the value the desk recorded.\n` +
            `      in the file: ${preview(String(inFile))}\n` +
            `      on the desk: ${preview(row.base_value)}`,
        );
        continue;
      }
      writable.push(row);
      if (row.value === row.base_value) {
        unchanged.push(row);
        continue;
      }
      scalarEdits.push({
        source: placed.source,
        path: placed.at,
        expected: row.base_value,
        value: row.value,
        label: row.key,
      });
      continue;
    }

    const before = state.overlays[corpus]?.[row.locale]?.get(row.key) ?? "";
    if (before !== row.base_value) {
      problems.push(
        `${row.key} [${row.locale}]: ${overlaySource(row.locale, corpus)} does not hold the value ` +
          `the desk recorded.\n      in the file: ${preview(before)}\n      on the desk: ${preview(row.base_value)}`,
      );
      continue;
    }
    writable.push(row);
    if (row.value === before) {
      unchanged.push(row);
      continue;
    }
    overlayEdits.push({ corpus, locale: row.locale, key: row.key, value: row.value, before });
  }

  return { scalarEdits, overlayEdits, unchanged, problems, writable };
}

/**
 * Read every file this run touched back FROM DISK and prove the write did what it said.
 *
 * The in-memory proofs in `yamlEdit.mjs` run before a file is opened; this one runs after it is
 * closed, and it is the one that would catch a truncated write, a mangled encoding, or a stray
 * serializer having been let anywhere near the file.
 *
 * @param {{raws: Record<string, string>, rewrites: Record<string, {text: string, changes: unknown[]}>, expectedOverlays: Record<string, Record<string, Map<string, string>>>}} promised
 */
async function verifyOnDisk({ raws, rewrites, expectedOverlays }) {
  for (const [source, rewrite] of Object.entries(rewrites)) {
    if (!rewrite.changes.length) continue;

    const written = await readFile(path.join(WEB_ROOT, source), "utf8");
    if (written !== rewrite.text) {
      throw new Error(`[copydesk] ${source} on disk is not what was written.`);
    }

    const before = commentLines(raws[source]);
    const after = commentLines(written);
    if (
      before.length !== after.length ||
      before.some((/** @type {string} */ line, /** @type {number} */ i) => line !== after[i])
    ) {
      throw new Error(
        `[copydesk] ${source}: comment lines went from ${before.length} to ${after.length}.`,
      );
    }

    const leavesBefore = collectScalars(YAML.parse(raws[source]));
    const leavesAfter = collectScalars(YAML.parse(written));
    if (leavesBefore.size !== leavesAfter.size) {
      throw new Error(`[copydesk] ${source}: the number of fields changed.`);
    }
  }

  for (const [corpus, byLocale] of Object.entries(expectedOverlays)) {
    for (const [locale, expected] of Object.entries(byLocale)) {
      const source = overlaySource(locale, corpus);
      const readBack = await readOverlay(locale, { corpus });
      if (readBack.size !== expected.size) {
        throw new Error(`[copydesk] ${source}: ${readBack.size} values, expected ${expected.size}.`);
      }
      for (const [key, value] of expected) {
        if (readBack.get(key) !== value) {
          throw new Error(`[copydesk] ${source}: ${key} is not what was written.`);
        }
      }
    }
  }
}

async function main() {
  const argv = process.argv.slice(2);
  const write = argv.includes("--write");
  const post = !argv.includes("--no-post");

  const base = apiBase();
  const account = credentials();
  if (account === null) {
    process.exitCode = 1;
    return;
  }
  const token = await authenticate(base, account);
  const { proposals } = await getJson(`${base}/api/copydesk/proposals/patch/`, token);

  if (!proposals.length) {
    console.log("[copydesk] nothing accepted is waiting to be written.");
    return;
  }

  // Every Polish file the writer may touch, as the exact bytes on disk and as a tree to read the
  // pre-image out of. Read once, up front: the pre-image check is only worth something if every
  // row of the patch is measured against the same snapshot of the repository.
  /** @type {Record<string, string>} */
  const raws = { [CONCERTS]: await readFile(path.join(WEB_ROOT, CONCERTS), "utf8") };
  /** @type {Record<string, unknown>} */
  const documents = { [CONCERTS]: await readConcerts() };
  for (const spec of PAGE_SPECS) {
    const source = pageSource(spec.id);
    raws[source] = await readFile(path.join(WEB_ROOT, source), "utf8");
    documents[source] = await readPage(spec);
  }
  const eol = detectEol(raws[CONCERTS]);

  /** @type {Record<string, Record<string, Map<string, string>>>} */
  const overlays = { concerts: {}, pages: {} };
  for (const locale of OVERLAY_LOCALES) {
    overlays.concerts[locale] = await readOverlay(locale, { corpus: "concerts" });
    overlays.pages[locale] = await readOverlay(locale, { corpus: "pages" });
  }

  const concerts = extractAll(
    /** @type {Record<string, unknown>[]} */ (documents[CONCERTS]),
    overlays.concerts,
  );
  const pages = await extractAllPages(overlays.pages);
  const paths = mergePaths(concerts.paths, pages.paths);
  const index = new Map(
    /** @type {any[]} */ (documents[CONCERTS]).map((concert, i) => [concert.id, i]),
  );

  const { winners, superseded } = collapse(proposals);
  const { scalarEdits, overlayEdits, unchanged, problems, writable } = plan(winners, {
    paths,
    index,
    overlays,
    documents,
  });

  // Every Polish rewrite is planned in full — and proved in full — before anything is written, so a
  // single unrenderable value stops the run rather than leaving half a patch in one of the files.
  /** @type {Record<string, {text: string, changes: any[]}>} */
  const rewrites = {};
  for (const source of Object.keys(raws)) {
    const edits = scalarEdits.filter((edit) => edit.source === source);
    rewrites[source] = edits.length
      ? replaceScalars(raws[source], edits)
      : { text: raws[source], changes: [] };
  }
  const changes = Object.values(rewrites).flatMap((rewrite) => rewrite.changes);

  console.log(
    `[copydesk] patch: ${proposals.length} accepted proposal(s) → ` +
      `${changes.length} Polish edit(s), ${overlayEdits.length} translation(s), ` +
      `${unchanged.length} already in the file, ${problems.length} refused`,
  );
  const styleOf = new Map(changes.map((change) => [change.label, change.style]));
  for (const edit of scalarEdits) {
    console.log(`  pl  ${edit.label} [${styleOf.get(edit.label)}] → ${edit.source}`);
    console.log(`      − ${preview(edit.expected)}`);
    console.log(`      + ${preview(edit.value)}`);
  }
  for (const edit of overlayEdits) {
    console.log(`  ${edit.locale}  ${edit.key} → ${overlaySource(edit.locale, edit.corpus)}`);
    if (edit.before) console.log(`      − ${preview(edit.before)}`);
    console.log(`      + ${preview(edit.value)}`);
  }
  // A superseded row is stamped only where the row that superseded it was actually written: if the
  // winner was refused, nothing about that segment reached the repository and neither of them has
  // anything to report.
  const written = new Set(writable.map((row) => `${row.key} ${row.locale}`));
  const stampedSuperseded = superseded.filter((row) => written.has(`${row.key} ${row.locale}`));
  for (const row of stampedSuperseded) {
    console.log(`  ·   ${row.key} [${row.locale}]: superseded by a later decision; stamped anyway.`);
  }
  for (const problem of problems) console.warn(`[copydesk] REFUSED ${problem}`);
  for (const [corpus, orphans] of [["concerts", concerts.orphans], ["pages", pages.orphans]]) {
    for (const [locale, keys] of Object.entries(/** @type {Record<string, string[]>} */ (orphans))) {
      console.warn(
        `[copydesk] ${overlaySource(locale, String(corpus))} holds ${keys.length} value(s) for ` +
          `keys the corpus no longer has: ${keys.join(", ")}`,
      );
    }
  }

  // A refused row is a patch that did not fully land, and the exit code says so: the reviewer has
  // to either restore the field or reject the proposal, and a green run would hide that.
  if (problems.length) process.exitCode = 1;

  // Warned about rather than refused (unlike `copy:sync`): the fields this run writes are already
  // protected by the pre-image check, and what a dirty tree costs here is the review — the patch
  // arrives in a diff with somebody's unfinished work mixed into it.
  if (describeTree().dirty) {
    console.warn(
      `[copydesk] ${CONTENT_DIR} has uncommitted changes: the diff you are about to read will ` +
        "hold more than this patch.",
    );
  }

  if (!write) {
    console.log("[copydesk] dry run — nothing written and nothing stamped. Pass --write.");
    return;
  }
  if (!changes.length && !overlayEdits.length && !unchanged.length) {
    console.log("[copydesk] nothing left to write.");
    return;
  }

  /** @type {Record<string, Record<string, Map<string, string>>>} */
  const nextOverlays = {};
  for (const edit of overlayEdits) {
    const byLocale = nextOverlays[edit.corpus] ?? {};
    const entries = byLocale[edit.locale] ?? new Map(overlays[edit.corpus][edit.locale]);
    entries.set(edit.key, edit.value);
    byLocale[edit.locale] = entries;
    nextOverlays[edit.corpus] = byLocale;
  }

  const rewritten = Object.keys(rewrites).filter((source) => rewrites[source].changes.length);
  for (const source of rewritten) {
    await writeFile(path.join(WEB_ROOT, source), rewrites[source].text, "utf8");
  }
  for (const [corpus, byLocale] of Object.entries(nextOverlays)) {
    for (const [locale, entries] of Object.entries(byLocale)) {
      await writeOverlay(locale, entries, { eol, corpus });
    }
  }

  try {
    await verifyOnDisk({ raws, rewrites, expectedOverlays: nextOverlays });
  } catch (error) {
    // Put every Polish corpus back the way it was. The overlays are regenerated from the desk on
    // the next run, so the hand-written files are the only ones worth restoring.
    for (const source of rewritten) {
      await writeFile(path.join(WEB_ROOT, source), raws[source], "utf8");
    }
    console.error(`[copydesk] ${rewritten.join(", ")} restored — the write did not verify.`);
    throw error;
  }

  const touched = [
    ...rewritten,
    ...Object.entries(nextOverlays).flatMap(([corpus, byLocale]) =>
      Object.keys(byLocale).map((locale) => overlaySource(locale, corpus)),
    ),
  ];
  console.log(`[copydesk] wrote ${touched.join(", ") || "nothing"} — verified on disk.`);

  if (!post) {
    console.log(
      "[copydesk] --no-post: the files are written but the desk still lists these as unapplied.\n" +
        "[copydesk] Re-run without the flag to stamp them; re-posting an applied batch is a skip, not an error.",
    );
    return;
  }
  const stamped = await postJson(`${base}/api/copydesk/proposals/applied/`, token, {
    proposal_ids: [...writable.map((row) => row.id), ...stampedSuperseded.map((row) => row.id)],
  });
  console.log(`[copydesk] stamped ${stamped.applied} applied, ${stamped.skipped.length} skipped.`);
  console.log("[copydesk] Now read the diff, then commit. Nothing is deployed by this script.");
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  await main();
}
