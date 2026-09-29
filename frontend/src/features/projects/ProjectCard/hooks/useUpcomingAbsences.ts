/**
 * @file useUpcomingAbsences.ts
 * @description The project's reported absences at rehearsals still ahead,
 * grouped by rehearsal — read by every Overview surface that states an absence
 * figure, so the attention row, the rehearsal list beside it and the sheet the
 * row opens can never count differently.
 *
 * "Ahead" is an answer about now, so it reads a ticking clock, quantised to the
 * minute: the grouping recomputes once a minute rather than once per tick, and
 * a rehearsal that starts while the Overview is open leaves the figure without
 * a remount.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/ProjectCard/hooks/useUpcomingAbsences
 */

import { useMemo } from "react";

import { useNow } from "@/shared/lib/dom/useNow";
import {
  useProjectAttendances,
  useProjectParticipations,
  useProjectRehearsals,
} from "../../api/project.read.queries";
import {
  collectUpcomingAbsences,
  type RehearsalAbsences,
} from "../../lib/upcomingAbsences";

const MINUTE_MS = 60_000;

export const useUpcomingAbsences = (projectId: string): RehearsalAbsences[] => {
  const { data: rehearsals } = useProjectRehearsals(projectId);
  const { data: participations } = useProjectParticipations(projectId);
  const { data: attendances } = useProjectAttendances(projectId);

  const now = useNow(MINUTE_MS);
  const nowMs = Math.floor(now.getTime() / MINUTE_MS) * MINUTE_MS;

  return useMemo(
    () =>
      collectUpcomingAbsences({ rehearsals, attendances, participations, now: nowMs }),
    [rehearsals, attendances, participations, nowMs],
  );
};
