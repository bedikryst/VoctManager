/**
 * @file options.queries.ts
 * @description React Query hooks for globally shared dictionary options.
 * Implements aggressive caching strategies (24h stale time) for static datasets.
 * @architecture Enterprise SaaS 2026
 * @module shared/api/options
 */

import { useQuery } from "@tanstack/react-query";
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

export const OPTIONS_QUERY_KEYS = {
  all: ["options"] as const,
  voiceTypes: ["options", "voiceTypes", DICTIONARY_VERSION] as const,
  voiceLines: ["options", "voiceLines", DICTIONARY_VERSION] as const,
};

export const useVoiceTypes = () => {
  return useQuery({
    queryKey: OPTIONS_QUERY_KEYS.voiceTypes,
    queryFn: OptionsService.getVoiceTypes,
    staleTime: 1000 * 60 * 60 * 24, // 24 hours cache!
  });
};

export const useVoiceLines = () => {
  return useQuery({
    queryKey: OPTIONS_QUERY_KEYS.voiceLines,
    queryFn: OptionsService.getVoiceLines,
    staleTime: 1000 * 60 * 60 * 24, // 24 hours cache!
  });
};
