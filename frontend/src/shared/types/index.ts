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
  | "S3"
  | "A1"
  | "A2"
  | "A3"
  | "T1"
  | "T2"
  | "T3"
  | "B1"
  | "B2"
  | "B3"
  | "SOLO"
  | "VP"
  | "TUTTI"
  | "BACK"
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
  first_name_vocative?: string;
  email?: string;
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
  score_pdf?: string | null;
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
  cast_confirmed?: number;
  cast_pending?: number;
  cast_declined?: number;
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
  email?: string | null;
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
  | "CHURCH"
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
  // Score Compiler enrichments (canonical identity + biography). All optional —
  // older composers entered manually before Phase 0 won't have them.
  full_name?: string;
  mbid?: string | null;
  wikidata_qid?: string;
  nationality?: string;
  period?: string;
  bio?: string;
  portrait_url?: string;
  portrait_license?: string;
  aliases?: string[];
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

// ---- Score Compiler nested entities ----------------------------------------

export interface Movement extends BaseModel {
  order_index: number;
  title: string;
  tempo_marking?: string;
  duration_seconds?: number | null;
  voicing_override?: string;
  starts_on_page?: number | null;
}

export interface Translation extends BaseModel {
  movement?: string | null;
  target_language: string;
  text: string;
  is_singable: boolean;
}

export type RecordingSource = "SPF" | "YTB" | "APL" | "OTH";

export interface Recording extends BaseModel {
  source: RecordingSource;
  source_display?: string;
  external_id: string;
  url: string;
  performer?: string;
  year?: number | null;
  duration_seconds?: number | null;
  is_featured: boolean;
}

export interface ProgramNote extends BaseModel {
  project?: string | null;
  language: string;
  target_tone: string;
  word_count_target: number;
  content: string;
  is_approved: boolean;
}

export type IngestionStatusCode =
  | "PEND"
  | "EXTR"
  | "ENRI"
  | "GENR"
  | "AWAI"
  | "RDY "
  | "FAIL";

/**
 * Lean ScoreEdition payload embedded in Piece read responses. The full
 * detail shape (with annotations, ingestion_cost_cents, sha256, etc.) lives
 * inside the score-compiler feature; this slim version is what the Archive
 * card, Materials card, and AI Context tab need to render PDF links + badges.
 */
export interface ScoreEditionSummary extends BaseModel {
  pdf_file?: string;
  original_filename: string;
  publisher?: string;
  edition_year?: number | null;
  editor_name?: string;
  page_count?: number | null;
  is_default: boolean;
  ingestion_status: IngestionStatusCode;
  ingestion_status_display?: string;
  created_at: string;
}

export interface Piece extends BaseModel {
  title: string;
  // Read shape: nested composer summary (matches backend PieceSerializer).
  // Write payloads use `composer_id` — see PieceWriteDTO in features/archive.
  composer?: Composer | null;
  composer_name?: string;
  composer_full_name?: string;

  arranger?: string;
  language?: string;
  estimated_duration?: number | null; // seconds
  voicing?: string;
  description?: string;
  sheet_music?: string; // URL string, no null
  lyrics_original?: string;
  lyrics_translation?: string;
  reference_recording?: string;
  reference_recording_youtube?: string;
  reference_recording_spotify?: string;
  composition_year?: number | null;
  epoch?: Epoch;
  epoch_display?: string;

  // Score Compiler additions — present on every piece returned by the new
  // unified PieceSerializer, even if empty / null.
  opus_catalog?: string;
  musical_key?: string;
  text_source?: string;
  lyrics_ipa?: string;
  mbid_work?: string | null;
  ingestion_status?: IngestionStatusCode;
  ingestion_status_display?: string;

  // Nested relations
  voice_requirements: VoiceRequirement[];
  tracks: Track[];
  movements: Movement[];
  translations: Translation[];
  recordings: Recording[];
  program_notes: ProgramNote[];
  // All Score Compiler editions attached to this Piece (legacy `sheet_music`
  // remains as the one-PDF-per-piece fallback for manually-entered records).
  editions: ScoreEditionSummary[];
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
