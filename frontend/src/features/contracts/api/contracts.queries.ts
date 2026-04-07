/**
 * @file contracts.queries.ts
 * @description React Query hooks for Server State management.
 * @architecture Enterprise SaaS 2026
 * @module panel/contracts/api
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ContractsService } from "./contracts.service";
import type {
  EnrichedParticipation,
  EnrichedCrewAssignment,
} from "../types/contracts.dto";

export const CONTRACT_QUERY_KEYS = {
  projects: ["contracts", "projects"] as const,
  participations: ["contracts", "participations"] as const,
  crew: ["contracts", "crew"] as const,
};

export const useContractLedgers = () => {
  const projectsQuery = useQuery({
    queryKey: CONTRACT_QUERY_KEYS.projects,
    queryFn: ContractsService.getProjects,
  });
  const castQuery = useQuery({
    queryKey: CONTRACT_QUERY_KEYS.participations,
    queryFn: ContractsService.getParticipations,
  });
  const crewQuery = useQuery({
    queryKey: CONTRACT_QUERY_KEYS.crew,
    queryFn: ContractsService.getCrewAssignments,
  });

  return {
    projects: projectsQuery.data || [],
    participations: castQuery.data || [],
    crewAssignments: crewQuery.data || [],
    isLoading:
      projectsQuery.isLoading || castQuery.isLoading || crewQuery.isLoading,
    isError: projectsQuery.isError || castQuery.isError || crewQuery.isError,
  };
};

export const useUpdateFee = (type: "CAST" | "CREW") => {
  const queryClient = useQueryClient();
  return useMutation<
    EnrichedParticipation | EnrichedCrewAssignment,
    Error,
    { id: string; fee: number | null }
  >({
    mutationFn: ({ id, fee }) =>
      type === "CAST"
        ? ContractsService.updateParticipationFee(id, fee)
        : ContractsService.updateCrewFee(id, fee),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey:
          type === "CAST"
            ? CONTRACT_QUERY_KEYS.participations
            : CONTRACT_QUERY_KEYS.crew,
      });
    },
  });
};

export const useBulkUpdateFee = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, fee }: { projectId: string; fee: number }) =>
      ContractsService.bulkUpdateParticipationsFee(projectId, fee),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: CONTRACT_QUERY_KEYS.participations,
      });
    },
  });
};
