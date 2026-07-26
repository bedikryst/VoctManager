/**
 * @file programDuration.ts
 * @description Duration formatting for the concert programme.
 * A setlist is read as a tracklist: the per-piece figure belongs in a
 * right-aligned column in `m:ss`, where the shape of the programme can be
 * scanned down the edge, not buried mid-sentence in a meta line as
 * "3 min 30 sek".
 * @architecture Enterprise SaaS 2026
 * @module features/projects/lib/programDuration
 */

const pad = (value: number): string => String(value).padStart(2, "0");

/** `3:30` · `12:00` · `1:04:10`. Null when the piece carries no duration. */
export const formatClockDuration = (
  totalSeconds?: number | null,
): string | null => {
  if (!totalSeconds || totalSeconds <= 0) return null;

  const whole = Math.round(totalSeconds);
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const seconds = whole % 60;

  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${minutes}:${pad(seconds)}`;
};
