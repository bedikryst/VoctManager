/**
 * @file types.ts
 * @description Shared domain types for the ProjectEditorPanel feature slice.
 * Centralizes DTOs and enriched aggregates consumed by hooks and tabs.
 * @architecture Enterprise SaaS 2026
 * @module panel/projects/ProjectEditorPanel/types
 */

import type {
  Artist,
  Collaborator,
  CrewAssignment,
  Participation,
} from "@/shared/types";

export interface ProjectFormData {
  title: string;
  timezone: string;
  date_time: string;
  call_time: string;
  location_id: string | null;
  conductor: string | null;
  dress_code_male: string;
  dress_code_female: string;
  spotify_playlist_url: string;
  description: string;
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
