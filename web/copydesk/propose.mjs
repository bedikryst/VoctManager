// @ts-check
/**
 * @file propose.mjs
 * @description `npm run copy:propose` — carries a locale's finished translation drafts into the
 *  desk as proposals, and accepts them, so that `copy:apply` can write them into the overlays.
 *
 *  WHY THIS EXISTS AT ALL, since the drafts could simply be typed into `concerts.en.yaml`.
 *  `CopySegment.source_hash` — the Polish a published translation renders, and the only thing the
 *  stale state is computed from — has exactly one door: `mark_applied`, reached through an
 *  ACCEPTED proposal. `upsert_segments` refuses to write that column by design (the extractor
 *  knows nothing about provenance) and a test enforces the refusal. So a hand-written overlay
 *  leaves every translated row reporting "provenance unknown" for ever: the editor edits the
 *  Polish, and nothing on the desk ever says which translations his edit invalidated. Going
 *  through a proposal is not ceremony — it is the only way the corpus gets a provenance at all.
 *
 *  WHAT IT IS NOT. Accepting here is the developer accepting their own draft, and it is not a
 *  review: the review is the `git diff` on two machine-written overlay files, which is where
 *  every value still has to pass before it reaches a reader. Proposals are posted as DRAFT rather
 *  than PROPOSED so the sitting digest — which reports PROPOSED only — does not mail the author
 *  a summary of their own import.
 *
 *  THE GUARD THAT MATTERS is not the clean tree; it is that the desk's Polish equals this
 *  checkout's Polish. The hash stamped at apply time asserts "this translation renders that
 *  Polish", and a mirror older than the corpus would make that assertion false while looking
 *  perfectly healthy. A drift stops the run and names the key.
 * @architecture Astro islands 2026
 * @module copydesk/propose
 */

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { apiBase, authenticate, credentials, getJson, postJson } from "./client.mjs";
import { extractAll } from "./extract.mjs";
import { readConcerts } from "./index.mjs";
import { OVERLAY_LOCALES, parseOverlay, readOverlay } from "./overlay.mjs";

const WEB_ROOT = fileURLToPath(new URL("..", import.meta.url));
const DRAFT_DIR = "copydesk/drafts";

/**
 * Every draft file for one locale, merged. The split into one file per page is the translator's
 * unit of work and nothing else — a key belongs to exactly one page, so a key in two files is a
 * copy-paste, not a decision, and it stops the run rather than letting file order pick a winner.
 *
 * @param {string} locale
 * @returns {Promise<Map<string, {value: string, source: string}>>}
 */
async function readDrafts(locale) {
  const dir = path.join(WEB_ROOT, DRAFT_DIR, locale);
  /** @type {string[]} */
  let files;
  try {
    files = (await readdir(dir)).filter((name) => name.endsWith(".yaml")).sort();
  } catch (error) {
    if (/** @type {NodeJS.ErrnoException} */ (error).code === "ENOENT") {
      throw new Error(`[copydesk] no drafts at ${DRAFT_DIR}/${locale}/.`);
    }
    throw error;
  }

  /** @type {Map<string, {value: string, source: string}>} */
  const drafts = new Map();
  for (const name of files) {
    const source = `${DRAFT_DIR}/${locale}/${name}`;
    const entries = parseOverlay(await readFile(path.join(dir, name), "utf8"), locale);
    for (const [key, value] of entries) {
      const seen = drafts.get(key);
      if (seen) {
        throw new Error(`[copydesk] ${key} appears in both ${seen.source} and ${source}.`);
      }
      drafts.set(key, { value, source });
    }
  }
  return drafts;
}

/**
 * The corpus as the desk should currently see it: the Polish of every translatable key, and the
 * value the repository already holds for this locale.
 *
 * @param {string} locale
 */
async function readCorpus(locale) {
  /** @type {Record<string, Map<string, string>>} */
  const overlays = {};
  for (const other of OVERLAY_LOCALES) overlays[other] = await readOverlay(other);
  const concerts = await readConcerts();
  const { segments } = extractAll(concerts, overlays);

  /** @type {Map<string, string>} */
  const polish = new Map();
  /** @type {Map<string, string>} */
  const existing = new Map();
  for (const row of segments) {
    if (row.locale === "pl") polish.set(row.key, row.value);
    else if (row.locale === locale) existing.set(row.key, row.value);
  }
  return { concerts, polish, existing };
}

/** The page a key belongs to — the first two parts, exactly as `scope_from_key` reads it. */
const scopeOf = (/** @type {string} */ key) => key.split(".").slice(0, 2).join(".");

/**
 * A draft value of exactly this stands for "the gloss IS the sung text": the original is already
 * in the reader's language, so the slot holds it verbatim.
 *
 * Thirteen of this corpus's sung texts are English and one is Polish, and their slots are filled
 * anyway — an empty one falls back to Polish and would print a Polish stanza under an English
 * original, and the apply script refuses an empty value outright. Copying a stanza by hand into a
 * second field is how a transcription error enters a text nobody proofreads twice, so the sentinel
 * is resolved from the corpus instead. The page then declines to print the pair (`glossFor`).
 */
