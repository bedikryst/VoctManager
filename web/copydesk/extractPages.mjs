// @ts-check
/**
 * @file extractPages.mjs
 * @description The second corpus: the static pages. `extract.mjs` walks a list of evenings through
 *  a table that lives beside it; this walks one page's prose through the contract that lives with
 *  the page itself, in `src/i18n/content/<page>.ts`.
 *
 *  THE CONTRACT IS NOT HERE, AND THAT IS THE POINT (spec §6r). The page renders by looking a key up
 *  in the overlay and this walk emits that same key from the same YAML, so the rule that turns a
 *  field into a key exists ONCE — `i18n/content/copySpec.ts`, imported straight from here. Node
 *  reads it by stripping the types, no build step, which is why that module may never import
 *  anything only a bundler can resolve. A second implementation of the rule would diverge in
 *  silence: a good translation stored under a key the page never asks for, the page still printing
 *  Polish, and nothing anywhere reporting an error.
 *
 *  THE SEGMENT KIND COMES FROM THE FIELD'S NAME. `…Html` is an `HTML` segment, everything else is
 *  `TEXT` — `segmentKind` in `copySpec.ts` decides, so the kind and the authoring convention cannot
 *  disagree. This corpus is where the `HTML` kind first appears at all, and therefore where §7's
 *  `contenteditable` sanitizer has something to sanitize.
 *
 *  THE PAGE IS VALIDATED BEFORE IT IS WALKED, against the same zod schema the page renders through.
 *  `.strict()` means a hand-added `en:` beside a Polish value fails here rather than being dropped:
 *  translations live in `src/content/pages.{en,fr}.yaml` under these same keys, and one fact with
 *  two homes is exactly what §8 settled against.
 * @architecture Astro islands 2026
 * @module copydesk/extractPages
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import YAML from "yaml";

import { walkCopy } from "../src/i18n/content/copySpec.ts";
import { KOLOFON_PAGE } from "../src/i18n/content/kolofon.ts";
import { KONCERTY_PAGE } from "../src/i18n/content/koncerty.ts";
import { KONTAKT_PAGE } from "../src/i18n/content/kontakt.ts";
import { NOT_FOUND_PAGE } from "../src/i18n/content/notFound.ts";
import { ABOUT_PAGE } from "../src/i18n/content/o-nas.ts";
import { OBRAZY_PAGE } from "../src/i18n/content/obrazy.ts";
import { guardSegments, localeRows } from "./segment.mjs";

const WEB_ROOT = fileURLToPath(new URL("..", import.meta.url));

/** @typedef {import("../src/i18n/content/copySpec.ts").PageCopySpec<unknown>} PageSpec */
/** @typedef {import("./segment.mjs").Overlays} Overlays */
/** @typedef {import("./segment.mjs").Segment} Segment */

/**
 * @typedef {object} PageSegmentPath
 * @property {string} source The page's YAML file, relative to `web/`.
 * @property {(string|number)[]} pl Where the Polish scalar sits inside that document.
 */

/**
 * Every static page the desk carries. Adding one is this line plus its content module — the walk
 * below has nothing page-specific in it.
 *
 * @type {readonly PageSpec[]}
 */
export const PAGE_SPECS = [
  ABOUT_PAGE,
  KONTAKT_PAGE,
  KONCERTY_PAGE,
  OBRAZY_PAGE,
  KOLOFON_PAGE,
  NOT_FOUND_PAGE,
];

/**
 * Where a page's Polish prose lives, relative to `web/`. Mirrors the glob `lib/pageCopy` reads.
 *
 * @param {string} id
 * @returns {string}
 */
export function pageSource(id) {
  return `src/content/pages/${id}.yaml`;
}

/**
 * One page's prose, parsed and validated. Read-only, like the concert corpus: §7's ban is on
 * parse-and-DUMP, because a round trip deletes the comments that carry the decisions.
 *
 * @param {PageSpec} spec
 * @param {string} [root]
 * @returns {Promise<unknown>}
 */
export async function readPage(spec, root = WEB_ROOT) {
  const raw = await readFile(path.join(root, pageSource(spec.id)), "utf8");
  return spec.schema.parse(YAML.parse(raw));
}

/**
 * Extract one page.
 *
 * @param {PageSpec} spec
 * @param {unknown} data Already through `spec.schema`.
 * @param {Overlays} [overlays]
 * @returns {{ segments: Segment[], paths: Record<string, PageSegmentPath> }}
 */
export function extractPage(spec, data, overlays = {}) {
  const source = pageSource(spec.id);
  /** @type {Segment[]} */
  const segments = [];
  /** @type {Record<string, PageSegmentPath>} */
  const paths = {};

  for (const leaf of walkCopy(spec, data)) {
    // Two entries of one list sharing an `id` would collide here rather than three steps away, at
    // an ingest that silently keeps whichever row arrived last.
    if (leaf.key in paths) throw new Error(`[copydesk] ${leaf.key}: emitted twice by ${source}.`);
    segments.push(
      ...localeRows({
        key: leaf.key,
        kind: leaf.kind,
        plValue: leaf.value,
        overlays,
        scopeLabel: spec.label,
        label: leaf.label,
        order: leaf.order,
      }),
    );
    paths[leaf.key] = { source, pl: [...leaf.at] };
  }

  return { segments, paths };
}

/**
 * Read and extract every registered page.
 *
 * @param {Overlays} [overlays]
 * @param {{ root?: string }} [options]
 * @returns {Promise<{ segments: Segment[], paths: Record<string, PageSegmentPath>, orphans: Record<string, string[]>, stats: Record<string, number> }>}
 */
export async function extractAllPages(overlays = {}, { root = WEB_ROOT } = {}) {
  /** @type {Segment[]} */
  const segments = [];
  /** @type {Record<string, PageSegmentPath>} */
  const paths = {};

  for (const spec of PAGE_SPECS) {
    const one = extractPage(spec, await readPage(spec, root), overlays);
    for (const key of Object.keys(one.paths)) {
      if (key in paths) throw new Error(`[copydesk] duplicate key across pages: ${key}`);
    }
    segments.push(...one.segments);
    Object.assign(paths, one.paths);
  }

  guardSegments(segments);

  // An overlay value whose key has left a page. Reported rather than deleted: a page's keys are
  // stable under reordering (§6r keys a list by `id`), so a key that vanished is a field somebody
  // renamed or removed, and the translation is worth a decision rather than a silent cleanup.
  /** @type {Record<string, string[]>} */
  const orphans = {};
  for (const [locale, entries] of Object.entries(overlays)) {
    const stray = [...(entries?.keys() ?? [])].filter((key) => !(key in paths)).sort();
    if (stray.length) orphans[locale] = stray;
  }

  const translated = segments.filter((s) => s.locale !== "pl" && s.value.length > 0).length;
  return {
    segments,
    paths,
    orphans,
    stats: {
      pages: PAGE_SPECS.length,
      keys: Object.keys(paths).length,
      rows: segments.length,
      translated,
    },
  };
}
