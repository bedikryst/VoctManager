/**
 * @file useAttendanceMatrix.ts
 * @description Deferred-persistence controller for the attendance grid. A click
 * writes only to a local OVERLAY over the server state — instant, no per-click
 * round-trip, so a conductor can rattle down a column — and the diff is flushed
 * on explicit Save through the shared EditorActionBar.
 *
 * The overlay is the point. The previous version re-seeded a full local copy
 * from the query on every change of its data reference, and attendance is
 * fetched with `RECONCILING_REFETCH`: alt-tabbing away and back mid-roll-call
 * silently discarded every unsaved mark. An overlay holds only the cells that
 * were touched, so a background refetch updates the untouched ones underneath
 * and cannot destroy work — and after a partial save the flushed cells simply
 * stop differing from the server and drop out of the diff on their own.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/editors/hooks/useAttendanceMatrix
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { toastApiError } from "@/shared/api/errors";
import type { Artist, Attendance, Participation, Rehearsal } from "@/shared/types";
import { getLocationLabel } from "../../lib/projectPresentation";
import {
  buildRoster,
  buildSessions,
  cellKeyOf,
  filterRoster,
  indexAttendances,
  isCalled,
  stepMark,
  tallyMarks,
  type AttendanceMark,
  type MarkTally,
  type MatrixSection,
  type MatrixSession,
} from "../../lib/attendanceMatrix";
import { ProjectService } from "../../api/project.service";
import {
  projectKeys,
  useProjectArtistsDictionary,
  useProjectAttendances,
  useProjectParticipations,
  useProjectRehearsals,
} from "../../api/project.queries";

const EMPTY_ARTISTS: Artist[] = [];
const EMPTY_ATTENDANCES: Attendance[] = [];
const EMPTY_PARTICIPATIONS: Participation[] = [];
const EMPTY_REHEARSALS: Rehearsal[] = [];

/** Above this many singers the roster needs a search field to stay usable. */
export const ROSTER_SEARCH_THRESHOLD = 8;

/**
 * A whole column can be filled in one gesture, so a save is no longer bounded
 * by how fast someone can click. Requests go out in small waves rather than as
 * one 44-wide burst that would occupy every gunicorn worker at once.
 */
const SAVE_CHUNK_SIZE = 6;

const runChunked = async <T>(
  items: readonly T[],
  run: (item: T) => Promise<unknown>,
): Promise<void> => {
  for (let index = 0; index < items.length; index += SAVE_CHUNK_SIZE) {
    await Promise.all(items.slice(index, index + SAVE_CHUNK_SIZE).map(run));
  }
};

interface DraftCell {
  readonly rehearsalId: string;
  readonly participationId: string;
  readonly mark: AttendanceMark;
}

/**
 * A drafted cell WINS even when its mark is `null` — "the conductor cleared
 * this" and "nothing was ever recorded here" are the same value but not the
 * same fact. Reaching for it with `draft.get(key)?.mark ?? server` collapses
 * the two and makes a cleared cell resume its saved status: the next click on
 * it would skip a step of the cycle, and a column fill would step over it.
 */
const resolveMark = (
  draft: ReadonlyMap<string, DraftCell>,
  serverMarks: ReadonlyMap<string, { status: AttendanceMark }>,
  key: string,
): AttendanceMark => {
  const drafted = draft.get(key);
  if (drafted) return drafted.mark;
  return serverMarks.get(key)?.status ?? null;
};

export interface UseAttendanceMatrixResult {
  readonly sessions: readonly MatrixSession[];
  /** Roster after the search filter; `rosterSize` is the unfiltered headcount. */
  readonly sections: readonly MatrixSection[];
  readonly rosterSize: number;
  readonly query: string;
  readonly setQuery: (value: string) => void;
  readonly isFiltered: boolean;

  readonly markOf: (rehearsalId: string, participationId: string) => AttendanceMark;
  readonly isDirtyCell: (rehearsalId: string, participationId: string) => boolean;

  readonly sessionTally: ReadonlyMap<string, MarkTally>;
  readonly singerTally: ReadonlyMap<string, MarkTally>;
  readonly overall: MarkTally;

  readonly cycleCell: (
    rehearsalId: string,
    participationId: string,
    direction: 1 | -1,
  ) => void;
  /** Fill a past session's still-blank seats with PRESENT; never overwrites a mark. */
  readonly markSessionPresent: (rehearsalId: string) => void;

