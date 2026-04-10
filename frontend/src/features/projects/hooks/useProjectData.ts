/**
 * @file useProjectData.ts
 * @description Scoped aggregation hook for Project module server state.
 * Composes domain queries into a stable contract consumed across cards and editor tabs.
 * Automatically resolves the root project entity from the cache.
 * @module panel/projects/hooks/useProjectData
 */

import { QueryClient } from "@tanstack/react-query";

import { queryKeys } from "../../../shared/lib/queryKeys";
import {
  useProjects, // ✅ Dodano import głównego zapytania projektów
  useProjectArtistsDictionary,
  useProjectCollaboratorsDictionary,
  useProjectCrewAssignments,
  useProjectParticipations,
  useProjectPieceCastings,
  useProjectPiecesDictionary,
  useProjectRehearsals,
} from "../api/project.queries";
import { ProjectService } from "../api/project.service";

export function useProjectData(projectId: string | undefined) {
  const projectsQuery = useProjects(); // ✅ Pobieramy zbuforowaną listę projektów
  const participationsQuery = useProjectParticipations(projectId);
  const rehearsalsQuery = useProjectRehearsals(projectId);
  const crewAssignmentsQuery = useProjectCrewAssignments(projectId);
  const pieceCastingsQuery = useProjectPieceCastings(projectId);
  const artistsQuery = useProjectArtistsDictionary();
  const collaboratorsQuery = useProjectCollaboratorsDictionary();
  const piecesQuery = useProjectPiecesDictionary();

  const isLoading =
    projectsQuery.isLoading ||
    participationsQuery.isLoading ||
    rehearsalsQuery.isLoading ||
    crewAssignmentsQuery.isLoading ||
    pieceCastingsQuery.isLoading ||
    artistsQuery.isLoading ||
    collaboratorsQuery.isLoading ||
    piecesQuery.isLoading;

  const isError =
    projectsQuery.isError ||
    participationsQuery.isError ||
    rehearsalsQuery.isError ||
    crewAssignmentsQuery.isError ||
    pieceCastingsQuery.isError ||
    artistsQuery.isError ||
    collaboratorsQuery.isError ||
    piecesQuery.isError;

  const project =
    projectsQuery.data?.find((p) => String(p.id) === String(projectId)) || null;

  return {
    project, // ✅ Teraz TypeScript i nasz hook prób poprawnie go rozpoznają
    participations: participationsQuery.data || [],
    rehearsals: rehearsalsQuery.data || [],
    crewAssignments: crewAssignmentsQuery.data || [],
    pieceCastings: pieceCastingsQuery.data || [],
    artists: artistsQuery.data || [],
    crew: collaboratorsQuery.data || [],
    pieces: piecesQuery.data || [],
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
    queryFn: () => ProjectService.getParticipationsByProject(projectId),
    staleTime: 1000 * 60 * 5,
  });

  queryClient.prefetchQuery({
    queryKey: queryKeys.rehearsals.byProject(projectId),
    queryFn: () => ProjectService.getRehearsalsByProject(projectId),
    staleTime: 1000 * 60 * 5,
  });

  queryClient.prefetchQuery({
    queryKey: queryKeys.crewAssignments.byProject(projectId),
    queryFn: () => ProjectService.getCrewAssignmentsByProject(projectId),
    staleTime: 1000 * 60 * 5,
  });

  queryClient.prefetchQuery({
    queryKey: queryKeys.artists.all,
    queryFn: ProjectService.getArtistsDictionary,
    staleTime: Infinity,
  });

  queryClient.prefetchQuery({
    queryKey: queryKeys.pieces.all,
    queryFn: ProjectService.getPiecesDictionary,
    staleTime: Infinity,
  });
};
