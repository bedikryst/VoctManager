/**
 * @file archiveLanguages.ts
 * @description Sung-language vocabulary for the archive. The backend stores a
 * canonical ISO 639-1 code (or a `+`-joined pair like "pl+la" for a bilingual
 * score); this module turns that code into a localised, human label so the UI
 * never shows a bare "la" / "pl". Mirrors {@link archiveEpochs} — a static
 * definition list feeding both a `<Select>` option builder and a display helper.
 * @architecture Enterprise SaaS 2026
 * @module features/archive/constants/archiveLanguages
 */

import type { TFunction } from "i18next";

interface ArchiveLanguageDefinition {
  value: string; // ISO 639-1
  labelKey: string;
  defaultLabel: string; // Polish (primary language) inline default
}

/** Languages the ensemble's repertoire realistically sings in. The set matches
 *  the backend `normalize_language` targets, so any stored code maps to a label. */
const ARCHIVE_LANGUAGE_DEFINITIONS: ArchiveLanguageDefinition[] = [
  { value: "la", labelKey: "archive.languages.la", defaultLabel: "łacina" },
  { value: "pl", labelKey: "archive.languages.pl", defaultLabel: "polski" },
  { value: "en", labelKey: "archive.languages.en", defaultLabel: "angielski" },
  { value: "de", labelKey: "archive.languages.de", defaultLabel: "niemiecki" },
  { value: "fr", labelKey: "archive.languages.fr", defaultLabel: "francuski" },
  { value: "it", labelKey: "archive.languages.it", defaultLabel: "włoski" },
  { value: "es", labelKey: "archive.languages.es", defaultLabel: "hiszpański" },
  { value: "cu", labelKey: "archive.languages.cu", defaultLabel: "cerkiewnosłowiański" },
  { value: "el", labelKey: "archive.languages.el", defaultLabel: "grecki" },
  { value: "he", labelKey: "archive.languages.he", defaultLabel: "hebrajski" },
  { value: "cs", labelKey: "archive.languages.cs", defaultLabel: "czeski" },
  { value: "uk", labelKey: "archive.languages.uk", defaultLabel: "ukraiński" },
  { value: "ru", labelKey: "archive.languages.ru", defaultLabel: "rosyjski" },
];

export interface ArchiveLanguageOption {
  value: string;
  label: string;
}

export const getArchiveLanguageOptions = (
  t: TFunction,
): ArchiveLanguageOption[] =>
  ARCHIVE_LANGUAGE_DEFINITIONS.map(({ value, labelKey, defaultLabel }) => ({
    value,
    label: t(labelKey, defaultLabel),
  }));

const LANGUAGE_DEFINITION_BY_VALUE = new Map(
  ARCHIVE_LANGUAGE_DEFINITIONS.map((definition) => [definition.value, definition]),
);

/** Localised label for a stored language value. Handles the bilingual "pl+la"
 *  form ("polski + łacina") and falls back to the upper-cased code for anything
 *  outside the known set, so nothing ever renders blank. */
export const getLanguageLabel = (
  code: string | null | undefined,
  t: TFunction,
): string => {
  if (!code) return "";
  return code
    .split("+")
    .map((part) => {
      const key = part.trim().toLowerCase();
      const definition = LANGUAGE_DEFINITION_BY_VALUE.get(key);
      return definition ? t(definition.labelKey, definition.defaultLabel) : key.toUpperCase();
    })
    .filter(Boolean)
    .join(" + ");
};
