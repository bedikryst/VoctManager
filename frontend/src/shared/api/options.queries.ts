/**
 * @file options.queries.ts
 * @description React Query hooks for globally shared dictionary options.
 * Implements aggressive caching strategies (24h stale time) for static datasets.
 * @architecture Enterprise SaaS 2026
 * @module shared/api/options
 */

import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { OptionsService } from "./options.service";

/**
 * Bump whenever a server-side enum gains or loses a value.
 *
 * These dictionaries are held for a day AND persisted to localStorage, so the
 * key is the only thing that can make a returning user fetch again: without a
 * new one they keep the pre-deploy list and the added entries simply never
 * appear in the pickers that are driven by it.
 */
export const DICTIONARY_VERSION = "2026-08-untyped-voices";

/**
 * Keyed by language as well as version: the server sends these vocabularies
 * already translated, so the reader's language is the other thing that can make
 * a cached copy wrong — a manager switching to French would otherwise read
 * Polish voice lines for the rest of the day.
 */
export const OPTIONS_QUERY_KEYS = {
  all: ["options"] as const,
  voiceTypes: (language: string) =>
    ["options", "voiceTypes", DICTIONARY_VERSION, language] as const,
  voiceLines: (language: string) =>
    ["options", "voiceLines", DICTIONARY_VERSION, language] as const,
};

export const useVoiceTypes = () => {
  const { i18n } = useTranslation();

  return useQuery({
    queryKey: OPTIONS_QUERY_KEYS.voiceTypes(i18n.language),
    queryFn: OptionsService.getVoiceTypes,
    staleTime: 1000 * 60 * 60 * 24, // 24 hours cache!
  });
};

export const useVoiceLines = () => {
  const { i18n } = useTranslation();

  return useQuery({
    queryKey: OPTIONS_QUERY_KEYS.voiceLines(i18n.language),
    queryFn: OptionsService.getVoiceLines,
    staleTime: 1000 * 60 * 60 * 24, // 24 hours cache!
  });
};
