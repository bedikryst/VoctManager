/**
 * @file LogisticsTimezoneBand.tsx
 * @description Live world-clock strip for every timezone the ensemble touches.
 * Each tile shows the local time, a day/night cue, how many venues sit in that
 * zone, and the soonest event there — the quick "what time is it on tour right
 * now" glance a conductor needs before calling a venue.
 * @architecture Enterprise SaaS 2026
 * @module features/logistics/components/LogisticsTimezoneBand
 */

import React from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { Building2, Globe2, Moon, Sun } from "lucide-react";

import { useLocalTime } from "@/shared/lib/time/hooks/useLocalTime";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import {
  Caption,
  Eyebrow,
  Heading,
  Text,
} from "@/shared/ui/primitives/typography";

import { daysUntil } from "../constants/eventImminence";
import type { TimezoneClock } from "../hooks/useLogisticsEvents";

interface LogisticsTimezoneBandProps {
  clocks: TimezoneClock[];
}

const relativeDayLabel = (date: Date, t: TFunction): string => {
  const diff = daysUntil(date);
  if (diff < 0) return t("logistics.timezone.no_event", "Brak wydarzeń");
  if (diff === 0) return t("logistics.imminence.today", "Dziś");
  if (diff === 1) return t("logistics.timezone.tomorrow", "Jutro");
  return t("logistics.timezone.in_days", "za {{count}} dni", { count: diff });
};

const TimezoneClockTile = ({
  clock,
}: {
  clock: TimezoneClock;
}): React.JSX.Element => {
  const { t } = useTranslation();
  const time = useLocalTime(clock.timezone);
  const hour = time ? Number.parseInt(time.split(":")[0] ?? "", 10) : NaN;
  const isDay = !Number.isNaN(hour) && hour >= 6 && hour < 20;
  const DayIcon = isDay ? Sun : Moon;

  return (
    <div className="flex w-[8.5rem] shrink-0 flex-col gap-1.5 rounded-2xl border border-ethereal-ink/6 bg-ethereal-alabaster/70 px-3.5 py-3">
      <div className="flex items-center justify-between gap-2">
        <Eyebrow color="graphite" truncate className="block">
          {clock.city}
        </Eyebrow>
        <DayIcon
          size={13}
          strokeWidth={1.75}
          aria-hidden="true"
          className={isDay ? "text-ethereal-gold" : "text-ethereal-amethyst"}
        />
      </div>

      <Heading
        as="p"
        size="2xl"
        weight="medium"
        className="leading-none tabular-nums text-ethereal-ink"
      >
        {time || "—"}
      </Heading>

      <div className="flex items-center justify-between gap-2">
        <Caption
          color="muted"
          className="inline-flex items-center gap-1 tabular-nums"
        >
          <Building2 size={10} aria-hidden="true" />
          {clock.venueCount}
        </Caption>
        {clock.nextEvent && (
          <Text
            as="span"
            size="xs"
            weight="medium"
            className="text-ethereal-graphite/70"
          >
            {relativeDayLabel(clock.nextEvent.date, t)}
          </Text>
        )}
      </div>
    </div>
  );
};

export const LogisticsTimezoneBand = ({
  clocks,
}: LogisticsTimezoneBandProps): React.JSX.Element | null => {
  const { t } = useTranslation();
  if (clocks.length === 0) return null;

  return (
    <GlassCard variant="solid" padding="none" isHoverable={false}>
      <div className="flex items-center justify-between gap-3 border-b border-ethereal-ink/6 px-5 py-3">
        <div className="flex items-center gap-2.5">
          <Globe2 size={14} className="text-ethereal-gold/70" aria-hidden="true" />
          <Eyebrow as="h2" color="graphite">
            {t("logistics.timezone.title", "Strefy czasowe zespołu")}
          </Eyebrow>
        </div>
        <Caption color="muted">
          {t("logistics.timezone.count", "{{count}} stref", {
            count: clocks.length,
          })}
        </Caption>
      </div>

      <div className="flex gap-2.5 overflow-x-auto p-4 no-scrollbar">
        {clocks.map((clock) => (
          <TimezoneClockTile key={clock.timezone} clock={clock} />
        ))}
      </div>
    </GlassCard>
  );
};
