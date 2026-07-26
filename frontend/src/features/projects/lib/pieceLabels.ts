/**
 * @file pieceLabels.ts
 * @description How a piece names itself on a project surface. The composer is
 * tolerant of the partial shape the AI-enriched archive can return (full_name
 * present, parts missing, or the other way round), which is why it is resolved
 * here once instead of at each call site.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/lib/pieceLabels
 */

import type { Piece } from "@/shared/types";

export const getComposerName = (piece?: Piece): string | null => {
  const composer = piece?.composer;
  if (!composer) return null;

  const fromParts = [composer.first_name, composer.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();

  return composer.full_name?.trim() || fromParts || null;
};

/**
 * The row's second line: composer · voicing. The duration is deliberately not
 * here — it is a column on the right edge, where the shape of a programme can
 * be read down the page.
 */
export const buildPieceMeta = (piece?: Piece): string | null => {
  const parts = [getComposerName(piece), piece?.voicing?.trim() || null].filter(
    (part): part is string => Boolean(part),
  );

  return parts.length > 0 ? parts.join(" · ") : null;
};
