/**
 * @file ConcertDayPlan.tsx
 * @description The plan as one axis, drawn for the chorister: the stored run
 * sheet with the call, the two typed windows and the downbeat merged into it
 * — the same list the producer's editor and the printed day card draw. Shared by
 * the spotlight and the event sheet, because a singer who reads the day twice
 * has to be reading it once.
 *
 * A row names a venue only when the point happens somewhere OTHER than the
 * event's — the coach departure, the lunch stop on the way — and then it is a
 * chip that opens the map, because that row exists precisely to send the reader
 * to an address the card's own venue line does not give them.
 *
 * A trip's plan heads each day with its date. A point only the travelling party
 * is due at carries a label, as on the printed sheet; for a singer who joins on
 * site it is also muted, under one line saying why. Muted, not hidden: knowing
 * where the group is has value, and two versions of one plan are two sources
 * of truth.
 *
 * The caller keeps the heading, the empty state and any height cap: this owns the
 * drawing of the day and nothing around it.
 * @module features/schedule/components/ConcertDayPlan
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { Luggage, MapPinHouse } from "lucide-react";

import { Text, Eyebrow, Caption } from "@/shared/ui/primitives/typography";
import { cn } from "@/shared/lib/utils";
import { LocationPreview } from "@/features/logistics/components/LocationPreview";
import { useLocationResolver } from "@/features/logistics/hooks/useLocationResolver";
import {
  groupDayTimeline,
  isDayWindow,
  isMultiDayTimeline,
  type DayTimelineEntry,
} from "../../projects/lib/dayTimeline";
import { usePlanDayLabel } from "../../projects/hooks/usePlanDayLabel";
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

/**
 * The plan's title on the singer's surfaces: a trip is titled as one, like the
 * printed sheet's section, so a traveller reading on Thursday knows the plan
 * does not start on concert day.
 */
export const concertDayPlanTitle = (
  entries: readonly DayTimelineEntry[],
): { readonly labelKey: string; readonly fallbackLabel: string } =>
  isMultiDayTimeline(entries)
    ? { labelKey: "schedule.card.trip_plan_title", fallbackLabel: "Plan wyjazdu" }
    : { labelKey: "schedule.card.run_sheet_title", fallbackLabel: "Harmonogram Dnia" };

interface ConcertDayPlanProps {
  entries: readonly DayTimelineEntry[];
  /** Names the downbeat row — a Mass says "Msza", not "Koncert". */
  eventKind: ProjectEventKind | undefined;
  /**
   * The event's own venue. A point that sits there says nothing about place —
   * the card already names the venue, and repeating it on every row buries the
   * one row that sends the reader somewhere else.
   */
  eventLocationId?: string | null;
  /** The concert's wall clock in the venue's zone, which dates each day. */
  concertTime: string;
  /** The reader comes straight to the venue instead of travelling. */
  joinsOnSite?: boolean;
}

