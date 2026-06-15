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
 * @architecture Enterprise SaaS 2026
 * @module features/artists/constants/voiceSections
 */

export type SectionKey = "S" | "A" | "T" | "B";

export interface SectionPresentation {
  readonly key: SectionKey;
  /** i18n key for the plural section label (Soprany / Alty / ...). */
  readonly labelKey: string;
  readonly defaultLabel: string;
  /** Badge variant used for the per-artist voice chip. */
  readonly badge: "danger" | "amethyst" | "warning" | "success";
  /** Typography colour token for the section accent. */
  readonly textColor: "crimson" | "amethyst" | "gold" | "sage";
  /** Tailwind classes for the proportional balance-bar fill. */
  readonly barClass: string;
  /** Border + ring + surface treatment when the section is the active filter. */
  readonly activeClass: string;
  /** Idle border treatment (hover hints the section accent). */
  readonly idleClass: string;
}

export const VOICE_SECTIONS: readonly SectionPresentation[] = [
  {
    key: "S",
    labelKey: "artists.filters.sopranos",
    defaultLabel: "Soprany",
    badge: "danger",
    textColor: "crimson",
    barClass: "bg-ethereal-crimson/55",
    activeClass:
      "border-ethereal-crimson/45 bg-ethereal-crimson/[0.04] ring-1 ring-ethereal-crimson/30",
    idleClass: "border-ethereal-ink/8 hover:border-ethereal-crimson/30",
  },
  {
    key: "A",
    labelKey: "artists.filters.altos",
    defaultLabel: "Alty",
    badge: "amethyst",
    textColor: "amethyst",
    barClass: "bg-ethereal-amethyst/55",
    activeClass:
      "border-ethereal-amethyst/45 bg-ethereal-amethyst/[0.04] ring-1 ring-ethereal-amethyst/30",
    idleClass: "border-ethereal-ink/8 hover:border-ethereal-amethyst/30",
  },
  {
    key: "T",
    labelKey: "artists.filters.tenors",
    defaultLabel: "Tenory",
    badge: "warning",
    textColor: "gold",
    barClass: "bg-ethereal-gold/60",
    activeClass:
      "border-ethereal-gold/45 bg-ethereal-gold/[0.05] ring-1 ring-ethereal-gold/30",
    idleClass: "border-ethereal-ink/8 hover:border-ethereal-gold/30",
  },
  {
    key: "B",
    labelKey: "artists.filters.basses",
    defaultLabel: "Basy",
    badge: "success",
    textColor: "sage",
    barClass: "bg-ethereal-sage/55",
    activeClass:
      "border-ethereal-sage/45 bg-ethereal-sage/[0.04] ring-1 ring-ethereal-sage/30",
    idleClass: "border-ethereal-ink/8 hover:border-ethereal-sage/30",
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
