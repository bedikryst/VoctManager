/**
 * @file artist.dto.ts
 * @description Data Transfer Objects for Artist mutations. 
 * Strictly mirrors the backend Django DTOs to ensure type safety across the network boundary.
 * @architecture Enterprise SaaS 2026
 */

export interface ArtistCreateDTO {
    first_name: string;
    last_name: string;
    email: string;
    voice_type: string;
    phone_number?: string | null;
    sight_reading_skill?: number | null;
    vocal_range_bottom?: string | null;
    vocal_range_top?: string | null;
}

export type ArtistUpdateDTO = Partial<ArtistCreateDTO> & {
    is_active?: boolean;
};