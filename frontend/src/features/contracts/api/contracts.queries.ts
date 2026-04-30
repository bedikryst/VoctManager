/**
 * @file contracts.queries.ts
 * @description React Query hooks for Contracts server state.
 * @architecture Enterprise SaaS 2026
 * Uses the shared query key factory to keep cache invalidation aligned with the rest of the app.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { projectKeys } from "@/features/projects/api/project.queries";
import { ContractsService } from "./contracts.service";
import type {
  EnrichedParticipation,
  EnrichedCrewAssignment,
} from "../types/contracts.dto";

export const useContractLedgers = () => {
  const projectsQuery = useQuery({
    queryKey: projectKeys.projects.all,
    queryFn: ContractsService.getProjects,
    staleTime: 30_000,
  });
  const castQuery = useQuery({
    queryKey: projectKeys.participations.all,
    queryFn: ContractsService.getParticipations,
    staleTime: 30_000,
  });
  const crewQuery = useQuery({
    queryKey: projectKeys.crewAssignments.all,
    queryFn: ContractsService.getCrewAssignments,
    staleTime: 30_000,
  });

  const refresh = async (): Promise<void> => {
    await Promise.allSettled([
      projectsQuery.refetch(),
      castQuery.refetch(),
      crewQuery.refetch(),
    ]);
  };

  return {
    projects: projectsQuery.data || [],
    participations: castQuery.data || [],
    crewAssignments: crewQuery.data || [],
    isLoading:
      projectsQuery.isLoading || castQuery.isLoading || crewQuery.isLoading,
    isFetching:
      projectsQuery.isFetching || castQuery.isFetching || crewQuery.isFetching,
    isError: projectsQuery.isError || castQuery.isError || crewQuery.isError,
    refresh,
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
            ? projectKeys.participations.all
            : projectKeys.crewAssignments.all,
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
        queryKey: projectKeys.participations.all,
      });
    },
  });
};
