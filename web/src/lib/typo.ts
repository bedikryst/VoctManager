/**
 * @file typo.ts
 * @description Micro-typography — the single source of truth for where a line of this site is
 *  allowed to break. Every rule replaces a breakable space with a non-breaking one; nothing here
 *  changes the words, so a pass is safe to run over any string and safe to run twice.
 *
 *  Three layers:
 *   - COMMON (every locale): initials (`J. S. Bach`), a number and the thing it counts, digit
 *     groups of a thousand, year ranges, and the spaced dash — which is pinned to the word BEFORE
 *     it so a dash can never open a line.
 *   - PL: the Polish orphan rule ("sierotki" — a one-letter conjunction/preposition may not end a
 *     line) and the abbreviations that must stay with what they qualify ("św." / "Filipa",
 *     "art." / "6").
 *   - FR: the French space before high punctuation (thin no-break before ; ! ?, no-break before :
 *     and inside guillemets). English needs neither, so it runs COMMON alone.
 *
 *  APPLIED AUTOMATICALLY to every text node of every page — see `typoHtml.ts` + `middleware.ts`.
 *  Page and component authors write plain prose and get this for free; `&nbsp;` belongs in markup
 *  only for a binding these rules do NOT make (a full name like `Florent&nbsp;de&nbsp;Bazelaire`,
 *  or a two-letter preposition pinned for a particular column width).
 *
 *  THE ONE EXCEPTION IS REACT ISLANDS. Their SSR markup is skipped by the HTML pass, because
 *  rewriting text React is about to hydrate is a hydration mismatch — React would discard the
 *  server HTML and re-render, dropping the fix on the floor. Island prose calls `typoFor()` /
 *  `nbsp()` itself, at render time, so server and client produce the same string.
 * @architecture Astro islands 2026
 * @module lib/typo
 */

import type { Locale } from "../i18n/config";

/** U+00A0 built explicitly — an invisible literal in source would not survive formatters. */
const NBSP = String.fromCharCode(0xa0);
/** U+202F narrow no-break space — the French thin space before ; ! ? (built explicitly, as NBSP). */
const NNBSP = String.fromCharCode(0x202f);
/** U+2060 word joiner — forbids a break without occupying width (year ranges). */
const WJ = String.fromCharCode(0x2060);

/**
 * One run of collapsible whitespace = exactly one rendered space, so a rule must consume the run
 * and emit a single NBSP. Matching a lone " " would miss every break the source's own line
 * wrapping introduced — in `<p>\n  wchodzi się z\n  ulicy` the break opportunity after "z" is a
 * newline, and it renders exactly like a space.
 */
const SP = "[ \\t\\r\\n]+";

/** Uppercase across the three locales — JS `\b` is ASCII-only, so diacritics need an explicit set. */
const UPPER = "A-ZĄĆĘŁŃÓŚŹŻÀÂÄÇÉÈÊËÎÏÔÖÙÛÜŸ";

/** Shared left context: line start, or the space/opening punctuation before the token. */
const LEFT = "(^|[\\s(„”«»>—–-])";

/** A rewrite that only ever swaps a breakable space for an unbreakable one. */
type Rule = readonly [pattern: RegExp, replacement: string];

/**
 * Elements that do not interrupt a line, so text on either side of one is the same sentence and a
 * rule may bind across it (`<em>9 Kart</em> — nabierają` needs the "t" to hold the dash). Anything
 * absent from this set — every block box, and `<br>`/`<wbr>`, which ARE the break — ends the run.
 * Shared by the HTML pass and the React one so both draw that line in the same place.
 */
export const INLINE_ELEMENTS: ReadonlySet<string> = new Set([
  "a", "abbr", "b", "bdi", "bdo", "cite", "data", "dfn", "em", "i", "mark",
  "q", "rp", "rt", "ruby", "s", "small", "span", "strong", "sub", "sup",
  "time", "u", "var",
]);

/**
 * Language-neutral bindings — these hold together what is one unit in any tongue.
 * The dash rule is the one that also normalises: it re-emits a plain space AFTER the dash, so a
 * whitespace run there collapses the same way the browser would render it.
 */
const COMMON: readonly Rule[] = [
  // "J. S. Bach" — an initial stranded from the name it abbreviates. Only before another capital,
  // which is what keeps "…Bank Polska S.A. z siedzibą" from swallowing the clause after it.
  [new RegExp(`${LEFT}([${UPPER}]\\.)${SP}(?=[${UPPER}])`, "g"), `$1$2${NBSP}`],
  // "20 000 zł" — the thousands group is part of the number, not a following word.
  [new RegExp(`(\\d)${SP}(?=\\d{3}(?!\\d))`, "g"), `$1${NBSP}`],
  // A numeral and what it counts: "12 głosów", "20 stycznia", "2024 r.", "80 %". Bound only to a
  // LOWERCASE word — a capital after a number is a new field, not its unit ("cze 2024 · Bazylika").
  [new RegExp(`(\\d)${SP}(?=[\\p{Ll}%‰°])`, "gu"), `$1${NBSP}`],
  // "1685–1750" — a year range is one token. En dash only: a hyphen there is a postal code or a
  // phone number, and a word joiner inside those would travel into anything the visitor copies.
  [/(\b\d{4})([–—])(?=\d{4}\b)/g, `$1$2${WJ}`],
  // A spaced dash belongs to the phrase it closes — it may never be the first thing on a line.
  [new RegExp(`(\\S)${SP}([—–])${SP}`, "g"), `$1${NBSP}$2 `],
];

