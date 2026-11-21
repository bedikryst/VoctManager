/**
 * @file useTrackBatch.ts
 * @description The audio files waiting in the tracks section's batch queue.
 * The queue is held by whoever owns the drop target, not by the section: on
 * the card the page is the one drop target, and it hands audio here while
 * PDFs go to the editions (`PieceCardPage`).
 * @module features/archive/piece-card/useTrackBatch
 */

import { useCallback, useState } from "react";

/** What the model's `FileExtensionValidator` lets through, as a dropzone map. */
export const AUDIO_ACCEPT: Record<string, string[]> = {
  "audio/mpeg": [".mp3"],
  "audio/wav": [".wav"],
  "audio/x-wav": [".wav"],
  "audio/midi": [".midi"],
};

/** The same list as an `<input accept>` value. */
export const AUDIO_INPUT_ACCEPT = Object.entries(AUDIO_ACCEPT)
  .flatMap(([type, extensions]) => [type, ...extensions])
  .filter((value, index, all) => all.indexOf(value) === index)
  .join(",");

/** Whether the server will take the file by its name, which is all it checks. */
export const hasTrackExtension = (name: string): boolean => /\.(mp3|wav|midi)$/i.test(name);

/** Whether a file the drop target accepted is a track rather than a score. */
export const isAudioFile = (file: File): boolean =>
  file.type.startsWith("audio/") || hasTrackExtension(file.name);

export const useTrackBatch = () => {
  const [files, setFiles] = useState<readonly File[]>([]);
  const add = useCallback((next: readonly File[]): void => {
    if (next.length > 0) setFiles((current) => [...current, ...next]);
  }, []);
  const clear = useCallback((): void => setFiles([]), []);
  return { files, add, clear };
};

export type TrackBatch = ReturnType<typeof useTrackBatch>;