  readonly pendingCount: number;
  readonly isDirty: boolean;
  readonly isSaving: boolean;
  readonly saveChanges: () => Promise<void>;
  readonly discardChanges: () => void;
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
  const attendancesQuery = useProjectAttendances(projectId);

  const rehearsals = rehearsalsQuery.data ?? EMPTY_REHEARSALS;
  const participations = participationsQuery.data ?? EMPTY_PARTICIPATIONS;
  const artists = artistsQuery.data ?? EMPTY_ARTISTS;
  const attendances = attendancesQuery.data ?? EMPTY_ATTENDANCES;

  const [draft, setDraft] = useState<ReadonlyMap<string, DraftCell>>(new Map());
  const [query, setQuery] = useState<string>("");
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const sessions = useMemo(
    () => buildSessions(rehearsals, (rehearsal) => getLocationLabel(rehearsal.location)),
    [rehearsals],
  );

  const artistById = useMemo(
    () => new Map(artists.map((artist) => [String(artist.id), artist])),
    [artists],
  );

  const roster = useMemo(
    () =>
      buildRoster({
        participations,
        artistById,
        unknownName: t("projects.matrix.unknown_member", "Nieznany członek"),
      }),
    [artistById, participations, t],
  );

  const sections = useMemo(() => filterRoster(roster, query), [roster, query]);

  const rosterSize = useMemo(
    () => roster.reduce((total, section) => total + section.singers.length, 0),
    [roster],
  );

  const serverMarks = useMemo(() => indexAttendances(attendances), [attendances]);

  const markOf = useCallback(
    (rehearsalId: string, participationId: string): AttendanceMark =>
      resolveMark(draft, serverMarks, cellKeyOf(rehearsalId, participationId)),
    [draft, serverMarks],
  );

  /** Only the cells that actually differ — a re-click back to the saved value is not a change. */
  const dirtyKeys = useMemo(() => {
    const keys = new Set<string>();
    draft.forEach((cell, key) => {
      const saved = serverMarks.get(key)?.status ?? null;
      if (saved !== cell.mark) keys.add(key);
    });
    return keys;
  }, [draft, serverMarks]);

  const isDirtyCell = useCallback(
    (rehearsalId: string, participationId: string): boolean =>
      dirtyKeys.has(cellKeyOf(rehearsalId, participationId)),
    [dirtyKeys],
  );

  const pendingCount = dirtyKeys.size;
  const isDirty = pendingCount > 0;

  useEffect(() => {
    onDirtyStateChange?.(isDirty);
  }, [isDirty, onDirtyStateChange]);

  /* ── Aggregates ─────────────────────────────────────────────────────────
   * Per session: over that session's summoned seats, past or not — a column
   * with nothing recorded simply has no rate. Per singer and overall: past
   * sessions ONLY, because a planned rehearsal cannot be missing its entries
   * and counting it would report a shortfall against work nobody could do yet.
   */

  const allSingers = useMemo(
    () => roster.flatMap((section) => section.singers),
    [roster],
  );

  const sessionTally = useMemo(() => {
    const tallies = new Map<string, MarkTally>();
    sessions.forEach((session) => {
      const marks = allSingers
        .filter((singer) => isCalled(session, singer.participationId))
        .map((singer) => markOf(session.rehearsalId, singer.participationId));
      tallies.set(session.rehearsalId, tallyMarks(marks));
    });
    return tallies;
  }, [allSingers, markOf, sessions]);

  const pastSessions = useMemo(
    () => sessions.filter((session) => session.isPast),
    [sessions],
  );

  const singerTally = useMemo(() => {
    const tallies = new Map<string, MarkTally>();
    allSingers.forEach((singer) => {
      const marks = pastSessions
        .filter((session) => isCalled(session, singer.participationId))
        .map((session) => markOf(session.rehearsalId, singer.participationId));
      tallies.set(singer.participationId, tallyMarks(marks));
    });
    return tallies;
  }, [allSingers, markOf, pastSessions]);

  const overall = useMemo(() => {
    const marks: AttendanceMark[] = [];
    pastSessions.forEach((session) => {
      allSingers.forEach((singer) => {
        if (!isCalled(session, singer.participationId)) return;
        marks.push(markOf(session.rehearsalId, singer.participationId));
      });
    });
    return tallyMarks(marks);
  }, [allSingers, markOf, pastSessions]);