export const ConcertDayPlan = ({
  entries,
  eventKind,
  eventLocationId,
  concertTime,
  joinsOnSite = false,
}: ConcertDayPlanProps): React.JSX.Element => {
  const { t } = useTranslation();
  const { resolveLocation } = useLocationResolver();
  const dayLabel = usePlanDayLabel(concertTime);

  const isMultiDay = isMultiDayTimeline(entries);
  const groups = isMultiDay
    ? groupDayTimeline(entries)
    : [{ dayOffset: 0, entries }];
  // The banner explains the muting, so it shows only where something is muted.
  const mutesTravel =
    joinsOnSite &&
    entries.some(
      (entry) => entry.kind === "point" && entry.item.travellers_only === true,
    );

  const renderEntry = (
    entry: DayTimelineEntry,
    index: number,
  ): React.JSX.Element => {
    const isPoint = entry.kind === "point";
    const isTravellersOnly = isPoint && entry.item.travellers_only === true;
    // Only a point can carry a place of its own, and only when it is not the
    // event's. An id the dictionary cannot resolve — a venue archived after
    // the day was planned — draws nothing rather than a chip reading
    // "unknown": the row's title and hour still stand on their own.
    const pointVenue =
      entry.kind === "point" &&
      entry.item.location_id &&
      entry.item.location_id !== eventLocationId
        ? resolveLocation(entry.item.location_id)
        : null;

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
        className={cn(
          "group/run relative",
          // The whole row, dot included: a joiner scanning for their own next
          // stop should be able to skip the group's without reading it.
          isTravellersOnly && joinsOnSite && "opacity-50",
        )}
      >
        {/* Filled for a moment the producer set in a field, hollow for a
            typed point — the same distinction the editor and the printed
            card draw. */}
        <div
          className={cn(
            "absolute -left-6 top-1.5 h-2.5 w-2.5 rounded-full shadow-glass-solid transition-transform group-hover/run:scale-125",
            isPoint
              ? "border-2 border-ethereal-gold bg-surface-inverse"
              : "bg-ethereal-gold",
          )}
          aria-hidden="true"
        />
        <div className="mb-1.5 flex flex-wrap items-center gap-2">
          <Eyebrow
            as="span"
            color="gold"
            className="inline-block rounded border border-ethereal-gold/40 bg-ethereal-gold/15 px-2 py-0.5"
          >
            {entry.kind === "point" ? entry.item.time : entry.time}
          </Eyebrow>
          {isTravellersOnly && (
            <Caption
              as="span"
              color="ink-on-inverse"
              className="inline-flex items-center gap-1"
            >
              <Luggage size={11} aria-hidden="true" />
              {t("projects.day_timeline.travellers_only", "dla jadących")}
            </Caption>
          )}
        </div>
        <div className="rounded-xl border border-ethereal-incense/20 bg-ethereal-incense/10 p-3.5 transition-colors hover:bg-ethereal-incense/20">
          {rowTitle ? (
            <Text weight="bold" color="ink-on-inverse">
              {rowTitle}
            </Text>
          ) : (
            <Text
              weight="medium"
              color="ink-on-inverse-muted"
              className="italic text-ink-on-inverse/50"
            >
              {t("schedule.card.run_sheet_untitled", "Punkt harmonogramu")}
            </Text>
          )}
          {isDayWindow(entry) && entry.endTime && (
            <Text
              size="sm"
              color="ink-on-inverse-muted"
              className="mt-1 leading-relaxed text-ink-on-inverse/80"
            >
              {t(DAY_WINDOW_UNTIL.labelKey, DAY_WINDOW_UNTIL.fallbackLabel, {
                time: entry.endTime,
              })}
            </Text>
          )}
          {entry.kind === "point" && entry.item.description && (
            <Text
              size="sm"
              color="ink-on-inverse-muted"
              className="mt-1 leading-relaxed text-ink-on-inverse/80"
            >
              {entry.item.description}
            </Text>
          )}
          {pointVenue && (
            // Its own line, because it is the reason this row is not at the
            // venue: a tap opens the map and the route from wherever the
            // singer is standing.
            <div className="mt-2 flex">
              <LocationPreview
                locationRef={pointVenue}
                variant="badge"
                className="max-w-full border-ethereal-gold/30 bg-ethereal-gold/10 text-ink-on-inverse"
              />
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {mutesTravel && (
        <Caption
          as="p"
          color="ink-on-inverse"
          className="flex items-start gap-1.5 rounded-xl border border-ethereal-gold/30 bg-ethereal-gold/10 px-3 py-2"
        >
          <MapPinHouse size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>
            {t(
              "schedule.card.joins_on_site_banner",
              "Dołączasz na miejscu — wyszarzone punkty dotyczą tylko jadących.",
            )}
          </span>
        </Caption>
      )}
      {groups.map((group, groupIndex) => (
        <div key={`day-${groupIndex}-${group.dayOffset}`} className="space-y-3">
          {isMultiDay && (
            <Eyebrow as="h4" color="ink-on-inverse" className="block">
              {dayLabel(group.dayOffset)}
            </Eyebrow>
          )}
          {/* The dots hang outside this box's padding — a caller capping the
              height does it on a wrapper, or it clips them. */}
          <div className="relative ml-2 space-y-4 border-l border-ethereal-incense/20 pl-5">
            {group.entries.map(renderEntry)}
          </div>
        </div>
      ))}
    </div>
  );
};
