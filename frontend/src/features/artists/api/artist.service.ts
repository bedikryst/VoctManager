/**
 * @file artist.service.ts
 * @description Pure HTTP service for the Artist domain.
 * Completely decoupled from React state or UI logic.
 * @architecture Enterprise SaaS 2026
 */

import api from "@/shared/api/api";
import type { Artist } from "@/shared/types";
import type { ArtistCreateDTO, ArtistUpdateDTO } from "../types/artist.dto";
import type { ArtistDossier } from "../types/artistDossier.dto";

const BASE_URL = "/api/artists/";

export const ArtistService = {
  /** Active roster. The list every picker reads — never includes archived singers. */
  getAll: async (): Promise<Artist[]> => {
    const response = await api.get<Artist[]>(BASE_URL);
    return response.data;
  },

  /**
   * Active roster plus archived singers, for the roster screen alone. Kept as a
   * separate call rather than a flag on `getAll` so no picker (invitations,
   * season setup, new message, command palette) can reach it by accident and
   * offer somebody who has been archived.
   */
  getAllIncludingArchived: async (): Promise<Artist[]> => {
    const response = await api.get<Artist[]>(BASE_URL, {
      params: { include_archived: "true" },
    });
    return response.data;
  },

  getById: async (id: string | number): Promise<Artist> => {
    const response = await api.get<Artist>(`${BASE_URL}${id}/`);
    return response.data;
  },

  create: async (data: ArtistCreateDTO): Promise<Artist> => {
    const response = await api.post<Artist>(BASE_URL, data);
    return response.data;
  },

  update: async (id: string, data: ArtistUpdateDTO): Promise<Artist> => {
    const response = await api.patch<Artist>(`${BASE_URL}${id}/`, data);
    return response.data;
  },

  resendActivation: async (id: string): Promise<void> => {
    await api.post(`${BASE_URL}${id}/resend-activation/`);
  },

  toggleStatus: async (
    id: string,
    isActive: boolean,
  ): Promise<Artist | void> => {
    if (isActive) {
      const response = await api.post<Artist>(`${BASE_URL}${id}/restore/`);
      return response.data;
    } else {
      await api.post(`${BASE_URL}${id}/archive/`);
    }
  },

  getDossier: async (id: string): Promise<ArtistDossier> => {
    const response = await api.get<ArtistDossier>(`${BASE_URL}${id}/dossier/`);
    return response.data;
  },
};
