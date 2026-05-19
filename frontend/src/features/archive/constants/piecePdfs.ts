/**
 * @file piecePdfs.ts
 * @description Unifies the two PDF stores a Piece can carry into one helper:
 *   - Legacy single-PDF `Piece.sheet_music` (Archive editor pre-Phase-0).
 *   - Score Compiler `editions[]` (one row per uploaded edition — Bärenreiter,
 *     IMSLP, custom arrangement, …).
 *
 * Consumers (PieceCard badge, ArchiveAIContextTab editions list,
 * PieceMaterialCard download buttons) call this single function so the
 * "what counts as a PDF for this piece" rule stays consistent.
 */
import type { Piece, ScoreEditionSummary } from "@/shared/types";

export interface PiecePdfLink {
  /** Stable identifier — edition id, or `"sheet_music"` for the legacy field. */
  id: string;
  url: string;
  /** Human-readable label (defaults to the filename, falls back to publisher). */
  label: string;
  is_default: boolean;
  publisher?: string;
  edition_year?: number | null;
  page_count?: number | null;
  /** True only for the legacy `Piece.sheet_music` field. */
  is_legacy: boolean;
}

type PieceLike = Pick<Piece, "sheet_music" | "editions">;

const normalizeLabel = (
  edition: ScoreEditionSummary,
): string => {
  const filename = edition.original_filename?.trim();
  if (filename) return filename;
  if (edition.publisher) {
    return edition.edition_year
      ? `${edition.publisher} (${edition.edition_year})`
      : edition.publisher;
  }
  return "Score edition";
};

/**
 * Return every downloadable PDF attached to this piece. ScoreEditions come
 * first (default edition first, then chronological); the legacy
 * `sheet_music` field is appended only when no editions exist — once a piece
 * has been through the Score Compiler the legacy field is effectively dead.
 */
export const getPiecePdfLinks = (piece: PieceLike): PiecePdfLink[] => {
  const editions = (piece.editions ?? []).filter((e) =>
    Boolean(e.pdf_file?.trim()),
  );

  if (editions.length === 0) {
    const legacy = piece.sheet_music?.trim();
    if (!legacy) return [];
    return [
      {
        id: "sheet_music",
        url: legacy,
        label: "Sheet music",
        is_default: true,
        is_legacy: true,
      },
    ];
  }

  return [...editions]
    .sort((a, b) => {
      if (a.is_default !== b.is_default) return a.is_default ? -1 : 1;
      // newer editions first within each tier
      return (b.created_at ?? "").localeCompare(a.created_at ?? "");
    })
    .map((edition) => ({
      id: edition.id,
      url: edition.pdf_file!,
      label: normalizeLabel(edition),
      is_default: edition.is_default,
      publisher: edition.publisher || undefined,
      edition_year: edition.edition_year ?? undefined,
      page_count: edition.page_count ?? undefined,
      is_legacy: false,
    }));
};

export const hasPdf = (piece: PieceLike): boolean =>
  getPiecePdfLinks(piece).length > 0;

export const getPrimaryPdf = (piece: PieceLike): PiecePdfLink | null =>
  getPiecePdfLinks(piece)[0] ?? null;
