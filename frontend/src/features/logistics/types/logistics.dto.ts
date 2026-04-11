/**
 * @file logistics.dto.ts
 * @description Feature-local DTOs for the Logistics domain.
 * Strictly mirrors the backend contracts to protect the network boundary.
 * @architecture Enterprise SaaS 2026
 */

import type { LocationCategory } from "../../../shared/types";

export interface LocationDto {
  id: string;
  name: string;
  category: LocationCategory;
  google_place_id: string | null;
  formatted_address: string;
  latitude: number | null;
  longitude: number | null;
  timezone: string;
  internal_notes: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LocationCreateDto {
  name: string;
  category: LocationCategory;
  formatted_address: string;
  google_place_id?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  internal_notes?: string;
}

export interface LocationUpdateDto extends Partial<LocationCreateDto> {
  is_active?: boolean;
}
