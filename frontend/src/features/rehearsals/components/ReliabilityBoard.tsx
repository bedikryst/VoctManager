/**
 * @file ReliabilityBoard.tsx
 * @description The "Frekwencja" intelligence view — the analytics the old
 * attendance journal never offered. Reads the conductor's recorded history for
 * one project and answers the questions that actually drive a conversation:
 * which sections show up, how attendance trends rehearsal-over-rehearsal, and
 * which singers are chronically late or absent. All derived client-side from
 * data already in cache (see useRehearsalAnalytics).
 * @architecture Enterprise SaaS 2026
 * @module features/rehearsals/components/ReliabilityBoard
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, BarChart3, Clock3, Sparkles, TrendingUp, Users } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { SectionCard } from "@/shared/ui/composites/SectionCard";
import { MetricBlock } from "@/shared/ui/composites/MetricBlock";
import { StatePanel } from "@/shared/ui/composites/StatePanel";
import { Avatar } from "@/shared/ui/composites/Avatar";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Caption, Eyebrow, Text } from "@/shared/ui/primitives/typography";
import { formatLocalizedDate } from "@/shared/lib/time/intl";
// The dot-separated facts line the archive pass settled. Its home should move
// to `shared/ui/composites` when that layer gets its pass — retyping it here
// would be the third copy of a shape the design system has already decided.
import { StatLine } from "@/shared/ui/composites/StatLine";

import type { Rehearsal } from "@/shared/types";
import type { RehearsalAnalytics, SingerReliability } from "../hooks/useRehearsalAnalytics";
import {
  ATTENDANCE_STATUS_META,
  RATE_TONE_ACCENT,
  RATE_TONE_BAR,
  RATE_TONE_TEXT,
  attendanceRateTone,
  voiceSectionLabelKey,
  type AttendanceCell,
} from "../constants/attendanceMeta";

interface ReliabilityBoardProps {
  analytics: RehearsalAnalytics;
  projectTitle: string;
  /** Drill down from a trend bar into that rehearsal's roll call. */
  onOpenRehearsal: (rehearsalId: string) => void;
}

/** The statuses worth counting per singer — present is the rate's numerator and
 *  the bulk of the strip, so printing it again taught the eye nothing. */
const EXCEPTION_STATUSES = ["LATE", "ABSENT", "EXCUSED"] as const;

const LEGEND_STATUSES = ["PRESENT", "LATE", "ABSENT", "EXCUSED"] as const;

const rateLabel = (rate: number | null): string =>
  rate === null ? "—" : `${rate}%`;

/* ── Per-singer wrapping heatmap ─────────────────────────────────────────── */
const HeatStrip = ({
  cells,
  rehearsalById,
}: {
  cells: SingerReliability["cells"];
  rehearsalById: Map<string, Rehearsal>;
}): React.JSX.Element => {
  const { t } = useTranslation();

  const dateOf = (rehearsalId: string): string => {
    const rehearsal = rehearsalById.get(rehearsalId);
    return rehearsal
      ? formatLocalizedDate(
          rehearsal.date_time,
          { day: "numeric", month: "short" },
          undefined,
          rehearsal.timezone,
        )
      : "";
  };

  return (
    <div className="flex flex-wrap gap-1">
      {cells.map((cell, index) => {
        const date = dateOf(cell.rehearsalId);
        if (cell.status === null) {
          return (
            <span
              key={cell.rehearsalId + index}
              className="h-3.5 w-3.5 rounded-[3px] border border-dashed border-hairline-strong"
              title={`${date} · ${t("rehearsals.reliability.not_summoned", "Bez wezwania")}`}
            />
          );
        }
        const meta = ATTENDANCE_STATUS_META[cell.status as AttendanceCell];
        return (
          <span
            key={cell.rehearsalId + index}
            className={cn("h-3.5 w-3.5 rounded-[3px]", meta.dot)}
            title={`${date} · ${t(meta.labelKey, meta.fallback)}`}
          />
        );
      })}
    </div>
  );
};

