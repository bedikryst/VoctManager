/**
 * @file fileSize.ts
 * @description A file size as /press prints it, at build beside each file and in the browser in
 *  the composer's bar. One function for both, so a photo's tile and a selection holding only that
 *  photo cannot round the same bytes two ways.
 *
 *  PURE, and kept apart from `lib/pressPack` for that reason: that module reads the disk at build,
 *  and the composer's script would drag `node:fs` into the browser bundle with it.
 * @architecture Astro islands 2026
 * @module lib/fileSize
 */

/**
 * A file size as a reader decides whether to download it on a train: kilobytes under one
 * megabyte, megabytes with one decimal below ten and none above. The number follows the locale's
 * decimal mark and the unit is the locale's own ("Mo" in French).
 */
export function formatBytes(
  bytes: number,
  htmlLang: string,
  units: { readonly kB: string; readonly MB: string },
): string {
  if (bytes < 1_000_000) {
    return `${Math.max(1, Math.round(bytes / 1000))} ${units.kB}`;
  }
  const mb = bytes / 1_000_000;
  const digits = mb < 10 ? 1 : 0;
  const value = new Intl.NumberFormat(htmlLang, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(mb);
  return `${value} ${units.MB}`;
}
