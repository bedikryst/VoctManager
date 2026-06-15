/**
 * @file RehearsalPulseBar.tsx
 * @description The conductor's "what needs me right now" strip. Folds a
 * cross-project spotlight on the next/live rehearsal together with headline
 * counts (today, this week, outstanding roll-calls, realised attendance).
 * One tap on the spotlight jumps the whole workspace to that rehearsal.
 * @architecture Enterprise SaaS 2026
 * @module features/rehearsals/components/RehearsalPulseBar
 */

import React from "react";
import { useTranslation } from "react-i18next";
import {
  Activity,
  CalendarClock,
  CalendarDays,
  ClipboardList,
  Clock,
  Radio,
  Sun,
  TrendingUp,
} from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Button } from "@/shared/ui/primitives/Button";
import { Caption, Eyebrow, Heading, Text } from "@/shared/ui/primitives/typography";
import { DualTimeDisplay } from "@/widgets/utility/DualTimeDisplay";
import { LocationPreview } from "@/features/logistics/components/LocationPreview";
import { formatLocalizedDate } from "@/shared/lib/time/intl";

import type { RehearsalPulse } from "../hooks/useRehearsalsData";

interface RehearsalPulseBarProps {
  pulse: RehearsalPulse;
  onOpenNext: () => void;
}

const useCountdown = (iso: string): string => {
  const { t } = useTranslation();
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return t("rehearsals.pulse.now", "Trwa teraz");
  const minutes = Math.round(diff / 60000);
  if (minutes < 60)
    return t("rehearsals.pulse.in_minutes", "Za {{count}} min", { count: minutes });
  const hours = Math.round(minutes / 60);
  if (hours < 24)
    return t("rehearsals.pulse.in_hours", "Za {{count}} godz.", { count: hours });
  const days = Math.round(hours / 24);
  if (days === 1) return t("rehearsals.pulse.tomorrow", "Jutro");
  return t("rehearsals.pulse.in_days", "Za {{count}} dni", { count: days });
};

const StatChip = ({
  icon,
  value,
  label,
  emphasised = false,
  alarm = false,
}: {
  icon: React.ReactNode;
  value: number | string;
  label: string;
  emphasised?: boolean;
  alarm?: boolean;
}) => (
  <Caption color="muted" className="inline-flex items-center gap-1.5 tabular-nums">
    <span
      className={cn(
        "shrink-0",
        alarm
          ? "text-ethereal-crimson"
          : emphasised
            ? "text-ethereal-gold"
            : "text-ethereal-incense/60",
      )}
      aria-hidden="true"
    >
      {icon}
    </span>
    <Text
      as="span"
      size="sm"
      weight="semibold"
      className={cn(
        alarm
          ? "text-ethereal-crimson"
          : emphasised
            ? "text-ethereal-gold"
            : "text-ethereal-ink",
      )}
    >
      {value}
    </Text>
    {label}
  </Caption>
);

