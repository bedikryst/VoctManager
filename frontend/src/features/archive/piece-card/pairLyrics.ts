/**
 * @file pairLyrics.ts
 * @description Line alignment for reading a lyric and its pronunciation guide.
 */

export const pairLyrics = (lyrics: string, ipa: string) => {
  if (!lyrics.trim() || !ipa.trim()) return null;
  const lines = lyrics.trimEnd().split(/\r\n?|\n/);
  const guides = ipa.trimEnd().split(/\r\n?|\n/);
  if (lines.length !== guides.length) return null;
  return lines.map((line, index) => ({ lyric: line, ipa: guides[index] }));
};
