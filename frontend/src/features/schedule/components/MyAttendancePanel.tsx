/**
 * @file MyAttendancePanel.tsx
 * @description The chorister's personal attendance mirror — the singer-facing
 * counterpart to the conductor's reliability board. A reassuring rate ring, a
 * present/late/absent breakdown and a current attendance streak, shown atop the
 * history view so people see their own track record, not just a list of dates.
 * @module features/schedule/components/MyAttendancePanel
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Clock, Flame, XCircle } from "lucide-react";

import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { CompletionRing } from "@/shared/ui/composites/CompletionRing";
import { Eyebrow, Heading, Text } from "@/shared/ui/primitives/typography";
import type { ScheduleAttendanceStats } from "../types/schedule.dto";

interface MyAttendancePanelProps {
  stats: ScheduleAttendanceStats;
}

export const MyAttendancePanel = ({
  stats,
}: MyAttendancePanelProps): React.JSX.Element | null => {
  const { t } = useTranslation();
  if (stats.rate == null) return null;

  const tone = stats.rate >= 90 ? "sage" : stats.rate >= 70 ? "gold" : "crimson";

  const counts = [
    {
      key: "present",
      value: stats.present,
      Icon: CheckCircle2,
      className: "text-ethereal-sage",
      label: t("schedule.attendance.present", "Obecności"),
    },
    {
      key: "late",
      value: stats.late,
      Icon: Clock,
      className: "text-ethereal-incense",
      label: t("schedule.attendance.late", "Spóźnienia"),
    },
    {
      key: "absent",
      value: stats.absent,
      Icon: XCircle,
      className: "text-ethereal-crimson",
      label: t("schedule.attendance.absent", "Nieobecności"),
    },
  ];

  return (
    <GlassCard variant="light" padding="md" isHoverable={false}>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <CompletionRing value={stats.rate} tone={tone} size={64} strokeWidth={6}>
            <span className="text-base font-bold tabular-nums text-ethereal-ink">
              {stats.rate}%
            </span>
          </CompletionRing>
          <div>
            <Eyebrow color="muted">
              {t("schedule.attendance.title", "Twoja frekwencja")}
            </Eyebrow>
            <Heading as="h3" size="lg" weight="bold">
              {t("schedule.attendance.subtitle", "Obecność na próbach")}
            </Heading>
            <Text size="xs" color="muted">
              {t("schedule.attendance.based_on", "Na podstawie {{count}} prób", {
                count: stats.accountable,
              })}
            </Text>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {counts.map(({ key, value, Icon, className, label }) => (
            <div
              key={key}
              title={label}
              className="flex items-center gap-1.5 rounded-xl border border-ethereal-incense/15 bg-ethereal-alabaster px-3 py-2 shadow-glass-ethereal"
            >
              <Icon size={14} className={className} aria-hidden="true" />
              <span className="text-sm font-bold tabular-nums text-ethereal-ink">
                {value}
              </span>
              <Eyebrow color="muted" className="hidden sm:inline">
                {label}
              </Eyebrow>
            </div>
          ))}

          {stats.streak > 1 && (
            <div className="flex items-center gap-1.5 rounded-xl border border-ethereal-gold/30 bg-ethereal-gold/10 px-3 py-2">
              <Flame size={14} className="text-ethereal-gold" aria-hidden="true" />
              <span className="text-sm font-bold tabular-nums text-ethereal-ink">
                {stats.streak}
              </span>
              <Eyebrow color="gold">
                {t("schedule.attendance.streak", "Seria")}
              </Eyebrow>
            </div>
          )}
        </div>
      </div>
    </GlassCard>
  );
};
