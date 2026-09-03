// @ts-check
/**
 * @file overlay.mjs
 * @description The per-locale overlay files — `concerts.{en,fr}.yaml` for the evenings and
 *  `pages.{en,fr}.yaml` for the static pages' prose — read and written here, one corpus at a time.
 *  Spec §8, option (b): a Polish corpus holds Polish only, and every translated value lives in an
 *  overlay under the copy desk's own dotted key.
 *
 *  THE CORPUS IS A PARAMETER, NOT A SECOND MODULE. The four files are the same shape, sorted the
 *  same way and written whole by the same run; only the header differs, because it is what sends an
 *  emergency edit to the right Polish source.
 *
 *  WHAT THE SPLIT BUYS. The Polish corpus is never restructured again, so `apply-copy`'s line-level
 *  path shrinks to a single operation — replace a Polish scalar in place — and the operation that
 *  could destroy 2 500 lines of hand-written prose and comments never has to insert a key, open a
 *  flow map or indent a block under a new locale. These files are machine-written, carry no
 *  comments to lose, and are rewritten whole, so nothing here needs the care `yamlEdit.mjs` takes.
 *
 *  THE SPLIT IS BY LANGUAGE, NOT BY FIELD, which is the answer to §5's rule against two shapes for
 *  one thing: every field behaves identically here, and the file is flat — no nesting mirrors the
 *  corpus, because the desk's key already carries the whole address.
 * @architecture Astro islands 2026
 * @module copydesk/overlay
 */

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import YAML from "yaml";

import { detectEol, doubleQuoted, literalBlock } from "./yamlEdit.mjs";

const WEB_ROOT = fileURLToPath(new URL("..", import.meta.url));

/** The locales an overlay exists for. Polish is the source and has no overlay by definition. */
export const OVERLAY_LOCALES = /** @type {const} */ (["en", "fr"]);

/**
 * Where one locale's overlay lives, relative to `web/`.
 *
 * `corpus` is `concerts` or `pages` — the two Polish corpora, the evenings and the static pages'
 * prose. They share ONE key space, and the namespace at the head of a key says which; they do not
 * share a file, because `copy:apply` rewrites an overlay whole and the two are written by different
 * runs.
 *
 * @param {string} locale
 * @param {string} [corpus]
 * @returns {string}
 */
export function overlaySource(locale, corpus = "concerts") {
  return `src/content/${corpus}.${locale}.yaml`;
}

/**
 * What each corpus's overlay is an overlay OVER. The four files are the same shape and are written
 * by the same run, so the header is the only thing that tells them apart — and an emergency edit
 * made against a header naming the wrong Polish source is an edit to a file that does not hold the
 * field.
 *
 * @type {Record<string, {over: string, at: string}>}
 */
const CORPORA = {
  concerts: {
    over: "src/content/concerts.yaml",
    at: "concerts.yaml, which holds no translations at all.",
  },
  pages: {
    over: "the static pages' Polish in src/content/pages/",
    at: "that page's own file, which holds no translations at all.",
  },
};

/**
 * The header every overlay carries. It is the only prose in the file and its whole job is to stop
 * the next person from treating it as a place to write.
 *
 * @param {string} locale
 * @param {string} corpus
 * @returns {string[]}
 */
function header(locale, corpus) {
  const over = CORPORA[corpus];
  if (!over) throw new Error(`[copydesk] ${corpus}: not a corpus this desk overlays.`);
  return [
    `# ${corpus}.${locale}.yaml — the ${locale.toUpperCase()} overlay over ${over.over}.`,
    "#",
    "# MACHINE-WRITTEN by `npm run copy:apply`, which is the write direction of the copy desk",
    "# (docs/web-copy-desk-2026-09.md §6c). Every key is a copy-desk segment key; the Polish it",
    `# renders sits at the matching path in ${over.at}`,
    "#",
    "# FALLBACK IS PER FIELD. A key missing here prints its Polish, beside fields that print this",
    "# locale — which is what lets a page go up while its prose is still being reviewed.",
    "#",
    "# Edit here only in an emergency, and run `npm run copy:sync` straight afterwards — otherwise",
    "# the desk still shows the old value, marks nothing stale, and the next apply run writes over",
    "# what you typed. The reviewable route is a proposal.",
    ...(locale === "fr"
      ? [
          "#",
          "# Do not hand-type French punctuation spacing. `lib/typo.ts` inserts the narrow no-break",
          "# space before `? ! : ;` at build time, and a hand-typed hard space doubles up.",
        ]
      : []),
    "#",
    "# Sorted by key and written whole, so a diff of this file is a diff of the translation.",
  ];
}

