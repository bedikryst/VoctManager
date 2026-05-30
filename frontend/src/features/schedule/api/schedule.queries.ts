import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import type { Attendance } from "@/shared/types";
import { projectKeys } from "@/features/projects/api/project.queries";
import { rehearsalKeys } from "@/features/rehearsals/api/rehearsals.queries";
import { ScheduleService } from "./schedule.service";
import type { ScheduleAttendanceReportDTO } from "../types/schedule.dto";

const ANONYMOUS_ARTIST_QUERY_ID = "anonymous";

export const useScheduleContextData = (artistId?: string | number) => {
  const results = useQueries({
    queries: [
      {
        queryKey: rehearsalKeys.rehearsals.byArtist(
          artistId ?? ANONYMOUS_ARTIST_QUERY_ID,
        ),
        queryFn: () => ScheduleService.getRehearsalsByArtist(artistId!),
        enabled: !!artistId,
        staleTime: 1000 * 60 * 5,
      },
      {
        queryKey: projectKeys.projects.all,
        queryFn: ScheduleService.getProjects,
        enabled: !!artistId,
        staleTime: 1000 * 60 * 5,
      },
      {
        queryKey: projectKeys.participations.byArtist(
          artistId ?? ANONYMOUS_ARTIST_QUERY_ID,
        ),
        queryFn: () => ScheduleService.getParticipationsByArtist(artistId!),
        enabled: !!artistId,
        staleTime: 1000 * 60 * 5,
      },
      {
        queryKey: rehearsalKeys.attendances.byArtist(
          artistId ?? ANONYMOUS_ARTIST_QUERY_ID,
        ),
        queryFn: () => ScheduleService.getAttendancesByArtist(artistId!),
        enabled: !!artistId,
        staleTime: 1000 * 60,
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

    onMutate: async ({ existingAttendanceId, payload }) => {
      await queryClient.cancelQueries({
        queryKey: rehearsalKeys.attendances.all,
      });

      const snapshot = queryClient.getQueriesData<Attendance[]>({
        queryKey: rehearsalKeys.attendances.all,
      });

      queryClient.setQueriesData<Attendance[]>(
        { queryKey: rehearsalKeys.attendances.all },
        (old = []) => {
          if (existingAttendanceId) {
            return old.map((record) =>
              record.id === existingAttendanceId
                ? {
                    ...record,
                    status: payload.status,
                    excuse_note: payload.excuse_note,
                  }
                : record,
            );
          }
          const optimisticRecord: Attendance = {
            id: `optimistic-${Date.now()}`,
            rehearsal: String(payload.rehearsal),
            participation: String(payload.participation),
            status: payload.status,
            excuse_note: payload.excuse_note,
          };
          return [...old, optimisticRecord];
        },
      );

      return { snapshot };
    },

    onError: (_error, _variables, context) => {
      if (!context?.snapshot) return;
      for (const [queryKey, data] of context.snapshot) {
        queryClient.setQueryData(queryKey, data);
      }
    },

    onSettled: async () => {
      await queryClient.invalidateQueries({
        queryKey: rehearsalKeys.attendances.all,
      });
    },
  });
};
