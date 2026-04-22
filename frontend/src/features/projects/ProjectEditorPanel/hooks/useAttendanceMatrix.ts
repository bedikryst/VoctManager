/**
 * @file useAttendanceMatrix.ts
 * @description Encapsulates optimistic mutations, matrix calculations, and
 * data caching strategies for the Attendance Matrix. Strictly uses React Query mutations.
 * @architecture Enterprise SaaS 2026
 * @module panel/projects/ProjectEditorPanel/hooks/useAttendanceMatrix
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { Artist, Attendance, Participation } from "@/shared/types";
import { compareProjectDateAsc } from "../../lib/projectPresentation";
import {
  projectKeys,
  useProjectAttendances,
  useCreateAttendance,
  useUpdateAttendance,
  useDeleteAttendance,
} from "../../api/project.queries";
import { useProjectData } from "../../hooks/useProjectData";

export type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED" | null;

export interface AttendanceRecord {
  id: string;
  rehearsal: string;
  participation: string;
  status: AttendanceStatus;
}

export interface EnrichedParticipation extends Participation {
  artistData: Artist;
}

export const STATUS_CYCLE: AttendanceStatus[] = [
  null,
  "PRESENT",
  "ABSENT",
  "LATE",
  "EXCUSED",
];

const toAttendanceRecord = (attendance: Attendance): AttendanceRecord => ({
  id: String(attendance.id),
  rehearsal: String(attendance.rehearsal),
  participation: String(attendance.participation),
  status: attendance.status,
});

export interface UseAttendanceMatrixResult {
  isLoading: boolean;
  projectRehearsals: import("@/shared/types").Rehearsal[];
  enrichedParticipations: EnrichedParticipation[];
  attendanceMap: Map<string, AttendanceRecord>;
  mutatingCells: Set<string>;
  handleToggleStatus: (
    rehearsalId: string,
    participationId: string,
    currentRecord: AttendanceRecord | undefined,
  ) => Promise<void>;
}

export const useAttendanceMatrix = (
  projectId: string,
): UseAttendanceMatrixResult => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const {
    rehearsals,
    participations,
    artists,
    isLoading: isProjectDataLoading,
  } = useProjectData(projectId);
  const { data: fetchedAttendances = [], isLoading: isLoadingAttendances } =
    useProjectAttendances(projectId);

  const createMutation = useCreateAttendance(projectId);
  const updateMutation = useUpdateAttendance(projectId);
  const deleteMutation = useDeleteAttendance(projectId);

  const isLoading = isProjectDataLoading || isLoadingAttendances;
  const [attendances, setAttendances] = useState<AttendanceRecord[]>([]);
  const [mutatingCells, setMutatingCells] = useState<Set<string>>(new Set());

  useEffect(() => {
    setAttendances(fetchedAttendances.map(toAttendanceRecord));
  }, [fetchedAttendances]);

  const projectRehearsals = useMemo(
    () =>
      [...rehearsals].sort((left, right) =>
        compareProjectDateAsc(left.date_time, right.date_time),
      ),
    [rehearsals],
  );

  const enrichedParticipations = useMemo<EnrichedParticipation[]>(() => {
    if (!artists || artists.length === 0) return [];

    return participations
      .map((participation) => ({
        ...participation,
        artistData: artists.find(
          (artist) => String(artist.id) === String(participation.artist),
        ),
      }))
      .filter((p): p is EnrichedParticipation => p.artistData !== undefined)
      .sort((left, right) =>
        left.artistData.last_name.localeCompare(right.artistData.last_name),
      );
  }, [participations, artists]);

  const attendanceMap = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    attendances.forEach((attendance) =>
      map.set(
        `${attendance.rehearsal}-${attendance.participation}`,
        attendance,
      ),
    );
    return map;
  }, [attendances]);

  const handleToggleStatus = useCallback(
    async (
      rehearsalId: string,
      participationId: string,
      currentRecord: AttendanceRecord | undefined,
    ) => {
      const cellKey = `${rehearsalId}-${participationId}`;

      setMutatingCells((previous) => {
        if (previous.has(cellKey)) return previous;
        const next = new Set(previous);
        next.add(cellKey);
        return next;
      });

      const currentStatus = currentRecord?.status || null;
      const currentIndex = STATUS_CYCLE.indexOf(currentStatus);
      const nextStatus = STATUS_CYCLE[(currentIndex + 1) % STATUS_CYCLE.length];

      const tempId = currentRecord?.id || `temp-${Date.now()}`;
      const attendanceQueryKey = projectKeys.attendances.byProject(projectId);

      const updateStateAndCache = (
        updater: (previous: AttendanceRecord[]) => AttendanceRecord[],
      ) => {
        setAttendances((previous) => {
          const nextState = updater(previous);
          queryClient.setQueryData(attendanceQueryKey, nextState);
          return nextState;
        });
      };

      // OPTIMISTIC UPDATE
      updateStateAndCache((previous) => {
        const filtered = previous.filter(
          (a) =>
            !(
              a.rehearsal === rehearsalId && a.participation === participationId
            ),
        );
        if (nextStatus === null) return filtered;
        return [
          ...filtered,
          {
            id: tempId,
            rehearsal: rehearsalId,
            participation: participationId,
            status: nextStatus,
          },
        ];
      });

      try {
        if (
          nextStatus === null &&
          currentRecord?.id &&
          !currentRecord.id.startsWith("temp")
        ) {
          await deleteMutation.mutateAsync(currentRecord.id);
        } else if (currentRecord?.id && !currentRecord.id.startsWith("temp")) {
          await updateMutation.mutateAsync({
            id: currentRecord.id,
            data: { status: nextStatus },
          });
        } else {
          const createdAttendance = await createMutation.mutateAsync({
            rehearsal: rehearsalId,
            participation: participationId,
            status: nextStatus,
          });
          updateStateAndCache((previous) =>
            previous.map((a) =>
              a.id === tempId ? { ...a, id: String(createdAttendance.id) } : a,
            ),
          );
        }

        await queryClient.invalidateQueries({
          queryKey: projectKeys.rehearsals.byProject(projectId),
        });
      } catch (error: unknown) {
        toast.error(
          t(
            "projects.matrix.toast.save_error",
            "Nie udało się zapisać zmiany.",
          ),
          {
            description: t(
              "projects.matrix.toast.save_error_desc",
              "Sprawdź połączenie i spróbuj ponownie.",
            ),
          },
        );

        // ROLLBACK STATE ON ERROR
        updateStateAndCache((previous) => {
          const filtered = previous.filter((a) => a.id !== tempId);
          return currentRecord ? [...filtered, currentRecord] : filtered;
        });
      } finally {
        setMutatingCells((previous) => {
          const next = new Set(previous);
          next.delete(cellKey);
          return next;
        });
      }
    },
    [projectId, queryClient, t, createMutation, updateMutation, deleteMutation],
  );

  return {
    isLoading,
    projectRehearsals,
    enrichedParticipations,
    attendanceMap,
    mutatingCells,
    handleToggleStatus,
  };
};
