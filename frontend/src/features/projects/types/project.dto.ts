/**
 * @file project.dto.ts
 * @description Data Transfer Objects for Project domain mutations.
 * Strictly mirrors backend payload contracts to protect the network boundary.
 * @architecture Enterprise SaaS 2026
 */

import type {
  Attendance,
  CrewAssignmentStatus,
  RunSheetItem,
  VoiceLine,
  ParticipationStatus,
} from "../../../shared/types";

import type { ProjectStatus } from "../constants/projectDomain";

export interface ProjectCreateDTO {
  title: string;
  date_time: string;
  timezone: string;
  call_time?: string | null;
  location?: string | null;
  dress_code_male?: string | null;
  dress_code_female?: string | null;
  spotify_playlist_url?: string | null;
  description?: string | null;
  run_sheet?: RunSheetItem[];
}

export type ProjectUpdateDTO = Partial<ProjectCreateDTO> & {
  status?: ProjectStatus;
};

export interface ParticipationCreateDTO {
  artist: string;
  project: string;
  status: ParticipationStatus;
  fee?: number | null;
}

export type ParticipationUpdateDTO = Partial<ParticipationCreateDTO>;

export interface CrewAssignmentCreateDTO {
  collaborator: string;
  project: string;
  role_description?: string;
  status?: CrewAssignmentStatus;
  fee?: number | null;
}

export type CrewAssignmentUpdateDTO = Partial<CrewAssignmentCreateDTO>;

export interface RehearsalCreateDTO {
  project: string;
  date_time: string;
  timezone: string;
  location: string;
  focus?: string;
  is_mandatory: boolean;
  invited_participations: string[];
}

export type RehearsalUpdateDTO = Partial<RehearsalCreateDTO>;

export interface ProgramItemCreateDTO {
  title: string;
  project: string;
  piece: string;
  order: number;
  is_encore: boolean;
}

export type ProgramItemUpdateDTO = Partial<ProgramItemCreateDTO>;

export interface PieceCastingCreateDTO {
  participation: string; // ✅ WZORZEC ENTERPRISE: Usunięto | number
  piece: string;
  voice_line: VoiceLine;
  gives_pitch: boolean;
  notes?: string;
}

export type PieceCastingUpdateDTO = Partial<PieceCastingCreateDTO>;

export interface AttendanceCreateDTO {
  rehearsal: string; // ✅ WZORZEC ENTERPRISE: Usunięto | number
  participation: string; // ✅ WZORZEC ENTERPRISE: Usunięto | number
  status: Attendance["status"];
}

export interface AttendanceUpdateDTO {
  status?: Attendance["status"];
  minutes_late?: number | null;
  excuse_note?: string | null;
}
