/**
 * @file referenceRecordings.ts
 * @description Convenience accessor over `Piece.recordings` for UI consumers
 * that want a flat list of reference-recording links (PieceCard, materials
 * card). Featured recordings sort first, then by platform.
 */
import type { Piece, Recording } from "@/shared/types";

export interface ReferenceRecordingLink {
  platform: "youtube" | "spotify" | "apple" | "other";
  label: string;
  url: string;
  performer?: string;
  year?: number | null;
  is_featured?: boolean;
}

type PieceLike = Pick<Piece, "recordings">;

const sourceToPlatform = (
  source: Recording["source"],
): ReferenceRecordingLink["platform"] => {
  switch (source) {
    case "YTB":
      return "youtube";
    case "SPF":
      return "spotify";
    case "APL":
      return "apple";
    default:
      return "other";
  }
};

const sourceLabel = (source: Recording["source"]): string => {
  switch (source) {
    case "YTB":
      return "YouTube";
    case "SPF":
      return "Spotify";
    case "APL":
      return "Apple Music";
    default:
      return "Other";
  }
};

export const getReferenceRecordingLinks = (
  piece: PieceLike,
): ReferenceRecordingLink[] => {
  return (piece.recordings ?? [])
    .filter((r) => Boolean(r.url?.trim()))
    .map((r) => ({
      platform: sourceToPlatform(r.source),
      label: r.source_display || sourceLabel(r.source),
      url: r.url,
      performer: r.performer || undefined,
      year: r.year ?? undefined,
      is_featured: r.is_featured,
    }))
    .sort((a, b) => Number(b.is_featured) - Number(a.is_featured));
};

export const getPrimaryReferenceRecording = (
  piece: PieceLike,
): ReferenceRecordingLink | null =>
  getReferenceRecordingLinks(piece)[0] ?? null;
