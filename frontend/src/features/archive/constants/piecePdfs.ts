/**
 * @file piecePdfs.ts
 * @description Convenience accessor over `Piece.editions` for consumers that
 * just want a flat list of downloadable PDFs (PieceCard badge, materials
 * download buttons). Default edition surfaces first; the rest is ordered by
 * recency.
 */
import type { Piece, ScoreEditionSummary } from "@/shared/types";

export interface PiecePdfLink {
  /** Edition id (UUID). */
  id: string;
  url: string;
  /** Human-readable label — defaults to original filename, falls back to publisher. */
  label: string;
  is_default: boolean;
  publisher?: string;
  edition_year?: number | null;
  page_count?: number | null;
}

type PieceLike = Pick<Piece, "editions">;

const normalizeLabel = (edition: ScoreEditionSummary): string => {
  const filename = edition.original_filename?.trim();
  if (filename) return filename;
  if (edition.publisher) {
    return edition.edition_year
      ? `${edition.publisher} (${edition.edition_year})`
      : edition.publisher;
  }
  return "Score edition";
};

export const getPiecePdfLinks = (piece: PieceLike): PiecePdfLink[] => {
  const editions = (piece.editions ?? []).filter((e) =>
    Boolean(e.pdf_file?.trim()),
  );
  return [...editions]
    .sort((a, b) => {
      if (a.is_default !== b.is_default) return a.is_default ? -1 : 1;
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
    }));
};

export const hasPdf = (piece: PieceLike): boolean =>
  getPiecePdfLinks(piece).length > 0;

export const getPrimaryPdf = (piece: PieceLike): PiecePdfLink | null =>
  getPiecePdfLinks(piece)[0] ?? null;