const SAME_AS_ORIGINAL = "= original";

/** The sung original a gloss key belongs to: `…textGloss` → `text`, `…claspTextGloss` → `claspText`. */
const ORIGINAL_OF = /** @type {const} */ ({
  textGloss: "text",
  claspTextGloss: "claspText",
});

/**
 * Replace every `= original` sentinel with the text it stands for, reading the corpus.
 *
 * @param {Map<string, {value: string, source: string}>} drafts
 * @param {any[]} concerts
 * @returns {string[]} the keys resolved, for the report
 */
function resolveOriginals(drafts, concerts) {
  /** @type {string[]} */
  const resolved = [];
  for (const [key, draft] of drafts) {
    if (draft.value.trim() !== SAME_AS_ORIGINAL) continue;

    const parts = key.split(".");
    const field = /** @type {keyof typeof ORIGINAL_OF} */ (parts.at(-1));
    const original = ORIGINAL_OF[field];
    const index = Number(parts.at(-2));
    const concert = concerts.find((entry) => entry.id === parts[1]);
    const work = original && Number.isInteger(index) ? concert?.program?.[index] : undefined;

    if (typeof work?.[original] !== "string") {
      throw new Error(
        `[copydesk] ${key} (${draft.source}): "${SAME_AS_ORIGINAL}" needs a sung original to ` +
          "stand for, and the corpus has none at that path.",
      );
    }
    drafts.set(key, { value: work[original], source: draft.source });
    resolved.push(key);
  }
  return resolved;
}

/**
 * What the run would do, with every reason it must not do it.
 *
 * Coverage is reported per page rather than as one number because that is the unit the translation
 * is written in: "wolanie-gor: 84 of 84" is a finished page, and 83 of 84 is a line somebody
 * skipped, which a corpus-wide percentage would hide.
 *
 * @param {Map<string, {value: string, source: string}>} drafts
 * @param {{polish: Map<string, string>, existing: Map<string, string>}} corpus
 */
function plan(drafts, corpus) {
  /** @type {string[]} */
  const problems = [];
  /** @type {{key: string, value: string}[]} */
  const writable = [];
  /** @type {string[]} */
  const unchanged = [];

  for (const [key, draft] of drafts) {
    if (!corpus.polish.has(key)) {
      problems.push(`${key} (${draft.source}): the corpus has no such key.`);
      continue;
    }
    if (!draft.value.trim()) {
      problems.push(
        `${key} (${draft.source}): empty. Clearing a value deletes the field rather than ` +
          "emptying it, so the apply script refuses it — leave the key out instead.",
      );
      continue;
    }
    if (draft.value === corpus.existing.get(key)) {
      unchanged.push(key);
      continue;
    }
    writable.push({ key, value: draft.value });
  }

  /** @type {Map<string, {expected: number, drafted: number, missing: string[]}>} */
  const coverage = new Map();
  for (const key of corpus.polish.keys()) {
    const scope = scopeOf(key);
    const bucket = coverage.get(scope) ?? { expected: 0, drafted: 0, missing: [] };
    bucket.expected += 1;
    if (drafts.has(key)) bucket.drafted += 1;
    else bucket.missing.push(key);
    coverage.set(scope, bucket);
  }

  return { writable, unchanged, problems, coverage };
}

/**
 * The desk's rows for one page, in one locale, plus the Polish they are measured against.
 *
 * @param {string} base
 * @param {string} token
 * @param {string} scope
 * @param {string} locale
 */
async function readScope(base, token, scope, locale) {
  const query = new URLSearchParams({ scope });
  for (const value of ["pl", locale]) query.append("locales", value);
  const { segments } = await getJson(
    `${base}/api/copydesk/segments/?${query.toString()}`,
    token,
  );
  /** @type {Map<string, {id: string, value: string}>} */
  const rows = new Map();
  /** @type {Map<string, string>} */
  const polish = new Map();
  for (const segment of segments) {
    if (segment.locale === "pl") polish.set(segment.key, segment.value);
    else rows.set(segment.key, { id: segment.id, value: segment.value });
  }
  return { rows, polish };
}

/**
 * Post one value and accept it. Two calls because there is no bulk door and there should not be
 * one: the endpoints are the editor's and the reviewer's, and this command is standing in for a
 * person at each of them.
 *
 * @param {string} base
 * @param {string} token
 * @param {string} segmentId
 * @param {string} value
 */
async function proposeAndAccept(base, token, segmentId, value) {
  const written = await postJson(`${base}/api/copydesk/proposals/`, token, {
    segment_id: segmentId,
    value,
    // DRAFT, not PROPOSED: the sitting digest reports PROPOSED, and an import has no sitting to
    // announce to the person who ran it.
    status: "DRAFT",
  });
  try {
    await postJson(`${base}/api/copydesk/proposals/${written.id}/review/`, token, {
      status: "ACCEPTED",
    });
  } catch (error) {
    // 409 is "already settled", which is the state this call was asking for — it happens when a
    // retried accept follows one that landed and lost its response.
    if (/** @type {{status?: number}} */ (error).status !== 409) throw error;
  }
}

