/**
 * @file RehearsalPulseBar.tsx
 * @description The conductor's "what needs me right now" strip. Spotlights the
 * next (or running) rehearsal across every active project and, beside the
 * title, the two figures that ask for a decision today: sessions starting
 * today and past sessions whose roll call is still open. One tap on the
 * spotlight jumps the whole workspace to that rehearsal.
 * @architecture Enterprise SaaS 2026
 * @module features/rehearsals/components/RehearsalPulseBar
 */

import React from "react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { Activity, CalendarClock, ClipboardList, Clock, Radio, Sun } from "lucide-react";

import { SectionCard } from "@/shared/ui/composites/SectionCard";
import { StatePanel } from "@/shared/ui/composites/StatePanel";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Button } from "@/shared/ui/primitives/Button";
import { Caption, Heading, Text } from "@/shared/ui/primitives/typography";
import { DualTimeDisplay } from "@/widgets/utility/DualTimeDisplay";
import { LocationPreview } from "@/features/logistics/components/LocationPreview";
import { formatLocalizedDate } from "@/shared/lib/time/intl";

import type { RehearsalPulse } from "../hooks/useRehearsalsData";

interface RehearsalPulseBarProps {
  pulse: RehearsalPulse;
  /** Ticking clock from the workspace, so the countdown ages on screen. */
  nowMs: number;
  onOpenNext: () => void;
}

/**
 * How far off the downbeat is, in the coarsest unit that is still true. Plain
 * function, not a hook: it holds no state — the clock is handed in.
 */
const countdownLabel = (startMs: number, nowMs: number, t: TFunction): string => {
  const diff = startMs - nowMs;
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

/** A figure that is only printed when there is one — a zero asks for nothing. */
const StatChip = ({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
}) => (
  <Caption color="muted" className="inline-flex items-center gap-1.5 tabular-nums">
    <span className="shrink-0 text-ethereal-gold" aria-hidden="true">
      {icon}
    </span>
    <Text as="span" size="sm" weight="semibold" color="gold">
      {value}
    </Text>
    {label}
  </Caption>
);

export const RehearsalPulseBar = React.memo(
  ({ pulse, nowMs, onOpenNext }: RehearsalPulseBarProps): React.JSX.Element => {
    const { t } = useTranslation();
    const { next } = pulse;

    const counters =
      pulse.todayCount > 0 || pulse.unmarkedCount > 0 ? (
        <div className="flex items-center gap-x-4">
          {pulse.todayCount > 0 && (
            <StatChip
              icon={<Sun size={11} />}
              value={pulse.todayCount}
              label={t("rehearsals.pulse.today", "dziś")}
            />
          )}
          {pulse.unmarkedCount > 0 && (
            <StatChip
              icon={<ClipboardList size={11} />}
              value={pulse.unmarkedCount}
              label={t("rehearsals.pulse.to_complete", "do uzupełnienia")}
            />
          )}
        </div>
      ) : undefined;

    if (!next) {
      return (
        <SectionCard
          as="h2"
          title={t("rehearsals.pulse.title", "Puls prób")}
          icon={<Activity size={14} />}
          action={counters}
        >
          <StatePanel
            variant="inline"
            icon={<CalendarClock size={20} aria-hidden="true" />}
            title={t("rehearsals.pulse.empty_title", "Brak nadchodzących prób")}
            description={t(
              "rehearsals.pulse.empty_desc",
              "W aktywnych projektach nie ma zaplanowanej żadnej próby.",
            )}
          />
        </SectionCard>
      );
    }

    const startMs = new Date(next.rehearsal.date_time).getTime();
    // One chip, not two: a "Próba trwa" badge beside a "Za 2 godz." countdown
    // contradicted itself for the whole two hours the live window opens before
    // the downbeat, and agreed with itself only by repeating the same sentence.
    const isRunning = next.isLive && nowMs >= startMs;

    return (
      <SectionCard
        as="h2"
        title={t("rehearsals.pulse.title", "Puls prób")}
        icon={<Activity size={14} />}
        action={counters}
        bodyClassName="gap-4 lg:flex-row lg:items-center lg:justify-between"
      >
        <div className="min-w-0 flex-1">
          <Badge
            variant={isRunning ? "warning" : "neutral"}
            pulse={isRunning}
            icon={isRunning ? <Radio size={11} /> : undefined}
          >
            {countdownLabel(startMs, nowMs, t)}
          </Badge>

          <Heading as="p" size="lg" weight="bold" truncate className="mt-2 leading-tight">
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
              endValue={next.rehearsal.end_date_time}
              timeZone={next.rehearsal.timezone}
              icon={<Clock size={11} className="text-ethereal-gold/70" aria-hidden="true" />}
              containerClassName="flex items-center gap-1.5"
              primaryTimeClassName="flex items-center gap-1.5 text-xs font-semibold text-ethereal-ink"
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
          {isRunning
            ? t("rehearsals.pulse.open_live", "Prowadź odprawę")
            : t("rehearsals.pulse.open_next", "Otwórz odprawę")}
        </Button>
      </SectionCard>
    );
  },
);

RehearsalPulseBar.displayName = "RehearsalPulseBar";
