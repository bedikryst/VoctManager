/**
 * @file contracts.service.ts
 * @description Pure HTTP service for the Contracts domain.
 * @architecture Enterprise SaaS 2026
 * @module panel/contracts/api
 */

import api from "@/shared/api/api";
import type { Project } from "@/shared/types";
import type {
  EnrichedParticipation,
  EnrichedCrewAssignment,
} from "../types/contracts.dto";

export const ContractsService = {
  // Note: If you create a global projects.service.ts in shared/api later, you can remove this.
  getProjects: async (): Promise<Project[]> => {
    const response = await api.get<Project[]>("/api/projects/");
    return response.data;
  },

  getParticipations: async (): Promise<EnrichedParticipation[]> => {
    const response = await api.get<EnrichedParticipation[]>(
      "/api/participations/",
    );
    return response.data;
  },

  getCrewAssignments: async (): Promise<EnrichedCrewAssignment[]> => {
    const response = await api.get<EnrichedCrewAssignment[]>(
      "/api/crew-assignments/",
    );
    return response.data;
  },

  updateParticipationFee: async (
    id: string,
    fee: number | null,
  ): Promise<EnrichedParticipation> => {
    const response = await api.patch<EnrichedParticipation>(
      `/api/participations/${id}/`,
      { fee },
    );
    return response.data;
  },

  updateCrewFee: async (
    id: string,
    fee: number | null,
  ): Promise<EnrichedCrewAssignment> => {
    const response = await api.patch<EnrichedCrewAssignment>(
      `/api/crew-assignments/${id}/`,
      { fee },
    );
    return response.data;
  },

  bulkUpdateParticipationsFee: async (
    projectId: string,
    fee: number,
  ): Promise<{ updated_count: number }> => {
    const response = await api.patch<{ updated_count: number }>(
      "/api/participations/bulk-fee/",
      {
        project_id: projectId,
        fee,
      },
    );
    return response.data;
  },
};
