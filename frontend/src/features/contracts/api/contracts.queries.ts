/**
 * @file contracts.queries.ts
 * @description React Query hooks for Contracts server state.
 * @architecture Enterprise SaaS 2026
 * Uses the shared query key factory to keep cache invalidation aligned with the rest of the app.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/shared/lib/queryKeys";
import { ContractsService } from "./contracts.service";
import type {
  EnrichedParticipation,
  EnrichedCrewAssignment,
} from "../types/contracts.dto";

export const useContractLedgers = () => {
  const projectsQuery = useQuery({
    queryKey: queryKeys.projects.all,
    queryFn: ContractsService.getProjects,
  });
  const castQuery = useQuery({
    queryKey: queryKeys.participations.all,
    queryFn: ContractsService.getParticipations,
  });
  const crewQuery = useQuery({
    queryKey: queryKeys.crewAssignments.all,
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
            ? queryKeys.participations.all
            : queryKeys.crewAssignments.all,
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
        queryKey: queryKeys.participations.all,
      });
    },
  });
};
