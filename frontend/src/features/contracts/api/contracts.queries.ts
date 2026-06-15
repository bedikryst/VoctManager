/**
 * @file contracts.queries.ts
 * @description React Query hooks for the settlements workspace server state.
 * Uses the shared project query-key factory so cache invalidation stays aligned
 * with the rest of the app (cast, crew and project lists are shared surfaces).
 * @architecture Enterprise SaaS 2026
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { projectKeys } from "@/features/projects/api/project.queries";
import { ContractsService, type ContractRecordType } from "./contracts.service";

const keyForType = (type: ContractRecordType) =>
  type === "CAST"
    ? projectKeys.participations.all
    : projectKeys.crewAssignments.all;

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

export const useUpdateFee = (type: ContractRecordType) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, fee }: { id: string; fee: number | null }) =>
      ContractsService.updateFee(type, id, fee),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keyForType(type) });
    },
  });
};

export const useSetPaid = (type: ContractRecordType) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, isPaid }: { id: string; isPaid: boolean }) =>
      ContractsService.setPaid(type, id, isPaid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keyForType(type) });
    },
  });
};

export const useBulkUpdateFee = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      projectId,
      fee,
      target,
    }: {
      projectId: string;
      fee: number;
      target: ContractRecordType;
    }) => ContractsService.bulkUpdateFee(target, projectId, fee),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: keyForType(variables.target) });
    },
  });
};

/**
 * Settles a batch of records in one click (e.g. "mark the whole project paid").
 * Mirrors the app's established bulk pattern — loops the per-record endpoint
 * client-side, tolerates partial failure, then invalidates both ledgers once.
 */
export const useMarkRecordsPaid = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      targets: { id: string; type: ContractRecordType }[],
    ): Promise<{ total: number; failed: number }> => {
      const results = await Promise.allSettled(
        targets.map((target) =>
          ContractsService.setPaid(target.type, target.id, true),
        ),
      );
      const failed = results.filter((r) => r.status === "rejected").length;
      return { total: targets.length, failed };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: projectKeys.participations.all,
      });
      queryClient.invalidateQueries({
        queryKey: projectKeys.crewAssignments.all,
      });
    },
  });
};
