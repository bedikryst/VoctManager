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
import {
  attendanceRateTone,
  type AttendanceRateTone,
} from "@/features/rehearsals/constants/attendanceMeta";
import type { ScheduleAttendanceStats } from "../types/schedule.dto";

/**
 * The ring is entirely colour, so its resting fill is the warm neutral and gold
 * marks the shortfall — the same scale the reliability board, the inspector and
 * the hub matrix read. This card was the fourth copy and the only one still
 * alive: sage ≥90, gold ≥70, crimson below, so a singer who had missed three
 * rehearsals in a busy term opened their own schedule to the panel's alarm
 * colour. A dip is not a failure.
 */
const RATE_TONE_RING: Record<
  AttendanceRateTone,
  "gold" | "graphite" | "incense"
> = {
  unknown: "graphite",
  low: "gold",
  normal: "incense",
};

interface MyAttendancePanelProps {
  stats: ScheduleAttendanceStats;
}

export const MyAttendancePanel = ({
  stats,
}: MyAttendancePanelProps): React.JSX.Element | null => {
  const { t } = useTranslation();
  if (stats.rate == null) return null;

  const rateTone = attendanceRateTone(stats.rate);
  const tone = RATE_TONE_RING[rateTone];

  /**
   * The three counts stay on screen at zero, unlike a chip in a list: they
   * partition the census stated beside them ("na podstawie N prób"), and this
   * is one person's own card, not forty rows to triage — there is nothing here
   * for a zero to bury. What they do NOT do is carry a status palette. A count
   * over a season is a measurement, not a roll-call record, so the icon says
   * which fact it is and the figure spends no colour; only the absences take a
   * tone, from the same scale the ring above them reads, so the card cannot
   * say "fine" in one place and "short" in the other.
   */
  const counts = [
    {
      key: "present",
      value: stats.present,
      Icon: CheckCircle2,
      className: "text-ethereal-graphite/60",
      label: t("schedule.attendance.present", "Obecności"),
    },
    {
      key: "late",
      value: stats.late,
      Icon: Clock,
      className: "text-ethereal-graphite/60",
      label: t("schedule.attendance.late", "Spóźnienia"),
    },
    {
      key: "absent",
      value: stats.absent,
      Icon: XCircle,
      className:
        rateTone === "low" ? "text-ethereal-gold" : "text-ethereal-graphite/60",
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
              className="flex items-center gap-1.5 rounded-nested border border-ethereal-incense/20 bg-ethereal-alabaster px-3 py-2 shadow-glass-ethereal"
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
            <div className="flex items-center gap-1.5 rounded-nested border border-ethereal-gold/30 bg-ethereal-gold/10 px-3 py-2">
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
