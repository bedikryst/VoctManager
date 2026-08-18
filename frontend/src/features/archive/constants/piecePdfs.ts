/**
 * @file piecePdfs.ts
 * @description Convenience accessor over `Piece.editions` for consumers that
 * just want a flat list of downloadable PDFs (PieceCard badge, materials
 * download buttons). Default edition surfaces first; the rest is ordered by
 * recency.
 */
import { INGESTION_STATUS, type Piece, type ScoreEditionSummary } from "@/shared/types";

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
  /**
   * Whether this edition may leave the app (open/share/download). Server-computed
   * from licence × role; defaults to true when the source omits it (public domain).
   */
  canExport: boolean;
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
      canExport: edition.can_export ?? true,
    }));
};

/**
 * How an edition is named where one has to be *chosen* rather than downloaded:
 * the publisher and the year, which is how a conductor asks for a score, and the
 * upload's filename only when neither is known. Mirrors the naming rule of
 * `roster/score_package_config.edition_label`, so the setlist picker and the
 * score-book cockpit put the same words on the same edition — the cockpit adds
 * the page count, which a running order has no use for.
 */
export const formatEditionLabel = (link: PiecePdfLink): string => {
  const parts = [link.publisher, link.edition_year].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : link.label;
};

export const hasPdf = (piece: PieceLike): boolean =>
  getPiecePdfLinks(piece).length > 0;

export const getPrimaryPdf = (piece: PieceLike): PiecePdfLink | null =>
  getPiecePdfLinks(piece)[0] ?? null;

/**
 * The score a Piece Card should put on screen: the edition awaiting approval
 * when there is one, otherwise the piece's primary.
 *
 * A review means checking one document's extractions against that document —
 * and its annotations belong to it too. Falling back to "default, then newest"
 * happened to land on the right edition only because nothing in the app sets
 * `is_default`; the moment anything does, the conductor would be verifying
 * edition B's fields against edition A's pages.
 */
export const getReviewPdf = (piece: PieceLike): PiecePdfLink | null => {
  const links = getPiecePdfLinks(piece);
  const awaiting = (piece.editions ?? []).find(
    (edition) => edition.ingestion_status === INGESTION_STATUS.AWAITING,
  );
  const underReview = awaiting
    ? links.find((link) => link.id === awaiting.id)
    : undefined;
  return underReview ?? links[0] ?? null;
};
