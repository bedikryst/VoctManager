/**
 * @file project.read.queries.ts
 * @description Read-only React Query hooks for Project server state.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/api
 */

import { useSuspenseQuery } from "@tanstack/react-query";

import type {
  Artist,
  Attendance,
  Collaborator,
  CrewAssignment,
  Participation,
  Piece,
  PieceCasting,
  ProgramItem,
  Project,
  Rehearsal,
  VoiceLineOption,
} from "@/shared/types";

import { ProjectService } from "./project.service";
import { projectKeys } from "./project.query-keys";
import {
  FAST_CHANGING_STALE_TIME,
  PROJECT_RELATION_STALE_TIME,
  STATIC_DICTIONARY_STALE_TIME,
} from "./project.query-utils";

const DISABLED_QUERY_STALE_TIME = Number.POSITIVE_INFINITY;
const PENDING_PROJECT_QUERY_ID = "pending";

interface PaginatedList<TData> {
  results?: TData[];
}

const getDisabledListQueryConfig = <TData>() => ({
  queryFn: async (): Promise<TData[]> => [],
  staleTime: DISABLED_QUERY_STALE_TIME,
  initialData: [] as TData[],
  initialDataUpdatedAt: 0,
});

const extractListData = <TData>(
  data: TData[] | PaginatedList<TData> | unknown,
): TData[] => {
  if (Array.isArray(data)) {
    return data;
  }

  if (
    data &&
    typeof data === "object" &&
    "results" in data &&
    Array.isArray((data as PaginatedList<TData>).results)
  ) {
    return (data as PaginatedList<TData>).results ?? [];
  }

  return [];
};

const selectArtistsDictionary = (
  data: Artist[] | PaginatedList<Artist>,
): Artist[] => extractListData<Artist>(data);

const selectArtistsMap = (
  data: Artist[] | PaginatedList<Artist>,
): Map<string, Artist> =>
  new Map(
    extractListData<Artist>(data).map((artist) => [String(artist.id), artist]),
  );

const selectPiecesDictionary = (
  data: Piece[] | PaginatedList<Piece>,
): Piece[] => extractListData<Piece>(data);

const selectCollaboratorsDictionary = (
  data: Collaborator[] | PaginatedList<Collaborator>,
): Collaborator[] => extractListData<Collaborator>(data);

const selectVoiceLinesDictionary = (
  data: VoiceLineOption[] | PaginatedList<VoiceLineOption>,
): VoiceLineOption[] => extractListData<VoiceLineOption>(data);

const selectParticipations = (
  data: Participation[] | PaginatedList<Participation>,
): Participation[] => extractListData<Participation>(data);

const selectRehearsals = (
  data: Rehearsal[] | PaginatedList<Rehearsal>,
): Rehearsal[] => extractListData<Rehearsal>(data);

const selectCrewAssignments = (
  data: CrewAssignment[] | PaginatedList<CrewAssignment>,
): CrewAssignment[] => extractListData<CrewAssignment>(data);

const selectProgramItems = (
  data: ProgramItem[] | PaginatedList<ProgramItem>,
): ProgramItem[] => extractListData<ProgramItem>(data);

const selectPieceCastings = (
  data: PieceCasting[] | PaginatedList<PieceCasting>,
): PieceCasting[] => extractListData<PieceCasting>(data);

const selectAttendances = (
  data: Attendance[] | PaginatedList<Attendance>,
): Attendance[] => extractListData<Attendance>(data);

export const useProjects = (enabled = true) =>
  useSuspenseQuery({
    queryKey: projectKeys.projects.all,
    ...(enabled
      ? {
          queryFn: ProjectService.getAll,
          staleTime: PROJECT_RELATION_STALE_TIME,
        }
      : getDisabledListQueryConfig<Project>()),
  });

export const useProjectArtistsDictionary = (enabled = true) =>
  useSuspenseQuery({
    queryKey: projectKeys.dictionaries.artists,
    ...(enabled
      ? {
          queryFn: ProjectService.getArtistsDictionary,
          staleTime: STATIC_DICTIONARY_STALE_TIME,
        }
      : getDisabledListQueryConfig<Artist>()),
    select: selectArtistsDictionary,
  });

export const useProjectArtistsMap = (enabled = true) =>
  useSuspenseQuery({
    queryKey: projectKeys.dictionaries.artists,
    ...(enabled
      ? {
          queryFn: ProjectService.getArtistsDictionary,
          staleTime: STATIC_DICTIONARY_STALE_TIME,
        }
      : getDisabledListQueryConfig<Artist>()),
    select: selectArtistsMap,
  });

