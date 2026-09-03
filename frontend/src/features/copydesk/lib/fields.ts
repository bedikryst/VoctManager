/**
 * @file fields.ts
 * @description Turns the flat segment payload into what the desk reads: one
 * entry per FIELD of the page, in the site's own reading order, carrying its
 * languages side by side.
 * @architecture Enterprise SaaS 2026
 * @module features/copydesk/lib/fields
 */

import { readCell, type CopyDeskCell } from "./proposals";
import type { CopyDeskSegment, SiteLocale } from "../types/copydesk.dto";

/**
 * One editable field of a page, in every language the mirror holds for it.
 *
 * The desk's unit is the field, not the row: a paragraph and its two
 * translations are one thing an editor works on, and splitting them into three
 * entries of a list would put the French of the first sentence between the
 * Polish of the first and the English of the second.
 *
 * `label` and `order` come from the key contract in `web/copydesk/contract.mjs`,
 * which is git — Polish text, and deliberately not translated: it names a slot
 * in the repository, and an editor who reports "the note under the third work"
 * has to be naming the same thing the developer will look for.
 */
export interface CopyDeskField {
  readonly key: string;
  readonly label: string;
  readonly order: number;
  /** Absent where the extractor holds no row for that language yet. */
  readonly cells: Partial<Record<SiteLocale, CopyDeskCell>>;
}

/**
 * The payload already arrives ordered by `order`, and this preserves it rather
 * than re-deriving it: the contract's declaration order IS the sequence
 * `/koncerty/[id]` prints, and a sort here would be a second opinion about the
 * page's shape that nothing keeps in step with the first.
 */
export const buildFields = (
  segments: readonly CopyDeskSegment[],
): readonly CopyDeskField[] => {
  const byKey = new Map<string, CopyDeskField>();

  for (const segment of segments) {
    const existing = byKey.get(segment.key);
    if (existing) {
      byKey.set(segment.key, {
        ...existing,
        cells: { ...existing.cells, [segment.locale]: readCell(segment) },
      });
      continue;
    }
    byKey.set(segment.key, {
      key: segment.key,
      label: segment.label,
      order: segment.order,
      cells: { [segment.locale]: readCell(segment) },
    });
  }

  return [...byKey.values()];
};
