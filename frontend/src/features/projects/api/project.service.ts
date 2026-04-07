/**
 * @file project.service.ts
 * @description Pure HTTP service for the Project domain.
 * Keeps transport logic isolated from React state and presentation concerns.
 * @architecture Enterprise SaaS 2026
 */

import type { AxiosResponse } from "axios";

import api from "../../../shared/api/api";
import type {
  Artist,
  Attendance,
  Collaborator,
  CrewAssignment,
  Participation,
  Piece,
  PieceCasting,
  ProgramItem,
  Project,
  Rehearsal,
  VoiceLineOption,
} from "../../../shared/types";
import type {
  AttendanceCreateDTO,
  AttendanceUpdateDTO,
  CrewAssignmentCreateDTO,
  CrewAssignmentUpdateDTO,
  ParticipationCreateDTO,
  ParticipationUpdateDTO,
  PieceCastingCreateDTO,
  PieceCastingUpdateDTO,
  ProgramItemCreateDTO,
  ProgramItemUpdateDTO,
  ProjectCreateDTO,
  ProjectUpdateDTO,
  RehearsalCreateDTO,
  RehearsalUpdateDTO,
} from "../types/project.dto";

const PROJECTS_BASE_URL = "/api/projects/";
const PARTICIPATIONS_BASE_URL = "/api/participations/";
const REHEARSALS_BASE_URL = "/api/rehearsals/";
const CREW_ASSIGNMENTS_BASE_URL = "/api/crew-assignments/";
const PROGRAM_ITEMS_BASE_URL = "/api/program-items/";
const PIECE_CASTINGS_BASE_URL = "/api/piece-castings/";
const ATTENDANCES_BASE_URL = "/api/attendances/";
const PIECES_BASE_URL = "/api/pieces/";
const ARTISTS_BASE_URL = "/api/artists/";
const COLLABORATORS_BASE_URL = "/api/collaborators/";
const VOICE_LINES_BASE_URL = "/api/options/voice-lines/";

export type ProjectReportEndpoint =
  | "export_call_sheet"
  | "export_zaiks"
  | "export_dtp";

