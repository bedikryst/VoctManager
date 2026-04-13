/**
 * @file crew.queries.ts
 * @description React Query hooks for the Crew domain.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { CrewService } from "./crew.service";
import type { CrewWriteDTO } from "../types/crew.dto";

export const crewKeys = {
  collaborators: {
    all: ["collaborators"] as const,
    details: (id: string | number) => ["collaborators", String(id)] as const,
  },
};

export const useCrewMembers = () => {
  return useQuery({
    queryKey: crewKeys.collaborators.all,
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
        queryKey: crewKeys.collaborators.all,
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
        queryKey: crewKeys.collaborators.all,
      });
    },
  });
};
