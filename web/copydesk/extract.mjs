// @ts-check
/**
 * @file extract.mjs
 * @description The walk over `contract.mjs` that turns `concerts.yaml` into copy-desk segments.
 *  It reads the YAML through a parser, which is safe and is not what §7 forbids: the ban is on
 *  parse-and-DUMP, because a round trip deletes the ~2 500 lines of comments that carry decisions
 *  nothing else records. Nothing here writes the file.
 *
 *  Every segment carries the concrete path its Polish scalar was read from. That is not debugging
 *  furniture — it is the second half of §4's requirement that a key be derivable in both
 *  directions, it is what `apply-copy` addresses in stage C3, and it is what lets the test prove
 *  reversibility mechanically: resolve the path back in the parsed document and it must be the
 *  exact string that was emitted.
 *
 *  TWO SOURCES, ONE MIRROR. Polish comes from `concerts.yaml`; `en` and `fr` come from the overlay
 *  files, addressed by the very key this walk produces (spec §8). The mirror is a projection of
 *  git, so a locale column shows what the repository holds for it and nothing else — an empty
 *  string where no translation exists yet, which is the column the desk offers for editing.
 *  A translation found INSIDE `concerts.yaml` is refused rather than read: after stage C3 that file
 *  is Polish-only, and quietly accepting a stray `en:` would put one fact back in two homes.
 * @architecture Astro islands 2026
 * @module copydesk/extract
 */

import { CONCERT_CONTRACT } from "./contract.mjs";
import { guardSegments, localeRows, TEXT } from "./segment.mjs";

/** The namespace every concert key opens with; the first two parts are the scope. */
const NAMESPACE = "concert";

/**
 * @typedef {object} SegmentPath
 * @property {(string|number)[]} pl Where the Polish scalar sits in the parsed document.
 * @property {"plain"|"map"} shape
 */

/** @typedef {import("./segment.mjs").Overlays} Overlays */
/** @typedef {import("./segment.mjs").Segment} Segment */

/**
 * Walk a dotted path, returning the value and the concrete location it was found at.
 *
 * @param {unknown} root
 * @param {string} path
 * @param {(string|number)[]} [base]
 * @returns {{ found: boolean, value: unknown, at: (string|number)[] }}
 */
function resolve(root, path, base = []) {
  let node = root;
  const at = [...base];
  for (const part of path.split(".")) {
    if (node === null || typeof node !== "object") return { found: false, value: undefined, at };
    node = /** @type {Record<string, unknown>} */ (node)[part];
    at.push(part);
    if (node === undefined) return { found: false, value: undefined, at };
  }
  return { found: node !== undefined && node !== null, value: node, at };
}

/**
 * A value is a segment only if it is a non-empty string. Anything else in a copy slot is a data
 * error rather than an empty field, so it is reported rather than skipped.
 *
 * @param {unknown} value
 * @param {string} key
 * @returns {string|null}
 */
function asCopy(value, key) {
  if (typeof value === "string") return value.length > 0 ? value : null;
  throw new Error(`[copydesk] ${key}: expected a string in a copy slot, found ${typeof value}.`);
}

/**
 * Refuse a translation sitting in the Polish corpus.
 *
 * The locale maps stage A introduced still have `en`/`fr` slots in shape — they are what a *gloss
 * of a foreign original* is written into — but §8 settled that no locale but Polish is stored in
 * this file any more. A stray one would be a fact with two homes, and the failure it causes is
 * silent: whichever copy the reader is not looking at goes stale with nothing to say so.
 *
 * @param {Record<string, unknown>} concert
 * @param {string} key
 * @param {(string|number)[]} plAt
 */
function refuseStrayTranslation(concert, key, plAt) {
  const mapAt = plAt.slice(0, -1);
  const map = mapAt.reduce(
    (node, step) => (node === null || typeof node !== "object" ? undefined : node[step]),
    /** @type {any} */ (concert),
  );
  if (map === null || typeof map !== "object") return;

  for (const locale of ["en", "fr"]) {
    const value = map[locale];
    if (typeof value === "string" && value.length > 0) {
      throw new Error(
        `[copydesk] ${key}: concerts.yaml holds a ${locale} value at ` +
          `${[...mapAt, locale].join(".")}. Since stage C3 that file is Polish-only — ` +
          `move it to concerts.${locale}.yaml under this key.`,
      );
    }
  }
}

