/**
 * @file project.optimistic.ts
 * @description Builders for typed optimistic Project domain cache entries.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/api
 */

import type {
  Attendance,
  CrewAssignment,
  Participation,
  PieceCasting,
  ProgramItem,
  Project,
  Rehearsal,
} from "@/shared/types";

import { PROJECT_STATUS } from "../constants/projectDomain";
import { compareProjectDateAsc } from "../lib/projectPresentation";
import type {
  AttendanceCreateDTO,
  CrewAssignmentCreateDTO,
  ParticipationCreateDTO,
  PieceCastingCreateDTO,
  ProgramItemCreateDTO,
  ProjectCreateDTO,
  RehearsalCreateDTO,
} from "../types/project.dto";

export const sortRehearsals = (rehearsals: Rehearsal[]): Rehearsal[] =>
  [...rehearsals].sort((left, right) =>
    compareProjectDateAsc(left.date_time, right.date_time),
  );

export const sortProgramItems = (
  programItems: ProgramItem[],
): ProgramItem[] =>
  [...programItems].sort((left, right) => left.order - right.order);

export const buildOptimisticProject = (
  data: ProjectCreateDTO,
  optimisticId: string,
): Project => ({
  id: optimisticId,
  title: data.title,
  date_time: data.date_time,
  timezone: data.timezone,
  call_time: data.call_time ?? null,
  location: data.location_id ?? null,
  conductor: data.conductor ?? null,
  conductor_name: null,
  dress_code_male: data.dress_code_male ?? null,
  dress_code_female: data.dress_code_female ?? null,
  spotify_playlist_url: data.spotify_playlist_url ?? null,
  description: data.description ?? null,
  run_sheet: data.run_sheet ?? [],
  program: [],
  cast: [],
  status: PROJECT_STATUS.DRAFT,
});

export const buildOptimisticRehearsal = (
  data: RehearsalCreateDTO,
  optimisticId: string,
): Rehearsal => ({
  id: optimisticId,
  project: data.project,
  date_time: data.date_time,
  timezone: data.timezone,
  location: data.location_id,
  focus: data.focus ?? "",
  is_mandatory: data.is_mandatory,
  invited_participations: data.invited_participations,
  absent_count: 0,
});

export const buildOptimisticParticipation = (
  data: ParticipationCreateDTO,
  optimisticId: string,
): Participation => ({
  id: optimisticId,
  artist: data.artist,
  project: data.project,
  status: data.status,
  fee: data.fee ?? null,
});

export const buildOptimisticCrewAssignment = (
  data: CrewAssignmentCreateDTO,
  optimisticId: string,
): CrewAssignment => ({
  id: optimisticId,
  collaborator: data.collaborator,
  project: data.project,
  role_description: data.role_description ?? "",
  status: data.status ?? "INV",
  fee: data.fee ?? null,
});

export const buildOptimisticProgramItem = (
  data: ProgramItemCreateDTO,
  optimisticId: string,
): ProgramItem => ({
  id: optimisticId,
  project: data.project,
  piece: data.piece,
  piece_id: data.piece,
  title: data.title,
  piece_title: data.title,
  order: data.order,
  is_encore: data.is_encore,
});

export const buildOptimisticPieceCasting = (
  data: PieceCastingCreateDTO,
  optimisticId: string,
): PieceCasting => ({
  id: optimisticId,
  participation: data.participation,
  piece: data.piece,
  voice_line: data.voice_line,
  gives_pitch: data.gives_pitch,
  notes: data.notes,
});

export const buildOptimisticAttendance = (
  data: AttendanceCreateDTO,
  optimisticId: string,
): Attendance => ({
  id: optimisticId,
  rehearsal: data.rehearsal,
  participation: data.participation,
  status: data.status,
});
