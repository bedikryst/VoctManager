/**
 * @file materials.service.ts
 * @description Pure HTTP service for the Materials domain.
 */

import api from "@/shared/api/api";
import type {
  Composer,
  Participation,
  Piece,
  PieceCasting,
  ProgramItem,
  Project,
  Track,
} from "@/shared/types";

export const MaterialsService = {
  getProjects: async (): Promise<Project[]> => {
    const response = await api.get<Project[]>("/api/projects/");
    return response.data;
  },

  getParticipationsByArtist: async (
    artistId: string | number,
  ): Promise<Participation[]> => {
    const response = await api.get<Participation[]>(
      `/api/participations/?artist=${artistId}`,
    );
    return response.data;
  },

  getProgramItems: async (): Promise<ProgramItem[]> => {
    const response = await api.get<ProgramItem[]>("/api/program-items/");
    return response.data;
  },

  getPieceCastings: async (): Promise<PieceCasting[]> => {
    const response = await api.get<PieceCasting[]>("/api/piece-castings/");
    return response.data;
  },

  getPieces: async (): Promise<Piece[]> => {
    const response = await api.get<Piece[]>("/api/pieces/");
    return response.data;
  },

  getComposers: async (): Promise<Composer[]> => {
    const response = await api.get<Composer[]>("/api/composers/");
    return response.data;
  },

  getTracks: async (): Promise<Track[]> => {
    const response = await api.get<Track[]>("/api/tracks/");
    return response.data;
  },
};