export const RehearsalPulseBar = React.memo(
  ({ pulse, onOpenNext }: RehearsalPulseBarProps): React.JSX.Element => {
    const { t } = useTranslation();
    const { next } = pulse;
    const countdown = useCountdown(next?.rehearsal.date_time ?? new Date().toISOString());

    return (
      <GlassCard variant="solid" padding="none" isHoverable={false}>
        <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-ethereal-ink/6 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <Activity size={14} className="text-ethereal-gold/70" aria-hidden="true" />
            <Eyebrow as="h2" color="graphite">
              {t("rehearsals.pulse.title", "Puls prób")}
            </Eyebrow>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <StatChip
              icon={<Sun size={11} />}
              value={pulse.todayCount}
              label={t("rehearsals.pulse.today", "dziś")}
              emphasised={pulse.todayCount > 0}
            />
            <StatChip
              icon={<CalendarDays size={11} />}
              value={pulse.weekCount}
              label={t("rehearsals.pulse.this_week", "w tym tygodniu")}
            />
            <StatChip
              icon={<ClipboardList size={11} />}
              value={pulse.unmarkedCount}
              label={t("rehearsals.pulse.to_complete", "do uzupełnienia")}
              alarm={pulse.unmarkedCount > 0}
            />
            <StatChip
              icon={<TrendingUp size={11} />}
              value={pulse.overallRate === null ? "—" : `${pulse.overallRate}%`}
              label={t("rehearsals.pulse.overall_rate", "frekwencja")}
            />
          </div>
        </header>

        {next ? (
          <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                {next.isLive ? (
                  <Eyebrow
                    as="span"
                    color="gold"
                    className="flex items-center gap-1.5 rounded-md border border-ethereal-gold/30 bg-ethereal-gold/10 px-2.5 py-1"
                  >
                    <span className="relative flex h-2 w-2" aria-hidden="true">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ethereal-gold opacity-60" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-ethereal-gold" />
                    </span>
                    {t("rehearsals.pulse.live", "Próba trwa")}
                  </Eyebrow>
                ) : (
                  <Eyebrow
                    as="span"
                    color="default"
                    className="rounded-md border border-ethereal-ink/10 bg-ethereal-ink/[0.04] px-2.5 py-1"
                  >
                    {t("rehearsals.pulse.next_rehearsal", "Najbliższa próba")}
                  </Eyebrow>
                )}
                <Eyebrow
                  as="span"
                  color="muted"
                  className="rounded-md border border-ethereal-incense/20 bg-ethereal-alabaster px-2.5 py-1 shadow-glass-ethereal"
                >
                  {countdown}
                </Eyebrow>
              </div>

              <Heading as="p" size="lg" weight="bold" truncate className="leading-tight">
                {next.project.title}
              </Heading>

              <div className="mt-2 flex flex-wrap items-center gap-3">
                <Caption color="muted" className="inline-flex items-center gap-1.5">
                  <CalendarClock size={12} className="text-ethereal-gold/70" aria-hidden="true" />
                  {formatLocalizedDate(
                    next.rehearsal.date_time,
                    { weekday: "short", day: "numeric", month: "short" },
                    undefined,
                    next.rehearsal.timezone,
                  )}
                </Caption>
                <DualTimeDisplay
                  value={next.rehearsal.date_time}
                  timeZone={next.rehearsal.timezone}
                  icon={<Clock size={11} className="text-ethereal-gold/70" aria-hidden="true" />}
                  containerClassName="flex items-center gap-1.5"
                  primaryTimeClassName="flex items-center gap-1.5 text-xs font-semibold text-ethereal-ink"
                  localTimeClassName="text-[9px] text-ethereal-graphite/50 font-medium normal-case tracking-normal pl-1.5"
                />
                <LocationPreview
                  locationRef={next.rehearsal.location}
                  fallback={t("rehearsals.dashboard.no_location", "Brak lok.")}
                  variant="minimal"
                />
              </div>

              {next.rehearsal.focus && (
                <Text size="sm" color="graphite" className="mt-2 line-clamp-1 font-serif italic">
                  {next.rehearsal.focus}
                </Text>
              )}
            </div>

            <Button
              variant="primary"
              onClick={onOpenNext}
              leftIcon={<Radio size={15} aria-hidden="true" />}
              className="shrink-0"
            >
              {next.isLive
                ? t("rehearsals.pulse.open_live", "Prowadź odprawę")
                : t("rehearsals.pulse.open_next", "Otwórz odprawę")}
            </Button>
          </div>
        ) : (
          <div className="px-5 py-4">
            <Text size="sm" color="muted" className="italic">
              {t(
                "rehearsals.pulse.empty",
                "Brak nadchodzących prób w aktywnych projektach. Zaplanuj je w karcie projektu.",
              )}
            </Text>
          </div>
        )}
      </GlassCard>
    );
  },
);

RehearsalPulseBar.displayName = "RehearsalPulseBar";
