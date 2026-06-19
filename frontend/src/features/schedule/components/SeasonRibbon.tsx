/**
 * @file SeasonRibbon.tsx
 * @description A swipeable per-day pulse of the season ahead. Each cell is a day
 * that has something on it, coloured by its dominant tone (concert / absence /
 * confirmed / open). Tapping a day scrolls the feed to it. Designed mobile-first:
 * a horizontal snap-rail that reads identically on a phone and a desktop.
 * @module features/schedule/components/SeasonRibbon
 */

import React, { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ChevronRight, Sparkles } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { formatLocalizedDate } from "@/shared/lib/time/intl";
import { Eyebrow, Heading } from "@/shared/ui/primitives/typography";
import { dayKey } from "../lib/groupByDay";
import type { PulseTone, SeasonDay } from "../lib/seasonPulse";

interface SeasonRibbonProps {
  days: SeasonDay[];
  now: Date;
  activeKey: string | null;
  onSelect: (key: string) => void;
}

const DOT_TONE: Record<PulseTone, string> = {
  concert: "bg-ethereal-gold",
  absent: "bg-ethereal-crimson",
  late: "bg-ethereal-incense",
  present: "bg-ethereal-sage",
  open: "bg-transparent border border-ethereal-incense/50",
};

export const SeasonRibbon = ({
  days,
  now,
  activeKey,
  onSelect,
}: SeasonRibbonProps): React.JSX.Element | null => {
  const { t } = useTranslation();
  const railRef = useRef<HTMLDivElement>(null);

  // Centre the selected day in the rail when it changes (tap-from-feed or
  // ribbon tap), so the active cell never hides under the scroll edge.
  useEffect(() => {
    if (!activeKey || !railRef.current) return;
    const node = railRef.current.querySelector<HTMLElement>(
      `[data-day-key="${activeKey}"]`,
    );
    node?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [activeKey]);

  if (days.length === 0) return null;

  const todayKey = dayKey(now);
  let lastMonth = -1;

  return (
    <section
      aria-label={t("schedule.ribbon.aria", "Puls sezonu")}
      className="rounded-2xl border border-ethereal-incense/15 bg-ethereal-alabaster/60 px-3 py-3 shadow-glass-ethereal"
    >
      <div className="mb-2 flex items-center gap-1.5 px-1">
        <Sparkles size={11} className="text-ethereal-gold" aria-hidden="true" />
        <Eyebrow color="muted">
          {t("schedule.ribbon.title", "Twój sezon")}
        </Eyebrow>
      </div>

      <div className="relative">
        <div
          ref={railRef}
          className="flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1 pr-6 no-scrollbar"
        >
          {days.map((day) => {
            const month = day.date.getMonth();
            const showMonth = month !== lastMonth;
            lastMonth = month;
            const isActive = day.key === activeKey;
            const isToday = day.key === todayKey;

            return (
              <div key={day.key} className="flex shrink-0 snap-start items-end gap-1.5">
                {showMonth && (
                  <Eyebrow
                    as="span"
                    color="gold"
                    className="self-center whitespace-nowrap px-0.5"
                  >
                    {formatLocalizedDate(day.date, { month: "short" })}
                  </Eyebrow>
                )}
                <button
                  type="button"
                  data-day-key={day.key}
                  onClick={() => onSelect(day.key)}
                  aria-current={isActive ? "true" : undefined}
                  className={cn(
                    "relative flex min-h-[3.25rem] w-12 flex-col items-center justify-center gap-1 rounded-xl border px-1 py-2 transition-all active:scale-95",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/50",
                    isActive
                      ? "border-ethereal-gold/60 bg-ethereal-gold/10"
                      : day.hasConcert
                        // Concerts carry a structural ring, not just a gold dot —
                        // a non-colour cue so the day still reads as special.
                        ? "border-ethereal-gold/40 bg-ethereal-gold/[0.04] ring-1 ring-ethereal-gold/30 hover:bg-ethereal-gold/10"
                        : "border-ethereal-incense/15 bg-ethereal-alabaster hover:border-ethereal-gold/30 hover:bg-ethereal-marble/40",
                  )}
                >
                  <Eyebrow as="span" color={isToday ? "gold" : "muted"}>
                    {formatLocalizedDate(day.date, { weekday: "short" })}
                  </Eyebrow>
                  <Heading
                    as="span"
                    size="lg"
                    weight="black"
                    color={isToday ? "gold" : "default"}
                    className="leading-none"
                  >
                    {formatLocalizedDate(day.date, { day: "numeric" })}
                  </Heading>
                  <span className="flex h-2 items-center justify-center gap-0.5">
                    <span
                      className={cn("h-1.5 w-1.5 rounded-full", DOT_TONE[day.tone])}
                      aria-hidden="true"
                    />
                    {day.eventCount > 1 && (
                      <span className="text-[10px] font-semibold text-ethereal-graphite/60">
                        {day.eventCount}
                      </span>
                    )}
                  </span>
                  {isToday && (
                    <span
                      className="absolute -top-px left-1/2 h-0.5 w-4 -translate-x-1/2 rounded-full bg-ethereal-gold"
                      aria-hidden="true"
                    />
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* scroll affordance — the season usually runs past the edge */}
        {days.length > 5 && (
          <div className="pointer-events-none absolute inset-y-0 right-0 flex w-9 items-center justify-end bg-gradient-to-l from-ethereal-alabaster via-ethereal-alabaster/80 to-transparent">
            <ChevronRight size={15} className="text-ethereal-gold/70" aria-hidden="true" />
          </div>
        )}
      </div>
    </section>
  );
};
