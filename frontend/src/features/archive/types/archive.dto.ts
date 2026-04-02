/**
 * @file archive.dto.ts
 * @description Data Transfer Objects for the Archive domain.
 * Strictly mirrors the backend Django DTOs to ensure type safety across the network boundary.
 */

export interface VoiceRequirementDTO {
    voice_line: string;
    quantity: number;
}

export interface PieceWriteDTO {
    title: string;
    composer?: string | null;
    arranger?: string | null;
    language?: string | null;
    estimated_duration?: number | null;
    voicing?: string;
    description?: string;
    lyrics_original?: string | null;
    lyrics_translation?: string | null;
    reference_recording_youtube?: string | null;
    reference_recording_spotify?: string | null;
    composition_year?: number | null;
    epoch?: string | null;
    voice_requirements?: VoiceRequirementDTO[];
    
    // File payload for multipart/form-data
    sheet_music?: File | null;
}