/**
 * @param {string} listLabel
 * @param {number} position 1-based, for the editor's eye.
 * @param {string} fieldLabel
 * @returns {string}
 */
function composeLabel(listLabel, position, fieldLabel) {
  const head = `${listLabel} · ${position}`;
  return fieldLabel ? `${head} · ${fieldLabel}` : head;
}

/**
 * Extract one concert.
 *
 * @param {Record<string, unknown>} concert
 * @param {Overlays} [overlays]
 * @returns {{ segments: Segment[], paths: Record<string, SegmentPath> }}
 */
export function extractConcert(concert, overlays = {}) {
  const id = concert.id;
  if (typeof id !== "string" || id.length === 0) {
    throw new Error("[copydesk] a concert without an `id` cannot be keyed.");
  }
  const scopeLabel = typeof concert.title === "string" ? concert.title : id;

  /** @type {Segment[]} */
  const segments = [];
  /** @type {Record<string, SegmentPath>} */
  const paths = {};
  let order = 0;

  /**
   * @param {string} keyTail
   * @param {string} label
   * @param {{ shape?: "plain"|"map" }} entry
   * @param {{ found: boolean, value: unknown, at: (string|number)[] }} hit
   */
  const emit = (keyTail, label, entry, hit) => {
    if (!hit.found) return;
    const key = `${NAMESPACE}.${id}.${keyTail}`;
    const plValue = asCopy(hit.value, key);
    if (plValue === null) return;

    if (entry.shape === "map") refuseStrayTranslation(concert, key, hit.at);
    // Every value in this corpus is plain text — `grep` finds no `<em>`, `<strong>` or `<a>`
    // anywhere in `concerts.yaml`. Inline markup enters the desk through the static pages, whose
    // extractor takes the kind from the field's name instead.
    segments.push(...localeRows({ key, kind: TEXT, plValue, overlays, scopeLabel, label, order }));
    paths[key] = { pl: hit.at, shape: entry.shape ?? "plain" };
    order += 1;
  };

  for (const entry of CONCERT_CONTRACT) {
    if (entry.kind === "field") {
      emit(entry.key ?? entry.path, entry.label, entry, resolve(concert, entry.path));
      continue;
    }

    const list = resolve(concert, entry.path);
    if (!list.found || !Array.isArray(list.value)) continue;
    const listKey = entry.key ?? entry.path;

    for (const [index, item] of list.value.entries()) {
      const part =
        entry.keyBy === null || entry.keyBy === undefined
          ? String(index)
          : String(/** @type {Record<string, unknown>} */ (item)[entry.keyBy]);
      const itemAt = [...list.at, index];

      for (const field of entry.fields ?? []) {
        const keyTail = field.key ? `${listKey}.${part}.${field.key}` : `${listKey}.${part}`;
        const hit =
          field.path === null
            ? { found: item !== undefined && item !== null, value: item, at: itemAt }
            : resolve(item, field.path, itemAt);
        emit(keyTail, composeLabel(entry.label, index + 1, field.label), field, hit);
      }
    }
  }

  return { segments, paths };
}

/**
 * Extract the whole corpus, and refuse to hand back anything the backend would reject: a duplicate
 * key here, and everything `guardSegments` names.
 *
 * @param {Record<string, unknown>[]} concerts
 * @param {Overlays} [overlays]
 * @returns {{ segments: Segment[], paths: Record<string, SegmentPath>, orphans: Record<string, string[]>, stats: Record<string, number> }}
 */
export function extractAll(concerts, overlays = {}) {
  /** @type {Segment[]} */
  const segments = [];
  /** @type {Record<string, SegmentPath>} */
  const paths = {};

  for (const concert of concerts) {
    const one = extractConcert(concert, overlays);
    for (const key of Object.keys(one.paths)) {
      if (key in paths) throw new Error(`[copydesk] duplicate key across concerts: ${key}`);
    }
    segments.push(...one.segments);
    Object.assign(paths, one.paths);
  }

  guardSegments(segments);

  // An overlay value whose key has left the corpus. Reported rather than deleted: the same
  // positional keying that makes an inserted programme entry re-key its neighbours (§6d) would
  // make a silent cleanup throw away a translation that is still wanted three lines down.
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
      concerts: concerts.length,
      keys: Object.keys(paths).length,
      rows: segments.length,
      translated,
    },
  };
}
