/**
 * @file score-compiler.service.ts
 * @description Pure HTTP service for the Score Package Compiler domain.
 * Handles multipart upload, the workflow-control actions (approve / reingest)
 * and the conductor-review patches for Piece-level fields.
 * @architecture Enterprise SaaS 2026
 * @module features/score-compiler/api/score-compiler.service
 */

import api from "@/shared/api/api";
import type {
  PiecePatchDTO,
  PieceSummaryDTO,
  ScoreEditionDetailDTO,
  ScoreEditionListDTO,
  ScoreEditionPatchDTO,
  ScoreEditionUploadDTO,
} from "../types/score-compiler.dto";

const EDITIONS_URL = "/api/archive/editions/";
const PIECES_URL = "/api/pieces/";

const buildUploadFormData = (dto: ScoreEditionUploadDTO): FormData => {
  const form = new FormData();
  form.append("pdf_file", dto.pdf_file);
  if (dto.original_filename) form.append("original_filename", dto.original_filename);
  if (dto.publisher) form.append("publisher", dto.publisher);
  if (dto.edition_year != null) form.append("edition_year", String(dto.edition_year));
  if (dto.editor_name) form.append("editor_name", dto.editor_name);
  if (dto.is_default != null) form.append("is_default", String(dto.is_default));
  return form;
};

export const ScoreCompilerService = {
  list: async (): Promise<ScoreEditionListDTO[]> => {
    const response = await api.get<ScoreEditionListDTO[]>(EDITIONS_URL);
    return response.data;
  },

  retrieve: async (id: string): Promise<ScoreEditionDetailDTO> => {
    const response = await api.get<ScoreEditionDetailDTO>(`${EDITIONS_URL}${id}/`);
    return response.data;
  },

  upload: async (
    dto: ScoreEditionUploadDTO,
    onProgress?: (loaded: number, total: number) => void,
  ): Promise<ScoreEditionDetailDTO> => {
    const form = buildUploadFormData(dto);
    const response = await api.post<ScoreEditionDetailDTO>(EDITIONS_URL, form, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (event) => {
        if (onProgress && event.total) onProgress(event.loaded, event.total);
      },
    });
    return response.data;
  },

  patch: async (
    id: string,
    dto: ScoreEditionPatchDTO,
  ): Promise<ScoreEditionDetailDTO> => {
    const response = await api.patch<ScoreEditionDetailDTO>(
      `${EDITIONS_URL}${id}/`,
      dto,
    );
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`${EDITIONS_URL}${id}/`);
  },

  approve: async (id: string): Promise<ScoreEditionDetailDTO> => {
    const response = await api.post<ScoreEditionDetailDTO>(
      `${EDITIONS_URL}${id}/approve/`,
    );
    return response.data;
  },

  reingest: async (
    id: string,
    force = false,
  ): Promise<ScoreEditionDetailDTO> => {
    const url = force
      ? `${EDITIONS_URL}${id}/reingest/?force=true`
      : `${EDITIONS_URL}${id}/reingest/`;
    const response = await api.post<ScoreEditionDetailDTO>(url);
    return response.data;
  },

  /**
   * Patch piece-level metadata via the canonical PieceViewSet. We send JSON
   * (the underlying PieceSerializer accepts it for partial updates that do
   * not include the sheet_music FileField). The conductor's review modal
   * uses this for AI-extracted fields (title, opus, key, voicing, etc.).
   */
  patchPiece: async (
    id: string,
    dto: PiecePatchDTO,
  ): Promise<PieceSummaryDTO> => {
    const response = await api.patch<PieceSummaryDTO>(
      `${PIECES_URL}${id}/`,
      dto,
    );
    return response.data;
  },
};
