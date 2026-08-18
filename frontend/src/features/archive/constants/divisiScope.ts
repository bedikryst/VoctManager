/**
 * @file divisiScope.ts
 * @description Which of a piece's divisi layers a given reader is looking at —
 * the panel's mirror of `archive/services/voice_scope.py`.
 *
 * A work published in more than one arrangement can have more than one voicing:
 * the same motet in unison and in three parts. Requirements and practice tracks
 * therefore carry an optional edition, and resolution is an OVERRIDE, never a
 * merge — an edition that declares its own lines replaces the piece-wide set
 * outright, because "unison" plus "three parts" describes no arrangement anyone
 * sings. An edition that declares nothing inherits the piece-wide layer.
 * @architecture Enterprise SaaS 2026
 * @module features/archive/constants/divisiScope
 */

import type { Piece, VoiceRequirement } from "@/shared/types";

import { getPiecePdfLinks } from "./piecePdfs";

/** Anything carrying the optional edition FK — requirements and tracks alike. */
interface EditionScoped {
  edition?: string | null;
}

/**
 * The edition a concert works from: the conductor's pin while it is still a
 * live, file-bearing edition of this piece, otherwise the auto-selected default
 * (`getPiecePdfLinks` already sorts default-first, then by recency, which is
 * the rule `score_package_config.resolve_item_edition` applies server-side).
 */
export const resolveBoundEditionId = (
  piece: Pick<Piece, "editions"> | null | undefined,
  pinnedEditionId?: string | null,
): string | null => {
  if (!piece) return null;
  const editions = getPiecePdfLinks(piece);
  if (pinnedEditionId && editions.some((e) => e.id === pinnedEditionId)) {
    return pinnedEditionId;
  }
  return editions[0]?.id ?? null;
};

/** The rows that apply to `editionId`, with the piece-wide layer as fallback. */
export const scopedToEdition = <T extends EditionScoped>(
  rows: readonly T[],
  editionId: string | null,
): T[] => {
  if (editionId) {
    const own = rows.filter((row) => row.edition === editionId);
    if (own.length > 0) return own;
  }
  return rows.filter((row) => !row.edition);
};

/** The divisi a concert actually sings, given the edition it binds. */
export const scopedRequirements = (
  piece: (Pick<Piece, "editions"> & { voice_requirements_read?: VoiceRequirement[] }) | null | undefined,
  pinnedEditionId?: string | null,
): VoiceRequirement[] =>
  piece
    ? scopedToEdition(
        piece.voice_requirements_read ?? [],
        resolveBoundEditionId(piece, pinnedEditionId),
      )
    : [];
