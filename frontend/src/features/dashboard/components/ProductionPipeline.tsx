/**
 * @file ProductionPipeline.tsx
 * @description The conductor's operational to-do list — every active/upcoming
 * production with its readiness at a glance: cast-confirmation ring, how many
 * invitations are still pending (the actionable signal, amber), rehearsals to
 * the premiere and programme size. Replaces the old aggregate "Status Zaproszeń"
 * tile (three numbers behind a modal) with a per-project triage that links
 * straight into each project hub. Aggregate totals are kept as a header summary.
 * @module features/dashboard/components/ProductionPipeline
 */

import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  CalendarClock,
  ChevronRight,
  Clock,
  ListMusic,
  UserCheck,
  UserX,
} from "lucide-react";

import { ProjectInvitationsSheet } from "./ProjectInvitationsSheet";

import type { ProjectStatus } from "@/features/projects/constants/projectDomain";
import { PROJECT_STATUS } from "@/features/projects/constants/projectDomain";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { SectionHeader } from "@/shared/ui/composites/SectionHeader";
import { CompletionRing } from "@/shared/ui/composites/CompletionRing";
import { Eyebrow, Heading, Text } from "@/shared/ui/primitives/typography";
import { formatLocalizedDate } from "@/shared/lib/time/intl";
import { cn } from "@/shared/lib/utils";

export interface InvitationStatsDto {
  confirmed: number;
  pending: number;
  declined: number;
}

export interface PipelineProjectDto {
  id: string;
  title: string;
  dateTime: string;
  timezone?: string;
  status: ProjectStatus;
  castConfirmed: number;
  castPending: number;
  castDeclined: number;
  castTotal: number;
  rehearsalsUpcoming: number;
  piecesTotal: number;
}

interface ProductionPipelineProps {
  stats: InvitationStatsDto;
  projects: PipelineProjectDto[];
}

const AggregateChip = ({
  Icon,
  value,
  label,
  tone,
}: {
  Icon: typeof UserCheck;
  value: number;
  label: string;
  tone: "sage" | "gold" | "graphite";
}): React.JSX.Element => {
  const toneClass =
    tone === "sage"
      ? "text-ethereal-sage"
      : tone === "gold"
        ? "text-ethereal-gold"
        : "text-ethereal-graphite/60";
  return (
    <div
      title={label}
      className="flex items-center gap-1.5 rounded-xl border border-ethereal-incense/15 bg-ethereal-alabaster px-3 py-1.5 shadow-glass-ethereal"
    >
      <Icon size={14} className={toneClass} aria-hidden="true" />
      <span className="text-sm font-bold tabular-nums text-ethereal-ink">
        {value}
      </span>
      <Eyebrow color="muted" className="hidden sm:inline">
        {label}
      </Eyebrow>
    </div>
  );
};

