/**
 * @file conductorParser.ts
 * @description Anti-Corruption Layer for raw conductor string extraction.
 * Safely extracts the conductor's name, strictly discarding legacy role suffixes.
 * @architecture Enterprise SaaS 2026
 */

export function parseConductorName(rawString?: string | null): string | null {
  if (!rawString) return null;

  // Extracts everything before the first opening parenthesis
  const regex = /(.+?)\s*\(/;
  const match = rawString.match(regex);

  // If match is found, return the trimmed name. Otherwise, return the raw trimmed string.
  return match ? match[1].trim() : rawString.trim();
}
