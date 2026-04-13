/**
 * @file schedule.queries.ts
 * @description React Query hooks for the Schedule domain.
 */

import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { artistKeys } from "@/features/artists/api/artist.queries";
import { projectKeys } from "@/features/projects/api/project.queries";
import { rehearsalKeys } from "@/features/rehearsals/api/rehearsals.queries";
import { ScheduleService } from "./schedule.service";
import type { ScheduleAttendanceReportDTO } from "../types/schedule.dto";

export const useScheduleContextData = (artistId?: string | number) => {
  const results = useQueries({
    queries: [
      {
        queryKey: rehearsalKeys.rehearsals.byArtist(artistId ?? "anonymous"),
        queryFn: () => ScheduleService.getRehearsals(),
        enabled: !!artistId,
      },
      {
        queryKey: projectKeys.projects.all,
        queryFn: ScheduleService.getProjects,
        enabled: !!artistId,
      },
      {
        queryKey: projectKeys.participations.byArtist(artistId ?? "anonymous"),
        queryFn: () => ScheduleService.getParticipationsByArtist(artistId!),
        enabled: !!artistId,
      },
      {
        queryKey: rehearsalKeys.attendances.byArtist(artistId ?? "anonymous"),
        queryFn: () => ScheduleService.getAttendancesByArtist(artistId!),
        enabled: !!artistId,
      },
    ],
  });

  return {
    rehearsals: results[0].data || [],
    projects: results[1].data || [],
    participations: results[2].data || [],
    attendances: results[3].data || [],
    isLoading: results.some((query) => query.isLoading),
  };
};

export const useScheduleProgramItems = (
  projectId: string | number,
  enabled: boolean,
) => {
  return useQuery({
    queryKey: projectKeys.program.byProject(projectId),
    queryFn: () => ScheduleService.getProgramItemsByProject(projectId),
    enabled,
  });
};

export const useSchedulePieceCastings = (
  projectId: string | number,
  pieceId: string | null,
  enabled: boolean,
) => {
  return useQuery({
    queryKey: projectKeys.pieceCastings.byProjectPiece(
      projectId,
      pieceId ?? "pending",
    ),
    queryFn: () =>
      ScheduleService.getPieceCastingsByProjectPiece(projectId, pieceId),
    enabled: enabled && !!pieceId,
  });
};

export const useUpsertScheduleAttendance = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      existingAttendanceId,
      payload,
    }: {
      existingAttendanceId?: string;
      payload: ScheduleAttendanceReportDTO;
    }) => ScheduleService.saveAttendanceReport(existingAttendanceId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: rehearsalKeys.attendances.all,
      });
    },
  });
};
