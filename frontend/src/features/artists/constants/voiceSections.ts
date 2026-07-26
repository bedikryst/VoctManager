/**
 * @file voiceSections.ts
 * @description Single source of truth for choral section taxonomy and presentation.
 * Maps granular voice types (SOP, MEZ, ALT, CT, TEN, BAR, BAS) onto the four
 * canonical SATB sections and their Ethereal colour language, so the balance
 * strip, roster cards, and list rows never drift apart.
 *
 * Section grouping follows mixed-choir practice: mezzo-soprano and countertenor
 * sing the alto line; baritone sings with the basses. This is also why the old
 * `voice_type.startsWith("A")` filter was lossy — it silently dropped MEZ / CT /
 * BAR from every section view.
 *
 * Colour comes from the shared accent scale, which has no crimson: a soprano is
 * not an alarm, and while the sections wore one, every roster showed a dozen
 * crimson chips beside the one singer whose invitation had actually expired.
 * @architecture Enterprise SaaS 2026
 * @module features/artists/constants/voiceSections
 */

import type { EtherealAccent } from "@/shared/ui/primitives/accents";

export type SectionKey = "S" | "A" | "T" | "B";

export interface SectionPresentation {
  readonly key: SectionKey;
  /** i18n key for the plural section label (Soprany / Alty / ...). */
  readonly labelKey: string;
  readonly defaultLabel: string;
  /** Accent claimed by this section; every surface derives its tone from it. */
  readonly accent: EtherealAccent;
}

export const VOICE_SECTIONS: readonly SectionPresentation[] = [
  {
    key: "S",
    labelKey: "artists.filters.sopranos",
    defaultLabel: "Soprany",
    accent: "incense",
  },
  {
    key: "A",
    labelKey: "artists.filters.altos",
    defaultLabel: "Alty",
    accent: "amethyst",
  },
  {
    key: "T",
    labelKey: "artists.filters.tenors",
    defaultLabel: "Tenory",
    accent: "gold",
  },
  {
    key: "B",
    labelKey: "artists.filters.basses",
    defaultLabel: "Basy",
    accent: "sage",
  },
];

const SECTION_BY_VOICE: Readonly<Record<string, SectionKey>> = {
  SOP: "S",
  MEZ: "A",
  ALT: "A",
  CT: "A",
  TEN: "T",
  BAR: "B",
  BAS: "B",
};

const SECTION_PRESENTATION = VOICE_SECTIONS.reduce<
  Record<SectionKey, SectionPresentation>
>(
  (accumulator, section) => {
    accumulator[section.key] = section;
    return accumulator;
  },
  {} as Record<SectionKey, SectionPresentation>,
);

/** Resolve a granular voice type onto its SATB section, or null if unknown. */
export const getVoiceSection = (
  voiceType?: string | null,
): SectionKey | null => {
  if (!voiceType) return null;
  const mapped = SECTION_BY_VOICE[voiceType];
  if (mapped) return mapped;
  // Defensive fallback for any unmapped code: first-letter heuristic.
  const head = voiceType.charAt(0).toUpperCase();
  return head === "S" || head === "A" || head === "T" || head === "B"
    ? (head as SectionKey)
    : null;
};

export const getSectionPresentation = (
  voiceType?: string | null,
): SectionPresentation | null => {
  const key = getVoiceSection(voiceType);
  return key ? SECTION_PRESENTATION[key] : null;
};

/** Ordering index for "by section" sort (S → A → T → B, unknown last). */
export const sectionOrder = (voiceType?: string | null): number => {
  const key = getVoiceSection(voiceType);
  return key
    ? VOICE_SECTIONS.findIndex((section) => section.key === key)
    : VOICE_SECTIONS.length;
};
