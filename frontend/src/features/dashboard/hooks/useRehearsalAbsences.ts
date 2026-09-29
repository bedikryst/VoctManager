/**
 * @file useRehearsalAbsences.ts
 * @description The reported absences for ONE rehearsal, by the rule the project
 * Overview counts with (`collectUpcomingAbsences`): a declined seat and a singer
 * the evening no longer calls are not absences. The dashboard banner states the
 * figure and opens the list from the same group, so "Nieobecni: 3" always opens
 * three names.
 *
 * The cut is the rehearsal's own start, not the clock. The banner keeps an
 * evening on screen while it is under way, and an absence reported for it is
 * still true then — a clock cut would drop the figure the moment the evening
 * began.
 *
 * Plain queries rather than the Overview's suspense hooks: the banner is one row
 * of the dashboard, so a slow or failed read leaves the figure out instead of
 * suspending the console or throwing it to an error boundary. The keys are the
 * Overview's, so a conductor who has opened the project reads from cache.
 * @module features/dashboard/hooks/useRehearsalAbsences
 */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { projectKeys } from "@/features/projects/api/project.queries";
import { ProjectService } from "@/features/projects/api/project.service";
import {
  FAST_CHANGING_STALE_TIME,
  PROJECT_RELATION_STALE_TIME,
} from "@/features/projects/api/project.query-utils";
import {
  collectUpcomingAbsences,
  type RehearsalAbsences,
} from "@/features/projects/lib/upcomingAbsences";
import { RECONCILING_REFETCH } from "@/shared/api/queryPolicy";
import type { Rehearsal } from "@/shared/types";

export const useRehearsalAbsences = (
  rehearsal: Rehearsal,
): RehearsalAbsences | null => {
  const projectId = String(rehearsal.project);

  const { data: participations } = useQuery({
    queryKey: projectKeys.participations.byProject(projectId),
    queryFn: () => ProjectService.getParticipationsByProject(projectId),
    ...RECONCILING_REFETCH,
    staleTime: PROJECT_RELATION_STALE_TIME,
  });

  const { data: attendances } = useQuery({
    queryKey: projectKeys.attendances.byProject(projectId),
    queryFn: () => ProjectService.getAttendancesByProject(projectId),
    ...RECONCILING_REFETCH,
    staleTime: FAST_CHANGING_STALE_TIME,
  });

  return useMemo(() => {
    if (!participations || !attendances) return null;
    const start = new Date(rehearsal.date_time).getTime();
    if (Number.isNaN(start)) return null;
    const [group] = collectUpcomingAbsences({
      rehearsals: [rehearsal],
      attendances,
      participations,
      now: start - 1,
    });
    return group ?? null;
  }, [rehearsal, participations, attendances]);
};
