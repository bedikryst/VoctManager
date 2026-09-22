/**
 * @file planWindow.ts
 * @description One phrasing of "which part of the evening is mine", shared by
 * every surface that states it: the rehearsal page, the timeline card and the
 * schedule's spotlight. The window itself is the server's — derived from the
 * plan against the reader's seat — and this only decides how to read it aloud,
 * so the three surfaces can never word the same evening differently.
 * @architecture Enterprise SaaS 2026
 * @module features/rehearsals/lib/planWindow
 */

import type { TFunction } from "i18next";

import type { RehearsalPlanWindow } from "@/shared/types";

/**
 * The window as a line of text, or null when there is nothing to say — no
 * plan, or a plan that spans the whole rehearsal, which the card's own hours
 * already state.
 *
 * `calls_me: false` is NOT silence: no row needs this voice, and saying so is
 * the point of the field. The call itself stands — attendance, the reminder
 * and the calendar all still count the seat — so the copy names the plan, not
 * the evening.
 */
export const planWindowLabel = (
  window: RehearsalPlanWindow | null | undefined,
  t: TFunction,
): string | null => {
  if (!window) return null;
  if (!window.calls_me) {
    return t(
      "schedule.rehearsal.plan.not_called",
      "Plan nie przewiduje Twojego głosu",
    );
  }
  if (!window.start) return null;
  return window.end
    ? t("schedule.rehearsal.plan.window_range", "{{start}}–{{end}}", {
        start: window.start,
        end: window.end,
      })
    : t("schedule.rehearsal.plan.window_open", "od {{start}}", {
        start: window.start,
      });
};

/** Whether the window says the plan skips this reader's voice entirely. */
export const planSkipsReader = (
  window: RehearsalPlanWindow | null | undefined,
): boolean => window !== null && window !== undefined && !window.calls_me;
