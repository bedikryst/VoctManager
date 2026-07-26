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
 * Lowercase, diacritic-free haystack for substring search. A Polish roster is
 * typed without diacritics far more often than with them, so "zielinska" has to
 * find Zielińska and "gorecki" Górecki — a plain `toLowerCase().includes()`
 * finds neither.
 */
export const foldDiacritics = (value: string): string =>
  value.normalize("NFD").replace(COMBINING_MARKS, "").toLowerCase();
