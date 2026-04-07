/**
 * @file options.service.ts
 * @description Centralized HTTP service for fetching global dictionary options (enums, dropdowns).
 * @architecture Enterprise SaaS 2026
 * @module shared/api/options
 */

import api from "./api";
import type { VoiceTypeOption, VoiceLineOption } from "../types";

export const OptionsService = {
  getVoiceTypes: async (): Promise<VoiceTypeOption[]> => {
    const response = await api.get<VoiceTypeOption[]>(
      "/api/options/voice-types/",
    );
    return response.data;
  },

  getVoiceLines: async (): Promise<VoiceLineOption[]> => {
    const response = await api.get<VoiceLineOption[]>(
      "/api/options/voice-lines/",
    );
    return response.data;
  },

  // W przyszłości dodasz tu np. getSpecialties(), getEpochs() itp.
};
