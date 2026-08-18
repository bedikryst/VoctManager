/**
 * @file ConcertDayPlan.tsx
 * @description The concert day as one axis, drawn for the chorister: the stored
 * run sheet with the call, the two typed windows and the downbeat merged into it
 * — the same list the producer's editor and the printed day card draw. Shared by
 * the spotlight and the event sheet, because a singer who reads the day twice
 * has to be reading it once.
 *
 * The caller keeps the heading, the empty state and any height cap: this owns the
 * drawing of the day and nothing around it.
 * @module features/schedule/components/ConcertDayPlan
 */

import React from "react";
import { useTranslation } from "react-i18next";

import { Text, Eyebrow } from "@/shared/ui/primitives/typography";
import { cn } from "@/shared/lib/utils";
import {
  isDayWindow,
  type DayTimelineEntry,
} from "../../projects/lib/dayTimeline";
import {
  DAY_WINDOW_UNTIL,
  getDayFixturePresentation,
} from "../../projects/lib/projectPresentation";
import type { ProjectEventKind } from "../../projects/constants/projectDomain";

/**
 * Whether the day carries a plan rather than only its frame. A project with a
 * call time and a downbeat and nothing between them has nothing planned, and the
 * caller's empty state is the honest answer — the two anchors cannot say that.
 */
export const hasConcertDayPlan = (
  entries: readonly DayTimelineEntry[],
): boolean =>
  entries.some((entry) => entry.kind === "point" || isDayWindow(entry));

interface ConcertDayPlanProps {
  entries: readonly DayTimelineEntry[];
  /** Names the downbeat row — a Mass says "Msza", not "Koncert". */
  eventKind: ProjectEventKind | undefined;
}

export const ConcertDayPlan = ({
  entries,
  eventKind,
}: ConcertDayPlanProps): React.JSX.Element => {
  const { t } = useTranslation();

  return (
    // The dots hang outside this box's padding — a caller capping the height
    // does it on a wrapper, or it clips them.
    <div className="relative ml-2 space-y-4 border-l border-ethereal-incense/20 pl-5">
      {entries.map((entry, index) => {
        const isPoint = entry.kind === "point";
        // A fixed moment is named here, in the reader's language; a typed point
        // carries whatever the producer wrote, which may be nothing at all.
        let rowTitle: string;
        if (entry.kind === "point") {
          rowTitle = entry.item.title;
        } else {
          const { labelKey, fallbackLabel } = getDayFixturePresentation(
            entry.kind,
            eventKind,
          );
          rowTitle = t(labelKey, fallbackLabel);
        }

        return (
          <div
            key={isPoint ? entry.item.id || `point-${index}` : entry.kind}
            className="group/run relative"
          >
            {/* Filled for a moment the producer set in a field, hollow for a
                typed point — the same distinction the editor and the printed
                card draw. */}
            <div
              className={cn(
                "absolute -left-6 top-1.5 h-2.5 w-2.5 rounded-full shadow-glass-solid transition-transform group-hover/run:scale-125",
                isPoint
                  ? "border-2 border-ethereal-gold bg-ethereal-ink"
                  : "bg-ethereal-gold",
              )}
              aria-hidden="true"
            />
            <Eyebrow
              as="span"
              color="gold"
              className="mb-1.5 inline-block self-start rounded border border-ethereal-gold/40 bg-ethereal-gold/15 px-2 py-0.5"
            >
              {isPoint ? entry.item.time : entry.time}
            </Eyebrow>
            <div className="rounded-xl border border-ethereal-incense/20 bg-ethereal-incense/10 p-3.5 transition-colors hover:bg-ethereal-incense/20">
              {rowTitle ? (
                <Text weight="bold" color="white">
                  {rowTitle}
                </Text>
              ) : (
                <Text
                  weight="medium"
                  color="parchment-muted"
                  className="italic text-ethereal-parchment/50"
                >
                  {t("schedule.card.run_sheet_untitled", "Punkt harmonogramu")}
                </Text>
              )}
              {isDayWindow(entry) && entry.endTime && (
                <Text
                  size="sm"
                  color="parchment-muted"
                  className="mt-1 leading-relaxed text-ethereal-parchment/80"
                >
                  {t(DAY_WINDOW_UNTIL.labelKey, DAY_WINDOW_UNTIL.fallbackLabel, {
                    time: entry.endTime,
                  })}
                </Text>
              )}
              {isPoint && entry.item.description && (
                <Text
                  size="sm"
                  color="parchment-muted"
                  className="mt-1 leading-relaxed text-ethereal-parchment/80"
                >
                  {entry.item.description}
                </Text>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
