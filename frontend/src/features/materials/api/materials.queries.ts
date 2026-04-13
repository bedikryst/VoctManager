/**
 * @file materials.queries.ts
 * @description React Query hooks for the Materials domain.
 */

import { useQueries } from "@tanstack/react-query";
import { MaterialsService } from "./materials.service";
import { projectKeys } from "@/features/projects/api/project.queries";
import { archiveKeys } from "@/features/archive/api/archive.queries";

export const useMaterialsContextData = (userId?: string | number) => {
  const results = useQueries({
    queries: [
      {
        queryKey: projectKeys.projects.all,
        queryFn: MaterialsService.getProjects,
        enabled: !!userId,
      },
      {
        queryKey: projectKeys.participations.byArtist(userId ?? "anonymous"),
        queryFn: () => MaterialsService.getParticipationsByArtist(userId!),
        enabled: !!userId,
      },
      {
        queryKey: projectKeys.program.all,
        queryFn: MaterialsService.getProgramItems,
        enabled: !!userId,
      },
      {
        queryKey: projectKeys.pieceCastings.all,
        queryFn: MaterialsService.getPieceCastings,
        enabled: !!userId,
      },
      {
        queryKey: archiveKeys.pieces.all,
        queryFn: MaterialsService.getPieces,
        enabled: !!userId,
      },
      {
        queryKey: archiveKeys.composers.all,
        queryFn: MaterialsService.getComposers,
        enabled: !!userId,
      },
      {
        queryKey: archiveKeys.tracks.all,
        queryFn: MaterialsService.getTracks,
        enabled: !!userId,
      },
    ],
  });

  return {
    projects: results[0].data || [],
    myParticipations: results[1].data || [],
    programItems: results[2].data || [],
    pieceCastings: results[3].data || [],
    pieces: results[4].data || [],
    composers: results[5].data || [],
    tracks: results[6].data || [],
    isLoading: results.some((query) => query.isLoading),
    isError: results.some((query) => query.isError),
  };
};
