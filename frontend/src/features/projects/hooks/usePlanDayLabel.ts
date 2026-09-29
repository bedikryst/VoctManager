/**
 * @file usePlanDayLabel.ts
 * @description Names a day of a project's plan — for the date heading over
 * each day of a trip, and for the day select a point or a window is placed
 * with. The weekday always leads, because it is what a singer packing on
 * Thursday actually checks. The short form ("sob., 10.10") fits a select and
 * a dense card; the long form ("sobota, 10 października") is for a heading
 * that divides the producer's own plan, where the words have the room.
 * The date is counted on the calendar from the concert's own wall-clock date
 * (`planDayDate`), never through an instant. Without a concert date yet — a
 * project being created — the day is named by its distance from the event.
 * @module features/projects/hooks/usePlanDayLabel
 */

import { useCallback } from "react";
import { useTranslation } from "react-i18next";

import { formatLocalizedDate } from "@/shared/lib/time/intl";
import { planDayDate } from "../lib/dayTimeline";

export type PlanDayLabelForm = "short" | "long";

const DAY_LABEL_FORMAT: Record<PlanDayLabelForm, Intl.DateTimeFormatOptions> = {
  short: { weekday: "short", day: "numeric", month: "numeric" },
  long: { weekday: "long", day: "numeric", month: "long" },
};

/**
 * @param concertTime the concert's `yyyy-MM-ddTHH:mm` wall clock in the
 * project's zone — the form's live value, or `toWallClockInput` of a stored one.
 */
export const usePlanDayLabel = (
  concertTime: string | null | undefined,
): ((dayOffset: number, form?: PlanDayLabelForm) => string) => {
  const { t, i18n } = useTranslation();

  return useCallback(
    (dayOffset: number, form: PlanDayLabelForm = "short"): string => {
      const date = planDayDate(concertTime, dayOffset);

      if (date) {
        return formatLocalizedDate(
          date,
          DAY_LABEL_FORMAT[form],
          i18n.language,
          // A calendar index at UTC midnight: formatted in any other zone it
          // prints the day before west of Greenwich.
          "UTC",
        );
      }

      if (dayOffset === 0) {
        return t("projects.plan_day.event_day", "Dzień wydarzenia");
      }

      return dayOffset < 0
        ? t("projects.plan_day.before", {
            count: -dayOffset,
            defaultValue: "{{count}} dni wcześniej",
          })
        : t("projects.plan_day.after", {
            count: dayOffset,
            defaultValue: "{{count}} dni później",
          });
    },
    [concertTime, i18n.language, t],
  );
};
