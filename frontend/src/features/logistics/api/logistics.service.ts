import api from "@/shared/api/api";
import type { Project, Rehearsal } from "@/shared/types";
import type {
  LocationDto,
  LocationCreateDto,
  LocationUpdateDto,
} from "../types/logistics.dto";

const LOGISTICS_BASE_URL = "/api/logistics/locations/";

const unwrapList = <T>(data: T[] | { results?: T[] }): T[] =>
  Array.isArray(data) ? data : (data.results ?? []);

export const logisticsService = {
  getLocations: async (): Promise<LocationDto[]> => {
    const response = await api.get(LOGISTICS_BASE_URL);
    return response.data.results ?? response.data;
  },

  /**
   * Concerts and rehearsals are plotted on the atlas by joining their
   * `location.id` against the full location records (which carry the
   * coordinates the inline LocationSnippet omits). Reads the same manager
   * endpoints the projects/rehearsals features already cache.
   */
  getProjects: async (): Promise<Project[]> => {
    const response = await api.get("/api/projects/");
    return unwrapList<Project>(response.data);
  },

  getRehearsals: async (): Promise<Rehearsal[]> => {
    const response = await api.get("/api/rehearsals/");
    return unwrapList<Rehearsal>(response.data);
  },

  createLocation: async (data: LocationCreateDto): Promise<LocationDto> => {
    const response = await api.post(LOGISTICS_BASE_URL, data);
    return response.data;
  },

  updateLocation: async (
    id: string,
    data: LocationUpdateDto,
  ): Promise<LocationDto> => {
    const response = await api.patch(`${LOGISTICS_BASE_URL}${id}/`, data);
    return response.data;
  },

  deleteLocation: async (id: string): Promise<void> => {
    await api.delete(`${LOGISTICS_BASE_URL}${id}/`);
  },
};