export const useProjectPiecesDictionary = (enabled = true) =>
  useSuspenseQuery({
    queryKey: projectKeys.dictionaries.pieces,
    ...(enabled
      ? {
          queryFn: ProjectService.getPiecesDictionary,
          staleTime: STATIC_DICTIONARY_STALE_TIME,
        }
      : getDisabledListQueryConfig<Piece>()),
    select: selectPiecesDictionary,
  });

export const useProjectCollaboratorsDictionary = (enabled = true) =>
  useSuspenseQuery({
    queryKey: projectKeys.dictionaries.collaborators,
    ...(enabled
      ? {
          queryFn: ProjectService.getCollaboratorsDictionary,
          staleTime: STATIC_DICTIONARY_STALE_TIME,
        }
      : getDisabledListQueryConfig<Collaborator>()),
    select: selectCollaboratorsDictionary,
  });

export const useProjectVoiceLinesDictionary = (enabled = true) =>
  useSuspenseQuery({
    queryKey: projectKeys.dictionaries.voiceLines,
    ...(enabled
      ? {
          queryFn: ProjectService.getVoiceLinesDictionary,
          staleTime: STATIC_DICTIONARY_STALE_TIME,
        }
      : getDisabledListQueryConfig<VoiceLineOption>()),
    select: selectVoiceLinesDictionary,
  });

export const useProjectParticipations = (projectId: string | undefined) =>
  useSuspenseQuery({
    queryKey: projectKeys.participations.byProject(
      projectId ?? PENDING_PROJECT_QUERY_ID,
    ),
    ...(projectId
      ? {
          queryFn: () => ProjectService.getParticipationsByProject(projectId),
          staleTime: PROJECT_RELATION_STALE_TIME,
        }
      : getDisabledListQueryConfig<Participation>()),
    select: selectParticipations,
  });

export const useProjectRehearsals = (projectId: string | undefined) =>
  useSuspenseQuery({
    queryKey: projectKeys.rehearsals.byProject(
      projectId ?? PENDING_PROJECT_QUERY_ID,
    ),
    ...(projectId
      ? {
          queryFn: () => ProjectService.getRehearsalsByProject(projectId),
          staleTime: PROJECT_RELATION_STALE_TIME,
        }
      : getDisabledListQueryConfig<Rehearsal>()),
    select: selectRehearsals,
  });

export const useProjectCrewAssignments = (projectId: string | undefined) =>
  useSuspenseQuery({
    queryKey: projectKeys.crewAssignments.byProject(
      projectId ?? PENDING_PROJECT_QUERY_ID,
    ),
    ...(projectId
      ? {
          queryFn: () => ProjectService.getCrewAssignmentsByProject(projectId),
          staleTime: PROJECT_RELATION_STALE_TIME,
        }
      : getDisabledListQueryConfig<CrewAssignment>()),
    select: selectCrewAssignments,
  });

export const useProjectProgram = (projectId: string | undefined) =>
  useSuspenseQuery({
    queryKey: projectKeys.program.byProject(
      projectId ?? PENDING_PROJECT_QUERY_ID,
    ),
    ...(projectId
      ? {
          queryFn: () => ProjectService.getProgramByProject(projectId),
          staleTime: FAST_CHANGING_STALE_TIME,
        }
      : getDisabledListQueryConfig<ProgramItem>()),
    select: selectProgramItems,
  });

export const useProjectPieceCastings = (projectId: string | undefined) =>
  useSuspenseQuery({
    queryKey: projectKeys.pieceCastings.byProject(
      projectId ?? PENDING_PROJECT_QUERY_ID,
    ),
    ...(projectId
      ? {
          queryFn: () => ProjectService.getPieceCastingsByProject(projectId),
          staleTime: FAST_CHANGING_STALE_TIME,
        }
      : getDisabledListQueryConfig<PieceCasting>()),
    select: selectPieceCastings,
  });

export const useProjectAttendances = (projectId: string | undefined) =>
  useSuspenseQuery({
    queryKey: projectKeys.attendances.byProject(
      projectId ?? PENDING_PROJECT_QUERY_ID,
    ),
    ...(projectId
      ? {
          queryFn: () => ProjectService.getAttendancesByProject(projectId),
          staleTime: FAST_CHANGING_STALE_TIME,
        }
      : getDisabledListQueryConfig<Attendance>()),
    select: selectAttendances,
  });
