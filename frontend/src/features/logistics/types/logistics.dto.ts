/**
 * @file logistics.dto.ts
 * @description Feature-local schemas and DTOs for the Logistics domain.
 */
import { z } from "zod";
import type { LocationCategory } from "@/shared/types";

const LocationCategoryEnum = z.enum([
  "CONCERT_HALL",
  "REHEARSAL_ROOM",
  "HOTEL",
  "AIRPORT",
  "TRANSIT_STATION",
  "WORKSPACE",
  "OTHER",
]);

export const locationFormSchema = z.object({
  name: z.string().min(1, "logistics.validation.name_required"),
  category: LocationCategoryEnum,
  formatted_address: z.string().min(1, "logistics.validation.address_required"),
  google_place_id: z.string().nullable().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  internal_notes: z.string().optional(),
});

export type LocationFormValues = z.infer<typeof locationFormSchema>;

export interface LocationDto extends LocationFormValues {
  id: string;
  timezone: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LocationUpdateDto extends Partial<LocationFormValues> {
  is_active?: boolean;
}
