/**
 * @file ProjectAttentionPanel.tsx
 * @description The focal card of the Project Overview — the one surface that turns a
 * passive dashboard into a worklist. Derives the open production items (casting gaps,
 * reported absences, missing setup) from already-cached suspense queries and ranks them
 * by urgency: crimson = a real alarm that threatens the concert, amber = pending setup.
 * When nothing is outstanding it resolves to a calm "all clear" state instead of an
 * empty card. Each row deep-links to the work area that resolves it.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/ProjectCard/widgets/ProjectAttentionPanel
 */

import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  ListChecks,
  ListOrdered,
  Shirt,
  UserMinus,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { Project } from "@/shared/types";
import { cn } from "@/shared/lib/utils";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Caption, Eyebrow, Text } from "@/shared/ui/primitives/typography";
import {
  useProjectRehearsals,
  useProjectParticipations,
} from "../../api/project.read.queries";
import { useScorePackageState } from "../../api/project.score-package";
import { isFutureProjectDate } from "../../lib/projectPresentation";
import { useProgramFulfillment } from "../hooks/useProgramFulfillment";

type AttentionTone = "crimson" | "amber";

interface AttentionItem {
  readonly id: string;
  readonly tone: AttentionTone;
  readonly icon: LucideIcon;
  readonly label: string;
  readonly value?: string;
  readonly segment: string;
}

interface ProjectAttentionPanelProps {
  project: Project;
}

const DOT_TONE: Record<AttentionTone, string> = {
  crimson: "bg-ethereal-crimson",
  amber: "bg-ethereal-gold",
};

const VALUE_TONE: Record<AttentionTone, string> = {
  crimson: "text-ethereal-crimson",
  amber: "text-ethereal-gold",
};

