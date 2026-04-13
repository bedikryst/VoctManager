/**
 * @file rehearsals.service.ts
 * @description Pure HTTP service for the Rehearsals domain.
 */

import api from "../../../shared/api/api";
import type {
  Artist,
  Attendance,
  Participation,
  Project,
  Rehearsal,
} from "../../../shared/types";
import type { AttendanceUpsertDTO } from "../types/rehearsals.dto";
import type { LocationDto } from "../../logistics/types/logistics.dto";

export const RehearsalsService = {
  getProjects: async (): Promise<Project[]> => {
    const response = await api.get<Project[]>("/api/projects/");
    return response.data;
  },

  getRehearsals: async (): Promise<Rehearsal[]> => {
    const response = await api.get<Rehearsal[]>("/api/rehearsals/");
    return response.data;
  },

  getParticipations: async (): Promise<Participation[]> => {
    const response = await api.get<Participation[]>("/api/participations/");
    return response.data;
  },

  getAttendances: async (): Promise<Attendance[]> => {
    const response = await api.get<Attendance[]>("/api/attendances/");
    return response.data;
  },

  getArtists: async (): Promise<Artist[]> => {
    const response = await api.get<Artist[]>("/api/artists/");
    return response.data;
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
    const response = await api.get<LocationDto[]>("/api/logistics/locations/");
    return response.data;
  },
};
