/**
 * @file typo.ts
 * @description Polish micro-typography for build-time strings. `nbsp()` pins one-letter
 *  conjunctions/prepositions (a, i, o, u, w, z — plus "we"/"ze") to the following word with
 *  a non-breaking space so they never orphan at a line end. Apply to DATA strings (YAML
 *  blurbs, card copy) at render time; hand-written markup uses &nbsp; entities directly.
 * @architecture Astro islands 2026
 * @module lib/typo
 */

const ORPHAN_RE = /(^|[\s(„”«>—–-])([aiouwzAIOUWZ]|[Ww]e|[Zz]e) /g;

/** U+00A0 built explicitly — an invisible literal in source would not survive formatters. */
const NBSP = String.fromCharCode(0xa0);

/**
 * Replace the space after Polish orphan words with a non-breaking space. Runs two passes
 * because consecutive orphans ("i w ciszy") share the space the second match needs as its
 * left context — after pass one that context is already NBSP, which \s still matches.
 */
export function nbsp(text: string): string {
  const pass = (s: string) => s.replace(ORPHAN_RE, `$1$2${NBSP}`);
  return pass(pass(text));
}
