/**
 * @file usePlanStartNote.ts
 * @description Names the moment a reader's plan starts, for the two places a
 * singer's card states it: the "Plan starts" chip beside the call, and the
 * first line of the entry "Add to calendar" books. Both read the facts the
 * server resolved for this reader's seat (`TimelineEvent.planStart`); nothing
 * here decides which moment that is.
 * @module features/schedule/hooks/usePlanStartNote
 */

import { useTranslation } from "react-i18next";

import type { Project } from "@/shared/types";
import { usePlanDayLabel } from "@/features/projects/hooks/usePlanDayLabel";
import { toWallClockInput } from "@/features/projects/lib/dayTimeline";
import { getDayFixturePresentation } from "@/features/projects/lib/projectPresentation";
import type { SchedulePlanStart } from "../types/schedule.dto";

export interface PlanStartNote {
  /** The day, only when the plan starts off concert day ("sob., 10.10"). */
  day: string | null;
  /** What happens then: the point's own title, or the window's name. */
  title: string | null;
}

/**
 * @param project the event's project; null for a rehearsal, whose plan never
 * starts before its own hour.
 */
export const usePlanStartNote = (
  planStart: SchedulePlanStart | null | undefined,
  project: Project | null,
): PlanStartNote | null => {
  const { t } = useTranslation();
  // The same day names the plan's own headings use, so the chip and the day
  // it points into cannot be dated two ways.
  const dayLabel = usePlanDayLabel(
    toWallClockInput(project?.date_time, project?.timezone),
  );

  if (!planStart || !project) return null;

  let title: string | null = planStart.title.trim() || null;
  if (planStart.window) {
    const window = getDayFixturePresentation(planStart.window, project.event_kind);
    title = t(window.labelKey, window.fallbackLabel);
  }

  return {
    day: planStart.dayOffset !== 0 ? dayLabel(planStart.dayOffset) : null,
    title,
  };
};
