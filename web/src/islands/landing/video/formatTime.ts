/**
 * @file formatTime.ts
 * @description m:ss formatter shared by the video player chrome (time label, ARIA
 *  valuetext) and the site cursor's seek state (the cursor renders the hover timestamp
 *  over the scrub rail, so both must speak the same format).
 * @architecture Astro islands 2026
 * @module islands/landing/video/formatTime
 */

/** 83 → "1:23"; non-finite/negative inputs read as "0:00". */
export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
