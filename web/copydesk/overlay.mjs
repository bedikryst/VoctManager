// @ts-check
/**
 * @file overlay.mjs
 * @description The per-locale overlay files — `src/content/concerts.en.yaml` and
 *  `concerts.fr.yaml` — read and written. Spec §8, option (b): `concerts.yaml` is Polish-only from
 *  stage C3 on, and every translated value lives here under the copy desk's own dotted key.
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
 * @param {string} locale
 * @returns {string}
 */
export function overlaySource(locale) {
  return `src/content/concerts.${locale}.yaml`;
}

/**
 * The header every overlay carries. It is the only prose in the file and its whole job is to stop
 * the next person from treating it as a place to write.
 *
 * @param {string} locale
 * @returns {string[]}
 */
function header(locale) {
  return [
    `# concerts.${locale}.yaml — the ${locale.toUpperCase()} overlay over src/content/concerts.yaml.`,
    "#",
    "# MACHINE-WRITTEN by `npm run copy:apply`, which is the write direction of the copy desk",
    "# (docs/web-copy-desk-2026-09.md §6c). Every key is a copy-desk segment key; the Polish it",
    "# renders sits at the matching path in concerts.yaml, which holds no translations at all.",
    "#",
    "# Edit here only in an emergency, and run `npm run copy:sync` straight afterwards — otherwise",
    "# the desk still shows the old value, marks nothing stale, and the next apply run writes over",
    "# what you typed. The reviewable route is a proposal.",
    "#",
    "# Sorted by key and written whole, so a diff of this file is a diff of the translation.",
  ];
}

/**
 * One locale's overlay as a map. A missing file is an empty overlay, not an error: the first
 * translation of a locale creates it.
 *
 * @param {string} locale
 * @param {string} [root]
 * @returns {Promise<Map<string, string>>}
 */
export async function readOverlay(locale, root = WEB_ROOT) {
  let raw;
  try {
    raw = await readFile(path.join(root, overlaySource(locale)), "utf8");
  } catch (error) {
    if (/** @type {NodeJS.ErrnoException} */ (error).code === "ENOENT") return new Map();
    throw error;
  }
  return parseOverlay(raw, locale);
}

/**
 * @param {string} raw
 * @param {string} locale
 * @returns {Map<string, string>}
 */
export function parseOverlay(raw, locale) {
  const parsed = YAML.parse(raw) ?? {};
  if (typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`[copydesk] ${overlaySource(locale)} is not a map of key → value.`);
  }
  const entries = new Map();
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value !== "string") {
      throw new Error(`[copydesk] ${overlaySource(locale)}: ${key} is not a string.`);
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
 * @returns {string}
 */
export function renderOverlay(locale, entries, eol) {
  const lines = [...header(locale), ""];
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
 * @param {{root?: string, eol?: string}} [options]
 * @returns {Promise<{source: string, count: number}>}
 */
export async function writeOverlay(locale, entries, { root = WEB_ROOT, eol = "\r\n" } = {}) {
  const source = overlaySource(locale);
  const text = renderOverlay(locale, entries, eol);

  const readBack = parseOverlay(text, locale);
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
