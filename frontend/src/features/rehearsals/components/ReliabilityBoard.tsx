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
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { StatePanel } from "@/shared/ui/composites/StatePanel";
import { Avatar } from "@/shared/ui/composites/Avatar";
import { Badge } from "@/shared/ui/primitives/Badge";
import {
  Caption,
  Eyebrow,
  Heading,
  Metric,
  Text,
} from "@/shared/ui/primitives/typography";
import { formatLocalizedDate } from "@/shared/lib/time/intl";

import type { Rehearsal } from "@/shared/types";
import type { RehearsalAnalytics, SingerReliability } from "../hooks/useRehearsalAnalytics";
import {
  ATTENDANCE_STATUS_META,
  voiceSectionLabelKey,
  type AttendanceCell,
} from "../constants/attendanceMeta";

interface ReliabilityBoardProps {
  analytics: RehearsalAnalytics;
  projectTitle: string;
  /** Drill down from a trend bar into that rehearsal's roll call. */
  onOpenRehearsal: (rehearsalId: string) => void;
}

const reliabilityTone = (
  rate: number | null,
): "sage" | "gold" | "crimson" | "graphite" => {
  if (rate === null) return "graphite";
  if (rate >= 85) return "sage";
  if (rate >= 60) return "gold";
  return "crimson";
};

