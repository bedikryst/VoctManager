/**
 * @file rehearsals.queries.ts
 * @description React Query hooks for the Rehearsals domain.
 */

import { useMutation, useQueries, useQueryClient } from "@tanstack/react-query";
import { RehearsalsService } from "./rehearsals.service";
import type { AttendanceUpsertDTO } from "../types/rehearsals.dto";
import { projectKeys } from "@/features/projects/api/project.queries";
import { artistKeys } from "@/features/artists/api/artist.queries";

export const rehearsalKeys = {
  rehearsals: {
    all: ["rehearsals"] as const,
    byProject: (projectId: string | number) =>
      ["rehearsals", { project: String(projectId) }] as const,
    byArtist: (artistId: string | number) =>
      ["rehearsals", { artist: String(artistId) }] as const,
  },
  attendances: {
    all: ["attendances"] as const,
    byRehearsal: (rehearsalId: string | number) =>
      ["attendances", { rehearsal: String(rehearsalId) }] as const,
    byArtist: (artistId: string | number) =>
      ["attendances", { artist: String(artistId) }] as const,
    byProject: (projectId: string | number) =>
      ["attendances", { project: String(projectId) }] as const,
  },
};

const invalidateRehearsalsDomain = async (
  queryClient: ReturnType<typeof useQueryClient>,
): Promise<void> => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: rehearsalKeys.attendances.all }),
    queryClient.invalidateQueries({ queryKey: rehearsalKeys.rehearsals.all }),
    queryClient.invalidateQueries({ queryKey: projectKeys.projects.all }),
  ]);
};

export const useRehearsalsWorkspaceData = () => {
  const results = useQueries({
    queries: [
      {
        queryKey: projectKeys.projects.all,
        queryFn: RehearsalsService.getProjects,
      },
      {
        queryKey: rehearsalKeys.rehearsals.all,
        queryFn: RehearsalsService.getRehearsals,
      },
      {
        queryKey: projectKeys.participations.all,
        queryFn: RehearsalsService.getParticipations,
      },
      {
        queryKey: rehearsalKeys.attendances.all,
        queryFn: RehearsalsService.getAttendances,
      },
      {
        queryKey: artistKeys.artists.all,
        queryFn: RehearsalsService.getArtists,
      },
      {
        queryKey: ["locations", "list"],
        queryFn: RehearsalsService.getLocations,
      },
    ],
  });

  return {
    projects: results[0].data || [],
    rehearsals: results[1].data || [],
    participations: results[2].data || [],
    attendances: results[3].data || [],
    artists: results[4].data || [],
    locations: results[5].data || [],
    isLoading: results.some((query) => query.isLoading),
    isError: results.some((query) => query.isError),
  };
};

export const useUpsertAttendanceRecord = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id?: string; data: AttendanceUpsertDTO }) => {
      return id
        ? RehearsalsService.updateAttendance(id, data)
        : RehearsalsService.createAttendance(data);
    },
    onSuccess: async () => {
      await invalidateRehearsalsDomain(queryClient);
    },
  });
};

export const useDeleteAttendanceRecord = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => RehearsalsService.deleteAttendance(id),
    onSuccess: async () => {
      await invalidateRehearsalsDomain(queryClient);
    },
  });
};

export const useMarkMissingAttendancesPresent = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      entries: Array<{
        attendanceId?: string;
        rehearsalId: string;
        participationId: string;
      }>,
    ) => {
      await Promise.all(
        entries.map((entry) => {
          const payload: AttendanceUpsertDTO = {
            rehearsal: entry.rehearsalId,
            participation: entry.participationId,
            status: "PRESENT",
            minutes_late: null,
            excuse_note: "",
          };

          return entry.attendanceId
            ? RehearsalsService.updateAttendance(entry.attendanceId, payload)
            : RehearsalsService.createAttendance(payload);
        }),
      );
    },
    onSuccess: async () => {
      await invalidateRehearsalsDomain(queryClient);
    },
  });
};
