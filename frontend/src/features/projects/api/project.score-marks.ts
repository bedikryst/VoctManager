/**
 * @file project.score-marks.ts
 * @description The reader's own pencil on the concert binder: whether the server
 * has any of their marks it could draw, and — when they ask for them — a blob
 * fetcher that requests the composed copy instead of the stored one.
 *
 * The switch is deliberately per-viewer state rather than a saved preference.
 * The book with someone's private marks on it is a different document each time
 * it is asked for, so remembering "on" would quietly hand a singer a heavier
 * download every time they open the score to check a page number.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/api
 */

import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { RECONCILING_REFETCH } from "@/shared/api/queryPolicy";

import { projectKeys } from "./project.query-keys";
import { ProjectService } from "./project.service";

export interface ScoreMarksControl {
  /** The server has marks of this reader's that this book can carry. */
  available: boolean;
  /** How many of them would land — never shown as a badge, used for the label. */
  count: number;
  enabled: boolean;
  setEnabled: (next: boolean) => void;
  /** Fetches the binder in whichever state the switch is currently in. */
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
    () => ProjectService.fetchScorePdfBlob(id, active),
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

/** The layers a manager may pull into a copy of his own. */
export const CONDUCTOR_MARK_LAYERS = ["conductor"] as const;

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
