// @ts-check
/**
 * @file normalize.mjs
 * @description The copy desk's source hash, mirrored in JavaScript.
 *  `backend/copydesk/hashing.py` is the SOLE source of truth for what the hash is taken over;
 *  this file has one job, which is to reproduce it character for character. A drift between the
 *  two is silent and expensive in one direction: if the two disagree, every translation in the
 *  corpus reads as stale (or, worse, a moved Polish reads as fresh) and nothing in the build says
 *  so. `fixtures/hash-parity.json` is generated FROM the Python and read by both sides, so a
 *  disagreement fails a test on each rather than surfacing on the desk weeks later.
 *
 *  The rules, in the order they apply — see `hashing.py` for why each one exists:
 *    1. NFC.
 *    2. Line endings to LF.
 *    3. Hard spaces (NBSP, narrow NBSP, thin space) to ordinary spaces.
 *    4. Strip the ends. Interior whitespace is deliberately left alone.
 * @architecture Astro islands 2026
 * @module copydesk/normalize
 */

import { createHash } from "node:crypto";

/**
 * The three hard spaces `lib/typo.ts` inserts at build time, built from escapes rather than
 * written as characters for the same reason `hashing.py` declares them as codepoints: they are
 * invisible in an editor, and a file carrying them literally is one careless paste away from
 * folding a different set. Every character of this line is ASCII, which is the point.
 */
const HARD_SPACES = new RegExp("[\\u00a0\\u202f\\u2009]", "gu");

/**
 * Python's whitespace — the set `str.strip()` removes, which is what step 4 must match.
 *
 * NOT `String.prototype.trim()`, and the difference is not academic: JavaScript strips U+FEFF,
 * which Python does not treat as whitespace at all, and Python strips U+0085 and U+001C..U+001F,
 * which JavaScript leaves standing. Two of the twenty parity cases exist to hold this line.
 */
const PYTHON_SPACE =
  "\\t\\n\\v\\f\\r\\x1c\\x1d\\x1e\\x1f\\x85\\u0020\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000";

const TRIM_ENDS = new RegExp(`^[${PYTHON_SPACE}]+|[${PYTHON_SPACE}]+$`, "gu");

/**
 * The exact text the hash is taken over.
 *
 * @param {string} value
 * @returns {string}
 */
export function normalizeForHash(value) {
  return value
    .normalize("NFC")
    .replace(/\r\n?/gu, "\n")
    .replace(HARD_SPACES, " ")
    .replace(TRIM_ENDS, "");
}

/**
 * SHA-256 (hex) of the normalized value, or `""` when there is nothing to hash.
 *
 * The empty answer is load-bearing on the Python side — it means "no source is recorded", which
 * the desk renders differently from "up to date" — so the mirror returns it too rather than
 * hashing the empty string.
 *
 * @param {string} value
 * @returns {string}
 */
export function sourceHash(value) {
  const normalized = normalizeForHash(value);
  if (!normalized) return "";
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}
