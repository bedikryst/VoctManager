import type { Piece } from "@/shared/types";

export interface ReferenceRecordingLink {
  platform: "youtube" | "spotify" | "legacy";
  label: string;
  url: string;
}

const normalizeUrl = (value?: string | null): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

export const getReferenceRecordingLinks = (
  piece: Pick<
    Piece,
    | "reference_recording"
    | "reference_recording_youtube"
    | "reference_recording_spotify"
  >,
): ReferenceRecordingLink[] => {
  const youtube = normalizeUrl(piece.reference_recording_youtube);
  const spotify = normalizeUrl(piece.reference_recording_spotify);
  const legacy = normalizeUrl(piece.reference_recording);

  const links: ReferenceRecordingLink[] = [];

  if (youtube) {
    links.push({ platform: "youtube", label: "YouTube", url: youtube });
  }

  if (spotify) {
    links.push({ platform: "spotify", label: "Spotify", url: spotify });
  }

  if (!youtube && !spotify && legacy) {
    links.push({ platform: "legacy", label: "Referencja", url: legacy });
  }

  return links;
};

export const getPrimaryReferenceRecording = (
  piece: Pick<
    Piece,
    | "reference_recording"
    | "reference_recording_youtube"
    | "reference_recording_spotify"
  >,
): ReferenceRecordingLink | null =>
  getReferenceRecordingLinks(piece)[0] ?? null;
