/**
 * @file manifestLines.ts
 * @description Three-stanza ensemble manifest + the answer line — typed content for
 *  ManifestSection. PROVENANCE (do not "improve" the wording): stanzas I and II are
 *  VERBATIM lines from the ensemble's founding text ("Skąd się wzięliśmy?", Florent's
 *  vision document) — the manifest quotes the founders, it does not paraphrase them.
 *  Stanza III + the answer are the page's own single not-X-but-Y figure (the copy
 *  system allows exactly one negation, and this is it). "Odsłania." is deliberately
 *  NOT part of stanza III: it is the manifest's answer, rendered as its own
 *  line-group with its own reveal beat.
 * @architecture Astro islands 2026
 * @module features/landing/constants/manifestLines
 */

export interface ManifestLine {
  readonly index: string;
  readonly text: string;
}

export const MANIFEST_LINES: readonly ManifestLine[] = [
  { index: "I", text: "W ciszy rodzi się muzyka." },
  { index: "II", text: "Muzyka jest kontemplacją duszy w czasie." },
  { index: "III", text: "Sacrum nie zdobi." },
];

/** The single-word answer to stanza III — its own group, its own moment. */
export const MANIFEST_ANSWER = "Odsłania.";
