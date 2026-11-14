/**
 * @file sourceFolios.ts
 * @description The arithmetic of reviewing an edition's own page numbers, shared
 * by the edition preview and the programme row: which pages a reviewed rule
 * touches, how a set of pages reads, which covers a keep cancels, and why a
 * piece's setting may currently do nothing. The keep-wins rule mirrors the
 * builder's (`resolve_page_covers`): a keep cancels every cover it touches.
 * @module features/projects/lib/sourceFolios
 */

import type {
  EditionFolioRule,
  ScorePackageConfig,
  ScorePackageItem,
} from "../api/project.service";

/** A rectangle as fractions of the visible page, from its top-left. */
export interface PageRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Whether `rule` applies to 1-based edition page `page`. */
export const ruleHits = (rule: EditionFolioRule, page: number): boolean =>
  rule.first <= page &&
  page <= rule.last &&
  (rule.parity === "all" || rule.parity === (page % 2 ? "odd" : "even"));

/** Every edition page a rule touches, within the edition's `total` pages. */
export const rulePages = (rule: EditionFolioRule, total: number): number[] => {
  const pages: number[] = [];
  const last = total > 0 ? Math.min(rule.last, total) : rule.last;
  for (let page = rule.first; page <= last; page += 1) {
    if (ruleHits(rule, page)) pages.push(page);
  }
  return pages;
};

/**
 * Pages as a reader scans them: consecutive runs of three or more collapse to
 * "3–9", everything else is listed, so "2, 4, 6" shows the parity it has.
 */
export const formatPages = (pages: readonly number[]): string => {
  const sorted = [...new Set(pages)].sort((a, b) => a - b);
  const parts: string[] = [];
  let index = 0;
  while (index < sorted.length) {
    let end = index;
    while (end + 1 < sorted.length && sorted[end + 1] === sorted[end] + 1) end += 1;
    if (end - index >= 2) {
      parts.push(`${sorted[index]}–${sorted[end]}`);
    } else {
      for (let i = index; i <= end; i += 1) parts.push(String(sorted[i]));
    }
    index = end + 1;
  }
  return parts.join(", ");
};

/** Interior overlap — rectangles that only share an edge do not touch. */
export const overlaps = (a: PageRect, b: PageRect): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** Why the book ignores a piece's folio review, or null when it applies. */
export type SourceNumberingOff = "book_numbering" | "item" | "book_switch";

/** Same gate order as the server's `resolve_source_numbering`. */
export const sourceNumberingOff = (
  item: Pick<ScorePackageItem, "hide_source_page_numbers">,
  config: Pick<ScorePackageConfig, "include_page_numbers" | "hide_source_page_numbers">,
): SourceNumberingOff | null => {
  if (!config.include_page_numbers) return "book_numbering";
  if (item.hide_source_page_numbers === false) return "item";
  if (item.hide_source_page_numbers === null && !config.hide_source_page_numbers) {
    return "book_switch";
  }
  return null;
};
