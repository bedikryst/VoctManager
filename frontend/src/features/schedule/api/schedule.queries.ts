import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { projectKeys } from "@/features/projects/api/project.queries";
import { useOfflineStore } from "@/app/store/useOfflineStore";
import { isLikelyOfflineError } from "@/shared/offline/offlineClient";
import {
  PERSONAL_READMODEL_KEYS,
  RECONCILING_REFETCH,
} from "@/shared/api/queryPolicy";
import { ScheduleService } from "./schedule.service";
import type {
  ScheduleAttendanceReportDTO,
  ScheduleDashboardItem,
} from "../types/schedule.dto";

const ANONYMOUS_ARTIST_QUERY_ID = "anonymous";

export const scheduleKeys = {
  dashboard: {
    byArtist: (artistId: string | number) =>
      [...PERSONAL_READMODEL_KEYS.scheduleDashboard, String(artistId)] as const,
  },
};

/** Partial key matching every artist's dashboard cache (for optimistic patches). */
const SCHEDULE_DASHBOARD_PREFIX = PERSONAL_READMODEL_KEYS.scheduleDashboard;

/**
 * The artist's personal schedule in one server-joined call — replaces the
 * former four-query `useScheduleContextData` + client-side O(n·m) join.
 */
export const useScheduleDashboard = (artistId?: string | number) =>
  useQuery({
    queryKey: scheduleKeys.dashboard.byArtist(
      artistId ?? ANONYMOUS_ARTIST_QUERY_ID,
    ),
    queryFn: ScheduleService.getScheduleDashboard,
    enabled: !!artistId,
    // Personal read-model driven by the artist's participations and the
    // project's rehearsals — both changed from the manager's session. Reconcile
    // on the artist's next mount/focus so a new rehearsal or assignment lands.
    ...RECONCILING_REFETCH,
    staleTime: 1000 * 60 * 5,
  });

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

/**
 * Optimistic RSVP: patches the artist's attendance straight onto the matching
 * rehearsal in every schedule-dashboard cache, so the card answers the tap with
 * zero latency, and rolls back if the server rejects the write.
 */
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
      await queryClient.cancelQueries({ queryKey: SCHEDULE_DASHBOARD_PREFIX });

      const snapshot = queryClient.getQueriesData<ScheduleDashboardItem[]>({
        queryKey: SCHEDULE_DASHBOARD_PREFIX,
      });

      queryClient.setQueriesData<ScheduleDashboardItem[]>(
        { queryKey: SCHEDULE_DASHBOARD_PREFIX },
        (old) =>
          old?.map((item) =>
            item.type === "REHEARSAL" &&
            String(item.rehearsal.id) === String(payload.rehearsal)
              ? {
                  ...item,
                  my_attendance: {
                    id:
                      existingAttendanceId ??
                      item.my_attendance?.id ??
                      `optimistic-${Date.now()}`,
                    status: payload.status,
                    excuse_note: payload.excuse_note,
                  },
                }
              : item,
          ),
      );

      return { snapshot };
    },

    onError: (error, { existingAttendanceId, payload }, context) => {
      // Offline RSVP: keep the optimistic patch and queue the write. The replay
      // re-uses the same method/URL, so an offline "create" stays a POST and an
      // edit of a synced record stays a PATCH.
      if (isLikelyOfflineError(error)) {
        useOfflineStore.getState().enqueueWrite({
          kind: "attendance",
          method: existingAttendanceId ? "PATCH" : "POST",
          url: existingAttendanceId
            ? `/api/attendances/${existingAttendanceId}/`
            : "/api/attendances/",
          body: payload,
          dedupeKey: `attendance:${payload.rehearsal}`,
          label: "Obecność na próbie",
        });
        return;
      }
      if (!context?.snapshot) return;
      for (const [queryKey, data] of context.snapshot) {
        queryClient.setQueryData(queryKey, data);
      }
    },

    onSettled: async () => {
      if (typeof navigator !== "undefined" && !navigator.onLine) return;
      await queryClient.invalidateQueries({ queryKey: SCHEDULE_DASHBOARD_PREFIX });
    },
  });
};
