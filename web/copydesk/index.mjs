// @ts-check
/**
 * @file index.mjs
 * @description `npm run copy:extract` — reads `src/content/concerts.yaml` and writes the copy
 *  desk's view of it. The output is the input to stage C2's ingest, and it is DETERMINISTIC on
 *  purpose: no timestamp, keys in reading order, so two runs over an unchanged corpus produce a
 *  byte-identical file and any difference between them is a real change to the site's text.
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
 * Read the corpus, write the desk's view of it, and hand the payload back. Exported so that
 * `copy:sync` runs the SAME extraction it then posts, rather than reading a file somebody may
 * have generated from a different tree.
 *
 * @param {{ out?: string, quiet?: boolean }} [options]
 */
export async function extractToFile({ out = DEFAULT_OUT, quiet = false } = {}) {
  const { segments, paths, stats } = extractAll(await readConcerts());

  const payload = { source: SOURCE, stats, segments, paths };
  await writeFile(path.join(WEB_ROOT, out), `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  if (!quiet) {
    console.log(`[copydesk] ${out}`);
    console.log(
      `  ${stats.concerts} concerts · ${stats.keys} keys · ${stats.rows} rows · ${stats.translated} already translated`,
    );
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