/** One-letter Polish conjunctions/prepositions that must not orphan at a line end. */
const PL_ORPHAN: Rule = [
  new RegExp(`${LEFT}([aiouwzAIOUWZ]|[Ww]e|[Zz]e)${SP}`, "g"),
  `$1$2${NBSP}`,
];

/**
 * Abbreviations that must stay glued to the word they qualify — a title stranded from its name
 * ("św." / "Filipa") or a legal marker from its number ("art." / "6") reads as broken. Dotted
 * forms require the period; abp/bp/dr/mgr/nr/wg also occur dotless. Case-insensitive so the
 * capitalised address form is caught too.
 *
 * Deliberately absent: "r." and "w." (rok / wiek). Those FOLLOW their number — "2024 r." is bound
 * by the numeral rule above, and binding them forward would glue a year to the next sentence.
 */
const PL_ABBR: Rule = [
  new RegExp(
    `${LEFT}((?:św|bł|śp|ks|kard|prof|hab|inż|o|ul|al|pl|art|ust|lit|np|tzw|tj|im|godz|ok|zob|por|pt|cz|str)\\.|(?:abp|bp|dr|mgr|nr|wg)\\.?)${SP}`,
    "gi",
  ),
  `$1$2${NBSP}`,
];

/** "XXI w." — the century's numeral and its marker are one token. */
const PL_ROMAN: Rule = [
  new RegExp(`${LEFT}([IVXLCDM]{1,7})${SP}(?=[wr]\\.)`, "g"),
  `$1$2${NBSP}`,
];

const PL: readonly Rule[] = [...COMMON, PL_ORPHAN, PL_ABBR, PL_ROMAN];

/**
 * French: the space BEFORE high punctuation is unbreakable, so a colon or a question mark never
 * begins a line stranded from its clause. Thin no-break (U+202F) before ; ! ?, full no-break
 * (U+00A0) before : and hugging the inside of the guillemets.
 *
 * The punctuation rules UPGRADE a space that is already there; they never introduce one. That is
 * deliberate, and not only stylistic caution: this pass runs over raw HTML, where every `&#39;`
 * and `&nbsp;` ends in a semicolon. A rule free to insert before `;` rewrote `l&#39;` as `l&#39 ;`
 * on the French page — 47 broken apostrophes, each rendering as literal text. French copy here is
 * written with the space, so requiring one costs nothing and closes that whole class of damage.
 * The guillemet rules may still insert: `«` and `»` cannot occur inside an entity.
 */
const FR_SPACE = "[ \\u00a0\\u202f]";
const FR: readonly Rule[] = [
  ...COMMON,
  [new RegExp(`(\\S)${FR_SPACE}([;!?])`, "g"), `$1${NNBSP}$2`],
  [new RegExp(`(\\S)${FR_SPACE}(:)`, "g"), `$1${NBSP}$2`],
  [new RegExp(`«${FR_SPACE}?`, "g"), `«${NBSP}`],
  [new RegExp(`${FR_SPACE}?»`, "g"), `${NBSP}»`],
];

const RULES: Record<Locale, readonly Rule[]> = { pl: PL, en: COMMON, fr: FR };

/**
 * Run a rule set to a fixed point. One pass is not enough: consecutive tokens share the space the
 * second match needs as its left context ("w z" / "J. S. T."), and after the first pass that space
 * is already an NBSP — which `\s` matches, so the next pass sees it. Three iterations covers every
 * chain that occurs in real copy; the cap is what guarantees termination if a rule is ever written
 * non-idempotently.
 */
function run(text: string, rules: readonly Rule[]): string {
  let out = text;
  for (let i = 0; i < 3; i++) {
    let next = out;
    for (const [pattern, replacement] of rules) next = next.replace(pattern, replacement);
    if (next === out) break;
    out = next;
  }
  return out;
}

/** Pin Polish orphans, abbreviations and the language-neutral bindings. */
export function nbsp(text: string): string {
  return run(text, PL);
}

/** French micro-typography (spaces before high punctuation, guillemets) + the common bindings. */
export function nbspFr(text: string): string {
  return run(text, FR);
}

/** English has no orphan or punctuation-spacing convention — the common bindings only. */
export function nbspEn(text: string): string {
  return run(text, COMMON);
}

/** Pick the micro-typography pass for a locale. */
export function typoFor(locale: Locale): (text: string) => string {
  const rules = RULES[locale] ?? PL;
  return (text: string) => run(text, rules);
}
