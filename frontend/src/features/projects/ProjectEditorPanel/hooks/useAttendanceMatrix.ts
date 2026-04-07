/**
 * @file useAttendanceMatrix.ts
 * @description Encapsulates optimistic mutations, matrix calculations, and
 * data caching strategies for the Attendance Matrix. Strictly uses Project domain queries
 * for data retrieval and services for write operations.
 * @architecture Enterprise SaaS 2026
 * @module panel/projects/ProjectEditorPanel/hooks/useAttendanceMatrix
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { Artist, Participation } from "../../../../shared/types";
import { queryKeys } from "../../../../shared/lib/queryKeys";
import { useProjectAttendances } from "../../api/project.queries";
import { ProjectService } from "../../api/project.service";
import { useProjectData } from "../../hooks/useProjectData";

export type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED" | null;

export interface AttendanceRecord {
  id: string | number;
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

export const useAttendanceMatrix = (projectId: string) => {
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

  const isLoading = isProjectDataLoading || isLoadingAttendances;
  const [attendances, setAttendances] = useState<AttendanceRecord[]>([]);
  const [mutatingCells, setMutatingCells] = useState<Set<string>>(new Set());

  useEffect(() => {
    setAttendances(fetchedAttendances as AttendanceRecord[]);
  }, [fetchedAttendances]);

  const projectRehearsals = useMemo(
    () =>
      [...rehearsals].sort(
        (left, right) =>
          new Date(left.date_time).getTime() -
          new Date(right.date_time).getTime(),
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
        ) as Artist,
      }))
      .filter((participation) => participation.artistData)
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
      rehearsalId: string | number,
      participationId: string | number,
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
      const attendanceQueryKey = queryKeys.attendances.byProject(projectId);

      const updateStateAndCache = (
        updater: (previous: AttendanceRecord[]) => AttendanceRecord[],
      ) => {
        setAttendances((previous) => {
          const nextState = updater(previous);
          queryClient.setQueryData(attendanceQueryKey, nextState);
          return nextState;
        });
      };

      updateStateAndCache((previous) => {
        const filtered = previous.filter(
          (attendance) =>
            !(
              String(attendance.rehearsal) === String(rehearsalId) &&
              String(attendance.participation) === String(participationId)
            ),
        );
        if (nextStatus === null) return filtered;
        return [
          ...filtered,
          {
            id: tempId,
            rehearsal: String(rehearsalId),
            participation: String(participationId),
            status: nextStatus,
          },
        ];
      });

      try {
        if (
          nextStatus === null &&
          currentRecord?.id &&
          !String(currentRecord.id).startsWith("temp")
        ) {
          await ProjectService.deleteAttendance(currentRecord.id);
        } else if (
          currentRecord?.id &&
          !String(currentRecord.id).startsWith("temp")
        ) {
          await ProjectService.updateAttendance(currentRecord.id, {
            status: nextStatus,
          });
        } else {
          const createdAttendance = await ProjectService.createAttendance({
            rehearsal: rehearsalId,
            participation: participationId,
            status: nextStatus,
          });
          updateStateAndCache((previous) =>
            previous.map((attendance) =>
              attendance.id === tempId
                ? { ...attendance, id: createdAttendance.id }
                : attendance,
            ),
          );
        }

        await Promise.all([
          queryClient.invalidateQueries({ queryKey: attendanceQueryKey }),
          queryClient.invalidateQueries({
            queryKey: queryKeys.rehearsals.byProject(projectId),
          }),
        ]);
      } catch {
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

        updateStateAndCache((previous) => {
          const filtered = previous.filter(
            (attendance) => attendance.id !== tempId,
          );
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
    [projectId, queryClient, t],
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
