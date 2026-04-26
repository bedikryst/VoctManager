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

const getDisabledListQueryConfig = <TData>() => ({
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
    select: (artists) => (Array.isArray(artists) ? artists : artists ? [artists] : []),
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
    select: (artists) => {
      const safeArtists = Array.isArray(artists)
        ? artists
        : artists
          ? [artists]
          : [];
      return new Map(safeArtists.map((artist) => [String(artist.id), artist]));
    },
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
    select: (pieces) => (Array.isArray(pieces) ? pieces : pieces ? [pieces] : []),
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
    select: (collabs) => (Array.isArray(collabs) ? collabs : collabs ? [collabs] : []),
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
    select: (lines) => (Array.isArray(lines) ? lines : lines ? [lines] : []),
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
    select: (data) => (Array.isArray(data) ? data : data ? [data] : []),
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
    select: (data) => (Array.isArray(data) ? data : data ? [data] : []),
  });

export const useProjectCrewAssignments = (projectId: string | undefined) =>
  useSuspenseQuery({
    queryKey: projectKeys.crewAssignments.byProject(projectId ?? "pending"),
    ...(projectId
      ? {
          queryFn: () => ProjectService.getCrewAssignmentsByProject(projectId),
          staleTime: PROJECT_RELATION_STALE_TIME,
        }
      : getDisabledListQueryConfig<CrewAssignment>()),
    select: (data) => (Array.isArray(data) ? data : data ? [data] : []),
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
    select: (data) => (Array.isArray(data) ? data : data ? [data] : []),
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
    select: (data) => (Array.isArray(data) ? data : data ? [data] : []),
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
    select: (data) => (Array.isArray(data) ? data : data ? [data] : []),
  });
