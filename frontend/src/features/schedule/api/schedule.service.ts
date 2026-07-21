/**
 * @file schedule.service.ts
 * @description Pure HTTP service for the Schedule domain.
 * @architecture Enterprise SaaS 2026
 */

import api from "@/shared/api/api";
import type {
  Attendance,
  PieceCasting,
  ProgramItem,
  Project,
  Participation,
} from "@/shared/types";
import type {
  ScheduleAttendanceReportDTO,
  ScheduleDashboardItem,
  EnrichedRehearsal,
} from "../types/schedule.dto";

export const ScheduleService = {
  /**
   * The artist's personal schedule, pre-joined server-side: projects they are
   * cast in + rehearsals they are invited to, each carrying their participation
   * and attendance. Replaces the four separate list calls the timeline used to
   * fetch and re-join on the client.
   */
  getScheduleDashboard: async (): Promise<ScheduleDashboardItem[]> => {
    const response = await api.get<ScheduleDashboardItem[]>(
      "/api/participations/schedule-dashboard/",
    );
    return response.data;
  },

  getRehearsals: async (): Promise<EnrichedRehearsal[]> => {
    const response = await api.get<EnrichedRehearsal[]>("/api/rehearsals/");
    return response.data;
  },

  getRehearsalsByArtist: async (
    artistId: string | number,
  ): Promise<EnrichedRehearsal[]> => {
    const response = await api.get<EnrichedRehearsal[]>(
      `/api/rehearsals/?invited_participations__artist=${artistId}`,
    );
    return response.data;
  },

  getProjects: async (): Promise<Project[]> => {
    const response = await api.get<Project[]>("/api/projects/");
    return response.data;
  },

  getParticipationsByArtist: async (
    artistId: string | number,
  ): Promise<Participation[]> => {
    const response = await api.get<Participation[]>(
      `/api/participations/?artist=${artistId}`,
    );
    return response.data;
  },

  getAttendancesByArtist: async (
    artistId: string | number,
  ): Promise<Attendance[]> => {
    const response = await api.get<Attendance[]>(
      `/api/attendances/?participation__artist=${artistId}`,
    );
    return response.data;
  },

  getProgramItemsByProject: async (
    projectId: string | number,
  ): Promise<ProgramItem[]> => {
    const response = await api.get<ProgramItem[]>(
      `/api/program-items/?project=${projectId}`,
    );
    return response.data;
  },

  getPieceCastingsByProjectPiece: async (
    projectId: string | number,
    pieceId: string | null,
  ): Promise<PieceCasting[]> => {
    if (!pieceId) {
      return [];
    }
    const response = await api.get<PieceCasting[]>(
      `/api/piece-castings/?piece=${pieceId}&participation__project=${projectId}`,
    );
    return response.data;
  },

  saveAttendanceReport: async (
    existingAttendanceId: string | undefined,
    payload: ScheduleAttendanceReportDTO,
  ): Promise<Attendance> => {
    if (existingAttendanceId) {
      const response = await api.patch<Attendance>(
        `/api/attendances/${existingAttendanceId}/`,
        payload,
      );
      return response.data;
    }

    const response = await api.post<Attendance>("/api/attendances/", payload);
    return response.data;
  },

  exportCallSheet: async (projectId: string | number): Promise<Blob> => {
    const response = await api.get(
      `/api/projects/${projectId}/export_call_sheet/`,
      { responseType: "blob" },
    );
    return response.data as Blob;
  },

  /**
   * Personalized concert-day sheet for the people performing it. The backend
   * resolves the audience from the caller: a cast singer receives their own
   * sheet (their voice, casting and pitch duties — no private contact
   * directory), the project's conductor receives the music-forward maestro
   * sheet. Managers use {@link exportCallSheet} for the full production version.
   */
  exportDaySheet: async (projectId: string | number): Promise<Blob> => {
    const response = await api.get(
      `/api/projects/${projectId}/export_day_sheet/`,
      { responseType: "blob" },
    );
    return response.data as Blob;
  },
};
