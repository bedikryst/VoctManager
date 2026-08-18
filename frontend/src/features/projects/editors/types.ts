/**
 * @file types.ts
 * @description Shared domain types for the editors feature slice.
 * Centralizes DTOs and enriched aggregates consumed by hooks and tabs.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/editors/types
 */

import type {
  Artist,
  Collaborator,
  CrewAssignment,
  Participation,
} from "@/shared/types";

import type { ProjectEventKind } from "../constants/projectDomain";

export interface ProjectFormData {
  title: string;
  /** What the ensemble is singing at — a Mass is programmed against the order
   *  of the rite, a concert against a running order. */
  event_kind: ProjectEventKind;
  timezone: string;
  date_time: string;
  call_time: string;
  location_id: string | null;
  conductor: string | null;
  dress_code_male: string;
  dress_code_female: string;
  spotify_playlist_url: string;
  description: string;
  entrance_note: string;
  parking_note: string;
  dressing_room_note: string;
  /** `HH:MM` as typed, empty when unset — the payload trims it to a bare hour
   *  or to `null`; the API stores a wall-clock time on concert day. */
  warmup_start: string;
  warmup_end: string;
  soundcheck_start: string;
  soundcheck_end: string;
  onsite_contact_name: string;
  onsite_contact_phone: string;
}

export interface RehearsalFormData {
  date_time: string;
  timezone: string;
  location_id: string;
  focus: string;
  is_mandatory: boolean;
}

export type RehearsalTargetType = "TUTTI" | "SECTIONAL" | "CUSTOM";

export interface ProgramTabItem {
  id: string;
  order: number;
  piece: string;
  piece_id?: string;
  piece_title: string;
  is_encore: boolean;
  /** The slot code the picker writes; `""` for an unplaced or concert item. */
  liturgical_slot: string;
  /** The slot as the singer will read it — numbered and translated by the
   *  server. Never composed here. */
  slot_label: string;
  /** The arrangement pinned for this concert; `null` leaves the choice to the
   *  auto-selection. Only a piece published in more than one edition has
   *  anything to pin. */
  score_edition: string | null;
}

export interface FeeMutation {
  type: "cast" | "crew";
  value: string;
}

export interface EnrichedParticipation extends Participation {
  artistData: Artist;
}

export interface EnrichedCrewAssignment extends CrewAssignment {
  crewData: Collaborator;
}

export type CastTabMobileView = "AVAILABLE" | "ASSIGNED";
