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
  IngestionProgressCode,
  IngestionStatusCode,
  LiveAnalysisPreview,
  Movement,
  Piece,
  Recording,
  ScoreEditionSummary,
  Track,
  Translation,
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
const MOVEMENTS_URL = "/api/archive/movements/";
const TRANSLATIONS_URL = "/api/archive/translations/";
const RECORDINGS_URL = "/api/archive/recordings/";

/**
 * Diagnostic result of a MusicBrainz/Wikidata refresh. `status` explains a
 * no-op so the UI never shows a silent "nothing happened":
 *   - "updated"             — at least one field changed
 *   - "matched_no_changes"  — a source matched, but everything was already set
 *   - "no_match"            — neither source returned a usable entry
 *   - "no_name"             — composer has no name to resolve
 */
export type ComposerRefreshStatus =
  | "updated"
  | "matched_no_changes"
  | "no_match"
  | "no_name";

export interface ComposerRefreshResult {
  composer: Composer;
  /** Every field that changed (filled + overwritten) — back-compat name. */
  fields_filled: string[];
  fields_overwritten: string[];
  fields_skipped_existing: string[];
  status: ComposerRefreshStatus;
  mbid: string;
  wikidata_qid: string;
  sources: { musicbrainz: boolean; wikidata: boolean };
}

/** Full edition detail returned by upload/retrieve/approve/reingest. */
export interface ScoreEditionDetail extends ScoreEditionSummary {
  sha256: string;
  uploaded_by: number | null;
  /** Present on POST responses (upload, reingest) only. */
  celery_task_id?: string;
}

/** One in-flight ingestion, from `GET /api/archive/editions/active/` — the
 *  durable source for the persistent "AI w toku" panel (survives refresh). */
export interface ActiveIngestion {
  id: string;
  original_filename: string;
  page_count?: number | null;
  piece?: string | null;
  piece_title?: string;
  composer_name?: string;
  ingestion_status: IngestionStatusCode;
  ingestion_status_display?: string;
  ingestion_progress?: IngestionProgressCode;
  /** When THIS run was dispatched — elapsed timers count from here, not from
   *  created_at (which, on a re-ingest, is the original upload date). */
  ingestion_run_started_at?: string | null;
  ingestion_cost_cents?: number;
  ingestion_cost_cents_lifetime?: number;
  ingestion_error?: string;
  /** Streaming partial-analysis preview; non-null only while Claude reads. */
  live_preview?: LiveAnalysisPreview | null;
  created_at: string;
  updated_at: string;
}

export const ArchiveService = {
  // ---- Pieces -----------------------------------------------------------
  getPieces: async (): Promise<Piece[]> => {
    const response = await api.get<Piece[]>(PIECES_URL);
    return response.data;
  },

  getPiece: async (id: string): Promise<Piece> => {
    const response = await api.get<Piece>(`${PIECES_URL}${id}/`);
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

  /**
   * Dispatch on-demand AI program-note generation for a piece (no longer eager
   * at ingest). Returns immediately with a task id; the note appears on a later
   * refetch. `force` regenerates over an existing note.
   */
  generateProgramNote: async (
    pieceId: string,
    force = false,
    language?: string,
  ): Promise<{ celery_task_id: string; status: string }> => {
    const params = new URLSearchParams();
    if (force) params.set("force", "true");
    if (language) params.set("language", language);
    const qs = params.toString();
    const url = `${PIECES_URL}${pieceId}/generate_program_note/${qs ? `?${qs}` : ""}`;
    const response = await api.post<{ celery_task_id: string; status: string }>(url);
    return response.data;
  },

  // ---- Composers --------------------------------------------------------
  getComposers: async (): Promise<Composer[]> => {
    const response = await api.get<Composer[]>(COMPOSERS_URL);
    return response.data;
  },

  getComposer: async (id: string): Promise<Composer> => {
    const response = await api.get<Composer>(`${COMPOSERS_URL}${id}/`);
    return response.data;
  },

  createComposer: async (data: ComposerWriteDTO): Promise<Composer> => {
    const response = await api.post<Composer>(COMPOSERS_URL, data);
    return response.data;
  },

  updateComposer: async (
    id: string,
    data: Partial<ComposerWriteDTO> & {
      nationality?: string;
      period?: string;
    },
  ): Promise<Composer> => {
    const response = await api.patch<Composer>(`${COMPOSERS_URL}${id}/`, data);
    return response.data;
  },

  deleteComposer: async (id: string): Promise<void> => {
    await api.delete(`${COMPOSERS_URL}${id}/`);
  },

  /** Reassigns this composer's pieces onto `targetId`, then soft-deletes the source. */
  mergeComposer: async (sourceId: string, targetId: string): Promise<Composer> => {
    const response = await api.post<Composer>(
      `${COMPOSERS_URL}${sourceId}/merge_into/${targetId}/`,
    );
    return response.data;
  },

  /**
   * Re-pull MusicBrainz + Wikidata data for a composer.
   * @param force when true, also overwrite existing canonical fields with fresh
   *   values (conductor's manual edits stay protected); otherwise fill blanks only.
   */
  refreshComposerFromMb: async (
    id: string,
    force = false,
  ): Promise<ComposerRefreshResult> => {
    const response = await api.post<ComposerRefreshResult>(
      `${COMPOSERS_URL}${id}/refresh_mb/${force ? "?force=true" : ""}`,
    );
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

  /** Single-edition fetch — drives the live ingestion-progress poll after upload. */
  getEdition: async (id: string): Promise<ScoreEditionDetail> => {
    const response = await api.get<ScoreEditionDetail>(`${EDITIONS_URL}${id}/`);
    return response.data;
  },

  /** Every in-flight ingestion across the archive — powers the persistent
   *  "AI w toku" panel that survives a page refresh. */
  getActiveEditions: async (): Promise<ActiveIngestion[]> => {
    const response = await api.get<ActiveIngestion[]>(`${EDITIONS_URL}active/`);
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

  /** Cooperatively cancel an in-flight ingestion (wrong PDF, changed mind). */
  cancelEdition: async (id: string): Promise<ScoreEditionDetail> => {
    const response = await api.post<ScoreEditionDetail>(`${EDITIONS_URL}${id}/cancel/`);
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

  // ---- AI artifacts (inline correction in the Review cockpit) -----------
  // Movements / translations / recordings are the AI's most error-prone
  // outputs; these let the conductor fix or drop a bad one during review.
  updateMovement: async (id: string, data: Partial<Movement>): Promise<Movement> => {
    const response = await api.patch<Movement>(`${MOVEMENTS_URL}${id}/`, data);
    return response.data;
  },

  deleteMovement: async (id: string): Promise<void> => {
    await api.delete(`${MOVEMENTS_URL}${id}/`);
  },

  updateTranslation: async (
    id: string,
    data: Partial<Translation>,
  ): Promise<Translation> => {
    const response = await api.patch<Translation>(`${TRANSLATIONS_URL}${id}/`, data);
    return response.data;
  },

  deleteTranslation: async (id: string): Promise<void> => {
    await api.delete(`${TRANSLATIONS_URL}${id}/`);
  },

  updateRecording: async (
    id: string,
    data: Partial<Recording>,
  ): Promise<Recording> => {
    const response = await api.patch<Recording>(`${RECORDINGS_URL}${id}/`, data);
    return response.data;
  },

  deleteRecording: async (id: string): Promise<void> => {
    await api.delete(`${RECORDINGS_URL}${id}/`);
  },
};
