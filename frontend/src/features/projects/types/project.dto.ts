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
} from "@/shared/types";

import type {
  ProjectEventKind,
  ProjectStatus,
} from "../constants/projectDomain";

export interface ProjectCreateDTO {
  title: string;
  date_time: string;
  timezone: string;
  call_time?: string | null;
  conductor?: string | null;
  location_id?: string | null;
  dress_code_male?: string | null;
  dress_code_female?: string | null;
  spotify_playlist_url?: string | null;
  description?: string | null;
  status?: ProjectStatus;
  event_kind?: ProjectEventKind;
  run_sheet?: RunSheetItem[];
  entrance_note?: string | null;
  parking_note?: string | null;
  dressing_room_note?: string | null;
  /** `HH:MM` wall-clock on concert day; `null` clears the window. The backend
   *  rejects an end without a start, so both halves always travel together. */
  warmup_start?: string | null;
  warmup_end?: string | null;
  soundcheck_start?: string | null;
  soundcheck_end?: string | null;
  onsite_contact_name?: string | null;
  onsite_contact_phone?: string | null;
}

export type ProjectUpdateDTO = Partial<ProjectCreateDTO> & {
  status?: ProjectStatus;
};

export interface ParticipationCreateDTO {
  artist: string;
  project: string;
  status: ParticipationStatus;
  fee?: string | number | null;
  /** This singer's seat in the concert's line-up; `""` clears it. */
  default_voice_line?: VoiceLine | "";
}

export type ParticipationUpdateDTO = Partial<ParticipationCreateDTO>;

export interface CrewAssignmentCreateDTO {
  collaborator: string;
  project: string;
  role_description?: string;
  status?: CrewAssignmentStatus;
  fee?: string | number | null;
}

export type CrewAssignmentUpdateDTO = Partial<CrewAssignmentCreateDTO>;

/**
 * One rate for a whole project's cast or crew. The server rejects unknown keys
 * (`extra="forbid"`), so this payload is exactly two fields — `fee` is the
 * public name of what the backend DTO calls `new_fee`.
 */
export interface ProjectBulkFeeDTO {
  project_id: string;
  fee: number;
}

export interface RehearsalCreateDTO {
  project_id: string;
  date_time: string;
  timezone: string;
  location_id?: string | null;
  focus?: string;
  is_mandatory: boolean;
  invited_participations?: string[];
}

export interface RehearsalUpdateDTO {
  date_time?: string;
  timezone?: string;
  location_id?: string | null;
  focus?: string;
  is_mandatory?: boolean;
  invited_participations?: string[];
}

export interface ProgramItemCreateDTO {
  project: string;
  piece: string;
  order: number;
  is_encore: boolean;
  /** Slot code from the served vocabulary; `""` clears it. The labels the app
   *  shows are derived from it server-side and are never sent back. */
  liturgical_slot?: string;
}

export type ProgramItemUpdateDTO = Partial<ProgramItemCreateDTO> & {
  /**
   * The published arrangement this concert sings from; `null` returns the row to
   * auto-selection (the piece's default edition, else the most recent). Written
   * only where the piece has more than one — and it settles more than which PDF
   * binds into the score book: the divisi the casting board offers and the
   * practice tracks the singers are served both follow it.
   */
  score_edition?: string | null;
};

/** One seat on the divisi board: this participant, on this voice line. */
export interface PieceCastingBoardRowDTO {
  participation: string;
  voice_line: VoiceLine;
  gives_pitch: boolean;
  notes: string;
}

/**
 * The whole divisi board for one piece, sent as one declarative write. Rows the
 * payload omits are deleted server-side — the board is the truth, not a list of
 * edits — which is what keeps a Save at one request and one message per singer.
 */
export interface PieceCastingBoardDTO {
  project: string;
  piece: string;
  castings: PieceCastingBoardRowDTO[];
}

/** One piece's board inside a multi-piece write. */
export interface PieceBoardDTO {
  piece: string;
  castings: PieceCastingBoardRowDTO[];
}

/**
 * Several boards of one project, saved as one act — what filling the programme
 * from the line-up sends. Each board is still declarative, so every board must
 * carry the seats that are to survive it, not only the ones being added.
 */
export interface PieceCastingBoardsDTO {
  project: string;
  boards: PieceBoardDTO[];
}

export interface AttendanceCreateDTO {
  rehearsal: string;
  participation: string;
  status: Attendance["status"];
  minutes_late?: number | null;
  excuse_note?: string | null;
}

export interface AttendanceUpdateDTO {
  status?: Attendance["status"];
  minutes_late?: number | null;
  excuse_note?: string | null;
}