/**
 * Coverage per page, and the remaining keys BY NAME once a page is nearly finished.
 *
 * The threshold is what makes the report usable: a page still being drafted would print hundreds
 * of names nobody reads, while the last handful is exactly the checklist the translator needs and
 * the one place a silently skipped line shows up.
 *
 * @param {Map<string, {expected: number, drafted: number, missing: string[]}>} coverage
 */
function reportCoverage(coverage) {
  const NAME_THRESHOLD = 12;
  for (const [scope, bucket] of [...coverage].sort()) {
    const left = bucket.expected - bucket.drafted;
    console.log(
      `  ${left === 0 ? "·" : "!"} ${scope.padEnd(26)} ${bucket.drafted} / ${bucket.expected}`,
    );
    if (left === 0 || left > NAME_THRESHOLD) continue;
    for (const key of bucket.missing) console.log(`      missing: ${key}`);
  }
}

async function main() {
  const argv = process.argv.slice(2);
  const localeIndex = argv.indexOf("--locale");
  const locale = localeIndex >= 0 ? argv[localeIndex + 1] : "";
  const write = argv.includes("--write");

  if (!OVERLAY_LOCALES.includes(/** @type {any} */ (locale))) {
    console.error(`[copydesk] --locale must be one of: ${OVERLAY_LOCALES.join(", ")}.`);
    process.exitCode = 1;
    return;
  }

  const drafts = await readDrafts(locale);
  const corpus = await readCorpus(locale);
  const sameAsOriginal = resolveOriginals(drafts, corpus.concerts);
  const { writable, unchanged, problems, coverage } = plan(drafts, corpus);

  console.log(`[copydesk] ${locale}: ${drafts.size} drafted value(s)`);
  if (sameAsOriginal.length) {
    console.log(
      `  ${sameAsOriginal.length} taken verbatim from the sung original: ` +
        sameAsOriginal.map((key) => key.replace(/^concert\./u, "")).join(", "),
    );
  }
  reportCoverage(coverage);
  console.log(
    `[copydesk] ${writable.length} to propose · ${unchanged.length} already in the repository`,
  );

  if (problems.length) {
    console.error(`[copydesk] ${problems.length} row(s) refused:`);
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exitCode = 1;
    return;
  }
  if (!write) {
    console.log("[copydesk] dry run — nothing posted. Re-run with --write.");
    return;
  }
  if (!writable.length) return;

  const base = apiBase();
  const account = credentials();
  if (account === null) {
    process.exitCode = 1;
    return;
  }
  const token = await authenticate(base, account);

  // What the desk has already accepted and not yet handed to the repository. Skipping it makes the
  // import RESUMABLE, which matters because the run posts a thousand times against a one-vCPU
  // droplet: a run that dies at row 300 has to be re-runnable without proposing the first 299 a
  // second time. `plan` cannot answer this — it compares against the repository, and these values
  // are precisely the ones that have not reached it yet.
  const { proposals: pending } = await getJson(
    `${base}/api/copydesk/proposals/patch/`,
    token,
  );
  /** @type {Map<string, string>} */
  const waiting = new Map();
  for (const row of pending) if (row.locale === locale) waiting.set(row.key, row.value);
  const remaining = writable.filter((row) => waiting.get(row.key) !== row.value);
  if (remaining.length < writable.length) {
    console.log(
      `[copydesk] ${writable.length - remaining.length} already accepted and waiting for the ` +
        `repository · ${remaining.length} left to post.`,
    );
  }
  if (!remaining.length) {
    console.log("[copydesk] nothing left to post — run `npm run copy:apply` next.");
    return;
  }

  // Grouped by page because that is what the desk reads by, and because the drift check below
  // needs the Polish of the same page in the same breath.
  /** @type {Map<string, {key: string, value: string}[]>} */
  const byScope = new Map();
  for (const row of remaining) {
    const scope = scopeOf(row.key);
    byScope.set(scope, [...(byScope.get(scope) ?? []), row]);
  }

  let posted = 0;
  for (const [scope, rows] of [...byScope].sort()) {
    const { rows: mirror, polish } = await readScope(base, token, scope, locale);

    for (const row of rows) {
      const deskPolish = polish.get(row.key);
      if (deskPolish !== corpus.polish.get(row.key)) {
        throw new Error(
          `[copydesk] ${row.key}: the desk's Polish is not this checkout's Polish. The hash this ` +
            "run would stamp claims the translation renders the source it was written against, " +
            "and that claim would be false. Run `npm run copy:sync` first.",
        );
      }
      const segment = mirror.get(row.key);
      if (!segment) throw new Error(`[copydesk] ${row.key} [${locale}]: no such row on the desk.`);

      await proposeAndAccept(base, token, segment.id, row.value);
      posted += 1;
      if (posted % 50 === 0) console.log(`[copydesk] ${posted} / ${remaining.length}`);
    }
    console.log(`[copydesk] ${scope}: ${rows.length} accepted`);
  }

  console.log(
    `[copydesk] ${posted} value(s) accepted and waiting for the repository.\n` +
      "[copydesk] Next: `npm run copy:apply` to read the patch, then `--write`, then `git diff`.",
  );
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  await main();
}
