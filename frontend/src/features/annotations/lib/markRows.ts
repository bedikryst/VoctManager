/**
 * @file markRows.ts
 * @description Edits to a list of mark rows that keep the list in the server's
 * order. The list is drawn in order, so order is stacking: a mark brought back
 * by an undo has to land under the marks drawn after it, exactly where it was,
 * not on top of everything. The server lists by `created_at`, and so do these.
 * @module features/annotations/lib
 */

import type { ScoreAnnotation } from "../types/annotations.dto";

const createdAt = (row: ScoreAnnotation): number => {
  const time = Date.parse(row.created_at);
  return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time;
};

/** Adds the marks not already listed, each at its place in creation order. */
export const insertMarks = (
  rows: readonly ScoreAnnotation[],
  marks: readonly ScoreAnnotation[],
): ScoreAnnotation[] => {
  const next = [...rows];
  for (const mark of marks) {
    if (next.some((row) => row.id === mark.id)) continue;
    const at = createdAt(mark);
    const index = next.findIndex((row) => createdAt(row) > at);
    if (index === -1) next.push(mark);
    else next.splice(index, 0, mark);
  }
  return next;
};

/** Replaces the mark with the same id where it stands, or inserts it. */
export const upsertMark = (
  rows: readonly ScoreAnnotation[],
  mark: ScoreAnnotation,
): ScoreAnnotation[] =>
  rows.some((row) => row.id === mark.id)
    ? rows.map((row) => (row.id === mark.id ? mark : row))
    : insertMarks(rows, [mark]);

export const withoutMarks = (
  rows: readonly ScoreAnnotation[],
  ids: ReadonlySet<string>,
): ScoreAnnotation[] => rows.filter((row) => !ids.has(row.id));
