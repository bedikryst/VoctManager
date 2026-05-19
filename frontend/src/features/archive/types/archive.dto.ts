/**
 * @file archive.dto.ts
 * @description Data Transfer Objects for the Archive domain.
 * Strictly mirrors the backend Django DTOs to ensure type safety across the network boundary.
 */

import type { Piece } from "@/shared/types";

export interface VoiceRequirementDTO {
  voice_line: string;
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
  // Backend accepts either `composer` (legacy, aliased server-side to
  // `composer_id`) or `composer_id` directly. We keep the legacy key so the
  // write path stays stable across the read-shape refactor.
  composer?: string;
  arranger?: string;
  language?: string;
  estimated_duration?: number | null;
  voicing?: string;
  description?: string;
  lyrics_original?: string;
  lyrics_translation?: string;
  reference_recording_youtube?: string;
  reference_recording_spotify?: string;
  composition_year?: number | null;
  epoch?: string;
  voice_requirements?: VoiceRequirementDTO[];

  // Score Compiler-populated fields the manager can edit by hand from the
  // Archive editor (e.g. fixing an AI mis-extraction without re-ingesting).
  opus_catalog?: string;
  musical_key?: string;
  text_source?: string;
  lyrics_ipa?: string;

  // File payload for multipart/form-data
  sheet_music?: File;
}

/**
 * Historical name kept for call-site stability. PieceSerializer now embeds
 * the composer object directly, so EnrichedPiece is just an alias for the
 * canonical shared/types Piece — no manual join needed any more.
 */
export type EnrichedPiece = Piece;
