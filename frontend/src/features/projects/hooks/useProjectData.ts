/**
 * @file useProjectData.ts
 * @description Scoped aggregation hook for Project module server state.
 * Composes domain queries into a stable contract consumed across cards and editor tabs.
 * Automatically resolves the root project entity from the cache.
 * @module panel/projects/hooks/useProjectData
 */

import type { QueryClient } from "@tanstack/react-query";

import type {
  Artist,
  Collaborator,
  CrewAssignment,
  Participation,
  Piece,
  PieceCasting,
  Project,
  Rehearsal,
} from "@/shared/types";

import {
  projectKeys,
  useProjects,
  useProjectArtistsDictionary,
  useProjectCollaboratorsDictionary,
  useProjectCrewAssignments,
  useProjectParticipations,
  useProjectPieceCastings,
  useProjectPiecesDictionary,
  useProjectRehearsals,
} from "../api/project.queries";
import { ProjectService } from "../api/project.service";
import {
  PROJECT_RELATION_STALE_TIME,
  STATIC_DICTIONARY_STALE_TIME,
} from "../api/project.query-utils";

export interface ProjectDataResult {
  project: Project | null;
  participations: Participation[];
  rehearsals: Rehearsal[];
  crewAssignments: CrewAssignment[];
  pieceCastings: PieceCasting[];
  artists: Artist[];
  crew: Collaborator[];
  pieces: Piece[];
  isLoading: boolean;
  isError: boolean;
}

export function useProjectData(
  projectId: string | undefined,
): ProjectDataResult {
  const isEnabled = typeof projectId === "string" && projectId.length > 0;

  const projectsQuery = useProjects(isEnabled);
  const participationsQuery = useProjectParticipations(projectId);
  const rehearsalsQuery = useProjectRehearsals(projectId);
  const crewAssignmentsQuery = useProjectCrewAssignments(projectId);
  const pieceCastingsQuery = useProjectPieceCastings(projectId);
  const artistsQuery = useProjectArtistsDictionary(isEnabled);
  const collaboratorsQuery = useProjectCollaboratorsDictionary(isEnabled);
  const piecesQuery = useProjectPiecesDictionary(isEnabled);

  const isLoading =
    isEnabled &&
    (projectsQuery.isLoading ||
      participationsQuery.isLoading ||
      rehearsalsQuery.isLoading ||
      crewAssignmentsQuery.isLoading ||
      pieceCastingsQuery.isLoading ||
      artistsQuery.isLoading ||
      collaboratorsQuery.isLoading ||
      piecesQuery.isLoading);

  const isError =
    isEnabled &&
    (projectsQuery.isError ||
      participationsQuery.isError ||
      rehearsalsQuery.isError ||
      crewAssignmentsQuery.isError ||
      pieceCastingsQuery.isError ||
      artistsQuery.isError ||
      collaboratorsQuery.isError ||
      piecesQuery.isError);

  const project =
    projectsQuery.data?.find(
      (candidate) => String(candidate.id) === String(projectId),
    ) ??
    null;

  return {
    project,
    participations: participationsQuery.data ?? [],
    rehearsals: rehearsalsQuery.data ?? [],
    crewAssignments: crewAssignmentsQuery.data ?? [],
    pieceCastings: pieceCastingsQuery.data ?? [],
    artists: artistsQuery.data ?? [],
    crew: collaboratorsQuery.data ?? [],
    pieces: piecesQuery.data ?? [],
    isLoading,
    isError,
  };
}

export const prefetchProjectData = (
  queryClient: QueryClient,
  projectId: string,
): Promise<void> =>
  Promise.all([
    queryClient.prefetchQuery({
      queryKey: projectKeys.participations.byProject(projectId),
      queryFn: () => ProjectService.getParticipationsByProject(projectId),
      staleTime: PROJECT_RELATION_STALE_TIME,
    }),
    queryClient.prefetchQuery({
      queryKey: projectKeys.rehearsals.byProject(projectId),
      queryFn: () => ProjectService.getRehearsalsByProject(projectId),
      staleTime: PROJECT_RELATION_STALE_TIME,
    }),
    queryClient.prefetchQuery({
      queryKey: projectKeys.crewAssignments.byProject(projectId),
      queryFn: () => ProjectService.getCrewAssignmentsByProject(projectId),
      staleTime: PROJECT_RELATION_STALE_TIME,
    }),
    queryClient.prefetchQuery({
      queryKey: projectKeys.dictionaries.artists,
      queryFn: ProjectService.getArtistsDictionary,
      staleTime: STATIC_DICTIONARY_STALE_TIME,
    }),
    queryClient.prefetchQuery({
      queryKey: projectKeys.dictionaries.pieces,
      queryFn: ProjectService.getPiecesDictionary,
      staleTime: STATIC_DICTIONARY_STALE_TIME,
    }),
  ]).then(() => undefined);
