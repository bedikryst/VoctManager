/**
 * @file project.score-marks.ts
 * @description Marks on copies of the concert binder that leave the app. Such a
 * copy always asks for the conductor's marks for the choir (`BOOK_COPY_LAYERS`):
 * the stored book is clean, because the stand draws every layer live over it.
 * On top of that, the reader's own pencil: whether the server has any of their
 * marks it could draw, and a blob fetcher that adds them when asked.
 *
 * The switch is deliberately per-viewer state rather than a saved preference.
 * The book with someone's private marks on it is a different document each time
 * it is asked for, so remembering "on" would quietly hand a singer a heavier
 * download every time they open the score to check a page number.
 * @module features/projects/api
 */

import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { RECONCILING_REFETCH } from "@/shared/api/queryPolicy";

import { projectKeys } from "./project.query-keys";
import { ProjectService, type ScoreMarkLayer } from "./project.service";

/**
 * What every copy of the binder that leaves the app carries: the conductor's
 * marks for the choir. Asked for by name, never implied — a surface that forgets
 * hands out a book without them, which shows, rather than one that draws them
 * twice. The server serves them only while the book's own switch is on.
 */
export const BOOK_COPY_LAYERS: readonly ScoreMarkLayer[] = ["shared"];

/** The reader's copy with their own pencil on it as well. */
const BOOK_COPY_WITH_PENCIL: readonly ScoreMarkLayer[] = [
  ...BOOK_COPY_LAYERS,
  "personal",
];

export interface ScoreMarksControl {
  /** The server has marks of this reader's that this book can carry. */
  available: boolean;
  /** How many of them would land — never shown as a badge, used for the label. */
  count: number;
  enabled: boolean;
  setEnabled: (next: boolean) => void;
  /**
   * Fetches the copy to keep: the conductor's marks, and the reader's own while
   * the switch is on.
   */
  fetchBlob: () => Promise<Blob>;
  /**
   * Append to the viewer's `docKey`. The composed book is different bytes under
   * the same URL, so without this the viewer would keep showing the copy it
   * cached before the switch was thrown.
   */
  docKeySuffix: string;
}

/**
 * Drives the "my marks" switch wherever the binder is opened. `enabled` is
 * ignored while nothing is available, so a surface may wire the fetcher without
 * first checking whether the switch will appear.
 */
export const useScoreMarks = (
  projectId: string | number | null | undefined,
  enabled = true,
): ScoreMarksControl => {
  const id = projectId == null ? "" : String(projectId);
  const [wanted, setWanted] = useState(false);

  const { data } = useQuery({
    queryKey: projectKeys.scorePackage.myMarks(id),
    queryFn: () => ProjectService.getScoreMarksAvailability(id),
    enabled: Boolean(id) && enabled,
    ...RECONCILING_REFETCH,
  });

  const available = data?.available ?? false;
  const active = available && wanted;

  const fetchBlob = useCallback(
    () =>
      ProjectService.fetchScorePdfBlob(
        id,
        active ? BOOK_COPY_WITH_PENCIL : BOOK_COPY_LAYERS,
      ),
    [id, active],
  );

  return useMemo(
    () => ({
      available,
      count: data?.count ?? 0,
      enabled: active,
      setEnabled: setWanted,
      fetchBlob,
      docKeySuffix: active ? "-marks" : "",
    }),
    [available, data?.count, active, fetchBlob],
  );
};

/**
 * The manager's own cue layer. The copy he pulls for the music desk carries it
 * on top of `BOOK_COPY_LAYERS`; asked on its own, it says whether he has any.
 */
export const CONDUCTOR_MARK_LAYERS: readonly ScoreMarkLayer[] = ["conductor"];

/**
 * Whether the conductor has cues of his own on this book — the one thing that
 * decides if the cockpit offers him a copy carrying them. A manager with no
 * private cues would otherwise get a button producing the choir's book under a
 * name that says otherwise.
 */
export const useConductorMarksAvailable = (
  projectId: string | number,
  enabled: boolean,
): boolean => {
  const id = String(projectId);
  const { data } = useQuery({
    queryKey: projectKeys.scorePackage.myMarks(id, "conductor"),
    queryFn: () =>
      ProjectService.getScoreMarksAvailability(id, CONDUCTOR_MARK_LAYERS),
    enabled: Boolean(id) && enabled,
    ...RECONCILING_REFETCH,
  });
  return data?.available ?? false;
};
