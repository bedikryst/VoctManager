/**
 * @file useAttendanceMatrix.ts
 * @description Deferred-persistence controller for the Attendance Matrix. Clicking a cell
 * only cycles a LOCAL draft (instant — no per-click round-trip, so a director can rattle
 * through a column without lag); the diff against the server baseline is flushed in one
 * batch on explicit Save through the shared EditorActionBar. Discard restores the baseline.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/editors/hooks/useAttendanceMatrix
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { toastApiError } from "@/shared/api/errors";
import type { Artist, Attendance, Participation, Rehearsal } from "@/shared/types";
import { compareProjectDateAsc } from "../../lib/projectPresentation";
import {
  projectKeys,
  useCreateAttendance,
  useDeleteAttendance,
  useProjectArtistsDictionary,
  useProjectAttendances,
  useProjectParticipations,
  useProjectRehearsals,
  useUpdateAttendance,
} from "../../api/project.queries";

export type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED" | null;

const EMPTY_ARTISTS: Artist[] = [];
const EMPTY_ATTENDANCES: Attendance[] = [];
const EMPTY_PARTICIPATIONS: Participation[] = [];
const EMPTY_REHEARSALS: Rehearsal[] = [];

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

const cellKeyOf = (rehearsalId: string, participationId: string): string =>
  `${rehearsalId}-${participationId}`;

export interface PendingCounts {
  creates: number;
  updates: number;
  deletes: number;
  total: number;
}

export interface UseAttendanceMatrixResult {
  projectRehearsals: Rehearsal[];
  enrichedParticipations: EnrichedParticipation[];
  attendanceMap: Map<string, AttendanceRecord>;
  dirtyCells: Set<string>;
  isDirty: boolean;
  isSaving: boolean;
  pendingCounts: PendingCounts;
  cycleCell: (
    rehearsalId: string,
    participationId: string,
    currentRecord: AttendanceRecord | undefined,
  ) => void;
  saveChanges: () => Promise<void>;
  discardChanges: () => void;
}

export const useAttendanceMatrix = (
  projectId: string,
  onDirtyStateChange?: (isDirty: boolean) => void,
): UseAttendanceMatrixResult => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const rehearsalsQuery = useProjectRehearsals(projectId);
  const participationsQuery = useProjectParticipations(projectId);
  const artistsQuery = useProjectArtistsDictionary();
  const fetchedAttendancesQuery = useProjectAttendances(projectId);
  const rehearsals = rehearsalsQuery.data ?? EMPTY_REHEARSALS;
  const participations = participationsQuery.data ?? EMPTY_PARTICIPATIONS;
  const artists = artistsQuery.data ?? EMPTY_ARTISTS;
  const fetchedAttendances = fetchedAttendancesQuery.data ?? EMPTY_ATTENDANCES;

  const createMutation = useCreateAttendance(projectId);
  const updateMutation = useUpdateAttendance(projectId);
  const deleteMutation = useDeleteAttendance(projectId);

  const [attendances, setAttendances] = useState<AttendanceRecord[]>([]);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Re-seed the local draft from the server whenever the saved baseline changes
  // (initial load + after a successful Save invalidates the query).
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

  const enrichedParticipations = useMemo<EnrichedParticipation[]>(
    () =>
      participations
        .map((participation) => ({
          ...participation,
          artistData: artists.find(
            (artist) => String(artist.id) === String(participation.artist),
          ),
        }))
        .filter(
          (participation): participation is EnrichedParticipation =>
            participation.artistData !== undefined,
        )
        .sort((left, right) =>
          left.artistData.last_name.localeCompare(right.artistData.last_name),
        ),
    [artists, participations],
  );

  const attendanceMap = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    attendances.forEach((attendance) => {
      map.set(cellKeyOf(attendance.rehearsal, attendance.participation), attendance);
    });
    return map;
  }, [attendances]);

  // Diff the local draft against the server baseline. Compared by cell, never by
  // string-splitting the composite key (ids may contain hyphens).
  const diff = useMemo(() => {
    const originalMap = new Map<string, { id: string; status: AttendanceStatus }>();
    fetchedAttendances.forEach((attendance) => {
      originalMap.set(
        cellKeyOf(String(attendance.rehearsal), String(attendance.participation)),
        { id: String(attendance.id), status: attendance.status },
      );
    });

    const creates: {
      rehearsal: string;
      participation: string;
      status: NonNullable<AttendanceStatus>;
    }[] = [];
    const updates: { id: string; status: NonNullable<AttendanceStatus> }[] = [];
    const dirtyCells = new Set<string>();
    const seen = new Set<string>();

    attendances.forEach((record) => {
      if (record.status === null) return;
      const key = cellKeyOf(record.rehearsal, record.participation);
      seen.add(key);
      const original = originalMap.get(key);
      if (!original) {
        creates.push({
          rehearsal: record.rehearsal,
          participation: record.participation,
          status: record.status,
        });
        dirtyCells.add(key);
      } else if (original.status !== record.status) {
        updates.push({ id: original.id, status: record.status });
        dirtyCells.add(key);
      }
    });

    const deletes: string[] = [];
    originalMap.forEach((original, key) => {
      if (!seen.has(key)) {
        deletes.push(original.id);
        dirtyCells.add(key);
      }
    });

    return { creates, updates, deletes, dirtyCells };
  }, [attendances, fetchedAttendances]);

  const pendingCounts = useMemo<PendingCounts>(
    () => ({
      creates: diff.creates.length,
      updates: diff.updates.length,
      deletes: diff.deletes.length,
      total: diff.creates.length + diff.updates.length + diff.deletes.length,
    }),
    [diff],
  );

  const isDirty = pendingCounts.total > 0;

  useEffect(() => {
    onDirtyStateChange?.(isDirty);
  }, [isDirty, onDirtyStateChange]);

  const cycleCell = useCallback(
    (
      rehearsalId: string,
      participationId: string,
      currentRecord: AttendanceRecord | undefined,
    ): void => {
      const currentStatus = currentRecord?.status ?? null;
      const currentIndex = STATUS_CYCLE.indexOf(currentStatus);
      const nextStatus = STATUS_CYCLE[(currentIndex + 1) % STATUS_CYCLE.length];

      setAttendances((previous) => {
        const filtered = previous.filter(
          (attendance) =>
            !(
              attendance.rehearsal === rehearsalId &&
              attendance.participation === participationId
            ),
        );

        if (nextStatus === null) {
          return filtered;
        }

        return [
          ...filtered,
          {
            id: currentRecord?.id ?? `local-${cellKeyOf(rehearsalId, participationId)}`,
            rehearsal: rehearsalId,
            participation: participationId,
            status: nextStatus,
          },
        ];
      });
    },
    [],
  );

  const discardChanges = useCallback(() => {
    setAttendances(fetchedAttendances.map(toAttendanceRecord));
  }, [fetchedAttendances]);

  const saveChanges = useCallback(async (): Promise<void> => {
    if (
      diff.creates.length === 0 &&
      diff.updates.length === 0 &&
      diff.deletes.length === 0
    ) {
      return;
    }

    setIsSaving(true);
    const toastId = toast.loading(
      t("projects.matrix.toast.saving", "Zapisywanie frekwencji..."),
    );

    try {
      await Promise.all([
        ...diff.creates.map((create) =>
          createMutation.mutateAsync({
            rehearsal: create.rehearsal,
            participation: create.participation,
            status: create.status,
          }),
        ),
        ...diff.updates.map((update) =>
          updateMutation.mutateAsync({
            id: update.id,
            data: { status: update.status },
          }),
        ),
        ...diff.deletes.map((id) => deleteMutation.mutateAsync(id)),
      ]);

      await queryClient.invalidateQueries({
        queryKey: projectKeys.attendances.byProject(projectId),
      });
      await queryClient.invalidateQueries({
        queryKey: projectKeys.rehearsals.byProject(projectId),
      });

      toast.success(
        t("projects.matrix.toast.save_success", "Zapisano frekwencję"),
        { id: toastId },
      );
    } catch (error) {
      toastApiError(error, t, {
        id: toastId,
        fallbackDescription: t(
          "projects.matrix.toast.save_error_desc",
          "Sprawdź połączenie i spróbuj ponownie.",
        ),
      });
      // Re-pull the authoritative state so the draft can't drift from the server.
      await queryClient.invalidateQueries({
        queryKey: projectKeys.attendances.byProject(projectId),
      });
    } finally {
      setIsSaving(false);
    }
  }, [
    createMutation,
    deleteMutation,
    diff,
    projectId,
    queryClient,
    t,
    updateMutation,
  ]);

  return {
    projectRehearsals,
    enrichedParticipations,
    attendanceMap,
    dirtyCells: diff.dirtyCells,
    isDirty,
    isSaving,
    pendingCounts,
    cycleCell,
    saveChanges,
    discardChanges,
  };
};
