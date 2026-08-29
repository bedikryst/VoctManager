/**
 * @file logistics.dto.ts
 * @description Feature-local schemas and DTOs for the Logistics domain.
 */
import { z } from "zod";
import type { LocationCategory } from "@/shared/types";

/**
 * The category union as a runtime tuple, exhaustively. The `satisfies` is the
 * point: this list used to be typed out by hand, so adding a category to
 * `LocationCategory` left the create form silently rejecting the very value its
 * own dropdown offered. Now a missing key is a compile error.
 */
const LOCATION_CATEGORY_KEYS = {
  CONCERT_HALL: true,
  CHURCH: true,
  REHEARSAL_ROOM: true,
  HOTEL: true,
  AIRPORT: true,
  TRANSIT_STATION: true,
  RESTAURANT: true,
  PARKING: true,
  WORKSPACE: true,
  OTHER: true,
} satisfies Record<LocationCategory, true>;

const LocationCategoryEnum = z.enum(
  Object.keys(LOCATION_CATEGORY_KEYS) as [LocationCategory, ...LocationCategory[]],
);

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

export type LocationCreateDto = LocationFormValues;

export interface LocationDto {
  id: string;
  name: string;
  category: LocationCategory;
  formatted_address: string;
  google_place_id?: string | null;
  latitude: string | null;
  longitude: string | null;
  timezone: string;
  internal_notes: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LocationReferenceDto {
  id: string;
  name?: string;
  category?: LocationCategory | string;
  timezone?: string;
  formatted_address?: string | null;
  google_place_id?: string | null;
  latitude?: string | number | null;
  longitude?: string | number | null;
}

export type LocationReference = string | LocationDto | LocationReferenceDto;

export interface LocationUpdateDto extends Partial<LocationFormValues> {
  is_active?: boolean;
}