/**
 * One locale's overlay as a map. A missing file is an empty overlay, not an error: the first
 * translation of a locale creates it.
 *
 * @param {string} locale
 * @param {{root?: string, corpus?: string}} [options]
 * @returns {Promise<Map<string, string>>}
 */
export async function readOverlay(locale, { root = WEB_ROOT, corpus = "concerts" } = {}) {
  let raw;
  try {
    raw = await readFile(path.join(root, overlaySource(locale, corpus)), "utf8");
  } catch (error) {
    if (/** @type {NodeJS.ErrnoException} */ (error).code === "ENOENT") return new Map();
    throw error;
  }
  return parseOverlay(raw, locale, corpus);
}

/**
 * @param {string} raw
 * @param {string} locale
 * @param {string} [corpus]
 * @returns {Map<string, string>}
 */
export function parseOverlay(raw, locale, corpus = "concerts") {
  const source = overlaySource(locale, corpus);
  const parsed = YAML.parse(raw) ?? {};
  if (typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`[copydesk] ${source} is not a map of key → value.`);
  }
  const entries = new Map();
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value !== "string") {
      throw new Error(`[copydesk] ${source}: ${key} is not a string.`);
    }
    entries.set(key, value);
  }
  return entries;
}

/**
 * Render a whole overlay. Deterministic: sorted keys, one shape per value, so two runs over the
 * same translations are byte-identical and a diff means somebody's words changed.
 *
 * @param {string} locale
 * @param {Map<string, string>} entries
 * @param {string} eol
 * @param {string} [corpus]
 * @returns {string}
 */
export function renderOverlay(locale, entries, eol, corpus = "concerts") {
  const lines = [...header(locale, corpus), ""];
  for (const key of [...entries.keys()].sort()) {
    const value = /** @type {string} */ (entries.get(key));
    lines.push(
      value.includes("\n")
        ? `${key}: ${literalBlock(value, { indent: 2, parentIndent: 0, eol })}`
        : `${key}: ${doubleQuoted(value)}`,
    );
  }
  return lines.join(eol) + eol;
}

/**
 * Write one locale's overlay, having proved it reads back exactly.
 *
 * The proof is the whole file rather than a value at a time, because the file is generated: if the
 * rendering of one value can break its neighbours, this is where it shows.
 *
 * @param {string} locale
 * @param {Map<string, string>} entries
 * @param {{root?: string, eol?: string, corpus?: string}} [options]
 * @returns {Promise<{source: string, count: number}>}
 */
export async function writeOverlay(
  locale,
  entries,
  { root = WEB_ROOT, eol = "\r\n", corpus = "concerts" } = {},
) {
  const source = overlaySource(locale, corpus);
  const text = renderOverlay(locale, entries, eol, corpus);

  const readBack = parseOverlay(text, locale, corpus);
  if (readBack.size !== entries.size) {
    throw new Error(`[copydesk] ${source}: ${entries.size} values written, ${readBack.size} read back.`);
  }
  for (const [key, value] of entries) {
    if (readBack.get(key) !== value) {
      throw new Error(`[copydesk] ${source}: ${key} does not survive a re-read.`);
    }
  }

  await writeFile(path.join(root, source), text, "utf8");
  return { source, count: entries.size };
}

/** The line ending the overlays keep, taken from the corpus they sit beside. */
export async function corpusEol(root = WEB_ROOT) {
  return detectEol(await readFile(path.join(root, "src/content/concerts.yaml"), "utf8"));
}
