/**
 * @file archive.dto.ts
 * @description Data Transfer Objects for the Archive domain.
 * Mirrors backend [archive.dtos.PieceWriteDTO] for the manager-edit form.
 * Sub-entities (editions, recordings, translations, movements, program_notes)
 * have their own dedicated endpoints and are NOT written via this DTO.
 */

import type {
  Epoch,
  Piece,
  ScoreLicenseType,
  StartingPitch,
  VoiceLine,
} from "@/shared/types";

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
  /** Ordered rehearsal pitches, top voice first — see shared/types StartingPitch. */
  starting_pitches?: StartingPitch[];
  text_source?: string;
  /** JSON list of `{voice_line, quantity}` — replaces full divisi atomically. */
  voice_requirements?: VoiceRequirementDTO[];
}

/**
 * Subset of `PieceWriteDTO` the Piece Card uses for dirty-field patches. Title
 * is required in the write DTO but optional here so individual fields can patch
 * without re-sending it. Since the Piece Card unified the edit + verify surfaces,
 * it covers the full editable set — composer FK, notes and divisi included.
 */
export interface PiecePatchDTO {
  title?: string;
  /** UUID of the composer FK. `null` clears it (traditional/anonymous works). */
  composer_id?: string | null;
  arranger?: string;
  opus_catalog?: string;
  musical_key?: string;
  /** Ordered rehearsal pitches, top voice first — see shared/types StartingPitch. */
  starting_pitches?: StartingPitch[];
  language?: string;
  voicing?: string;
  text_source?: string;
  composition_year?: number | null;
  epoch?: Epoch | "";
  estimated_duration?: number | null;
  lyrics_original?: string;
  lyrics_ipa?: string;
  /** Conductor's internal notes. */
  description?: string;
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
  /** Copyright status — drives export gating, watermarking and access logging. */
  license_type?: ScoreLicenseType;
  /** Physical copies owned (LICENSED_COPIES only); null clears it. */
  copies_owned?: number | null;
}
