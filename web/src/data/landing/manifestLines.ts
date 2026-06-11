/**
 * @file manifestLines.ts
 * @description Three-stanza ensemble manifest + the answer line — typed content for
 *  ManifestSection. "Odsłania." is deliberately NOT part of stanza III: it is the
 *  manifest's answer, rendered as its own line-group with its own reveal beat.
 * @architecture Astro islands 2026
 * @module features/landing/constants/manifestLines
 */

export interface ManifestLine {
  readonly index: string;
  readonly text: string;
}

export const MANIFEST_LINES: readonly ManifestLine[] = [
  { index: "I", text: "Nie śpiewamy repertuaru." },
  { index: "II", text: "Słuchamy jednym oddechem." },
  { index: "III", text: "Sacrum nie zdobi." },
];

/** The single-word answer to stanza III — its own group, its own moment. */
export const MANIFEST_ANSWER = "Odsłania.";
