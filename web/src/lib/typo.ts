/**
 * @file typo.ts
 * @description Per-locale micro-typography for build-time strings. `nbsp()` (Polish) pins two
 *  classes of token to the following word with a non-breaking space so they never orphan at a
 *  line end: one-letter conjunctions/prepositions (a, i, o, u, w, z — plus "we"/"ze"), and
 *  qualifying abbreviations (honorifics/titles "sw.", "bl.", "o.", "abp", "bp"; address "ul.";
 *  legal "art.", "ust.", "lit."; "np."). `nbspFr()` applies the French space-before-punctuation
 *  rule (thin no-break space before ; ! ?, no-break before : and inside guillemets). English has
 *  no such convention, so `nbspEn()` is identity. Use `typoFor(locale)` to pick the right one for
 *  localized copy. Apply to DATA strings (YAML blurbs, card copy) at render time; hand-written
 *  markup uses &nbsp; entities directly.
 * @architecture Astro islands 2026
 * @module lib/typo
 */

import type { Locale } from "../i18n/config";

/** U+00A0 built explicitly — an invisible literal in source would not survive formatters. */
const NBSP = String.fromCharCode(0xa0);
/** U+202F narrow no-break space — the French thin space before ; ! ? (built explicitly, as NBSP). */
const NNBSP = String.fromCharCode(0x202f);

/** Shared left context: line start, or the space/opening-punctuation before the token. */
const LEFT = "(^|[\\s(„”«>—–-])";

/** One-letter Polish conjunctions/prepositions that must not orphan at a line end. */
const ORPHAN_RE = new RegExp(`${LEFT}([aiouwzAIOUWZ]|[Ww]e|[Zz]e) `, "g");

/**
 * Abbreviations that must stay glued to the word they qualify — a title stranded from its name
 * ("sw." / "Filipa") or a legal marker from its number ("art." / "6") reads as broken. Dotted
 * forms require the period; abp/bp/nr also occur dotless. Case-insensitive so the capitalised
 * address form is caught too.
 */
const ABBR_RE = new RegExp(
  `${LEFT}((?:św|bł|śp|ks|kard|prof|dr|o|ul|al|pl|art|ust|lit|np)\\.|(?:abp|bp|nr)\\.?) `,
  "gi",
);

/**
 * Pin Polish orphans and qualifying abbreviations to the following word with U+00A0. Runs two
 * passes because consecutive tokens share the space the second match needs as its left context —
 * after pass one that space is already NBSP, which \s matches.
 */
export function nbsp(text: string): string {
  const pass = (s: string) =>
    s.replace(ORPHAN_RE, `$1$2${NBSP}`).replace(ABBR_RE, `$1$2${NBSP}`);
  return pass(pass(text));
}

/**
 * French micro-typography: the space BEFORE high punctuation is a no-break space, so a colon or
 * question mark never begins a line stranded from its clause. Convention: a thin no-break space
 * (U+202F) before ; ! ?, a full no-break space (U+00A0) before : and hugging the inside of the
 * guillemets. The optional-space class absorbs an ordinary space, NBSP or thin NBSP already
 * present, so the pass is idempotent. Apply to French DATA strings; French markup can also use
 * the entities directly.
 */
export function nbspFr(text: string): string {
  const SP = "[ \\u00a0\\u202f]?"; // optional ordinary / no-break / thin space to absorb
  const GUILLE_OPEN = "«";
  const GUILLE_CLOSE = "»";
  return text
    .replace(new RegExp(`(\\S)${SP}([;!?])`, "g"), `$1${NNBSP}$2`)
    .replace(new RegExp(`(\\S)${SP}(:)`, "g"), `$1${NBSP}$2`)
    .replace(new RegExp(`${GUILLE_OPEN}${SP}`, "g"), `${GUILLE_OPEN}${NBSP}`)
    .replace(new RegExp(`${SP}${GUILLE_CLOSE}`, "g"), `${NBSP}${GUILLE_CLOSE}`);
}

/** English needs no orphan/punctuation pinning by convention — identity. */
export function nbspEn(text: string): string {
  return text;
}

/** Pick the micro-typography pass for a locale. */
export function typoFor(locale: Locale): (text: string) => string {
  return locale === "pl" ? nbsp : locale === "fr" ? nbspFr : nbspEn;
}
