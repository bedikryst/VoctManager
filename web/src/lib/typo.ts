/**
 * @file typo.ts
 * @description Polish micro-typography for build-time strings. `nbsp()` pins two classes of
 *  token to the following word with a non-breaking space so they never orphan at a line end:
 *  one-letter conjunctions/prepositions (a, i, o, u, w, z — plus "we"/"ze"), and qualifying
 *  abbreviations (honorifics/titles "św.", "bł.", "o.", "abp", "bp"; address "ul."; legal
 *  "art.", "ust.", "lit."; "np."). Apply to DATA strings (YAML blurbs, card copy) at render
 *  time; hand-written markup uses &nbsp; entities directly.
 * @architecture Astro islands 2026
 * @module lib/typo
 */

/** U+00A0 built explicitly — an invisible literal in source would not survive formatters. */
const NBSP = String.fromCharCode(0xa0);

/** Shared left context: line start, or the space/opening-punctuation before the token. */
const LEFT = "(^|[\\s(„”«>—–-])";

/** One-letter Polish conjunctions/prepositions that must not orphan at a line end. */
const ORPHAN_RE = new RegExp(`${LEFT}([aiouwzAIOUWZ]|[Ww]e|[Zz]e) `, "g");

/**
 * Abbreviations that must stay glued to the word they qualify — a title stranded from its name
 * ("św." │ "Filipa") or a legal marker from its number ("art." │ "6") reads as broken. Dotted
 * forms (św. bł. o. ks. …) require the period; abp/bp/nr also occur dotless. Case-insensitive
 * so the capitalised address form ("ul. Św. Filipa") is caught too.
 */
const ABBR_RE = new RegExp(
  `${LEFT}((?:św|bł|śp|ks|kard|prof|dr|o|ul|al|pl|art|ust|lit|np)\\.|(?:abp|bp|nr)\\.?) `,
  "gi",
);

/**
 * Pin Polish orphans and qualifying abbreviations to the following word with U+00A0. Runs two
 * passes because consecutive tokens ("i w ciszy", "ul. Św. Filipa") share the space the second
 * match needs as its left context — after pass one that space is already NBSP, which \s matches.
 */
export function nbsp(text: string): string {
  const pass = (s: string) =>
    s.replace(ORPHAN_RE, `$1$2${NBSP}`).replace(ABBR_RE, `$1$2${NBSP}`);
  return pass(pass(text));
}
