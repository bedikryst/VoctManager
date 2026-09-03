// @ts-check
/**
 * @file index.mjs
 * @description `npm run copy:extract` — reads BOTH Polish corpora, `src/content/concerts.yaml` and
 *  every `src/content/pages/<page>.yaml`, plus the four locale overlays, and writes the copy desk's
 *  view of them. The output is the input to stage C2's ingest, and it is DETERMINISTIC on purpose:
 *  no timestamp, keys in reading order, so two runs over unchanged corpora produce a byte-identical
 *  file and any difference between them is a real change to the site's text.
 *
 *  ONE KEY SPACE, TWO WALKS. The corpora share nothing but the key space (`concert.` and `page.` are
 *  the namespaces) and are extracted by their own modules — a list of evenings against the table in
 *  `contract.mjs`, a page's prose against the contract in its own content module. They meet here,
 *  and `paths` says which by SHAPE: a page's record names the file it addresses, a concert's is a
 *  location inside `concerts.yaml` that still wants its concert's index in front of it. The write
 *  direction has to branch on that anyway.
 *
 *  `segments` is exactly the shape `SegmentUpsertDTO` accepts — that DTO forbids extra fields, so
 *  the paths the apply script needs travel beside it in `paths` rather than inside the rows.
 * @architecture Astro islands 2026
 * @module copydesk/index
 */

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import YAML from "yaml";

import { extractAll } from "./extract.mjs";
import { extractAllPages, PAGE_SPECS, pageSource } from "./extractPages.mjs";
import { OVERLAY_LOCALES, overlaySource, readOverlay } from "./overlay.mjs";

const WEB_ROOT = fileURLToPath(new URL("..", import.meta.url));
const SOURCE = "src/content/concerts.yaml";
const DEFAULT_OUT = "copydesk/segments.json";

/**
 * @param {string[]} argv
 * @returns {{ out: string, quiet: boolean }}
 */
function parseArgs(argv) {
  const outIndex = argv.indexOf("--out");
  return {
    out: outIndex >= 0 ? argv[outIndex + 1] : DEFAULT_OUT,
    quiet: argv.includes("--quiet"),
  };
}

/** Parse the corpus. Read-only: §7 forbids writing this file through a parser, never reading it. */
export async function readConcerts() {
  const raw = await readFile(path.join(WEB_ROOT, SOURCE), "utf8");
  const parsed = YAML.parse(raw);
  if (!Array.isArray(parsed)) throw new Error(`[copydesk] ${SOURCE} is not a list of concerts.`);
  return parsed;
}

/**
 * Both corpora's path records in one map, refusing a key they both claim. The namespaces make that
 * impossible today, which is exactly why it is worth an assertion: a collision would mean somebody
 * changed one of them, and the loser would be a segment the write direction addresses to the wrong
 * file.
 *
 * Exported because `copy:apply` merges the same two maps to decide where a row is written, and the
 * rule that says a key belongs to exactly one corpus has to be the same one in both directions.
 *
 * @param {Record<string, object>} concerts
 * @param {Record<string, object>} pages
 * @returns {Record<string, object>}
 */
export function mergePaths(concerts, pages) {
  for (const key of Object.keys(pages)) {
    if (key in concerts) throw new Error(`[copydesk] ${key} is claimed by both corpora.`);
  }
  return { ...concerts, ...pages };
}

/**
 * An overlay value whose key has left its corpus: reported, never deleted here. `extract.mjs` and
 * `extractPages.mjs` say why each of them keeps its own.
 *
 * @param {string} corpus
 * @param {Record<string, string[]>} orphans
 */
function warnOrphans(corpus, orphans) {
  for (const [locale, keys] of Object.entries(orphans)) {
    console.warn(
      `[copydesk] ${overlaySource(locale, corpus)} holds ${keys.length} value(s) for keys the ` +
        `corpus no longer has: ${keys.join(", ")}`,
    );
  }
}

/**
 * Read both corpora, write the desk's view of them, and hand the payload back. Exported so that
 * `copy:sync` runs the SAME extraction it then posts, rather than reading a file somebody may
 * have generated from a different tree.
 *
 * @param {{ out?: string, quiet?: boolean }} [options]
 */
export async function extractToFile({ out = DEFAULT_OUT, quiet = false } = {}) {
  /** @type {Record<string, Map<string, string>>} */
  const concertOverlays = {};
  /** @type {Record<string, Map<string, string>>} */
  const pageOverlays = {};
  for (const locale of OVERLAY_LOCALES) {
    concertOverlays[locale] = await readOverlay(locale);
    pageOverlays[locale] = await readOverlay(locale, { corpus: "pages" });
  }

  const concerts = extractAll(await readConcerts(), concertOverlays);
  const pages = await extractAllPages(pageOverlays);

  const payload = {
    sources: [SOURCE, ...PAGE_SPECS.map((spec) => pageSource(spec.id))],
    stats: {
      concerts: concerts.stats.concerts,
      pages: pages.stats.pages,
      keys: concerts.stats.keys + pages.stats.keys,
      rows: concerts.stats.rows + pages.stats.rows,
      translated: concerts.stats.translated + pages.stats.translated,
    },
    segments: [...concerts.segments, ...pages.segments],
    paths: mergePaths(concerts.paths, pages.paths),
  };
  await writeFile(path.join(WEB_ROOT, out), `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  if (!quiet) {
    const { stats } = payload;
    console.log(`[copydesk] ${out}`);
    console.log(
      `  ${stats.concerts} concerts · ${stats.pages} page(s) · ${stats.keys} keys · ` +
        `${stats.rows} rows · ${stats.translated} already translated`,
    );
    warnOrphans("concerts", concerts.orphans);
    warnOrphans("pages", pages.orphans);
  }
  return payload;
}

async function main() {
  const { out, quiet } = parseArgs(process.argv.slice(2));
  await extractToFile({ out, quiet });
}

// Compared as file URLs rather than as strings: on Windows `process.argv[1]` is a backslashed
// drive path and would never match `import.meta.url` written by hand.
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  await main();
}
