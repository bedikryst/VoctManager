/**
 * @file manifestLines.ts
 * @description The ensemble manifest — typed content for ManifestSection. PROVENANCE (do not
 *  "improve" the wording): MANIFEST_LINES are VERBATIM lines from the ensemble's founding text
 *  ("Skąd się wzięliśmy?", Florent's vision document) — the manifest quotes the founders, it
 *  does not paraphrase them. MANIFEST_RESPONSE is the page's own single not-X-but-Y figure (the
 *  copy system allows exactly one negation on the whole site, and this is it). It is ONE value
 *  rather than a third quoted line because statement and answer are one utterance: the layout
 *  sets them as a single block and the reply is not a fourth thesis.
 * @architecture Astro islands 2026
 * @module features/landing/constants/manifestLines
 */

/** The quoted theses, in the order the founding text states them. */
export const MANIFEST_LINES: readonly string[] = [
  "W ciszy rodzi się muzyka.",
  "Muzyka jest kontemplacją duszy w czasie.",
];

/** The page's own figure. `answer` replies to `statement`; neither stands alone. */
export const MANIFEST_RESPONSE = {
  statement: "Sacrum nie zdobi.",
  answer: "Odsłania.",
} as const;
