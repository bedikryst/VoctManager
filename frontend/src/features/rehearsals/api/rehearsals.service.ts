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
import type { AttendanceUpsertDTO } from "../types/rehearsals.dto";
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

  getLocations: async (): Promise<LocationDto[]> => {
    const response = await api.get("/api/logistics/locations/");
    return response.data.results ?? response.data ?? [];
  },
};
