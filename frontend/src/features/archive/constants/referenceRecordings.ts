/**
 * @file referenceRecordings.ts
 * @description Single helper that merges the two reference-recording stores
 * a Piece can carry:
 *   - Legacy: `reference_recording_youtube` + `reference_recording_spotify`
 *     (one URL per platform, set by the Archive editor before Phase 0).
 *   - Score Compiler: `recordings[]` table (multiple results per platform,
 *     populated by the SpotifyClient / YouTubeClient pipeline tasks).
 *
 * Consumers (PieceCard, PieceMaterialCard, MicroCastingTab) all call this
 * single function so the rule for which links to show stays consistent.
 */
import type { Piece, Recording } from "@/shared/types";

export interface ReferenceRecordingLink {
  platform: "youtube" | "spotify" | "apple" | "legacy" | "other";
  label: string;
  url: string;
  performer?: string;
  year?: number | null;
  is_featured?: boolean;
}

const normalizeUrl = (value?: string | null): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

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

type PieceLike = Pick<
  Piece,
  | "reference_recording"
  | "reference_recording_youtube"
  | "reference_recording_spotify"
  | "recordings"
>;

/**
 * Return every reference recording attached to the piece. Score Compiler
 * `recordings[]` take priority; legacy single-URL fields are appended only
 * when no entry of that platform already came from the new table (otherwise
 * you'd see the same Spotify link twice). Featured recordings sort first.
 */
export const getReferenceRecordingLinks = (
  piece: PieceLike,
): ReferenceRecordingLink[] => {
  const fromTable: ReferenceRecordingLink[] = (piece.recordings ?? [])
    .filter((r) => normalizeUrl(r.url))
    .map((r) => ({
      platform: sourceToPlatform(r.source),
      label: r.source_display || sourceLabel(r.source),
      url: r.url,
      performer: r.performer || undefined,
      year: r.year ?? undefined,
      is_featured: r.is_featured,
    }));

  const hasYoutube = fromTable.some((l) => l.platform === "youtube");
  const hasSpotify = fromTable.some((l) => l.platform === "spotify");

  const legacy: ReferenceRecordingLink[] = [];
  const ytLegacy = normalizeUrl(piece.reference_recording_youtube);
  if (ytLegacy && !hasYoutube) {
    legacy.push({ platform: "youtube", label: "YouTube", url: ytLegacy });
  }
  const spLegacy = normalizeUrl(piece.reference_recording_spotify);
  if (spLegacy && !hasSpotify) {
    legacy.push({ platform: "spotify", label: "Spotify", url: spLegacy });
  }
  if (legacy.length === 0 && fromTable.length === 0) {
    const genericLegacy = normalizeUrl(piece.reference_recording);
    if (genericLegacy) {
      legacy.push({
        platform: "legacy",
        label: "Referencja",
        url: genericLegacy,
      });
    }
  }

  return [...fromTable, ...legacy].sort((a, b) => {
    if ((a.is_featured ? 1 : 0) !== (b.is_featured ? 1 : 0)) {
      return a.is_featured ? -1 : 1;
    }
    return 0;
  });
};

export const getPrimaryReferenceRecording = (
  piece: PieceLike,
): ReferenceRecordingLink | null =>
  getReferenceRecordingLinks(piece)[0] ?? null;
