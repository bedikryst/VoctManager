/**
 * @file crew.queries.ts
 * @description React Query hooks for the Crew domain.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../shared/lib/queryKeys";
import { CrewService } from "./crew.service";
import type { CrewWriteDTO } from "../types/crew.dto";

export const CREW_QUERY_KEYS = {
  collaborators: queryKeys.collaborators.all,
};

export const useCrewMembers = () => {
  return useQuery({
    queryKey: CREW_QUERY_KEYS.collaborators,
    queryFn: CrewService.getCrewMembers,
  });
};

export const useSaveCrewMember = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id?: string; data: CrewWriteDTO }) => {
      return id
        ? CrewService.updateCrewMember(id, data)
        : CrewService.createCrewMember(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: CREW_QUERY_KEYS.collaborators,
      });
    },
  });
};

export const useDeleteCrewMember = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => CrewService.deleteCrewMember(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: CREW_QUERY_KEYS.collaborators,
      });
    },
  });
};
