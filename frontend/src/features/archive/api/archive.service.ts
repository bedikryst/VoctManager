/**
 * @file archive.service.ts
 * @description Pure HTTP service for the Archive domain — Pieces, Composers,
 * Tracks, and ScoreEditions. JSON-only writes for Piece metadata (the legacy
 * multipart write was needed for `sheet_music`, now removed from the model).
 * PDFs flow through the dedicated upload endpoint, which dispatches the AI
 * ingestion pipeline server-side.
 */

import api from "@/shared/api/api";
import type {
  Composer,
  Piece,
  ScoreEditionSummary,
  Track,
} from "@/shared/types";
import type {
  ComposerWriteDTO,
  PiecePatchDTO,
  PieceWriteDTO,
  ScoreEditionPatchDTO,
  ScoreEditionUploadDTO,
} from "../types/archive.dto";

const PIECES_URL = "/api/pieces/";
const COMPOSERS_URL = "/api/composers/";
const TRACKS_URL = "/api/tracks/";
const EDITIONS_URL = "/api/archive/editions/";

/** Full edition detail returned by upload/retrieve/approve/reingest. */
export interface ScoreEditionDetail extends ScoreEditionSummary {
  sha256: string;
  uploaded_by: number | null;
  /** Present on POST responses (upload, reingest) only. */
  celery_task_id?: string;
}

export const ArchiveService = {
  // ---- Pieces -----------------------------------------------------------
  getPieces: async (): Promise<Piece[]> => {
    const response = await api.get<Piece[]>(PIECES_URL);
    return response.data;
  },

  createPiece: async (data: PieceWriteDTO): Promise<Piece> => {
    const response = await api.post<Piece>(PIECES_URL, data);
    return response.data;
  },

  updatePiece: async (
    id: string,
    data: PiecePatchDTO | PieceWriteDTO,
  ): Promise<Piece> => {
    const response = await api.patch<Piece>(`${PIECES_URL}${id}/`, data);
    return response.data;
  },

  deletePiece: async (id: string): Promise<void> => {
    await api.delete(`${PIECES_URL}${id}/`);
  },

  // ---- Composers --------------------------------------------------------
  getComposers: async (): Promise<Composer[]> => {
    const response = await api.get<Composer[]>(COMPOSERS_URL);
    return response.data;
  },

  createComposer: async (data: ComposerWriteDTO): Promise<Composer> => {
    const response = await api.post<Composer>(COMPOSERS_URL, data);
    return response.data;
  },

  // ---- Rehearsal tracks -------------------------------------------------
  getTracksByPiece: async (pieceId: string | number): Promise<Track[]> => {
    const response = await api.get<Track[]>(`${TRACKS_URL}?piece=${pieceId}`);
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

    const response = await api.post<Track>(TRACKS_URL, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  },

  deleteTrack: async (trackId: string): Promise<void> => {
    await api.delete(`${TRACKS_URL}${trackId}/`);
  },

  // ---- Score editions (PDF upload + ingestion workflow) -----------------
  uploadEdition: async (
    dto: ScoreEditionUploadDTO,
    onProgress?: (loaded: number, total: number) => void,
  ): Promise<ScoreEditionDetail> => {
    const form = new FormData();
    form.append("pdf_file", dto.pdf_file);
    if (dto.original_filename) form.append("original_filename", dto.original_filename);
    if (dto.publisher) form.append("publisher", dto.publisher);
    if (dto.edition_year != null) form.append("edition_year", String(dto.edition_year));
    if (dto.editor_name) form.append("editor_name", dto.editor_name);
    if (dto.is_default != null) form.append("is_default", String(dto.is_default));
    if (dto.piece_id) form.append("piece_id", dto.piece_id);

    const response = await api.post<ScoreEditionDetail>(EDITIONS_URL, form, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (event) => {
        if (onProgress && event.total) onProgress(event.loaded, event.total);
      },
    });
    return response.data;
  },

  patchEdition: async (
    id: string,
    dto: ScoreEditionPatchDTO,
  ): Promise<ScoreEditionDetail> => {
    const response = await api.patch<ScoreEditionDetail>(`${EDITIONS_URL}${id}/`, dto);
    return response.data;
  },

  deleteEdition: async (id: string): Promise<void> => {
    await api.delete(`${EDITIONS_URL}${id}/`);
  },

  approveEdition: async (id: string): Promise<ScoreEditionDetail> => {
    const response = await api.post<ScoreEditionDetail>(`${EDITIONS_URL}${id}/approve/`);
    return response.data;
  },

  reingestEdition: async (
    id: string,
    force = false,
  ): Promise<ScoreEditionDetail> => {
    const url = force
      ? `${EDITIONS_URL}${id}/reingest/?force=true`
      : `${EDITIONS_URL}${id}/reingest/`;
    const response = await api.post<ScoreEditionDetail>(url);
    return response.data;
  },
};
