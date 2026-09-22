/**
 * @file sectionLabels.ts
 * @description How a sectional's rule (`Rehearsal.called_sections`, SATB
 * letters) is spelled out wherever a rehearsal's scope is shown — the
 * inspector badge, the timeline row, the dashboard widget, the chorister's
 * schedule card. One reading so "SA" is "Soprany, Alty" on every surface.
 * @architecture Enterprise SaaS 2026
 * @module features/rehearsals/lib/sectionLabels
 */

import type { TFunction } from "i18next";

import {
  SECTION_LETTERS,
  type SectionLetter,
} from "@/features/projects/lib/voiceFamilies";

const SECTION_LABEL_KEY: Readonly<Record<SectionLetter, string>> = {
  S: "rehearsals.voices.sopranos",
  A: "rehearsals.voices.altos",
  T: "rehearsals.voices.tenors",
  B: "rehearsals.voices.basses",
};

const SECTION_FALLBACK: Readonly<Record<SectionLetter, string>> = {
  S: "Soprany",
  A: "Alty",
  T: "Tenory",
  B: "Basy",
};

/** "SA" → "Soprany, Alty", in SATB order whatever order the letters arrive in. */
export const sectionNamesLabel = (letters: string, t: TFunction): string =>
  SECTION_LETTERS.filter((letter) => letters.includes(letter))
    .map((letter) => t(SECTION_LABEL_KEY[letter], SECTION_FALLBACK[letter]))
    .join(", ");