  /* ── Editing ────────────────────────────────────────────────────────────── */

  const cycleCell = useCallback(
    (rehearsalId: string, participationId: string, direction: 1 | -1): void => {
      const key = cellKeyOf(rehearsalId, participationId);
      setDraft((previous) => {
        const next = new Map(previous);
        next.set(key, {
          rehearsalId,
          participationId,
          mark: stepMark(resolveMark(previous, serverMarks, key), direction),
        });
        return next;
      });
    },
    [serverMarks],
  );

  const markSessionPresent = useCallback(
    (rehearsalId: string): void => {
      const session = sessions.find(
        (candidate) => candidate.rehearsalId === rehearsalId,
      );
      if (!session) return;

      setDraft((previous) => {
        const next = new Map(previous);
        allSingers.forEach((singer) => {
          if (!isCalled(session, singer.participationId)) return;
          const key = cellKeyOf(rehearsalId, singer.participationId);
          if (resolveMark(previous, serverMarks, key) !== null) return;
          next.set(key, {
            rehearsalId,
            participationId: singer.participationId,
            mark: "PRESENT",
          });
        });
        return next;
      });
    },
    [allSingers, serverMarks, sessions],
  );

  const discardChanges = useCallback(() => {
    setDraft(new Map());
  }, []);

  const saveChanges = useCallback(async (): Promise<void> => {
    if (dirtyKeys.size === 0) return;

    // `record_attendance` upserts on (rehearsal, participation), so a create and
    // an edit are the same POST; only a cleared cell needs its row deleting.
    const writes: DraftCell[] = [];
    const deletions: string[] = [];
    const flushed = new Map<string, DraftCell>();

    dirtyKeys.forEach((key) => {
      const cell = draft.get(key);
      if (!cell) return;
      flushed.set(key, cell);
      if (cell.mark === null) {
        const saved = serverMarks.get(key);
        if (saved) deletions.push(saved.id);
        return;
      }
      writes.push(cell);
    });

    setIsSaving(true);
    const toastId = toast.loading(
      t("projects.matrix.toast.saving", "Zapisywanie frekwencji…"),
    );

    try {
      // Written through the service rather than the per-row mutations: those
      // invalidate twice each on settle, which for a filled column meant ~90
      // refetches for one save.
      await runChunked(writes, (cell) =>
        ProjectService.createAttendance({
          rehearsal: cell.rehearsalId,
          participation: cell.participationId,
          status: cell.mark as NonNullable<AttendanceMark>,
        }),
      );
      await runChunked(deletions, (id) => ProjectService.deleteAttendance(id));

      await queryClient.invalidateQueries({
        queryKey: projectKeys.attendances.byProject(projectId),
      });
      await queryClient.invalidateQueries({
        queryKey: projectKeys.rehearsals.byProject(projectId),
      });

      // Retired only once the refetch has landed — dropping the overlay earlier
      // would flash every cell back to its pre-save value for the length of the
      // trip — and only cell by cell, by identity: the grid stays live during a
      // save, and a mark made while it was in flight is not one of the ones
      // that just went out.
      setDraft((previous) => {
        const next = new Map(previous);
        flushed.forEach((cell, key) => {
          if (previous.get(key) === cell) next.delete(key);
        });
        return next;
      });

      toast.success(t("projects.matrix.toast.save_success", "Zapisano frekwencję"), {
        id: toastId,
      });
    } catch (error) {
      toastApiError(error, t, {
        id: toastId,
        fallbackDescription: t(
          "projects.matrix.toast.save_error_desc",
          "Sprawdź połączenie i spróbuj ponownie.",
        ),
      });
      // Re-pull the authoritative state. Whatever did get through stops
      // differing from the server and leaves the diff by itself; the rest stays
      // in the overlay, so a retry is one more click on Save.
      await queryClient.invalidateQueries({
        queryKey: projectKeys.attendances.byProject(projectId),
      });
    } finally {
      setIsSaving(false);
    }
  }, [dirtyKeys, draft, projectId, queryClient, serverMarks, t]);

  return {
    sessions,
    sections,
    rosterSize,
    query,
    setQuery,
    isFiltered: query.trim().length > 0,
    markOf,
    isDirtyCell,
    sessionTally,
    singerTally,
    overall,
    cycleCell,
    markSessionPresent,
    pendingCount,
    isDirty,
    isSaving,
    saveChanges,
    discardChanges,
  };
};
