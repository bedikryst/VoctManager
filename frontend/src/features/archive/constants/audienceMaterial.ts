/**
 * @file audienceMaterial.ts
 * @description How the archive offers its audience material — programme notes
 * and prose translations: labels for the languages a score book card prints
 * (`AUDIENCE_LANGUAGES` in `shared/types`) and for the three registers a note
 * can take (backend `ProgramNoteTone`). Polish and the accessible register
 * lead their lists because they are what the approval writes on its own.
 * @architecture Enterprise SaaS 2026
 * @module features/archive/constants/audienceMaterial
 */

import type { TFunction } from "i18next";

import {
  AUDIENCE_LANGUAGES,
  type AudienceLanguage,
  type ProgramNoteToneCode,
} from "@/shared/types";

export const DEFAULT_AUDIENCE_LANGUAGE: AudienceLanguage = "pl";

export const isAudienceLanguage = (value: string): value is AudienceLanguage =>
  (AUDIENCE_LANGUAGES as readonly string[]).includes(value);

const LANGUAGE_LABELS: Record<AudienceLanguage, { key: string; fallback: string }> = {
  pl: { key: "archive.audience.language.pl", fallback: "polski" },
  en: { key: "archive.audience.language.en", fallback: "angielski" },
  fr: { key: "archive.audience.language.fr", fallback: "francuski" },
};

export const getAudienceLanguageLabel = (
  language: AudienceLanguage,
  t: TFunction,
): string => t(LANGUAGE_LABELS[language].key, LANGUAGE_LABELS[language].fallback);

/**
 * Whether a translation into `target` tells a reader anything — the sung text
 * is at least partly in another language. Mirrors the backend rule on the
 * stored ISO codes ('pl', 'pl+la'); a blank or free-text language keeps the
 * offer open and leaves the final word to the server.
 */
export const translationAddsMeaning = (
  sungLanguage: string | null | undefined,
  target: AudienceLanguage,
): boolean => {
  const codes = (sungLanguage ?? "")
    .toLowerCase()
    .split("+")
    .map((code) => code.trim())
    .filter(Boolean);
  return codes.length === 0 || codes.some((code) => code !== target);
};

export const PROGRAM_NOTE_TONES: readonly ProgramNoteToneCode[] = [
  "accessible",
  "scholarly",
  "devotional",
];

export const DEFAULT_PROGRAM_NOTE_TONE: ProgramNoteToneCode = "accessible";

export const isProgramNoteTone = (value: string): value is ProgramNoteToneCode =>
  (PROGRAM_NOTE_TONES as readonly string[]).includes(value);

const TONE_LABELS: Record<ProgramNoteToneCode, { key: string; fallback: string }> = {
  accessible: { key: "archive.audience.tone.accessible", fallback: "przystępny" },
  scholarly: { key: "archive.audience.tone.scholarly", fallback: "fachowy" },
  devotional: { key: "archive.audience.tone.devotional", fallback: "modlitewny" },
};

/** Localised name of a stored tone; the raw value for a legacy free-text one. */
export const getProgramNoteToneLabel = (tone: string, t: TFunction): string =>
  isProgramNoteTone(tone) ? t(TONE_LABELS[tone].key, TONE_LABELS[tone].fallback) : tone;
