/**
 * @file CalendarGrid.tsx
 * @description The month view the date field opens: six fixed weeks, a heading
 * that doubles as the way out to a month-and-year board, and a dot under any day
 * the caller has marked. The board matters more than it looks — a concert booked
 * eight months out is one click away instead of eight, which is the single
 * reason a month grid usually loses to typing a date by hand.
 * @architecture Enterprise SaaS 2026
 * @module shared/ui/composites/DateTimeField
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Locale } from "date-fns";

import { cn } from "@/shared/lib/utils";
import { Eyebrow, Text } from "@/shared/ui/primitives/typography";
import {
  buildMonthGrid,
  buildWeekdayLabels,
  formatDayLabel,
  formatMonthHeading,
  formatMonthName,
  fromFloatingDate,
  isSameCalendarDate,
  shiftMonth,
  toDateKey,
  toFloatingDate,
  todayCalendarDate,
  type CalendarDate,
} from "./wallClock";

export type CalendarMarkerTone = "gold" | "sage" | "amethyst";

export interface CalendarMarker {
  /** `yyyy-MM-dd`, matched against the day cell's own key. */
  readonly date: string;
  readonly tone: CalendarMarkerTone;
  /** Read out with the day, so the dot is not a colour-only signal. */
  readonly label: string;
}

interface CalendarGridProps {
  readonly selected: CalendarDate | null;
  readonly visibleMonth: Date;
  readonly onVisibleMonthChange: (next: Date) => void;
  readonly onSelect: (next: CalendarDate) => void;
  readonly locale: Locale;
  readonly markers?: readonly CalendarMarker[];
  /** `touch` grows every target to the 44px floor for thumbs. */
  readonly size?: "md" | "touch";
}

const MARKER_TONE: Record<CalendarMarkerTone, string> = {
  gold: "bg-ethereal-gold",
  sage: "bg-ethereal-sage",
  amethyst: "bg-ethereal-amethyst",
};

const MONTHS_IN_YEAR = 12;
/** Six weeks, always — see `buildMonthGrid`. */
const WEEK_ROWS = [0, 1, 2, 3, 4, 5];

const shiftDate = (date: CalendarDate, deltaDays: number): CalendarDate => {
  const floating = toFloatingDate(date);
  floating.setDate(floating.getDate() + deltaDays);
  return fromFloatingDate(floating);
};

const isSameMonth = (date: CalendarDate, month: Date): boolean =>
  date.year === month.getFullYear() && date.month === month.getMonth() + 1;

