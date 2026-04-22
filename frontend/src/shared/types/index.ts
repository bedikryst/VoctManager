/**
 * @file index.ts
 * @description Comprehensive Data Dictionary for the production frontend.
 * Directly maps to Django backend models (roster & archive applications).
 * @architecture Enterprise SaaS 2026
 * @module shared/types
 */

import type { ProjectStatus } from "@features/projects/constants/projectDomain";

export interface BaseModel {
  id: string;
  created_at?: string;
  updated_at?: string;
  is_deleted?: boolean;
}

// ==========================================
// STRICT DOMAIN ENUMS
// ==========================================

export type VoiceType =
  | "SOP"
  | "MEZ"
  | "ALT"
  | "CT"
  | "TEN"
  | "BAR"
  | "BAS"
  | "DIR";

export type ParticipationStatus = "INV" | "CON" | "DEC";
export type AttendanceStatus = "PRESENT" | "LATE" | "ABSENT" | "EXCUSED";
export type CollaboratorSpecialty =
  | "SOUND"
  | "LIGHT"
  | "VISUALS"
  | "INSTRUMENT"
  | "LOGISTICS"
  | "OTHER";
export type CrewAssignmentStatus = "INV" | "CON";
export type Epoch =
  | "MED"
  | "REN"
  | "BAR"
  | "CLA"
  | "ROM"
  | "M20"
  | "CON"
  | "POP"
  | "FOLK"
  | "OTH";

export type VoiceLine =
  | "S1"
  | "S2"
  | "A1"
  | "A2"
  | "T1"
  | "T2"
  | "B1"
  | "B2"
  | "SOLO"
  | "VP"
  | "TUTTI"
  | "ACC"
  | "PRON";

export interface VoiceLineOption {
  value: VoiceLine;
  label: string;
}

export interface VoiceTypeOption {
  value: string;
  label: string;
}

// ==========================================
// DOMAIN ENTITIES: ROSTER & PROJECTS
// ==========================================

export interface Artist extends BaseModel {
  user?: string | null; // FK relation, can be null
  first_name: string;
  last_name: string;
  email: string;
  phone_number?: string;
  voice_type: VoiceType;
  voice_type_display?: string;
  is_active: boolean;
  username?: string;
  is_manager?: boolean;
  sight_reading_skill?: number | null; // Numeric, can be null
  vocal_range_bottom?: string;
  vocal_range_top?: string;
}

export interface RunSheetItem {
  id?: string | number;
  time: string;
  title: string;
  description?: string;
  activity?: string;
  details?: string;
}

export interface LocationSnippet {
  id: string;
  name: string;
  category: LocationCategory | string;
  timezone: string;
  formatted_address?: string | null;
  google_place_id?: string | null;
  latitude?: string | number | null;
  longitude?: string | number | null;
}

export interface Project extends BaseModel {
  title: string;
  date_time: string;
  timezone: string;
  call_time?: string | null; // DateTime, can be null
  dress_code_male?: string | null;
  dress_code_female?: string | null;
  location?: string | LocationSnippet | null;
  conductor?: string | Artist | null;
  conductor_name?: string | null;
  description?: string | null;
  spotify_playlist_url?: string | null;
  status: ProjectStatus;
  run_sheet?: RunSheetItem[];
  program?: ProgramItem[];
  cast?: Array<{
    id: string;
    first_name: string;
    last_name: string;
    voice_type: VoiceType;
    voice_type_display: string;
  }>;
  rehearsals_total?: number;
  rehearsals_upcoming?: number;
  cast_total?: number;
  crew_total?: number;
  pieces_total?: number;
}

export interface Participation extends BaseModel {
  artist: string;
  project: string;
  status: ParticipationStatus;
  fee?: string | number | null;
  artist_name?: string;
  project_name?: string;
  artist_voice_type_display?: string;
}

export interface Rehearsal extends BaseModel {
  project: string; // Foreign Key ID
  date_time: string;
  timezone: string;
  location?: string | LocationSnippet | null;
  focus?: string;
  is_mandatory: boolean;
  invited_participations?: string[];
  absent_count?: number;
}

export interface Attendance extends BaseModel {
  rehearsal: string; // Foreign Key ID
  participation: string; // Foreign Key ID
  status: AttendanceStatus | null;
  minutes_late?: number | null; // Numeric, can be null
  excuse_note?: string | null;
}

export interface Collaborator extends BaseModel {
  first_name: string;
  last_name: string;
  email?: string;
  phone_number?: string;
  company_name?: string;
  specialty: CollaboratorSpecialty;
}

export interface CrewAssignment extends BaseModel {
  collaborator: string; // Foreign Key ID
  project: string; // Foreign Key ID
  role_description?: string;
  status: CrewAssignmentStatus;
  fee?: string | number | null; // Decimal, can be null
}

// ==========================================
// DOMAIN ENTITIES: LOGISTICS
// ==========================================

export type LocationCategory =
  | "CONCERT_HALL"
  | "REHEARSAL_ROOM"
  | "HOTEL"
  | "AIRPORT"
  | "TRANSIT_STATION"
  | "WORKSPACE"
  | "OTHER";

export interface Location extends BaseModel {
  name: string;
  category: LocationCategory;
  google_place_id?: string | null;
  formatted_address: string;
  latitude?: string | number | null;
  longitude?: string | number | null;
  timezone: string;
  internal_notes?: string;
  is_active: boolean;
}

// ==========================================
// DOMAIN ENTITIES: ARCHIVE
// ==========================================

export interface Composer extends BaseModel {
  first_name?: string;
  last_name: string;
  birth_year?: string;
  death_year?: string;
}

export interface VoiceRequirement {
  id?: string;
  piece?: string; // Foreign Key ID
  voice_line: VoiceLine;
  voice_line_display?: string;
  quantity: number;
}

export interface Track extends BaseModel {
  piece: string; // Foreign Key ID
  voice_part: VoiceLine;
  voice_part_display?: string;
  audio_file: string; // URL string, no null
}

export interface Piece extends BaseModel {
  title: string;
  composer?: string | null; // FK relation, can be null
  composer_name?: string;
  composer_full_name?: string;

  arranger?: string;
  language?: string;
  estimated_duration?: number | null; // Numeric, can be null
  voicing?: string;
  description?: string;
  sheet_music?: string; // URL string, no null
  lyrics_original?: string;
  lyrics_translation?: string;
  reference_recording?: string;
  reference_recording_youtube?: string;
  reference_recording_spotify?: string;
  composition_year?: number | null; // Numeric, can be null
  epoch?: Epoch;
  epoch_display?: string;

  // Nested relations
  voice_requirements?: VoiceRequirement[];
  tracks?: Track[];
}

export interface ProgramItem extends BaseModel {
  project: string | number;
  piece: string | number;
  piece_id?: string | number;
  title?: string;
  piece_title?: string;
  order: number;
  is_encore: boolean;
}

export interface PieceCasting extends BaseModel {
  participation: string; // Foreign Key ID
  piece: string; // Foreign Key ID
  voice_line: VoiceLine;
  gives_pitch: boolean;
  notes?: string;

  voice_line_display?: string;
  artist_name?: string;
  project_id?: string;
  artist_id?: string;
}
