/**
 * @file resumeStore.ts
 * @description Cross-surface playback resume for the landing's video players. Positions are
 *  keyed by the MP4's public src and kept in sessionStorage (single tab-session — no
 *  persistence, no consent surface), so the same file picks up where the visitor left off
 *  across surfaces: hero lightbox → in-flow Vox moment and back (VOX_VIDEO aliases
 *  MODAL_VIDEO). Early positions restart from the top and near-end positions clear,
 *  mirroring familiar player UX. Storage failures (private mode, quota) degrade silently
 *  to no-resume.
 * @architecture Astro islands 2026
 * @module islands/landing/video/resumeStore
 */

const STORAGE_KEY = "voct:video-resume";

/** Below this many seconds watched, resuming is noise — restart from the top. */
const MIN_RESUME_S = 5;
/** Stopping this close to the end means "finished" — restart from the top. */
const END_GUARD_S = 4;

type PositionMap = Record<string, number>;

function readMap(): PositionMap {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? (parsed as PositionMap) : {};
  } catch {
    return {};
  }
}

function writeMap(map: PositionMap): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Quota exceeded / storage disabled — resume is a nicety, not a need.
  }
}

/** Record where playback stopped; trivial and near-end positions clear the entry instead. */
export function savePosition(src: string, time: number, duration: number): void {
  if (!Number.isFinite(time) || time < 0) return;
  const nearEnd = Number.isFinite(duration) && duration > 0 && duration - time < END_GUARD_S;
  const map = readMap();
  if (time < MIN_RESUME_S || nearEnd) {
    if (!(src in map)) return;
    delete map[src];
  } else {
    map[src] = Math.round(time);
  }
  writeMap(map);
}

/** Position to resume from, or 0 to start from the top. */
export function readPosition(src: string): number {
  const value = readMap()[src];
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

/** Watched to the end — next play starts from the top. */
export function clearPosition(src: string): void {
  const map = readMap();
  if (!(src in map)) return;
  delete map[src];
  writeMap(map);
}
