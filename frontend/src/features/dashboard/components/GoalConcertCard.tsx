/**
 * @file GoalConcertCard.tsx
 * @description The "what am I working toward" strip. When the chorister's next
 * event is a rehearsal, this surfaces the concert it leads to — with their own
 * part-readiness (4/7 partii gotowych) and a one-tap jump into the Songbook.
 * Closes the loop rehearsal → practice → stage, right on the home screen.
 * It self-suppresses when there is no concert ahead.
 * @module features/dashboard/components/GoalConcertCard
 */

import React from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight, CalendarClock, Target } from "lucide-react";

import type { Project } from "@/shared/types";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Eyebrow, Heading, Text } from "@/shared/ui/primitives/typography";
import { formatLocalizedDate } from "@/shared/lib/time/intl";
import { useProjectReadiness } from "@/features/schedule/hooks/useProjectReadiness";
import { ReadinessRing } from "@/features/schedule/components/ReadinessRing";
import type { TimelineEvent } from "@/features/schedule/types/schedule.dto";

interface GoalConcertCardProps {
  event: TimelineEvent;
}

const daysUntil = (date: Date): number =>
  Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

export const GoalConcertCard = ({
  event,
}: GoalConcertCardProps): React.JSX.Element => {
  const { t } = useTranslation();
  const project = event.rawObj as Project;
  const readiness = useProjectReadiness(event.project_id, true);

  const days = daysUntil(event.date_time);
  const countdown =
    days <= 0
      ? t("dashboard.artist.goal.today", "Dziś")
      : days === 1
        ? t("dashboard.artist.goal.tomorrow", "Jutro")
        : t("dashboard.artist.goal.days_away", "Za {{count}} dni", {
            count: days,
          });

  return (
    <GlassCard variant="light" padding="md" isHoverable={false}>
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Eyebrow color="muted" className="flex items-center gap-1.5">
              <Target size={12} aria-hidden="true" />
              {t("dashboard.artist.goal.eyebrow", "Przygotowujesz się do")}
            </Eyebrow>
            <Heading as="h3" size="lg" weight="bold" className="mt-1 truncate">
              {event.title}
            </Heading>
            <Text size="xs" color="muted" className="mt-0.5 block">
              {formatLocalizedDate(
                event.date_time,
                { weekday: "long", day: "numeric", month: "long" },
                undefined,
                project.timezone,
              )}
            </Text>
          </div>

          <Eyebrow
            as="span"
            color="gold"
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-ethereal-gold/25 bg-ethereal-gold/10 px-2.5 py-1"
          >
            <CalendarClock size={11} aria-hidden="true" />
            {countdown}
          </Eyebrow>
        </div>

        {readiness.hasData ? (
          <ReadinessRing readiness={readiness} to="/panel/materials" />
        ) : (
          <Link
            to="/panel/materials"
            className="group inline-flex items-center gap-2 self-start rounded-xl border border-ethereal-incense/20 bg-ethereal-alabaster px-3.5 py-2.5 shadow-glass-ethereal transition-all hover:border-ethereal-sage/40 active:scale-[0.99]"
          >
            <Text size="sm" weight="semibold">
              {t("dashboard.artist.goal.open_songbook", "Otwórz Śpiewnik")}
            </Text>
            <ArrowRight
              size={13}
              aria-hidden="true"
              className="text-ethereal-graphite/40 transition-transform group-hover:translate-x-0.5"
            />
          </Link>
        )}
      </div>
    </GlassCard>
  );
};