const SingerRow = ({
  singer,
  rehearsalById,
}: {
  singer: SingerReliability;
  rehearsalById: Map<string, Rehearsal>;
}): React.JSX.Element => {
  const { t } = useTranslation();
  const fullName = `${singer.artist.first_name} ${singer.artist.last_name}`;
  const countOf: Record<(typeof EXCEPTION_STATUSES)[number], number> = {
    LATE: singer.late,
    ABSENT: singer.absent,
    EXCUSED: singer.excused,
  };

  return (
    <div className="flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center sm:gap-4">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar src={singer.artist.avatar_thumb_url} name={fullName} size="sm" shape="rounded" />
        <div className="min-w-0">
          <Text size="sm" weight="semibold" truncate className="block">
            {fullName}
          </Text>
          <div className="flex flex-wrap items-center gap-1.5">
            <Caption color="muted">
              {t(voiceSectionLabelKey(singer.section), singer.section)}
            </Caption>
            {singer.chronicAbsence && (
              <Badge variant="danger" icon={<AlertTriangle size={9} />}>
                {t("rehearsals.reliability.flag_absence", "Częste nieobecności")}
              </Badge>
            )}
            {singer.chronicLateness && (
              <Badge variant="warning" icon={<Clock3 size={9} />}>
                {t("rehearsals.reliability.flag_lateness", "Częste spóźnienia")}
              </Badge>
            )}
            {singer.spotless && (
              <Badge variant="success" icon={<Sparkles size={9} />}>
                {t("rehearsals.reliability.flag_spotless", "Wzorowa")}
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="shrink-0 sm:w-44">
        <HeatStrip cells={singer.cells} rehearsalById={rehearsalById} />
      </div>

      <div className="flex shrink-0 items-center justify-end gap-4 sm:w-40">
        {/* Only what departed from plain attendance; a row with nothing to note
            says nothing, which is what makes the ones that do stand out. */}
        <div className="flex items-center gap-2.5">
          {EXCEPTION_STATUSES.map((status) =>
            countOf[status] === 0 ? null : (
              <Caption
                key={status}
                color="muted"
                className="inline-flex items-center gap-1 tabular-nums"
                title={t(
                  ATTENDANCE_STATUS_META[status].labelKey,
                  ATTENDANCE_STATUS_META[status].fallback,
                )}
              >
                <span
                  className={cn("h-2 w-2 rounded-full", ATTENDANCE_STATUS_META[status].dot)}
                  aria-hidden="true"
                />
                {countOf[status]}
              </Caption>
            ),
          )}
        </div>
        {/* A rate in a column of forty rates is a figure that must align, so it
            is sans + tabular — the serif display figure is for a KPI read once. */}
        <Text
          as="span"
          size="md"
          weight="semibold"
          className={cn(
            "w-12 text-right tabular-nums",
            RATE_TONE_TEXT[attendanceRateTone(singer.attendanceRate)],
          )}
        >
          {rateLabel(singer.attendanceRate)}
        </Text>
      </div>
    </div>
  );
};

export const ReliabilityBoard = ({
  analytics,
  projectTitle,
  onOpenRehearsal,
}: ReliabilityBoardProps): React.JSX.Element => {
  const { t } = useTranslation();

  const rehearsalById = React.useMemo(
    () =>
      new Map(analytics.gradedRehearsals.map((r) => [String(r.id), r])),
    [analytics.gradedRehearsals],
  );

  if (!analytics.hasData) {
    return (
      <StatePanel
        icon={<BarChart3 size={22} aria-hidden="true" />}
        title={t("rehearsals.reliability.empty_title", "Brak danych do analizy")}
        description={t(
          "rehearsals.reliability.empty_desc",
          "Analiza frekwencji pojawi się po pierwszej zakończonej próbie z odnotowaną obecnością.",
        )}
      />
    );
  }

  const overallTone = attendanceRateTone(analytics.overallRate);

  return (
    <div className="space-y-5">
      {/* Headline — one display figure, and the two sets it is measured over. */}
      <SectionCard
        as="h2"
        title={t("rehearsals.reliability.title", "Frekwencja projektu")}
        icon={<TrendingUp size={14} />}
        action={
          <Caption color="muted" truncate className="block max-w-56">
            {projectTitle}
          </Caption>
        }
        bodyClassName="gap-4 sm:flex-row sm:items-end sm:justify-between"
      >
        <MetricBlock
          label={t("rehearsals.reliability.overall", "Frekwencja ogółem")}
          value={analytics.overallRate === null ? "—" : analytics.overallRate}
          unit={analytics.overallRate === null ? undefined : "%"}
          accentColor={RATE_TONE_ACCENT[overallTone]}
        />
        {/* The singers who need a conversation are not counted here: the card
            below states them by listing them, flagged rows first. */}
        <StatLine
          stats={[
            {
              id: "graded",
              value: analytics.gradedRehearsals.length,
              label: t("rehearsals.reliability.graded", "zakończonych prób", {
                count: analytics.gradedRehearsals.length,
              }),
            },
            {
              id: "singers",
              value: analytics.singers.length,
              label: t("rehearsals.reliability.roster_size", "śpiewaków", {
                count: analytics.singers.length,
              }),
            },
          ]}
        />
      </SectionCard>

      {/* Sections + trend */}
      <div className="grid gap-5 lg:grid-cols-2">
        <SectionCard
          title={t("rehearsals.reliability.by_section", "Frekwencja sekcji")}
          icon={<Users size={14} />}
          bodyClassName="gap-3"
        >
          {analytics.sections.map((section) => {
            const tone = attendanceRateTone(section.rate);
            return (
              <div key={section.key}>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <Caption className="inline-flex items-center gap-2">
                    <span className="font-semibold text-ethereal-ink">
                      {t(voiceSectionLabelKey(section.key), section.key)}
                    </span>
                    <span className="text-ethereal-graphite/50">
                      {t("rehearsals.reliability.headcount", "{{count}} os.", {
                        count: section.headcount,
                      })}
                    </span>
                  </Caption>
                  <Text
                    as="span"
                    size="sm"
                    weight="semibold"
                    className={cn("tabular-nums", RATE_TONE_TEXT[tone])}
                  >
                    {rateLabel(section.rate)}
                  </Text>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-ethereal-ink/6">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-700 ease-out",
                      RATE_TONE_BAR[tone],
                    )}
                    style={{ width: `${section.rate ?? 0}%` }}
                  />
                </div>
              </div>
            );
          })}
        </SectionCard>

        <SectionCard
          title={t("rehearsals.reliability.trend", "Trend frekwencji")}
          icon={<BarChart3 size={14} />}
          bodyClassName="min-h-40 flex-row items-end gap-2 overflow-x-auto p-4"
        >
          {analytics.trend.map(({ rehearsal, tally }) => {
            const tone = attendanceRateTone(tally.rate);
            // Absolute 0–100 scale so a weak rehearsal reads as short, not tall.
            const height =
              tally.rate === null ? 4 : Math.max(4, Math.round((tally.rate / 100) * 120));
            const date = formatLocalizedDate(
              rehearsal.date_time,
              { day: "numeric", month: "short" },
              undefined,
              rehearsal.timezone,
            );
            return (
              <button
                key={rehearsal.id}
                type="button"
                onClick={() => onOpenRehearsal(String(rehearsal.id))}
                className="group flex w-10 shrink-0 flex-col items-center gap-1.5 rounded-chip px-0.5 py-1 transition-colors hover:bg-ethereal-marble/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40"
                aria-label={t(
                  "rehearsals.reliability.trend_bar",
                  "{{date}}: frekwencja {{rate}}, oznaczono {{marked}} z {{total}}",
                  {
                    date,
                    rate: rateLabel(tally.rate),
                    marked: tally.marked,
                    total: tally.total,
                  },
                )}
              >
                <Text
                  as="span"
                  size="xs"
                  weight="semibold"
                  className={cn("tabular-nums", RATE_TONE_TEXT[tone])}
                >
                  {tally.rate === null ? "—" : tally.rate}
                </Text>
                <div className="flex w-full flex-1 items-end justify-center">
                  <div
                    className={cn(
                      "w-5 rounded-t-md transition-all duration-700 ease-out group-hover:opacity-80",
                      RATE_TONE_BAR[tone],
                    )}
                    style={{ height }}
                  />
                </div>
                <Eyebrow as="span" color="muted" className="whitespace-nowrap">
                  {date}
                </Eyebrow>
              </button>
            );
          })}
        </SectionCard>
      </div>

      {/* Singer reliability */}
      <SectionCard
        title={t("rehearsals.reliability.singers", "Rzetelność śpiewaków")}
        icon={<Users size={14} />}
        scroll
        className="lg:max-h-[60vh]"
        bodyClassName="divide-y divide-hairline p-0"
        // The legend decodes colour ↔ meaning for the strips above it and
        // carries no counts of its own; the arithmetic belongs to the rows.
        footer={
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {LEGEND_STATUSES.map((status) => {
              const meta = ATTENDANCE_STATUS_META[status];
              return (
                <Caption key={status} color="muted" className="inline-flex items-center gap-1.5">
                  <span className={cn("h-2.5 w-2.5 rounded-[3px]", meta.dot)} aria-hidden="true" />
                  {t(meta.labelKey, meta.fallback)}
                </Caption>
              );
            })}
          </div>
        }
      >
        {analytics.singers.length === 0 ? (
          <StatePanel
            variant="inline"
            className="py-10"
            icon={<Users size={22} aria-hidden="true" />}
            title={t("rehearsals.reliability.no_singers", "Brak śpiewaków w tym projekcie")}
          />
        ) : (
          analytics.singers.map((singer) => (
            <SingerRow
              key={singer.participation.id}
              singer={singer}
              rehearsalById={rehearsalById}
            />
          ))
        )}
      </SectionCard>
    </div>
  );
};
