/**
 * @file types/index.ts
 * @description Comprehensive Data Dictionary for the production frontend.
 * Directly maps to Django backend models (roster & archive applications).
 * @architecture Enterprise 2026 Standards
 * @module types
 */

export interface BaseModel {
  id: string;
  created_at?: string;
  updated_at?: string;
  is_deleted?: boolean;
}

export type VoiceType = 'SOP' | 'MEZ' | 'ALT' | 'CT' | 'TEN' | 'BAR' | 'BAS' | 'DIR';
export type ProjectStatus = 'DRAFT' | 'ACTIVE' | 'DONE' | 'CANC';
export type ParticipationStatus = 'INV' | 'CON' | 'DEC';
export type CastingRole = 'TUTTI' | 'SOLO' | 'BACK';
export type AttendanceStatus = 'PRESENT' | 'LATE' | 'ABSENT' | 'EXCUSED' | null;
export type CollaboratorSpecialty = 'SOUND' | 'LIGHT' | 'VISUALS' | 'INSTRUMENT' | 'LOGISTICS' | 'OTHER';
export type CrewAssignmentStatus = 'INV' | 'CON';
export type Epoch = 'MED' | 'REN' | 'BAR' | 'CLA' | 'ROM' | 'M20' | 'CON' | 'POP' | 'FOLK' | 'OTH';

export type VoiceLine =
  | 'S1' | 'S2'
  | 'A1' | 'A2'
  | 'T1' | 'T2'
  | 'B1' | 'B2'
  | 'SOLO' | 'VP' | 'TUTTI' | 'ACC' | 'PRON';

export interface VoiceLineOption {
  value: VoiceLine | string;
  label: string;
}

export interface Artist extends BaseModel {
  user?: string | null;
  first_name: string;
  last_name: string;
  email: string;
  phone_number?: string | null;
  voice_type: VoiceType | string;
  voice_type_display?: string;
  is_active: boolean;
  username?: string | null;
  sight_reading_skill?: number | null;
  vocal_range_bottom?: string | null;
  vocal_range_top?: string | null;
}

export interface RunSheetItem {
  id?: string | number;
  time: string;
  title: string;
  description?: string;
  activity?: string;
  details?: string | null;
}

export interface Project extends BaseModel {
  title: string;
  date_time: string;
  call_time?: string | null;
  dress_code_male?: string | null;
  dress_code_female?: string | null;
  location?: string | null;
  description?: string | null;
  status: ProjectStatus | string;
  run_sheet?: RunSheetItem[];
  program?: ProgramItem[];
  spotify_playlist_url?: string;
}

export interface Participation extends BaseModel {
  artist: string;
  project: string;
  status: ParticipationStatus | string;
  fee?: string | number | null;
}

export interface Rehearsal extends BaseModel {
  project: string;
  date_time: string;
  location: string;
  focus?: string | null;
  is_mandatory: boolean;
  invited_participations?: string[];
}

export interface Attendance extends BaseModel {
  rehearsal: string;
  participation: string;
  status: AttendanceStatus | string;
  minutes_late?: number | null;
  excuse_note?: string | null;
}

export interface Collaborator extends BaseModel {
  first_name: string;
  last_name: string;
  email?: string | null;
  phone_number?: string | null;
  company_name?: string | null;
  specialty: CollaboratorSpecialty | string;
}

export interface CrewAssignment extends BaseModel {
  collaborator: string;
  project: string;
  role_description?: string | null;
  status: CrewAssignmentStatus | string;
  fee?: string | number | null;
}

export interface Composer extends BaseModel {
  first_name?: string | null;
  last_name: string;
  birth_year?: string | null;
  death_year?: string | null;
}

export interface VoiceRequirement {
  id?: string;
  piece?: string;
  voice_line: string;
  voice_line_display?: string;
  quantity: number;
}

export interface Piece extends BaseModel {
  title: string;
  composer?: string | Composer | null;
  composer_name?: string | null;
  composer_full_name?: string | null;
  arranger?: string | null;
  language?: string | null;
  estimated_duration?: number | null;
  voicing?: string | null;
  description?: string;
  sheet_music?: string | null;
  lyrics_original?: string | null;
  lyrics_translation?: string | null;
  reference_recording?: string | null;
  reference_recording_youtube?: string | null;
  reference_recording_spotify?: string | null;
  composition_year?: number | null;
  epoch?: Epoch | string | null;
  epoch_display?: string | null;
  voice_requirements?: VoiceRequirement[];
  tracks?: Track[];
}

export interface ProgramItem extends BaseModel {
  project: string;
  piece: string;
  piece_id?: string;
  piece_title?: string;
  title: string;
  order: number;
  is_encore: boolean;
}

export interface PieceCasting extends BaseModel {
  participation: string;
  piece: string;
  voice_line: string;
  gives_pitch: boolean;
  notes?: string | null;
}

export interface Track extends BaseModel {
  piece: string;
  voice_part: string;
  voice_part_display?: string;
  audio_file: string;
}
