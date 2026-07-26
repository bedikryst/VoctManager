/**
 * @file text.ts
 * @description Domain-free string helpers for search and comparison.
 * @architecture Enterprise SaaS 2026
 * @module shared/lib/text
 */

/**
 * Every Unicode combining mark, which is exactly what NFD decomposition peels
 * off a letter. Named through the property escape rather than a literal
 * codepoint range: a combining character typed into source is invisible in
 * every editor and does not survive a copy-paste.
 */
const COMBINING_MARKS = /\p{M}/gu;

/**
 * Letters whose diacritic is a stroke through the glyph rather than a mark
 * beside it. NFD cannot help here — they are atomic codepoints with no
 * decomposition — so without this map `ł` survives the fold and "lukaszewski"
 * misses Łukaszewski, which in a Polish repertoire is not an edge case.
 */
const STROKED_LETTERS: Record<string, string> = {
  ł: "l",
  đ: "d",
  ð: "d",
  ø: "o",
  ħ: "h",
  ŧ: "t",
  ß: "ss",
};

const STROKED_PATTERN = new RegExp(
  `[${Object.keys(STROKED_LETTERS).join("")}]`,
  "g",
);

/**
 * Lowercase, diacritic-free haystack for substring search. A Polish roster is
 * typed without diacritics far more often than with them, so "zielinska" has to
 * find Zielińska and "gorecki" Górecki — a plain `toLowerCase().includes()`
 * finds neither.
 *
 * Case is folded first, so the stroked map only has to carry lowercase forms.
 */
export const foldDiacritics = (value: string): string =>
  value
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .toLowerCase()
    .replace(STROKED_PATTERN, (letter) => STROKED_LETTERS[letter] ?? letter);