const PipelineRow = ({
  project,
  onOpen,
}: {
  project: PipelineProjectDto;
  onOpen: (project: PipelineProjectDto) => void;
}): React.JSX.Element => {
  const { t } = useTranslation();
  const pct =
    project.castTotal > 0
      ? Math.round((project.castConfirmed / project.castTotal) * 100)
      : 0;
  const hasPending = project.castPending > 0;
  const statusLabel =
    project.status === PROJECT_STATUS.ACTIVE
      ? t("dashboard.admin.pipeline.status_active", "W produkcji")
      : t("dashboard.admin.pipeline.status_prep", "Przygotowanie");

  return (
    <button
      type="button"
      onClick={() => onOpen(project)}
      aria-haspopup="dialog"
      className="group flex w-full items-center gap-3 rounded-2xl border border-ethereal-incense/12 bg-ethereal-alabaster/50 p-3 text-left transition-all hover:border-ethereal-gold/30 hover:bg-ethereal-alabaster hover:shadow-glass-ethereal-hover active:scale-[0.99] sm:gap-4 sm:p-3.5"
    >
      <CompletionRing
        value={pct}
        tone={hasPending ? "gold" : "sage"}
        size={48}
        strokeWidth={4}
        className="shrink-0"
      >
        <span className="text-[11px] font-bold tabular-nums text-ethereal-ink">
          {project.castConfirmed}/{project.castTotal}
        </span>
      </CompletionRing>

      <div className="min-w-0 flex-1">
        <Heading as="h3" size="md" weight="bold" className="truncate leading-tight">
          {project.title}
        </Heading>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
          <Eyebrow color="muted" className="flex items-center gap-1">
            <CalendarClock size={11} aria-hidden="true" />
            {formatLocalizedDate(
              project.dateTime,
              { day: "numeric", month: "short" },
              undefined,
              project.timezone,
            )}
          </Eyebrow>
          <Eyebrow color="muted" className="hidden items-center gap-1 sm:flex">
            <Clock size={11} aria-hidden="true" />
            {t("dashboard.admin.pipeline.rehearsals_left", "{{count}} prób", {
              count: project.rehearsalsUpcoming,
            })}
          </Eyebrow>
          <Eyebrow color="muted" className="hidden items-center gap-1 sm:flex">
            <ListMusic size={11} aria-hidden="true" />
            {t("dashboard.admin.pipeline.pieces", "{{count}} utw.", {
              count: project.piecesTotal,
            })}
          </Eyebrow>
          <Eyebrow color="incense-muted">{statusLabel}</Eyebrow>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {hasPending ? (
          <span className="flex items-center gap-1 rounded-lg border border-ethereal-gold/30 bg-ethereal-gold/10 px-2.5 py-1">
            <Clock size={11} className="text-ethereal-gold" aria-hidden="true" />
            <span className="text-xs font-bold tabular-nums text-ethereal-ink">
              {project.castPending}
            </span>
            <Eyebrow color="gold" className="hidden md:inline">
              {t("dashboard.admin.pipeline.pending_short", "czeka")}
            </Eyebrow>
          </span>
        ) : project.castTotal > 0 ? (
          <span className="hidden items-center gap-1 rounded-lg border border-ethereal-sage/25 bg-ethereal-sage/10 px-2.5 py-1 sm:flex">
            <UserCheck size={11} className="text-ethereal-sage" aria-hidden="true" />
            <Eyebrow color="sage">
              {t("dashboard.admin.pipeline.complete", "komplet")}
            </Eyebrow>
          </span>
        ) : null}
        <ChevronRight
          size={16}
          className="text-ethereal-graphite/35 transition-transform group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </div>
    </button>
  );
};

export const ProductionPipeline = ({
  stats,
  projects,
}: ProductionPipelineProps): React.JSX.Element => {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<PipelineProjectDto | null>(null);

  return (
    <>
    <GlassCard variant="light" padding="none" isHoverable={false} withNoise className="p-6 md:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <SectionHeader
          title={t("dashboard.admin.pipeline.title", "Linia produkcji")}
          icon={<UserCheck size={16} strokeWidth={1.5} />}
          withFluidDivider={false}
          className="!mb-0 !pb-0"
        />
        <div className="flex flex-wrap items-center gap-2">
          <AggregateChip
            Icon={UserCheck}
            value={stats.confirmed}
            label={t("dashboard.admin.inv_confirmed", "Potwierdzeni")}
            tone="sage"
          />
          <AggregateChip
            Icon={Clock}
            value={stats.pending}
            label={t("dashboard.admin.inv_pending", "Oczekujący")}
            tone="gold"
          />
          <AggregateChip
            Icon={UserX}
            value={stats.declined}
            label={t("dashboard.admin.inv_declined", "Odrzucili")}
            tone="graphite"
          />
        </div>
      </div>

      <div className={cn("mt-6 flex flex-col gap-2.5")}>
        {projects.length > 0 ? (
          projects.map((project) => (
            <PipelineRow
              key={project.id}
              project={project}
              onOpen={setSelected}
            />
          ))
        ) : (
          <Text size="sm" color="muted" className="py-6 text-center italic">
            {t(
              "dashboard.admin.pipeline.empty",
              "Brak aktywnych produkcji. Czas zaplanować kolejny koncert.",
            )}
          </Text>
        )}
      </div>

      <Link
        to="/panel/projects"
        className="group mt-5 inline-flex items-center gap-1.5 text-ethereal-graphite/70 transition-colors hover:text-ethereal-gold"
      >
        <Eyebrow color="inherit">
          {t("dashboard.admin.pipeline.see_all", "Wszystkie projekty")}
        </Eyebrow>
        <ArrowRight
          size={13}
          aria-hidden="true"
          className="transition-transform group-hover:translate-x-0.5"
        />
      </Link>
    </GlassCard>

    <ProjectInvitationsSheet
      projectId={selected?.id ?? null}
      projectTitle={selected?.title ?? ""}
      isOpen={selected !== null}
      onClose={() => setSelected(null)}
    />
    </>
  );
};
