/**
 * @file options.queries.ts
 * @description React Query hooks for globally shared dictionary options.
 * Implements aggressive caching strategies (24h stale time) for static datasets.
 * @architecture Enterprise SaaS 2026
 * @module shared/api/options
 */

import { useQuery } from "@tanstack/react-query";
import { OptionsService } from "./options.service";

export const OPTIONS_QUERY_KEYS = {
  all: ["options"] as const,
  voiceTypes: ["options", "voiceTypes"] as const,
  voiceLines: ["options", "voiceLines"] as const,
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