export const ProjectService = {
  getAll: async (): Promise<Project[]> => {
    const response = await api.get<Project[]>(PROJECTS_BASE_URL);
    return response.data;
  },

  create: async (data: ProjectCreateDTO): Promise<Project> => {
    const response = await api.post<Project>(PROJECTS_BASE_URL, data);
    return response.data;
  },

  update: async (
    id: string | number,
    data: ProjectUpdateDTO,
  ): Promise<Project> => {
    const response = await api.patch<Project>(`${PROJECTS_BASE_URL}${id}/`, data);
    return response.data;
  },

  remove: async (id: string | number): Promise<void> => {
    await api.delete(`${PROJECTS_BASE_URL}${id}/`);
  },

  downloadReport: async (
    projectId: string | number,
    endpoint: ProjectReportEndpoint,
  ): Promise<AxiosResponse<Blob>> =>
    api.get(`${PROJECTS_BASE_URL}${projectId}/${endpoint}/`, {
      responseType: "blob",
    }),

  getArtistsDictionary: async (): Promise<Artist[]> => {
    const response = await api.get<Artist[]>(ARTISTS_BASE_URL);
    return response.data;
  },

  getPiecesDictionary: async (): Promise<Piece[]> => {
    const response = await api.get<Piece[]>(PIECES_BASE_URL);
    return response.data;
  },

  getCollaboratorsDictionary: async (): Promise<Collaborator[]> => {
    const response = await api.get<Collaborator[]>(COLLABORATORS_BASE_URL);
    return response.data;
  },

  getVoiceLinesDictionary: async (): Promise<VoiceLineOption[]> => {
    const response = await api.get<VoiceLineOption[]>(VOICE_LINES_BASE_URL);
    return response.data;
  },

  getParticipationsByProject: async (
    projectId: string | number,
  ): Promise<Participation[]> => {
    const response = await api.get<Participation[]>(
      `${PARTICIPATIONS_BASE_URL}?project=${projectId}`,
    );
    return response.data;
  },

  createParticipation: async (
    data: ParticipationCreateDTO,
  ): Promise<Participation> => {
    const response = await api.post<Participation>(PARTICIPATIONS_BASE_URL, data);
    return response.data;
  },

  updateParticipation: async (
    id: string | number,
    data: ParticipationUpdateDTO,
  ): Promise<Participation> => {
    const response = await api.patch<Participation>(
      `${PARTICIPATIONS_BASE_URL}${id}/`,
      data,
    );
    return response.data;
  },

  deleteParticipation: async (id: string | number): Promise<void> => {
    await api.delete(`${PARTICIPATIONS_BASE_URL}${id}/`);
  },

  getRehearsalsByProject: async (
    projectId: string | number,
  ): Promise<Rehearsal[]> => {
    const response = await api.get<Rehearsal[]>(
      `${REHEARSALS_BASE_URL}?project=${projectId}`,
    );
    return response.data;
  },

  createRehearsal: async (data: RehearsalCreateDTO): Promise<Rehearsal> => {
    const response = await api.post<Rehearsal>(REHEARSALS_BASE_URL, data);
    return response.data;
  },

  updateRehearsal: async (
    id: string | number,
    data: RehearsalUpdateDTO,
  ): Promise<Rehearsal> => {
    const response = await api.patch<Rehearsal>(
      `${REHEARSALS_BASE_URL}${id}/`,
      data,
    );
    return response.data;
  },

  deleteRehearsal: async (id: string | number): Promise<void> => {
    await api.delete(`${REHEARSALS_BASE_URL}${id}/`);
  },

  getCrewAssignmentsByProject: async (
    projectId: string | number,
  ): Promise<CrewAssignment[]> => {
    const response = await api.get<CrewAssignment[]>(
      `${CREW_ASSIGNMENTS_BASE_URL}?project=${projectId}`,
    );
    return response.data;
  },

  createCrewAssignment: async (
    data: CrewAssignmentCreateDTO,
  ): Promise<CrewAssignment> => {
    const response = await api.post<CrewAssignment>(
      CREW_ASSIGNMENTS_BASE_URL,
      data,
    );
    return response.data;
  },

  updateCrewAssignment: async (
    id: string | number,
    data: CrewAssignmentUpdateDTO,
  ): Promise<CrewAssignment> => {
    const response = await api.patch<CrewAssignment>(
      `${CREW_ASSIGNMENTS_BASE_URL}${id}/`,
      data,
    );
    return response.data;
  },

  deleteCrewAssignment: async (id: string | number): Promise<void> => {
    await api.delete(`${CREW_ASSIGNMENTS_BASE_URL}${id}/`);
  },

  getProgramByProject: async (
    projectId: string | number,
  ): Promise<ProgramItem[]> => {
    const response = await api.get<ProgramItem[]>(
      `${PROGRAM_ITEMS_BASE_URL}?project=${projectId}`,
    );
    return [...response.data].sort((a, b) => a.order - b.order);
  },

  createProgramItem: async (data: ProgramItemCreateDTO): Promise<ProgramItem> => {
    const response = await api.post<ProgramItem>(PROGRAM_ITEMS_BASE_URL, data);
    return response.data;
  },

  updateProgramItem: async (
    id: string | number,
    data: ProgramItemUpdateDTO,
  ): Promise<ProgramItem> => {
    const response = await api.patch<ProgramItem>(
      `${PROGRAM_ITEMS_BASE_URL}${id}/`,
      data,
    );
    return response.data;
  },

  deleteProgramItem: async (id: string | number): Promise<void> => {
    await api.delete(`${PROGRAM_ITEMS_BASE_URL}${id}/`);
  },

  getPieceCastingsByProject: async (
    projectId: string | number,
  ): Promise<PieceCasting[]> => {
    const response = await api.get<PieceCasting[]>(
      `${PIECE_CASTINGS_BASE_URL}?participation__project=${projectId}`,
    );
    return response.data;
  },

  createPieceCasting: async (
    data: PieceCastingCreateDTO,
  ): Promise<PieceCasting> => {
    const response = await api.post<PieceCasting>(PIECE_CASTINGS_BASE_URL, data);
    return response.data;
  },

  updatePieceCasting: async (
    id: string | number,
    data: PieceCastingUpdateDTO,
  ): Promise<PieceCasting> => {
    const response = await api.patch<PieceCasting>(
      `${PIECE_CASTINGS_BASE_URL}${id}/`,
      data,
    );
    return response.data;
  },

  deletePieceCasting: async (id: string | number): Promise<void> => {
    await api.delete(`${PIECE_CASTINGS_BASE_URL}${id}/`);
  },

  getAttendancesByProject: async (
    projectId: string | number,
  ): Promise<Attendance[]> => {
    const response = await api.get<Attendance[]>(
      `${ATTENDANCES_BASE_URL}?rehearsal__project=${projectId}`,
    );
    return response.data;
  },

  createAttendance: async (
    data: AttendanceCreateDTO,
  ): Promise<Attendance> => {
    const response = await api.post<Attendance>(ATTENDANCES_BASE_URL, data);
    return response.data;
  },

  updateAttendance: async (
    id: string | number,
    data: AttendanceUpdateDTO,
  ): Promise<Attendance> => {
    const response = await api.patch<Attendance>(
      `${ATTENDANCES_BASE_URL}${id}/`,
      data,
    );
    return response.data;
  },

  deleteAttendance: async (id: string | number): Promise<void> => {
    await api.delete(`${ATTENDANCES_BASE_URL}${id}/`);
  },
};