export const CalendarGrid = ({
  selected,
  visibleMonth,
  onVisibleMonthChange,
  onSelect,
  locale,
  markers,
  size = "md",
}: CalendarGridProps): React.JSX.Element => {
  const { t } = useTranslation();
  const gridRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<"days" | "months">("days");
  const [focusedDate, setFocusedDate] = useState<CalendarDate>(
    () => selected ?? todayCalendarDate(),
  );

  const today = todayCalendarDate();
  const days = buildMonthGrid(visibleMonth, locale);
  const weekdays = buildWeekdayLabels(locale);
  const isTouch = size === "touch";

  /**
   * The one cell in the tab order. It follows the arrow keys, but a month
   * changed from the header leaves the focused day off the board entirely —
   * without the fallback the whole grid would then drop out of the tab order.
   */
  const focusedKey = toDateKey(focusedDate);
  const tabbableKey = days.some((day) => toDateKey(day) === focusedKey)
    ? focusedKey
    : toDateKey({
        year: visibleMonth.getFullYear(),
        month: visibleMonth.getMonth() + 1,
        day: 1,
      });

  useEffect(() => {
    if (selected) {
      setFocusedDate(selected);
    }
  }, [selected]);

  /**
   * Only ever pulls focus that is already inside the grid: the roving tabindex
   * has to follow the arrow keys, but the same state also moves when the value
   * changes from outside, and stealing focus for that would yank it out of the
   * time field mid-edit.
   */
  useEffect(() => {
    const gridElement = gridRef.current;
    if (!gridElement || !gridElement.contains(document.activeElement)) {
      return;
    }

    const cell = gridElement.querySelector<HTMLButtonElement>(
      `[data-date-key="${toDateKey(focusedDate)}"]`,
    );
    cell?.focus();
  }, [focusedDate]);

  const moveFocus = useCallback(
    (next: CalendarDate) => {
      setFocusedDate(next);

      if (!isSameMonth(next, visibleMonth)) {
        onVisibleMonthChange(toFloatingDate({ ...next, day: 1 }));
      }
    },
    [onVisibleMonthChange, visibleMonth],
  );

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    const steps: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };

    if (event.key in steps) {
      event.preventDefault();
      moveFocus(shiftDate(focusedDate, steps[event.key]));
      return;
    }

    if (event.key === "PageUp" || event.key === "PageDown") {
      event.preventDefault();
      const next = shiftMonth(
        toFloatingDate(focusedDate),
        event.key === "PageUp" ? -1 : 1,
      );
      moveFocus(fromFloatingDate(next));
      return;
    }

    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      const index = days.findIndex((day) => isSameCalendarDate(day, focusedDate));
      if (index < 0) return;
      const weekStart = index - (index % 7);
      moveFocus(days[weekStart + (event.key === "Home" ? 0 : 6)]);
    }
  };

  const headingLabel = formatMonthHeading(visibleMonth, locale);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-1">
        <button
          type="button"
          onClick={() =>
            onVisibleMonthChange(
              shiftMonth(visibleMonth, view === "months" ? -MONTHS_IN_YEAR : -1),
            )
          }
          aria-label={
            view === "months"
              ? t("shared.datetime.previous_year", "Poprzedni rok")
              : t("shared.datetime.previous_month", "Poprzedni miesiąc")
          }
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-ethereal-graphite/70 transition-colors hover:bg-ethereal-parchment/70 hover:text-ethereal-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40"
        >
          <ChevronLeft size={16} strokeWidth={1.5} aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={() => setView(view === "days" ? "months" : "days")}
          aria-expanded={view === "months"}
          className="flex-1 rounded-control px-2 py-1 text-center transition-colors hover:bg-ethereal-parchment/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40"
        >
          <Text
            as="span"
            size="md"
            weight="medium"
            className="font-serif capitalize tracking-tight"
          >
            {view === "months" ? visibleMonth.getFullYear() : headingLabel}
          </Text>
        </button>

        <button
          type="button"
          onClick={() =>
            onVisibleMonthChange(
              shiftMonth(visibleMonth, view === "months" ? MONTHS_IN_YEAR : 1),
            )
          }
          aria-label={
            view === "months"
              ? t("shared.datetime.next_year", "Następny rok")
              : t("shared.datetime.next_month", "Następny miesiąc")
          }
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-ethereal-graphite/70 transition-colors hover:bg-ethereal-parchment/70 hover:text-ethereal-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40"
        >
          <ChevronRight size={16} strokeWidth={1.5} aria-hidden="true" />
        </button>
      </div>

      {view === "months" ? (
        <div className="grid grid-cols-3 gap-1 py-1">
          {Array.from({ length: MONTHS_IN_YEAR }, (_, index) => {
            const month = new Date(visibleMonth.getFullYear(), index, 1, 12);
            const isCurrent = index === visibleMonth.getMonth();

            return (
              <button
                key={index}
                type="button"
                onClick={() => {
                  onVisibleMonthChange(month);
                  setView("days");
                }}
                className={cn(
                  "rounded-control px-2 py-2.5 text-sm capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40",
                  isCurrent
                    ? "bg-ethereal-gold/20 font-semibold text-ethereal-ink"
                    : "text-ethereal-graphite hover:bg-ethereal-parchment/70 hover:text-ethereal-ink",
                )}
              >
                {formatMonthName(month, locale)}
              </button>
            );
          })}
        </div>
      ) : (
        <>
          {/* Presentational: every cell already announces its own weekday. */}
          <div className="grid grid-cols-7 gap-0.5" aria-hidden="true">
            {weekdays.map((weekday) => (
              <Eyebrow
                key={weekday}
                size="overline-sm"
                color="muted"
                className="py-1 text-center"
              >
                {weekday}
              </Eyebrow>
            ))}
          </div>

          {/* One tab stop for the whole month; the arrow keys move inside it. */}
          <div
            ref={gridRef}
            role="grid"
            aria-label={headingLabel}
            onKeyDown={handleKeyDown}
            className="flex flex-col gap-0.5"
          >
            {WEEK_ROWS.map((week) => (
              <div key={week} role="row" className="grid grid-cols-7 gap-0.5">
                {days.slice(week * 7, week * 7 + 7).map((day) => {
                  const key = toDateKey(day);
                  const marker = markers?.find((entry) => entry.date === key);
                  const isSelected = isSameCalendarDate(day, selected);
                  const isToday = isSameCalendarDate(day, today);
                  const isOutside = !isSameMonth(day, visibleMonth);

                  return (
                    <button
                      key={key}
                      type="button"
                      role="gridcell"
                      data-date-key={key}
                      tabIndex={key === tabbableKey ? 0 : -1}
                      aria-selected={isSelected}
                      aria-current={isToday ? "date" : undefined}
                      aria-label={
                        marker
                          ? `${formatDayLabel(day, locale)} — ${marker.label}`
                          : formatDayLabel(day, locale)
                      }
                      onClick={() => {
                        setFocusedDate(day);
                        onSelect(day);
                      }}
                      className={cn(
                        "relative flex items-center justify-center rounded-full text-sm tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40",
                        isTouch ? "size-11" : "size-9",
                        isSelected
                          ? "bg-ethereal-gold font-semibold text-surface-inverse shadow-button-primary"
                          : "hover:bg-ethereal-parchment/70",
                        !isSelected && isOutside && "text-ethereal-graphite/35",
                        !isSelected && !isOutside && "text-ethereal-graphite",
                        // Today is a ring, never a fill: the fill means
                        // "chosen", and two filled days would leave the field
                        // ambiguous.
                        !isSelected &&
                          isToday &&
                          "font-semibold text-ethereal-ink ring-1 ring-inset ring-ethereal-gold/60",
                      )}
                    >
                      {day.day}
                      {marker && (
                        <span
                          className={cn(
                            "absolute bottom-1 size-1 rounded-full",
                            // On the chosen day the dot sits on the gold fill,
                            // not on the popover — so it takes the same inverse
                            // ink as the figure above it rather than the ink
                            // rung, which inverts with the theme.
                            isSelected
                              ? "bg-surface-inverse/50"
                              : MARKER_TONE[marker.tone],
                          )}
                          aria-hidden="true"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
