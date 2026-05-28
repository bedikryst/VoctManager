/**
 * @file manifestLines.ts
 * @description Three-stanza ensemble manifest — typed content for ManifestSection.
 * @architecture Enterprise SaaS 2026
 * @module features/landing/constants/manifestLines
 */

export interface ManifestLine {
  readonly index: string;
  readonly text: string;
  readonly emphasis?: string;
  readonly closing?: boolean;
}

export const MANIFEST_LINES: readonly ManifestLine[] = [
  { index: "I", text: "Nie śpiewamy repertuaru." },
  { index: "II", text: "Słuchamy jednym oddechem." },
  { index: "III", text: "Sacrum nie zdobi.", emphasis: "Odsłania.", closing: true },
];
