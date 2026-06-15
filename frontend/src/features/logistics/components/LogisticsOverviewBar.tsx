/**
 * @file LogisticsOverviewBar.tsx
 * @description The single command-strip for the logistics module — folds the
 * old hero + metrics grid + category <select> into one scannable surface
 * (mirrors crew's CrewSpecialtyBar). Header carries the headline schedule
 * stats; the tile grid is the category filter, each tile showing a venue count
 * + proportional bar and doubling as a toggle.
 * @architecture Enterprise SaaS 2026
 * @module features/logistics/components/LogisticsOverviewBar
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { CalendarClock, Globe2, Layers, MapPin, Radio, Sun } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import {
  Caption,
  Eyebrow,
  Metric,
  Text,
} from "@/shared/ui/primitives/typography";

import type { LocationCategory } from "@/shared/types";
import type {
  LocationCategoryAccent,
  LocationCategoryOption,
} from "../constants/locationCategories";
import type { LocationsMetrics } from "../hooks/useLocationsData";
import type { LogisticsScheduleMetrics } from "../hooks/useLogisticsEvents";

interface LogisticsOverviewBarProps {
  categoryOptions: LocationCategoryOption[];
  categoryStats: Partial<Record<LocationCategory, number>>;
  metrics: LocationsMetrics;
  scheduleMetrics: LogisticsScheduleMetrics;
  activeCategory: LocationCategory | "";
  onSelectCategory: (value: LocationCategory | "") => void;
}

const ACCENT: Record<
  LocationCategoryAccent,
  { active: string; idle: string }
> = {
  gold: {
    active:
      "border-ethereal-gold/45 bg-ethereal-gold/[0.05] ring-1 ring-ethereal-gold/30",
    idle: "border-ethereal-ink/8 hover:border-ethereal-gold/30",
  },
  amethyst: {
    active:
      "border-ethereal-amethyst/45 bg-ethereal-amethyst/[0.04] ring-1 ring-ethereal-amethyst/30",
    idle: "border-ethereal-ink/8 hover:border-ethereal-amethyst/30",
  },
  crimson: {
    active:
      "border-ethereal-crimson/45 bg-ethereal-crimson/[0.04] ring-1 ring-ethereal-crimson/30",
    idle: "border-ethereal-ink/8 hover:border-ethereal-crimson/30",
  },
  sage: {
    active:
      "border-ethereal-sage/45 bg-ethereal-sage/[0.04] ring-1 ring-ethereal-sage/30",
    idle: "border-ethereal-ink/8 hover:border-ethereal-sage/30",
  },
  graphite: {
    active:
      "border-ethereal-graphite/40 bg-ethereal-graphite/[0.05] ring-1 ring-ethereal-graphite/25",
    idle: "border-ethereal-ink/8 hover:border-ethereal-graphite/30",
  },
  incense: {
    active:
      "border-ethereal-incense/45 bg-ethereal-incense/[0.05] ring-1 ring-ethereal-incense/30",
    idle: "border-ethereal-ink/8 hover:border-ethereal-incense/30",
  },
};

const StatChip = ({
  icon,
  value,
  label,
  emphasised = false,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  emphasised?: boolean;
}) => (
  <Caption
    color="muted"
    className="inline-flex items-center gap-1.5 tabular-nums"
  >
    <span
      className={emphasised ? "text-ethereal-gold" : "text-ethereal-incense/60"}
      aria-hidden="true"
    >
      {icon}
    </span>
    <Text
      as="span"
      size="sm"
      weight="semibold"
      className={emphasised ? "text-ethereal-gold" : "text-ethereal-ink"}
    >
      {value}
    </Text>
    {label}
  </Caption>
);

export const LogisticsOverviewBar = React.memo(
  ({
    categoryOptions,
    categoryStats,
    metrics,
    scheduleMetrics,
    activeCategory,
    onSelectCategory,
  }: LogisticsOverviewBarProps): React.JSX.Element => {
    const { t } = useTranslation();
    const peak = Math.max(
      ...categoryOptions.map((option) => categoryStats[option.value] ?? 0),
      1,
    );
    const hasFilter = activeCategory !== "";

    return (
      <GlassCard variant="solid" padding="none" isHoverable={false}>
        <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-ethereal-ink/6 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <Layers
              size={14}
              className="text-ethereal-gold/70"
              aria-hidden="true"
            />
            <Eyebrow as="h2" color="graphite">
              {t("logistics.overview.title", "Przegląd operacyjny")}
            </Eyebrow>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <StatChip
              icon={<MapPin size={11} />}
              value={metrics.totalLocations}
              label={t("logistics.overview.venues", "lokacji")}
            />
            <StatChip
              icon={<CalendarClock size={11} />}
              value={scheduleMetrics.upcomingCount}
              label={t("logistics.overview.upcoming", "nadchodzących")}
            />
            <StatChip
              icon={<Sun size={11} />}
              value={scheduleMetrics.todayCount}
              label={t("logistics.overview.today", "dziś")}
              emphasised={scheduleMetrics.todayCount > 0}
            />
            <StatChip
              icon={<Radio size={11} />}
              value={scheduleMetrics.liveVenues}
              label={t("logistics.overview.live", "aktywnych miejsc")}
            />
            <StatChip
              icon={<Globe2 size={11} />}
              value={metrics.uniqueTimezones}
              label={t("logistics.overview.timezones", "stref")}
            />
          </div>
        </header>

        <div className="grid grid-cols-2 gap-2.5 p-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
          {categoryOptions.map((option) => {
            const count = categoryStats[option.value] ?? 0;
            const isActive = activeCategory === option.value;
            const accent = ACCENT[option.accent];
            const Icon = option.icon;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={isActive}
                disabled={count === 0 && !isActive}
                onClick={() =>
                  onSelectCategory(isActive ? "" : option.value)
                }
                title={option.plural}
                className={cn(
                  "group flex flex-col gap-2 rounded-2xl border bg-ethereal-alabaster px-3.5 py-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45",
                  isActive ? accent.active : accent.idle,
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <Icon
                    size={15}
                    strokeWidth={1.75}
                    aria-hidden="true"
                    className="shrink-0"
                    style={{ color: option.atlasMarker }}
                  />
                  <Metric
                    size="xl"
                    color={isActive ? "default" : "graphite"}
                    className="leading-none tabular-nums"
                  >
                    {count}
                  </Metric>
                </div>
                <Eyebrow color={option.accent} truncate className="block">
                  {option.plural}
                </Eyebrow>
                <div
                  className="h-1 w-full overflow-hidden rounded-full bg-ethereal-ink/6"
                  aria-hidden="true"
                >
                  <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{
                      width: `${Math.round((count / peak) * 100)}%`,
                      backgroundColor: option.atlasMarker,
                      opacity: 0.55,
                    }}
                  />
                </div>
              </button>
            );
          })}

          <button
            type="button"
            aria-pressed={!hasFilter}
            onClick={() => onSelectCategory("")}
            className={cn(
              "group flex flex-col justify-between gap-2 rounded-2xl border px-3.5 py-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40 active:scale-[0.98]",
              !hasFilter
                ? "border-ethereal-gold/40 bg-ethereal-gold/[0.06] ring-1 ring-ethereal-gold/25"
                : "border-dashed border-ethereal-ink/12 bg-ethereal-alabaster/50 hover:border-ethereal-gold/30",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <Layers
                size={15}
                strokeWidth={1.75}
                aria-hidden="true"
                className={cn(
                  "shrink-0",
                  hasFilter ? "text-ethereal-graphite/55" : "text-ethereal-gold",
                )}
              />
              <Metric
                size="xl"
                color={!hasFilter ? "default" : "graphite"}
                className="leading-none tabular-nums"
              >
                {metrics.totalLocations}
              </Metric>
            </div>
            <Eyebrow color={!hasFilter ? "gold" : "muted"} className="block">
              {t("logistics.overview.all", "Wszystkie")}
            </Eyebrow>
            <Caption color="muted" className="leading-tight">
              {t("logistics.overview.all_hint", "Wszystkie kategorie")}
            </Caption>
          </button>
        </div>
      </GlassCard>
    );
  },
);

LogisticsOverviewBar.displayName = "LogisticsOverviewBar";
