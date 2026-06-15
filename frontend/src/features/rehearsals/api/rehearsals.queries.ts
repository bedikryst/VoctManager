/**
 * @file rehearsals.queries.ts
 * @description React Query hooks for the Rehearsals domain.
 */

import { useMutation, useQueries, useQueryClient } from "@tanstack/react-query";
import { RehearsalsService } from "./rehearsals.service";
import type { AttendanceUpsertDTO } from "../types/rehearsals.dto";
import type { Attendance } from "@/shared/types";
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

/* ── Optimistic helpers ──────────────────────────────────────────────────
 * Attendance edits are taken live, in front of the choir — the roster must
 * react on the tap, not after a network round-trip. We patch the flat
 * `["attendances"]` cache (the single source every rehearsal surface derives
 * from) on mutate, then reconcile with the server on settle. A failed write
 * rolls the snapshot back, so the only cost of being wrong is a brief flicker.
 */

type AttendanceCache = Attendance[];
type OptimisticContext = { previous?: AttendanceCache };

const ATTENDANCES_KEY = rehearsalKeys.attendances.all;
/** Shared key so a burst of attendance writes can coordinate reconciliation. */
const ATTENDANCE_WRITE_KEY = ["attendance-write"] as const;

const makeOptimisticId = (): string =>
  `optimistic-${
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  }`;

const beginOptimistic = async (
  queryClient: ReturnType<typeof useQueryClient>,
  mutate: (current: AttendanceCache) => AttendanceCache,
): Promise<OptimisticContext> => {
  await queryClient.cancelQueries({ queryKey: ATTENDANCES_KEY });
  const previous = queryClient.getQueryData<AttendanceCache>(ATTENDANCES_KEY);
  queryClient.setQueryData<AttendanceCache>(ATTENDANCES_KEY, (current) =>
    mutate(current ?? []),
  );
  return { previous };
};

const rollbackOptimistic = (
  queryClient: ReturnType<typeof useQueryClient>,
  context: OptimisticContext | undefined,
): void => {
  if (context?.previous) {
    queryClient.setQueryData(ATTENDANCES_KEY, context.previous);
  }
};

/**
 * Reconcile with the server only once the *last* in-flight attendance write
 * settles. During a rapid roll-call this stops an early mutation's refetch from
 * overwriting the optimistic state of taps that haven't reached the server yet.
 */
const settleOptimistic = async (
  queryClient: ReturnType<typeof useQueryClient>,
): Promise<void> => {
  if (queryClient.isMutating({ mutationKey: ATTENDANCE_WRITE_KEY }) <= 1) {
    await invalidateRehearsalsDomain(queryClient);
  }
};

export const useRehearsalsWorkspaceData = () => {
  const results = useQueries({
    queries: [
      {
        queryKey: projectKeys.projects.all,
        queryFn: RehearsalsService.getProjects,
        staleTime: 1000 * 60 * 5,
      },
      {
        queryKey: rehearsalKeys.rehearsals.all,
        queryFn: RehearsalsService.getRehearsals,
        staleTime: 1000 * 60 * 5,
      },
      {
        queryKey: projectKeys.participations.all,
        queryFn: RehearsalsService.getParticipations,
        staleTime: 1000 * 60 * 5,
      },
      {
        queryKey: rehearsalKeys.attendances.all,
        queryFn: RehearsalsService.getAttendances,
        staleTime: 1000 * 60,
      },
      {
        queryKey: artistKeys.artists.all,
        queryFn: RehearsalsService.getArtists,
        staleTime: 1000 * 60 * 5,
      },
      {
        queryKey: ["locations", "list"],
        queryFn: RehearsalsService.getLocations,
        staleTime: 1000 * 60 * 5,
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
    mutationKey: ATTENDANCE_WRITE_KEY,
    mutationFn: ({ id, data }: { id?: string; data: AttendanceUpsertDTO }) => {
      return id
        ? RehearsalsService.updateAttendance(id, data)
        : RehearsalsService.createAttendance(data);
    },
    onMutate: ({ id, data }) =>
      beginOptimistic(queryClient, (current) => {
        if (id) {
          return current.map((record) =>
            String(record.id) === String(id)
              ? {
                  ...record,
                  status: data.status,
                  minutes_late: data.minutes_late ?? null,
                  excuse_note: data.excuse_note ?? "",
                }
              : record,
          );
        }
        const optimistic: Attendance = {
          id: makeOptimisticId(),
          rehearsal: data.rehearsal,
          participation: data.participation,
          status: data.status,
          minutes_late: data.minutes_late ?? null,
          excuse_note: data.excuse_note ?? "",
        };
        return [...current, optimistic];
      }),
    onError: (_error, _variables, context) =>
      rollbackOptimistic(queryClient, context),
    onSettled: () => settleOptimistic(queryClient),
  });
};

export const useDeleteAttendanceRecord = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ATTENDANCE_WRITE_KEY,
    mutationFn: (id: string) => RehearsalsService.deleteAttendance(id),
    onMutate: (id) =>
      beginOptimistic(queryClient, (current) =>
        current.filter((record) => String(record.id) !== String(id)),
      ),
    onError: (_error, _variables, context) =>
      rollbackOptimistic(queryClient, context),
    onSettled: () => settleOptimistic(queryClient),
  });
};

export const useMarkMissingAttendancesPresent = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ATTENDANCE_WRITE_KEY,
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
    onMutate: (entries) =>
      beginOptimistic(queryClient, (current) => {
        const next = [...current];
        entries.forEach((entry) => {
          if (entry.attendanceId) {
            const index = next.findIndex(
              (record) => String(record.id) === String(entry.attendanceId),
            );
            if (index !== -1) {
              next[index] = {
                ...next[index],
                status: "PRESENT",
                minutes_late: null,
                excuse_note: "",
              };
              return;
            }
          }
          next.push({
            id: makeOptimisticId(),
            rehearsal: entry.rehearsalId,
            participation: entry.participationId,
            status: "PRESENT",
            minutes_late: null,
            excuse_note: "",
          });
        });
        return next;
      }),
    onError: (_error, _variables, context) =>
      rollbackOptimistic(queryClient, context),
    onSettled: () => settleOptimistic(queryClient),
  });
};
