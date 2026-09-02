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
 * @architecture Astro islands 2026
 * @module copydesk/extract
 */

import { CONCERT_CONTRACT, SITE_LOCALES } from "./contract.mjs";

/** Mirrors `KEY_PATTERN` in `backend/copydesk/models.py`, which is the source of truth. */
const KEY_PATTERN = /^[a-z][a-z0-9]*(?:\.[A-Za-z0-9_-]+)+$/u;

/** Mirrors the ceilings in `backend/copydesk/dtos.py`, so a rejected row is caught here first. */
const MAX_VALUE_LENGTH = 20_000;
const MAX_LABEL_LENGTH = 200;

/** The namespace every concert key opens with; the first two parts are the scope. */
const NAMESPACE = "concert";

/**
 * @typedef {object} Segment
 * @property {string} key
 * @property {string} locale
 * @property {string} kind
 * @property {string} value
 * @property {string} scope_label
 * @property {string} label
 * @property {number} order
 */

/**
 * @typedef {object} SegmentPath
 * @property {(string|number)[]} pl Where the Polish scalar sits in the parsed document.
 * @property {"plain"|"map"} shape
 * @property {Partial<Record<string, (string|number)[]>>} [seeded] Where an existing translation
 *  was read from — the legacy `about` block, which stage C3 empties into the overlay.
 */

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
 * One key in all three locales. Polish carries the repository's value; the other two carry
 * whatever the repository already holds for them, which today is only the `about` block's
 * translations and is otherwise empty — the desk needs the empty column to offer it for editing.
 *
 * @param {object} args
 * @param {string} args.key
 * @param {string} args.plValue
 * @param {Partial<Record<string, string>>} args.translations
 * @param {string} args.scopeLabel
 * @param {string} args.label
 * @param {number} args.order
 * @returns {Segment[]}
 */
function localeRows({ key, plValue, translations, scopeLabel, label, order }) {
  return SITE_LOCALES.map((locale) => ({
    key,
    locale,
    kind: "TEXT",
    value: locale === "pl" ? plValue : (translations[locale] ?? ""),
    scope_label: scopeLabel,
    label,
    order,
  }));
}

/**
 * Read the `en`/`fr` a field already has: the sibling slots of a locale map, or the absolute paths
 * a `seed` names.
 *
 * @param {Record<string, unknown>} concert
 * @param {{ shape?: "plain"|"map", seed?: {en: string, fr: string} }} entry
 * @param {(string|number)[]} plAt
 * @returns {{ values: Partial<Record<string, string>>, seeded: Partial<Record<string, (string|number)[]>> }}
 */
function readTranslations(concert, entry, plAt) {
  /** @type {Partial<Record<string, string>>} */
  const values = {};
  /** @type {Partial<Record<string, (string|number)[]>>} */
  const seeded = {};

  if (entry.shape === "map") {
    // The Polish sits at `…pl`; its siblings are the same map's other locales.
    const mapAt = plAt.slice(0, -1);
    for (const locale of ["en", "fr"]) {
      const { found, value, at } = resolve(concert, locale, mapAt);
      if (found && typeof value === "string" && value.length > 0) {
        values[locale] = value;
        seeded[locale] = at;
      }
    }
  }
  if (entry.seed) {
    for (const locale of /** @type {const} */ (["en", "fr"])) {
      const { found, value, at } = resolve(concert, entry.seed[locale]);
      if (found && typeof value === "string" && value.length > 0) {
        values[locale] = value;
        seeded[locale] = at;
      }
    }
  }
  return { values, seeded };
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
 * @returns {{ segments: Segment[], paths: Record<string, SegmentPath> }}
 */
export function extractConcert(concert) {
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
   * @param {{ shape?: "plain"|"map", seed?: {en: string, fr: string} }} entry
   * @param {{ found: boolean, value: unknown, at: (string|number)[] }} hit
   */
  const emit = (keyTail, label, entry, hit) => {
    if (!hit.found) return;
    const key = `${NAMESPACE}.${id}.${keyTail}`;
    const plValue = asCopy(hit.value, key);
    if (plValue === null) return;

    const { values, seeded } = readTranslations(concert, entry, hit.at);
    segments.push(
      ...localeRows({ key, plValue, translations: values, scopeLabel, label, order }),
    );
    paths[key] = { pl: hit.at, shape: entry.shape ?? "plain", ...(Object.keys(seeded).length ? { seeded } : {}) };
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
 * Extract the whole corpus, and refuse to hand back anything the backend would reject: a key the
 * pattern does not accept, a duplicate key, a value or label over the DTO's ceiling. Every one of
 * those is cheaper to find here than as a 400 in the middle of an ingest run.
 *
 * @param {Record<string, unknown>[]} concerts
 * @returns {{ segments: Segment[], paths: Record<string, SegmentPath>, stats: Record<string, number> }}
 */
export function extractAll(concerts) {
  /** @type {Segment[]} */
  const segments = [];
  /** @type {Record<string, SegmentPath>} */
  const paths = {};

  for (const concert of concerts) {
    const one = extractConcert(concert);
    for (const key of Object.keys(one.paths)) {
      if (key in paths) throw new Error(`[copydesk] duplicate key across concerts: ${key}`);
    }
    segments.push(...one.segments);
    Object.assign(paths, one.paths);
  }

  for (const segment of segments) {
    if (!KEY_PATTERN.test(segment.key)) {
      throw new Error(`[copydesk] key rejected by KEY_PATTERN: ${segment.key}`);
    }
    if (segment.value.length > MAX_VALUE_LENGTH) {
      throw new Error(
        `[copydesk] ${segment.key} [${segment.locale}] is ${segment.value.length} characters; the DTO stops at ${MAX_VALUE_LENGTH}.`,
      );
    }
    if (segment.label.length > MAX_LABEL_LENGTH || segment.scope_label.length > MAX_LABEL_LENGTH) {
      throw new Error(`[copydesk] ${segment.key}: label over ${MAX_LABEL_LENGTH} characters.`);
    }
  }

  const translated = segments.filter((s) => s.locale !== "pl" && s.value.length > 0).length;
  return {
    segments,
    paths,
    stats: {
      concerts: concerts.length,
      keys: Object.keys(paths).length,
      rows: segments.length,
      translated,
    },
  };
}
