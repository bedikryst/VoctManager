/**
 * @file ProjectStatusStrip.tsx
 * @description At-a-glance command bar for the Project Overview. Surfaces the four
 * questions a conductor opens a production to answer — days to concert, rehearsal
 * progress, program casting completeness, ensemble size — as compact, tappable
 * metric tiles. Each tile deep-links to the work area that resolves it. Derives
 * everything from already-cached suspense queries, so it adds no network cost.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/ProjectCard/widgets/ProjectStatusStrip
 */

import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  CalendarClock,
  CalendarRange,
  ListChecks,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { Project } from "@/shared/types";
import { cn } from "@/shared/lib/utils";
import { Metric, Text } from "@/shared/ui/primitives/typography";
import {
  useProjectRehearsals,
  useProjectParticipations,
} from "../../api/project.read.queries";
import { isPastProjectDate } from "../../lib/projectPresentation";
import { useProgramFulfillment } from "../hooks/useProgramFulfillment";

type ToneName = "neutral" | "gold" | "sage" | "crimson";

interface TileProps {
  readonly label: string;
  readonly value: string;
  readonly unit?: string;
  readonly icon: LucideIcon;
  readonly tone?: ToneName;
  readonly progress?: number;
  readonly onClick: () => void;
  readonly ariaLabel: string;
}

const VALUE_TONE: Record<ToneName, string> = {
  neutral: "text-ethereal-ink",
  gold: "text-ethereal-gold",
  sage: "text-ethereal-sage",
  crimson: "text-ethereal-crimson",
};

const BAR_TONE: Record<ToneName, string> = {
  neutral: "bg-ethereal-graphite/40",
  gold: "bg-ethereal-gold",
  sage: "bg-ethereal-sage",
  crimson: "bg-ethereal-crimson",
};

const StatusTile = ({
  label,
  value,
  unit,
  icon: Icon,
  tone = "neutral",
  progress,
  onClick,
  ariaLabel,
}: TileProps): React.JSX.Element => (
  <button
    type="button"
    onClick={onClick}
    aria-label={ariaLabel}
    className="group flex flex-col gap-3 rounded-2xl border border-ethereal-ink/6 bg-ethereal-marble p-4 text-left shadow-glass-solid transition-[transform,border-color,box-shadow] duration-300 hover:-translate-y-0.5 hover:border-ethereal-gold/35 hover:shadow-glass-ethereal-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40"
  >
    <div className="flex items-center justify-between">
      <Text
        as="span"
        className="truncate text-[10px] font-bold uppercase tracking-widest text-ethereal-graphite/55"
      >
        {label}
      </Text>
      <Icon
        size={15}
        className="shrink-0 text-ethereal-gold/55 transition-colors group-hover:text-ethereal-gold"
        aria-hidden="true"
      />
    </div>

    <div className="flex items-baseline gap-1.5">
      <Metric
        as="span"
        className={cn("text-3xl leading-none tabular-nums", VALUE_TONE[tone])}
      >
        {value}
      </Metric>
      {unit && (
        <Text as="span" className="text-xs text-ethereal-graphite/55">
          {unit}
        </Text>
      )}
    </div>

    {typeof progress === "number" && (
      <div className="h-1 w-full rounded-full bg-ethereal-ink/8">
        <div
          className={cn(
            "h-1 rounded-full transition-all duration-500",
            BAR_TONE[tone],
          )}
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
      </div>
    )}
  </button>
);

interface ProjectStatusStripProps {
  project: Project;
}

export const ProjectStatusStrip = ({
  project,
}: ProjectStatusStripProps): React.JSX.Element => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const base = `/panel/projects/${project.id}`;

  const { data: rehearsals } = useProjectRehearsals(String(project.id));
  const { data: participations } = useProjectParticipations(String(project.id));
  const { enrichedProgram } = useProgramFulfillment(project);

  const daysToConcert = useMemo<number | null>(() => {
    if (!project.date_time) return null;
    const target = new Date(project.date_time);
    if (Number.isNaN(target.getTime())) return null;
    target.setHours(0, 0, 0, 0);
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    return Math.round((target.getTime() - startOfToday.getTime()) / 86_400_000);
  }, [project.date_time]);

  const rehearsalsDone = useMemo(
    () => rehearsals.filter((r) => isPastProjectDate(r.date_time)).length,
    [rehearsals],
  );

  const program = useMemo(() => {
    const cast = enrichedProgram.filter(
      (item) => item.statusVariant === "success",
    ).length;
    const gaps = enrichedProgram.filter(
      (item) => item.statusVariant === "warning",
    ).length;
    return { cast, gaps, withReqs: cast + gaps };
  }, [enrichedProgram]);

  // Tile 1 — countdown to the concert date.
  const countdown = (() => {
    if (daysToConcert === null) {
      return {
        value: "—",
        unit: undefined,
        tone: "neutral" as ToneName,
      };
    }
    if (daysToConcert < 0) {
      return {
        value: t("projects.overview.kpi.past", "Po terminie"),
        unit: undefined,
        tone: "neutral" as ToneName,
      };
    }
    if (daysToConcert === 0) {
      return {
        value: t("projects.overview.kpi.today", "Dziś"),
        unit: undefined,
        tone: "gold" as ToneName,
      };
    }
    return {
      value: String(daysToConcert),
      unit: t("projects.overview.kpi.days", "dni"),
      tone: daysToConcert <= 7 ? ("gold" as ToneName) : ("neutral" as ToneName),
    };
  })();

  const rehearsalsTone: ToneName =
    rehearsals.length > 0 && rehearsalsDone === rehearsals.length
      ? "sage"
      : "neutral";

  const programTone: ToneName =
    program.withReqs === 0 ? "neutral" : program.gaps > 0 ? "gold" : "sage";

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <StatusTile
        label={t("projects.overview.kpi.countdown", "Do koncertu")}
        value={countdown.value}
        unit={countdown.unit}
        tone={countdown.tone}
        icon={CalendarClock}
        onClick={() => navigate(`${base}/details`)}
        ariaLabel={t("projects.overview.kpi.countdown_aria", "Szczegóły terminu")}
      />
      <StatusTile
        label={t("projects.overview.kpi.rehearsals", "Próby")}
        value={`${rehearsalsDone}/${rehearsals.length}`}
        tone={rehearsalsTone}
        progress={
          rehearsals.length > 0
            ? (rehearsalsDone / rehearsals.length) * 100
            : 0
        }
        icon={CalendarRange}
        onClick={() => navigate(`${base}/rehearsals`)}
        ariaLabel={t("projects.overview.kpi.rehearsals_aria", "Przejdź do prób")}
      />
      <StatusTile
        label={t("projects.overview.kpi.program", "Obsada programu")}
        value={
          program.withReqs === 0
            ? String(enrichedProgram.length)
            : `${program.cast}/${program.withReqs}`
        }
        unit={
          program.gaps > 0
            ? t("projects.overview.kpi.gaps", "{{count}} luk", {
                count: program.gaps,
              })
            : undefined
        }
        tone={programTone}
        icon={ListChecks}
        onClick={() => navigate(`${base}/divisi`)}
        ariaLabel={t("projects.overview.kpi.program_aria", "Przejdź do divisi")}
      />
      <StatusTile
        label={t("projects.overview.kpi.ensemble", "Zespół")}
        value={String(participations.length)}
        unit={t("projects.overview.kpi.artists", "artystów")}
        icon={Users}
        onClick={() => navigate(`${base}/cast`)}
        ariaLabel={t("projects.overview.kpi.ensemble_aria", "Przejdź do obsady")}
      />
    </div>
  );
};
