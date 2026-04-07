/**
 * @file archive.dto.ts
 * @description Data Transfer Objects for the Archive domain.
 * Strictly mirrors the backend Django DTOs to ensure type safety across the network boundary.
 */

import type { Piece, Composer } from "../../../shared/types";

export interface VoiceRequirementDTO {
  voice_line: string;
  quantity: number;
}

export interface PieceWriteDTO {
  title: string;
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

  // File payload for multipart/form-data
  sheet_music?: File;
}

/**
 * View Model for the UI.
 * Replaces the string ID of the composer with the actual Composer object.
 */
export interface EnrichedPiece extends Omit<Piece, "composer"> {
  composer?: Composer | null;
}
