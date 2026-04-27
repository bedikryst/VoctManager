/**
 * @file artist.dto.ts
 * @description Data Transfer Objects and Zod schemas for Artist mutations.
 * @architecture Enterprise SaaS 2026
 */

import { z } from "zod";

// 1. Zod Schema defining both validation rules and the shape of the form
export const artistFormSchema = z.object({
  first_name: z.string().min(1, "artists.validation.first_name_required"),
  first_name_vocative: z.string().optional(),
  last_name: z.string().min(1, "artists.validation.last_name_required"),
  email: z.string().email("artists.validation.invalid_email"),
  voice_type: z.string().min(1, "artists.validation.voice_type_required"),
  phone_number: z.string().optional(),
  sight_reading_skill: z.string().optional(),
  vocal_range_bottom: z.string().optional(),
  vocal_range_top: z.string().optional(),
  language: z.enum(["pl", "en", "fr"]),
  is_active: z.boolean(),
});

export type ArtistFormValues = z.infer<typeof artistFormSchema>;

export interface ArtistCreateDTO {
  first_name: string;
  first_name_vocative?: string;
  last_name: string;
  email: string;
  voice_type: string;
  phone_number?: string;
  sight_reading_skill?: number | null;
  vocal_range_bottom?: string;
  vocal_range_top?: string;
  language?: string;
}

export type ArtistUpdateDTO = Partial<ArtistCreateDTO> & {
  is_active?: boolean;
};
