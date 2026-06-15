/**
 * @file contracts.service.ts
 * @description Pure HTTP service for the Contracts / settlements domain.
 * @architecture Enterprise SaaS 2026
 * @module panel/contracts/api
 *
 * Fee and payment edits go through dedicated detail actions (`/fee/`, `/payment/`)
 * rather than the generic record PATCH: the generic Participation update trips a
 * DRF conditional-UniqueConstraint bug, and the payment action keeps `paid_at`
 * server-managed and consistent with `is_paid`.
 */

import api from "@/shared/api/api";
import type { Project } from "@/shared/types";
import type {
  EnrichedParticipation,
  EnrichedCrewAssignment,
} from "../types/contracts.dto";

export type ContractRecordType = "CAST" | "CREW";

const detailBase = (type: ContractRecordType, id: string): string =>
  type === "CAST"
    ? `/api/participations/${id}`
    : `/api/crew-assignments/${id}`;

export const ContractsService = {
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

  updateFee: async (
    type: ContractRecordType,
    id: string,
    fee: number | null,
  ): Promise<EnrichedParticipation | EnrichedCrewAssignment> => {
    const response = await api.patch(`${detailBase(type, id)}/fee/`, { fee });
    return response.data;
  },

  setPaid: async (
    type: ContractRecordType,
    id: string,
    isPaid: boolean,
  ): Promise<EnrichedParticipation | EnrichedCrewAssignment> => {
    const response = await api.patch(`${detailBase(type, id)}/payment/`, {
      is_paid: isPaid,
    });
    return response.data;
  },

  bulkUpdateFee: async (
    target: ContractRecordType,
    projectId: string,
    fee: number,
  ): Promise<{ updated_count: number }> => {
    const url =
      target === "CAST"
        ? "/api/participations/bulk-fee/"
        : "/api/crew-assignments/bulk-fee/";
    const response = await api.patch<{ updated_count: number }>(url, {
      project_id: projectId,
      fee,
    });
    return response.data;
  },
};