export const ProjectAttentionPanel = ({
  project,
}: ProjectAttentionPanelProps): React.JSX.Element => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const base = `/panel/projects/${project.id}`;

  const { data: rehearsals } = useProjectRehearsals(String(project.id));
  const { data: participations } = useProjectParticipations(String(project.id));
  const { data: scorePackage } = useScorePackageState(String(project.id));
  const { enrichedProgram } = useProgramFulfillment(project);

  const items = useMemo<AttentionItem[]>(() => {
    const next: AttentionItem[] = [];

    // ── Crimson: real alarms that threaten the concert ──────────────────────
    const programGaps = enrichedProgram.filter(
      (item) => item.statusVariant === "warning",
    ).length;
    if (programGaps > 0) {
      next.push({
        id: "program-gaps",
        tone: "crimson",
        icon: ListChecks,
        label: t("projects.overview.attention.program_gaps", "Luki w obsadzie programu"),
        value: String(programGaps),
        segment: "divisi",
      });
    }

    const upcomingAbsences = rehearsals
      .filter((rehearsal) => isFutureProjectDate(rehearsal.date_time))
      .reduce((sum, rehearsal) => sum + (rehearsal.absent_count ?? 0), 0);
    if (upcomingAbsences > 0) {
      next.push({
        id: "rehearsal-absences",
        tone: "crimson",
        icon: UserMinus,
        label: t(
          "projects.overview.attention.absences",
          "Zgłoszone nieobecności na próbach",
        ),
        value: String(upcomingAbsences),
        segment: "rehearsals",
      });
    }

    // ── Amber: pending setup, not yet an alarm ──────────────────────────────
    if (participations.length === 0) {
      next.push({
        id: "no-cast",
        tone: "amber",
        icon: Users,
        label: t("projects.overview.attention.no_cast", "Brak obsady wokalnej"),
        segment: "cast",
      });
    }

    if (enrichedProgram.length === 0) {
      next.push({
        id: "no-program",
        tone: "amber",
        icon: ListOrdered,
        label: t("projects.overview.attention.no_program", "Pusty program koncertu"),
        segment: "program",
      });
    }

    if (rehearsals.length === 0) {
      next.push({
        id: "no-rehearsals",
        tone: "amber",
        icon: Calendar,
        label: t("projects.overview.attention.no_rehearsals", "Brak zaplanowanych prób"),
        segment: "rehearsals",
      });
    }

    if (!project.run_sheet || project.run_sheet.length === 0) {
      next.push({
        id: "no-runsheet",
        tone: "amber",
        icon: Clock,
        label: t("projects.overview.attention.no_runsheet", "Brak harmonogramu dnia"),
        segment: "details",
      });
    }

    if (!project.score_pdf) {
      next.push({
        id: "no-score",
        tone: "amber",
        icon: FileText,
        label: t("projects.overview.attention.no_score", "Brak partytury (PDF)"),
        segment: "partytura",
      });
    } else if (scorePackage?.is_stale) {
      next.push({
        id: "stale-score",
        tone: "amber",
        icon: FileText,
        label: t("projects.overview.attention.stale_score", "Partytura nieaktualna"),
        segment: "partytura",
      });
    }

    if (!project.dress_code_female && !project.dress_code_male) {
      next.push({
        id: "no-dress",
        tone: "amber",
        icon: Shirt,
        label: t("projects.overview.attention.no_dress", "Brak ustalonego dress code'u"),
        segment: "details",
      });
    }

    return next;
  }, [enrichedProgram, rehearsals, participations.length, project, scorePackage?.is_stale, t]);

  const hasAlarm = items.some((item) => item.tone === "crimson");
  const isClear = items.length === 0;

  const headerToneClass = isClear
    ? "border-ethereal-sage/25 bg-ethereal-sage/10 text-ethereal-sage"
    : hasAlarm
      ? "border-ethereal-crimson/20 bg-ethereal-crimson/10 text-ethereal-crimson"
      : "border-ethereal-gold/25 bg-ethereal-gold/10 text-ethereal-gold";

  const HeaderIcon = isClear ? CheckCircle2 : AlertTriangle;

  return (
    <GlassCard variant="solid" padding="none" isHoverable={false} className="flex flex-col">
      <header className="flex items-center gap-3 border-b border-ethereal-ink/6 px-5 py-3.5">
        <span
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border",
            headerToneClass,
          )}
          aria-hidden="true"
        >
          <HeaderIcon size={16} />
        </span>
        <Eyebrow as="h3" color="graphite" className="flex-1 truncate">
          {t("projects.overview.attention.title", "Wymaga uwagi")}
        </Eyebrow>
        {!isClear && (
          <span
            className={cn(
              "flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-[11px] font-bold tabular-nums",
              hasAlarm
                ? "bg-ethereal-crimson/10 text-ethereal-crimson"
                : "bg-ethereal-gold/10 text-ethereal-gold",
            )}
          >
            {items.length}
          </span>
        )}
      </header>

      {isClear ? (
        <div className="flex items-center gap-3 px-5 py-4">
          <span
            className="h-2 w-2 shrink-0 rounded-full bg-ethereal-sage"
            aria-hidden="true"
          />
          <div className="flex flex-col">
            <Text size="sm" weight="medium">
              {t("projects.overview.attention.clear_title", "Wszystko gotowe")}
            </Text>
            <Caption color="muted">
              {t(
                "projects.overview.attention.clear_desc",
                "Produkcja jest skompletowana — nic nie wymaga teraz Twojej uwagi.",
              )}
            </Caption>
          </div>
        </div>
      ) : (
        <ul className="divide-y divide-ethereal-ink/5">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => navigate(`${base}/${item.segment}`)}
                  className="group flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-ethereal-alabaster/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ethereal-gold/40"
                >
                  <span
                    className={cn(
                      "h-2 w-2 shrink-0 rounded-full",
                      DOT_TONE[item.tone],
                    )}
                    aria-hidden="true"
                  />
                  <Icon
                    size={15}
                    className="shrink-0 text-ethereal-graphite/45"
                    aria-hidden="true"
                  />
                  <Text as="span" size="sm" weight="medium" className="flex-1 truncate">
                    {item.label}
                  </Text>
                  {item.value && (
                    <span
                      className={cn(
                        "text-sm font-bold tabular-nums",
                        VALUE_TONE[item.tone],
                      )}
                    >
                      {item.value}
                    </span>
                  )}
                  <ChevronRight
                    size={16}
                    className="shrink-0 text-ethereal-graphite/35 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:text-ethereal-gold"
                    aria-hidden="true"
                  />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </GlassCard>
  );
};