const TONE_TEXT: Record<"sage" | "gold" | "crimson" | "graphite", string> = {
  sage: "text-ethereal-sage",
  gold: "text-ethereal-gold",
  crimson: "text-ethereal-crimson",
  graphite: "text-ethereal-graphite/60",
};

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
              className="h-3.5 w-3.5 rounded-[3px] border border-dashed border-ethereal-ink/12"
              title={`${date} · ${t("rehearsals.reliability.not_summoned", "Nie wezwany")}`}
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
  const tone = reliabilityTone(singer.attendanceRate);
  const fullName = `${singer.artist.first_name} ${singer.artist.last_name}`;

  return (
    <div className="flex flex-col gap-3 border-b border-ethereal-incense/10 px-5 py-3.5 last:border-b-0 sm:flex-row sm:items-center sm:gap-4">
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

      <div className="flex shrink-0 items-center gap-4 sm:w-44 sm:justify-end">
        <Caption color="muted" className="tabular-nums">
          <span className="text-ethereal-sage">{singer.present}</span>
          {" · "}
          <span className="text-ethereal-gold">{singer.late}</span>
          {" · "}
          <span className="text-ethereal-crimson">{singer.absent}</span>
        </Caption>
        <div className="w-12 text-right">
          <Metric size="lg" className={cn("leading-none tabular-nums", TONE_TEXT[tone])}>
            {singer.attendanceRate === null ? "—" : `${singer.attendanceRate}%`}
          </Metric>
        </div>
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

  return (
    <div className="space-y-5">
      {/* Headline */}
      <GlassCard variant="solid" padding="none" isHoverable={false}>
        <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-ethereal-ink/6 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <TrendingUp size={14} className="text-ethereal-gold/70" aria-hidden="true" />
            <Eyebrow as="h2" color="graphite">
              {t("rehearsals.reliability.title", "Frekwencja projektu")}
            </Eyebrow>
          </div>
          <Caption color="muted" truncate className="max-w-xs">
            {projectTitle}
          </Caption>
        </header>

        <div className="grid grid-cols-2 gap-px bg-ethereal-ink/6 sm:grid-cols-4">
          {[
            {
              label: t("rehearsals.reliability.overall", "Frekwencja ogółem"),
              value: analytics.overallRate === null ? "—" : `${analytics.overallRate}%`,
              tone: TONE_TEXT[reliabilityTone(analytics.overallRate)],
            },
            {
              label: t("rehearsals.reliability.graded", "Zakończone próby"),
              value: analytics.gradedRehearsals.length,
              tone: "text-ethereal-ink",
            },
            {
              label: t("rehearsals.reliability.roster_size", "Śpiewacy"),
              value: analytics.singers.length,
              tone: "text-ethereal-ink",
            },
            {
              label: t("rehearsals.reliability.flagged", "Do rozmowy"),
              value: analytics.singers.filter(
                (s) => s.chronicAbsence || s.chronicLateness,
              ).length,
              tone: "text-ethereal-crimson",
            },
          ].map((cell) => (
            <div key={cell.label} className="bg-ethereal-alabaster px-5 py-4">
              <Eyebrow color="muted">{cell.label}</Eyebrow>
              <Metric size="2xl" className={cn("mt-1 block leading-none tabular-nums", cell.tone)}>
                {cell.value}
              </Metric>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* Sections + trend */}
      <div className="grid gap-5 lg:grid-cols-2">
        <GlassCard variant="solid" padding="none" isHoverable={false}>
          <header className="flex items-center gap-2.5 border-b border-ethereal-ink/6 px-5 py-3.5">
            <Users size={14} className="text-ethereal-gold/70" aria-hidden="true" />
            <Eyebrow as="h3" color="graphite">
              {t("rehearsals.reliability.by_section", "Frekwencja sekcji")}
            </Eyebrow>
          </header>
          <div className="space-y-3 p-4">
            {analytics.sections.map((section) => {
              const tone = reliabilityTone(section.rate);
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
                    <Text as="span" size="sm" weight="semibold" className={cn("tabular-nums", TONE_TEXT[tone])}>
                      {section.rate === null ? "—" : `${section.rate}%`}
                    </Text>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-ethereal-ink/6">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-700 ease-out",
                        tone === "sage"
                          ? "bg-ethereal-sage"
                          : tone === "gold"
                            ? "bg-ethereal-gold"
                            : tone === "crimson"
                              ? "bg-ethereal-crimson"
                              : "bg-ethereal-graphite/40",
                      )}
                      style={{ width: `${section.rate ?? 0}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </GlassCard>

        <GlassCard variant="solid" padding="none" isHoverable={false}>
          <header className="flex items-center gap-2.5 border-b border-ethereal-ink/6 px-5 py-3.5">
            <BarChart3 size={14} className="text-ethereal-gold/70" aria-hidden="true" />
            <Eyebrow as="h3" color="graphite">
              {t("rehearsals.reliability.trend", "Trend frekwencji")}
            </Eyebrow>
          </header>
          <div className="flex items-end gap-2 overflow-x-auto p-4" style={{ minHeight: 160 }}>
            {analytics.trend.map(({ rehearsal, tally }) => {
              // Realised attendance among recorded singers — consistent with the
              // headline + section + singer rates (unmarked rows excluded).
              const realised =
                tally.marked > 0
                  ? Math.round(((tally.present + tally.late) / tally.marked) * 100)
                  : null;
              const tone = reliabilityTone(realised);
              // Absolute 0–100 scale so a weak rehearsal reads as short, not tall.
              const height = realised === null ? 4 : Math.max(4, Math.round((realised / 100) * 120));
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
                  className="group flex w-10 shrink-0 flex-col items-center gap-1.5 rounded-lg px-0.5 py-1 transition-colors hover:bg-ethereal-marble/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40"
                  title={`${date} · ${
                    realised === null ? t("rehearsals.row.status_none", "Nieoznaczony") : `${realised}%`
                  } · ${tally.marked}/${tally.total}`}
                  aria-label={`${date}: ${realised === null ? "—" : `${realised}%`}`}
                >
                  <Text as="span" size="xs" weight="semibold" className={cn("tabular-nums", TONE_TEXT[tone])}>
                    {realised === null ? "—" : realised}
                  </Text>
                  <div className="flex w-full flex-1 items-end justify-center">
                    <div
                      className={cn(
                        "w-5 rounded-t-md transition-all duration-700 ease-out group-hover:opacity-80",
                        tone === "sage"
                          ? "bg-ethereal-sage"
                          : tone === "gold"
                            ? "bg-ethereal-gold"
                            : tone === "crimson"
                              ? "bg-ethereal-crimson"
                              : "bg-ethereal-graphite/40",
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
          </div>
        </GlassCard>
      </div>

      {/* Singer reliability */}
      <GlassCard variant="solid" padding="none" isHoverable={false}>
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-ethereal-ink/6 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <Users size={14} className="text-ethereal-gold/70" aria-hidden="true" />
            <Eyebrow as="h3" color="graphite">
              {t("rehearsals.reliability.singers", "Rzetelność śpiewaków")}
            </Eyebrow>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {(["PRESENT", "LATE", "ABSENT", "EXCUSED"] as const).map((status) => {
              const meta = ATTENDANCE_STATUS_META[status];
              return (
                <Caption key={status} color="muted" className="inline-flex items-center gap-1.5">
                  <span className={cn("h-2.5 w-2.5 rounded-[3px]", meta.dot)} aria-hidden="true" />
                  {t(meta.labelKey, meta.fallback)}
                </Caption>
              );
            })}
          </div>
        </header>

        <div className="lg:max-h-[60vh] lg:overflow-y-auto">
          {analytics.singers.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <Heading as="p" size="lg" weight="medium" color="muted">
                {t("rehearsals.reliability.no_singers", "Brak śpiewaków w tym projekcie.")}
              </Heading>
            </div>
          ) : (
            analytics.singers.map((singer) => (
              <SingerRow
                key={singer.participation.id}
                singer={singer}
                rehearsalById={rehearsalById}
              />
            ))
          )}
        </div>
      </GlassCard>
    </div>
  );
};
