/**
 * @file crew.service.ts
 * @description Pure HTTP service for the Crew domain.
 */

import api from "@/shared/api/api";
import type { Collaborator } from "@/shared/types";
import type { CrewWriteDTO } from "../types/crew.dto";

const COLLABORATORS_URL = "/api/collaborators/";

export const CrewService = {
  getCrewMembers: async (): Promise<Collaborator[]> => {
    const response = await api.get<Collaborator[]>(COLLABORATORS_URL);
    return response.data;
  },

  createCrewMember: async (data: CrewWriteDTO): Promise<Collaborator> => {
    const response = await api.post<Collaborator>(COLLABORATORS_URL, data);
    return response.data;
  },

  updateCrewMember: async (
    id: string,
    data: CrewWriteDTO,
  ): Promise<Collaborator> => {
    const response = await api.patch<Collaborator>(
      `${COLLABORATORS_URL}${id}/`,
      data,
    );
    return response.data;
  },

  deleteCrewMember: async (id: string): Promise<void> => {
    await api.delete(`${COLLABORATORS_URL}${id}/`);
  },
};
