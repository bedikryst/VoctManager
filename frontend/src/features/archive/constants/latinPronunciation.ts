/**
 * @file latinPronunciation.ts
 * @description The three Latin pronunciation systems an IPA guide can be
 * written in, as the archive card offers them and as both the card and the
 * singer's lyrics view name them. German is the ensemble's default and leads
 * the list. Each system carries two sample words in IPA — the same two for all
 * three — because the names alone ("niemiecka", "włoska") do not tell a
 * manager what a choir will actually sing.
 * @architecture Enterprise SaaS 2026
 * @module features/archive/constants/latinPronunciation
 */

import type { TFunction } from "i18next";

import type { LatinPronunciationCode } from "@/shared/types";

interface LatinPronunciationDefinition {
  value: LatinPronunciationCode;
  labelKey: string;
  defaultLabel: string; // Polish (primary language) inline default
  /** "coeli · excelsis" in this system; IPA reads the same in every locale. */
  sample: string;
}

const LATIN_PRONUNCIATION_DEFINITIONS: readonly LatinPronunciationDefinition[] = [
  {
    value: "germanic",
    labelKey: "archive.ipa_system.germanic",
    defaultLabel: "niemiecka",
    sample: "ˈtsøːli · ɛksˈtsɛlzɪs",
  },
  {
    value: "italianate",
    labelKey: "archive.ipa_system.italianate",
    defaultLabel: "włoska (kościelna)",
    sample: "ˈtʃɛːli · ekˈʃɛlsis",
  },
  {
    value: "classical",
    labelKey: "archive.ipa_system.classical",
    defaultLabel: "klasyczna (restituta)",
    sample: "ˈkoeliː · eksˈkelsiːs",
  },
];

export const DEFAULT_LATIN_PRONUNCIATION: LatinPronunciationCode = "germanic";

/** The words every `sample` transcribes, in the order it gives them. */
export const LATIN_SAMPLE_WORDS = "coeli · excelsis";

export const isLatinPronunciationCode = (
  value: string,
): value is LatinPronunciationCode =>
  LATIN_PRONUNCIATION_DEFINITIONS.some((d) => d.value === value);

export interface LatinPronunciationOption {
  value: LatinPronunciationCode;
  label: string;
  sample: string;
}

export const getLatinPronunciationOptions = (
  t: TFunction,
): LatinPronunciationOption[] =>
  LATIN_PRONUNCIATION_DEFINITIONS.map(({ value, labelKey, defaultLabel, sample }) => ({
    value,
    label: t(labelKey, defaultLabel),
    sample,
  }));

/** Localised name of a stored system; "" for an unknown one, so a caller can
 *  leave the label bare rather than print a code. */
export const getLatinPronunciationLabel = (
  code: string | null | undefined,
  t: TFunction,
): string => {
  const definition = LATIN_PRONUNCIATION_DEFINITIONS.find((d) => d.value === code);
  return definition ? t(definition.labelKey, definition.defaultLabel) : "";
};
