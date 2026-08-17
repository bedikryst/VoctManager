/**
 * @file rehearsals.service.ts
 * @description Pure HTTP service for the Rehearsals domain.
 */

import api from "@/shared/api/api";
import type {
  Artist,
  Attendance,
  Participation,
  Project,
  Rehearsal,
} from "@/shared/types";
import type {
  AbsenceSpanDTO,
  AbsenceSpanPreview,
  AbsenceSpanResult,
  AttendanceUpsertDTO,
} from "../types/rehearsals.dto";
import type { LocationDto } from "../../logistics/types/logistics.dto";

export const RehearsalsService = {
  getProjects: async (): Promise<Project[]> => {
    const response = await api.get("/api/projects/");
    return response.data.results ?? response.data ?? [];
  },

  getRehearsals: async (): Promise<Rehearsal[]> => {
    const response = await api.get("/api/rehearsals/");
    return response.data.results ?? response.data ?? [];
  },

  getParticipations: async (): Promise<Participation[]> => {
    const response = await api.get("/api/participations/");
    return response.data.results ?? response.data ?? [];
  },

  getAttendances: async (): Promise<Attendance[]> => {
    const response = await api.get("/api/attendances/");
    return response.data.results ?? response.data ?? [];
  },

  getArtists: async (): Promise<Artist[]> => {
    const response = await api.get("/api/artists/");
    return response.data.results ?? response.data ?? [];
  },

  createAttendance: async (data: AttendanceUpsertDTO): Promise<Attendance> => {
    const response = await api.post<Attendance>("/api/attendances/", data);
    return response.data;
  },

  updateAttendance: async (
    id: string,
    data: AttendanceUpsertDTO,
  ): Promise<Attendance> => {
    const response = await api.patch<Attendance>(
      `/api/attendances/${id}/`,
      data,
    );
    return response.data;
  },

  deleteAttendance: async (id: string): Promise<void> => {
    await api.delete(`/api/attendances/${id}/`);
  },

  /**
   * Which evenings a span would reach for this singer, resolved by the server —
   * across every production they sing in, not only the one on screen. The seat
   * rule (declined, draft, cancelled, invited-or-tutti) lives there, and asking
   * for it is what keeps the number a manager is shown equal to the rows the
   * write produces.
   */
  getAbsenceSpanPreview: async (
    artistId: string,
    startsAt: string,
    endsAt: string,
  ): Promise<AbsenceSpanPreview> => {
    const response = await api.get<AbsenceSpanPreview>(
      "/api/attendances/range-preview/",
      { params: { artist: artistId, starts_at: startsAt, ends_at: endsAt } },
    );
    return response.data;
  },

  saveAbsenceSpan: async (payload: AbsenceSpanDTO): Promise<AbsenceSpanResult> => {
    const response = await api.post<AbsenceSpanResult>(
      "/api/attendances/range/",
      payload,
    );
    return response.data;
  },

  getLocations: async (): Promise<LocationDto[]> => {
    const response = await api.get("/api/logistics/locations/");
    return response.data.results ?? response.data ?? [];
  },
};
