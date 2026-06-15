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
  getAll: async (): Promise<Artist[]> => {
    const response = await api.get<Artist[]>(BASE_URL);
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
