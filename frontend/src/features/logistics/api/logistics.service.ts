import api from "@/shared/api/api";
import {
  LocationDto,
  LocationCreateDto,
  LocationUpdateDto,
} from "../types/logistics.dto";

const LOGISTICS_BASE_URL = "api/logistics/locations/";

export const logisticsService = {
  getLocations: async (): Promise<LocationDto[]> => {
    const response = await api.get(LOGISTICS_BASE_URL);
    return response.data.results ?? response.data;
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
