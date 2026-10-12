// @ts-check
/**
 * @file segment.mjs
 * @description What a segment IS (§4), and the two things every corpus's extractor has to do with
 *  one: build the three locale rows around a Polish value, and refuse a row the ingest endpoint
 *  would reject.
 *
 *  IT SITS APART BECAUSE THERE ARE TWO CORPORA. `concerts.yaml` is a list of evenings, walked by
 *  the table in `contract.mjs`; `src/content/pages/<page>.yaml` is one page's prose, walked by the
 *  contract inside that page's own content module. They are keyed differently, read differently and
 *  written differently — but a SEGMENT is the same object in both, and the ceilings it has to fit
 *  belong to `backend/copydesk/dtos.py` rather than to either corpus. A second copy of these would
 *  drift the expensive way: an extractor that goes on emitting rows the ingest run rejects three
 *  thousand rows into a batch.
 * @architecture Astro islands 2026
 * @module copydesk/segment
 */

import { scopePath } from "../src/comment-mode/scopePath.ts";

/** Mirrors `SiteLocale` on the backend and `LOCALES` in `src/i18n/config.ts`. */
export const SITE_LOCALES = /** @type {const} */ (["pl", "en", "fr"]);

/**
 * Plain text, edited as text and with no markup path at all. It is what the whole concert corpus
 * is; the static pages are where `HTML` appears, derived from a field's `…Html` name by
 * `i18n/content/copySpec.ts` so that the kind and the authoring convention cannot disagree.
 */
export const TEXT = "TEXT";

/** Mirrors `KEY_PATTERN` in `backend/copydesk/models.py`, which is the source of truth. */
const KEY_PATTERN = /^[a-z][a-z0-9]*(?:\.[A-Za-z0-9_-]+)+$/u;

/** Mirrors the ceilings in `backend/copydesk/dtos.py`, so a rejected row is caught here first. */
const MAX_VALUE_LENGTH = 20_000;
const MAX_LABEL_LENGTH = 200;

/** Mirror `SCOPE_PATH_PATTERN` and `MAX_SCOPE_PATH_LENGTH` in `backend/copydesk/dtos.py`. */
const SCOPE_PATH_PATTERN = /^(?:\/|\/[^/\\\s?#][^\\\s?#]*)?$/u;
const MAX_SCOPE_PATH_LENGTH = 200;

/**
 * The page a key belongs to — the first two parts, exactly as `scope_from_key` reads it on the
 * backend.
 *
 * @param {string} key
 */
export const scopeOf = (key) => key.split(".").slice(0, 2).join(".");

/**
 * @typedef {object} Segment
 * @property {string} key
 * @property {string} locale
 * @property {string} kind
 * @property {string} value
 * @property {string} scope_label
 * @property {string} scope_path The Polish page the comment mode opens this scope on, `""` when
 *  none. Set by `localeRows` from `src/comment-mode/scopePath.ts`, the site's one map of it.
 * @property {string} label
 * @property {number} order
 */

/**
 * @typedef {Partial<Record<string, Map<string, string>>>} Overlays The translations the repository
 *  holds, per locale, keyed by segment key.
 */

/**
 * One key in all three locales. Polish carries the corpus's value; the other two carry whatever the
 * overlay holds for that key, which is an empty string until somebody translates it — the desk
 * needs the empty column in order to offer it for editing.
 *
 * @param {object} args
 * @param {string} args.key
 * @param {string} args.kind
 * @param {string} args.plValue
 * @param {Overlays} args.overlays
 * @param {string} args.scopeLabel
 * @param {boolean} [args.hasPage] A concert's `hasPage`; a static page's route is the site's to
 *  know, so its extractor passes nothing.
 * @param {string} args.label
 * @param {number} args.order
 * @returns {Segment[]}
 */
export function localeRows({ key, kind, plValue, overlays, scopeLabel, hasPage = false, label, order }) {
  const path = scopePath(scopeOf(key), { hasPage });
  return SITE_LOCALES.map((locale) => ({
    key,
    locale,
    kind,
    value: locale === "pl" ? plValue : (overlays[locale]?.get(key) ?? ""),
    scope_label: scopeLabel,
    scope_path: path,
    label,
    order,
  }));
}

/**
 * Refuse anything the backend would: a key the pattern does not accept, a value or a label over the
 * DTO's ceiling. Every one of those is cheaper to find here than as a 400 in the middle of an
 * ingest run, where half the corpus is already written.
 *
 * @param {Segment[]} segments
 */
export function guardSegments(segments) {
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
    if (!SCOPE_PATH_PATTERN.test(segment.scope_path) || segment.scope_path.length > MAX_SCOPE_PATH_LENGTH) {
      throw new Error(`[copydesk] ${segment.key}: scope path rejected: ${segment.scope_path}`);
    }
  }
}
