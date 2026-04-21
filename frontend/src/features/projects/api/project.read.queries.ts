/**
 * @file project.read.queries.ts
 * @description Read-only React Query hooks for Project server state.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/api
 */

import { useQuery } from "@tanstack/react-query";

import { archiveKeys } from "@/features/archive/api/archive.queries";
import { artistKeys } from "@/features/artists/api/artist.queries";
import { crewKeys } from "@/features/crew/api/crew.queries";
import { rehearsalKeys } from "@/features/rehearsals/api/rehearsals.queries";
import { OPTIONS_QUERY_KEYS } from "@/shared/api/options.queries";

import { ProjectService } from "./project.service";
import { projectKeys } from "./project.query-keys";
import {
  FAST_CHANGING_STALE_TIME,
  PROJECT_RELATION_STALE_TIME,
  STATIC_DICTIONARY_STALE_TIME,
  getRequiredProjectId,
} from "./project.query-utils";

export const useProjects = (enabled = true) =>
  useQuery({
    queryKey: projectKeys.projects.all,
    queryFn: ProjectService.getAll,
    staleTime: PROJECT_RELATION_STALE_TIME,
    enabled,
  });

export const useProjectArtistsDictionary = (enabled = true) =>
  useQuery({
    queryKey: artistKeys.artists.all,
    queryFn: ProjectService.getArtistsDictionary,
    staleTime: STATIC_DICTIONARY_STALE_TIME,
    enabled,
  });

export const useProjectPiecesDictionary = (enabled = true) =>
  useQuery({
    queryKey: archiveKeys.pieces.all,
    queryFn: ProjectService.getPiecesDictionary,
    staleTime: STATIC_DICTIONARY_STALE_TIME,
    enabled,
  });

export const useProjectCollaboratorsDictionary = (enabled = true) =>
  useQuery({
    queryKey: crewKeys.collaborators.all,
    queryFn: ProjectService.getCollaboratorsDictionary,
    staleTime: STATIC_DICTIONARY_STALE_TIME,
    enabled,
  });

export const useProjectVoiceLinesDictionary = (enabled = true) =>
  useQuery({
    queryKey: OPTIONS_QUERY_KEYS.voiceLines,
    queryFn: ProjectService.getVoiceLinesDictionary,
    staleTime: STATIC_DICTIONARY_STALE_TIME,
    enabled,
  });

export const useProjectParticipations = (projectId: string | undefined) =>
  useQuery({
    queryKey: projectKeys.participations.byProject(projectId ?? "pending"),
    queryFn: () =>
      ProjectService.getParticipationsByProject(getRequiredProjectId(projectId)),
    staleTime: PROJECT_RELATION_STALE_TIME,
    enabled: !!projectId,
  });

export const useProjectRehearsals = (projectId: string | undefined) =>
  useQuery({
    queryKey: rehearsalKeys.rehearsals.byProject(projectId ?? "pending"),
    queryFn: () =>
      ProjectService.getRehearsalsByProject(getRequiredProjectId(projectId)),
    staleTime: PROJECT_RELATION_STALE_TIME,
    enabled: !!projectId,
  });

export const useProjectCrewAssignments = (projectId: string | undefined) =>
  useQuery({
    queryKey: projectKeys.crewAssignments.byProject(projectId ?? "pending"),
    queryFn: () =>
      ProjectService.getCrewAssignmentsByProject(
        getRequiredProjectId(projectId),
      ),
    staleTime: PROJECT_RELATION_STALE_TIME,
    enabled: !!projectId,
  });

export const useProjectProgram = (projectId: string | undefined) =>
  useQuery({
    queryKey: projectKeys.program.byProject(projectId ?? "pending"),
    queryFn: () =>
      ProjectService.getProgramByProject(getRequiredProjectId(projectId)),
    staleTime: FAST_CHANGING_STALE_TIME,
    enabled: !!projectId,
  });

export const useProjectPieceCastings = (projectId: string | undefined) =>
  useQuery({
    queryKey: projectKeys.pieceCastings.byProject(projectId ?? "pending"),
    queryFn: () =>
      ProjectService.getPieceCastingsByProject(getRequiredProjectId(projectId)),
    staleTime: FAST_CHANGING_STALE_TIME,
    enabled: !!projectId,
  });

export const useProjectAttendances = (projectId: string | undefined) =>
  useQuery({
    queryKey: rehearsalKeys.attendances.byProject(projectId ?? "pending"),
    queryFn: () =>
      ProjectService.getAttendancesByProject(getRequiredProjectId(projectId)),
    staleTime: FAST_CHANGING_STALE_TIME,
    enabled: !!projectId,
  });
