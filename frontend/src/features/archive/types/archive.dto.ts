/**
 * @file archive.dto.ts
 * @description Data Transfer Objects for the Archive domain.
 * Mirrors backend [archive.dtos.PieceWriteDTO] for the manager-edit form.
 * Sub-entities (editions, recordings, translations, movements, program_notes)
 * have their own dedicated endpoints and are NOT written via this DTO.
 */

import type { Epoch, Piece, VoiceLine } from "@/shared/types";

export interface VoiceRequirementDTO {
  voice_line: VoiceLine;
  quantity: number;
}

export interface ComposerWriteDTO {
  first_name?: string;
  last_name: string;
  birth_year?: string;
  death_year?: string;
}

export interface PieceWriteDTO {
  title: string;
  /** UUID of the composer FK. `null` clears it (e.g. traditional/anonymous works). */
  composer_id?: string | null;
  arranger?: string;
  language?: string;
  estimated_duration?: number | null;
  voicing?: string;
  description?: string;
  lyrics_original?: string;
  lyrics_ipa?: string;
  composition_year?: number | null;
  epoch?: Epoch | "";
  opus_catalog?: string;
  musical_key?: string;
  text_source?: string;
  /** JSON list of `{voice_line, quantity}` — replaces full divisi atomically. */
  voice_requirements?: VoiceRequirementDTO[];
}

/**
 * Subset of `PieceWriteDTO` the AI Review tab uses for inline patches.
 * Excludes voice_requirements (managed via dedicated DivisiEditor) and
 * description (only edited from the Metadata tab). Title is required there
 * but optional here so individual fields can patch without re-sending it.
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
  lyrics_ipa?: string;
  voice_requirements?: VoiceRequirementDTO[];
}

/**
 * Historical alias kept for call-site stability. Read responses are
 * `shared/types/Piece` — no extra client-side enrichment needed.
 */
export type EnrichedPiece = Piece;

// ===========================================================================
// ScoreEdition — DTOs for upload + workflow control
// ===========================================================================

export interface ScoreEditionUploadDTO {
  pdf_file: File;
  original_filename?: string;
  publisher?: string;
  edition_year?: number | null;
  editor_name?: string;
  is_default?: boolean;
  /** If set, the resolver step is skipped — the upload attaches as another
   *  edition of this existing piece. */
  piece_id?: string;
}

export interface ScoreEditionPatchDTO {
  publisher?: string;
  edition_year?: number | null;
  editor_name?: string;
  is_default?: boolean;
}
