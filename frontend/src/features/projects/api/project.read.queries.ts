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

const getDisabledListQueryConfig = <TData,>() => ({
  queryFn: async (): Promise<TData[]> => [],
  staleTime: DISABLED_QUERY_STALE_TIME,
  initialData: [] as TData[],
  initialDataUpdatedAt: 0,
});

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
    select: (artists) =>
      new Map(artists.map((artist) => [String(artist.id), artist])),
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
  });

export const useProjectParticipations = (projectId: string | undefined) =>
  useSuspenseQuery({
    queryKey: projectKeys.participations.byProject(projectId ?? "pending"),
    ...(projectId
      ? {
          queryFn: () => ProjectService.getParticipationsByProject(projectId),
          staleTime: PROJECT_RELATION_STALE_TIME,
        }
      : getDisabledListQueryConfig<Participation>()),
  });

export const useProjectRehearsals = (projectId: string | undefined) =>
  useSuspenseQuery({
    queryKey: projectKeys.rehearsals.byProject(projectId ?? "pending"),
    ...(projectId
      ? {
          queryFn: () => ProjectService.getRehearsalsByProject(projectId),
          staleTime: PROJECT_RELATION_STALE_TIME,
        }
      : getDisabledListQueryConfig<Rehearsal>()),
  });

export const useProjectCrewAssignments = (projectId: string | undefined) =>
  useSuspenseQuery({
    queryKey: projectKeys.crewAssignments.byProject(projectId ?? "pending"),
    ...(projectId
      ? {
          queryFn: () =>
            ProjectService.getCrewAssignmentsByProject(projectId),
          staleTime: PROJECT_RELATION_STALE_TIME,
        }
      : getDisabledListQueryConfig<CrewAssignment>()),
  });

export const useProjectProgram = (projectId: string | undefined) =>
  useSuspenseQuery({
    queryKey: projectKeys.program.byProject(projectId ?? "pending"),
    ...(projectId
      ? {
          queryFn: () => ProjectService.getProgramByProject(projectId),
          staleTime: FAST_CHANGING_STALE_TIME,
        }
      : getDisabledListQueryConfig<ProgramItem>()),
  });

export const useProjectPieceCastings = (projectId: string | undefined) =>
  useSuspenseQuery({
    queryKey: projectKeys.pieceCastings.byProject(projectId ?? "pending"),
    ...(projectId
      ? {
          queryFn: () => ProjectService.getPieceCastingsByProject(projectId),
          staleTime: FAST_CHANGING_STALE_TIME,
        }
      : getDisabledListQueryConfig<PieceCasting>()),
  });

export const useProjectAttendances = (projectId: string | undefined) =>
  useSuspenseQuery({
    queryKey: projectKeys.attendances.byProject(projectId ?? "pending"),
    ...(projectId
      ? {
          queryFn: () => ProjectService.getAttendancesByProject(projectId),
          staleTime: FAST_CHANGING_STALE_TIME,
        }
      : getDisabledListQueryConfig<Attendance>()),
  });
