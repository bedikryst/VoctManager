/**
 * @file useProjectData.ts
 * @description Scoped Data Fetcher for individual projects.
 * Utilizes React Query to share cache across multiple tabs and widgets inside a project card.
 * Pre-fetches global dictionaries with Infinity staleTime to optimize UI responsiveness.
 * @module panel/projects/hooks/useProjectData
 */

import { useQueries, QueryClient } from "@tanstack/react-query";
import api from "../../../shared/api/api";
import { queryKeys } from "../../../shared/lib/queryKeys";
import type {
  Participation,
  Rehearsal,
  CrewAssignment,
  PieceCasting,
  Artist,
  Collaborator,
  Piece,
} from "../../../shared/types";

export function useProjectData(projectId: string | undefined) {
  const results = useQueries({
    queries: [
      // --- PROJECT-SPECIFIC DATA (Cache: 5 minutes) ---
      {
        queryKey: queryKeys.participations.byProject(projectId!),
        queryFn: async () =>
          (
            await api.get<Participation[]>(
              `/api/participations/?project=${projectId}`,
            )
          ).data,
        staleTime: 1000 * 60 * 5,
        enabled: !!projectId,
      },
      {
        queryKey: queryKeys.rehearsals.byProject(projectId!),
        queryFn: async () =>
          (await api.get<Rehearsal[]>(`/api/rehearsals/?project=${projectId}`))
            .data,
        staleTime: 1000 * 60 * 5,
        enabled: !!projectId,
      },
      {
        queryKey: queryKeys.crewAssignments.byProject(projectId!),
        queryFn: async () =>
          (
            await api.get<CrewAssignment[]>(
              `/api/crew-assignments/?project=${projectId}`,
            )
          ).data,
        staleTime: 1000 * 60 * 5,
        enabled: !!projectId,
      },
      {
        queryKey: queryKeys.pieceCastings.byProject(projectId!),
        queryFn: async () =>
          (
            await api.get<PieceCasting[]>(
              `/api/piece-castings/?participation__project=${projectId}`,
            )
          ).data,
        staleTime: 1000 * 60 * 5,
        enabled: !!projectId,
      },

      // --- GLOBAL DICTIONARIES (Cache: Infinity) ---
      {
        queryKey: queryKeys.artists.all,
        queryFn: async () => (await api.get<Artist[]>("/api/artists/")).data,
        staleTime: Infinity,
      },
      {
        queryKey: queryKeys.collaborators.all,
        queryFn: async () =>
          (await api.get<Collaborator[]>("/api/collaborators/")).data,
        staleTime: Infinity,
      },
      {
        queryKey: queryKeys.pieces.all,
        queryFn: async () => (await api.get<Piece[]>("/api/pieces/")).data,
        staleTime: Infinity,
      },
    ],
  });

  const isLoading = results.some((r) => r.isLoading);
  const isError = results.some((r) => r.isError);

  return {
    participations: results[0].data || [],
    rehearsals: results[1].data || [],
    crewAssignments: results[2].data || [],
    pieceCastings: results[3].data || [],
    artists: results[4].data || [],
    crew: results[5].data || [],
    pieces: results[6].data || [],
    isLoading,
    isError,
  };
}

export const prefetchProjectData = (
  queryClient: QueryClient,
  projectId: string,
) => {
  queryClient.prefetchQuery({
    queryKey: queryKeys.participations.byProject(projectId),
    queryFn: async () =>
      (
        await api.get<Participation[]>(
          `/api/participations/?project=${projectId}`,
        )
      ).data,
    staleTime: 1000 * 60 * 5,
  });

  queryClient.prefetchQuery({
    queryKey: queryKeys.rehearsals.byProject(projectId),
    queryFn: async () =>
      (await api.get<Rehearsal[]>(`/api/rehearsals/?project=${projectId}`))
        .data,
    staleTime: 1000 * 60 * 5,
  });

  queryClient.prefetchQuery({
    queryKey: queryKeys.crewAssignments.byProject(projectId),
    queryFn: async () =>
      (
        await api.get<CrewAssignment[]>(
          `/api/crew-assignments/?project=${projectId}`,
        )
      ).data,
    staleTime: 1000 * 60 * 5,
  });

  queryClient.prefetchQuery({
    queryKey: queryKeys.artists.all,
    queryFn: async () => (await api.get<Artist[]>("/api/artists/")).data,
    staleTime: Infinity,
  });

  queryClient.prefetchQuery({
    queryKey: queryKeys.pieces.all,
    queryFn: async () => (await api.get<Piece[]>("/api/pieces/")).data,
    staleTime: Infinity,
  });
};
