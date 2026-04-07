/**
 * @file archive.service.ts
 * @description Pure HTTP service for the Archive domain.
 * Encapsulates the complex logic of constructing multipart/form-data payloads.
 */

import api from "../../../shared/api/api";
import type { Piece, Composer, Track } from "../../../shared/types";
import type { PieceWriteDTO } from "../types/archive.dto";

const PIECES_URL = "/api/pieces/";
const COMPOSERS_URL = "/api/composers/";

/**
 * Helper utility to serialize standard DTOs into FormData for file uploads.
 */
const buildPieceFormData = (dto: PieceWriteDTO): FormData => {
  const formData = new FormData();

  Object.entries(dto).forEach(([key, value]) => {
    if (value === null || value === undefined) return;

    if (key === "voice_requirements") {
      formData.append("requirements_data", JSON.stringify(value));
    } else if (key === "sheet_music" && value instanceof File) {
      formData.append("sheet_music", value);
    } else {
      formData.append(key, String(value));
    }
  });

  return formData;
};

export const ArchiveService = {
  // --- PIECES ---
  getPieces: async (): Promise<Piece[]> => {
    const response = await api.get<Piece[]>(PIECES_URL);
    return response.data;
  },

  createPiece: async (data: PieceWriteDTO): Promise<Piece> => {
    const payload = buildPieceFormData(data);
    const response = await api.post<Piece>(PIECES_URL, payload, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  },

  updatePiece: async (
    id: string,
    data: Partial<PieceWriteDTO>,
  ): Promise<Piece> => {
    const payload = buildPieceFormData(data as PieceWriteDTO);
    const response = await api.patch<Piece>(`${PIECES_URL}${id}/`, payload, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  },

  deletePiece: async (id: string): Promise<void> => {
    await api.delete(`${PIECES_URL}${id}/`);
  },

  // --- COMPOSERS ---
  getComposers: async (): Promise<Composer[]> => {
    const response = await api.get<Composer[]>(COMPOSERS_URL);
    return response.data;
  },

  uploadTrack: async (
    pieceId: string | number,
    voiceLine: string,
    file: File,
  ): Promise<Track> => {
    const formData = new FormData();
    formData.append("piece", String(pieceId));
    formData.append("voice_part", voiceLine);
    formData.append("audio_file", file);

    const response = await api.post<Track>("/api/tracks/", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  },
  deleteTrack: async (trackId: string): Promise<void> => {
    await api.delete(`/api/tracks/${trackId}/`);
  },

  getTracksByPiece: async (pieceId: string | number): Promise<Track[]> => {
    const response = await api.get<Track[]>(`/api/tracks/?piece=${pieceId}`);
    return response.data;
  },
};
