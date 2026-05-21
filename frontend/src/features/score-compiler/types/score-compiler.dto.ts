/**
 * @file score-compiler.dto.ts
 * @description Score Package Compiler — DTOs mirroring the backend serializers.
 * Shared nested entities live in shared/types. ScoreEdition-specific list,
 * detail, and write payloads stay here because the backend uses dedicated
 * serializers for the review workflow.
 * @architecture Enterprise SaaS 2026
 * @module features/score-compiler/types/score-compiler.dto
 */

import type {
  IngestionStatusCode,
  Movement,
  ProgramNote,
  Recording,
  RecordingSource,
  Translation,
  VoiceRequirement,
} from "@/shared/types";

// ===========================================================================
// Re-exported shared shapes (historical DTO aliases).
// ===========================================================================

export type IngestionStatus = IngestionStatusCode;
export type RecordingSourceCode = RecordingSource;
export type MovementDTO = Movement;
export type TranslationDTO = Translation;
export type RecordingDTO = Recording;
export type ProgramNoteDTO = ProgramNote;

export interface ComposerSummaryDTO {
  id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  birth_year: string;
  death_year: string;
  nationality?: string;
  period?: string;
  bio?: string;
  portrait_url?: string;
  portrait_license?: string;
  mbid?: string | null;
  wikidata_qid?: string;
}

export interface PieceSummaryDTO {
  id: string;
  title: string;
  composer: ComposerSummaryDTO | null;
  opus_catalog: string;
  musical_key: string;
  language: string;
  estimated_duration: number | null;
  voicing: string;
  text_source: string;
  lyrics_original: string;
  lyrics_translation: string;
  lyrics_ipa: string;
  composition_year: number | null;
  epoch: string;
  mbid_work: string | null;
  ingestion_status: IngestionStatus;
  voice_requirements: VoiceRequirement[];
  movements: MovementDTO[];
  translations: TranslationDTO[];
  recordings: RecordingDTO[];
  program_notes: ProgramNoteDTO[];
}

export type AnnotationTypeCode = "HL" | "CM" | "FH" | "ST";

export interface AnnotationDTO {
  id: string;
  page_number: number;
  annotation_type: AnnotationTypeCode;
  payload: Record<string, unknown>;
  color: string;
  layer_name: string;
  created_by: string | null;
}

// ===========================================================================
// ScoreEdition — list + detail variants
// ===========================================================================

/** Lean shape for the table on the review dashboard. */
export interface ScoreEditionListDTO {
  id: string;
  original_filename: string;
  publisher: string;
  edition_year: number | null;
  page_count: number | null;
  is_default: boolean;
  piece: string | null;
  piece_title: string;
  composer_name: string;
  ingestion_status: IngestionStatus;
  ingestion_status_display: string;
  ingestion_cost_cents: number;
  ingestion_error: string;
  created_at: string;
  updated_at: string;
}

/** Full shape powering the conductor review screen. */
export interface ScoreEditionDetailDTO {
  id: string;
  pdf_file: string; // URL to download
  original_filename: string;
  page_count: number | null;
  publisher: string;
  edition_year: number | null;
  editor_name: string;
  is_default: boolean;
  sha256: string;
  uploaded_by: number | null;
  piece: PieceSummaryDTO | null;
  annotations: AnnotationDTO[];
  ingestion_status: IngestionStatus;
  ingestion_status_display: string;
  ingestion_cost_cents: number;
  ingestion_error: string;
  created_at: string;
  updated_at: string;
  /** Present on POST /editions/ and POST /editions/{id}/reingest/ responses only. */
  celery_task_id?: string;
}

// ===========================================================================
// Write payloads
// ===========================================================================

export interface ScoreEditionUploadDTO {
  pdf_file: File;
  original_filename?: string;
  publisher?: string;
  edition_year?: number | null;
  editor_name?: string;
  is_default?: boolean;
}

export interface ScoreEditionPatchDTO {
  publisher?: string;
  edition_year?: number | null;
  editor_name?: string;
  is_default?: boolean;
}

export interface VoiceRequirementInput {
  voice_line: string;
  quantity: number;
}

/**
 * Subset of Piece fields the conductor can edit from the review modal.
 * Maps 1:1 to PieceSerializer JSON fields (PATCH /api/pieces/{id}/).
 * Composer disambiguation is a separate flow and intentionally NOT here.
 *
 * `requirements_data` mirrors the legacy PieceSerializer write-only field
 * used by the Archive editor — the same payload shape (list of
 * `{voice_line, quantity}`) so the backend doesn't need a new entrypoint.
 */
export interface PiecePatchDTO {
  title?: string;
  opus_catalog?: string;
  musical_key?: string;
  language?: string;
  voicing?: string;
  text_source?: string;
  composition_year?: number | null;
  estimated_duration?: number | null;
  lyrics_original?: string;
  requirements_data?: VoiceRequirementInput[];
}

// ===========================================================================
// UI helpers — derived flags computed from ingestion_status
// ===========================================================================

export const INGESTION_STATUS_LABELS: Record<IngestionStatus, string> = {
  PEND: "Pending",
  EXTR: "Extracting metadata",
  ENRI: "Looking up canonical sources",
  GENR: "Generating program note & translations",
  AWAI: "Awaiting your review",
  "RDY ": "Ready",
  FAIL: "Failed",
};

export const TERMINAL_STATUSES: ReadonlySet<IngestionStatus> = new Set([
  "AWAI",
  "RDY ",
  "FAIL",
]);

export const isIngestionInProgress = (status: IngestionStatus): boolean =>
  !TERMINAL_STATUSES.has(status);

/**
 * Semantic tone for a status — maps to Ethereal accent tokens in the
 * EditionStatusBadge. Kept here so the badge stays a pure presentational
 * component and any consumer can compare tones (e.g. for icon choice).
 */
export type StatusTone =
  | "neutral"
  | "progress"
  | "awaiting"
  | "ready"
  | "failed";

export const INGESTION_STATUS_TONES: Record<IngestionStatus, StatusTone> = {
  PEND: "neutral",
  EXTR: "progress",
  ENRI: "progress",
  GENR: "progress",
  AWAI: "awaiting",
  "RDY ": "ready",
  FAIL: "failed",
};
