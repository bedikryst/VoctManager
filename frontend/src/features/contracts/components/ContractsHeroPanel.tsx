/**
 * @file ContractsHeroPanel.tsx
 * @description Primary hero and project context surface for the contracts dashboard.
 * Aligns finance workflows with the shared Ethereal page shell and control patterns.
 * @architecture Enterprise SaaS 2026
 */

import React from "react";
import { useTranslation } from "react-i18next";
import {
  CalendarClock,
  MapPin,
  ReceiptText,
  Sparkles,
  Users,
  Wrench,
} from "lucide-react";

import { getLocationLabel } from "@/features/projects/lib/projectPresentation";
import { formatLocalizedDateTime } from "@/shared/lib/time/intl";
import type { Project } from "@/shared/types";
import { cn } from "@/shared/lib/utils";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Select } from "@/shared/ui/primitives/Select";
import { StatusBadge } from "@/shared/ui/primitives/StatusBadge";
import { Heading, Text, Eyebrow } from "@/shared/ui/primitives/typography";
import {
  formatContractCurrency,
  formatInteger,
  getProjectStatusMeta,
} from "../lib/contractsPresentation";

interface ContractsHeroPanelProps {
  projects: Project[];
  selectedProjectId: string;
  selectedProject: Project | null;
  totalProjects: number;
  globalCompletionRate: number;
  globalBudget: number;
  activeProjectsCount: number;
  draftProjectsCount: number;
  projectBudget: number;
  projectContractCount: number;
  projectCompletionRate: number;
  castCount: number;
  crewCount: number;
  onProjectChange: (projectId: string) => void;
}

const ContextStat = ({
  icon,
  label,
  value,
  tone = "light",
  className,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: "light" | "dark";
  className?: string;
}) => (
  <div
    className={cn(
      "rounded-[1.5rem] border border-ethereal-incense/15 bg-white/55 p-4 shadow-[0_12px_32px_rgba(22,20,18,0.05)]",
      className,
    )}
  >
    <div
      className={cn(
        "mb-2 flex items-center gap-2",
        tone === "dark" ? "text-ethereal-marble/70" : "text-ethereal-incense/70",
      )}
    >
      {icon}
      <Eyebrow color="inherit">{label}</Eyebrow>
    </div>
    <Text
      size="sm"
      weight="medium"
      color={tone === "dark" ? "marble" : "default"}
      className="leading-snug"
    >
      {value}
    </Text>
  </div>
);

export function ContractsHeroPanel({
  projects,
  selectedProjectId,
  selectedProject,
  totalProjects,
  globalCompletionRate,
  globalBudget,
  activeProjectsCount,
  draftProjectsCount,
  projectBudget,
  projectContractCount,
  projectCompletionRate,
  castCount,
  crewCount,
  onProjectChange,
}: ContractsHeroPanelProps): React.JSX.Element {
  const { t } = useTranslation();

  const projectStatusMeta = selectedProject
    ? getProjectStatusMeta(selectedProject.status)
    : null;

  const scheduledAt = selectedProject
    ? formatLocalizedDateTime(
        selectedProject.date_time,
        {
          day: "2-digit",
          month: "long",
          hour: "2-digit",
          minute: "2-digit",
        },
        undefined,
        selectedProject.timezone,
      )
    : t(
        "contracts.hero.context_schedule_placeholder",
        "Select an event to activate the settlement workspace.",
      );

  const locationLabel =
    selectedProject && getLocationLabel(selectedProject.location)
      ? getLocationLabel(selectedProject.location)!
      : t(
          "contracts.hero.context_location_placeholder",
          "Event venue and logistics context will appear here.",
        );

  const personnelLabel = selectedProject
    ? `${formatInteger(castCount)} ${t("contracts.hero.cast", "cast")} / ${formatInteger(crewCount)} ${t("contracts.hero.crew", "crew")}`
    : `${formatInteger(activeProjectsCount)} ${t("contracts.hero.active_projects", "active")} / ${formatInteger(draftProjectsCount)} ${t("contracts.hero.draft_projects", "draft")}`;

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.9fr)]">
      <GlassCard
        variant="dark"
        padding="lg"
        glow={true}
        className="overflow-hidden"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(194,168,120,0.18),transparent_32%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.08),transparent_24%)]" />
        <div className="flex h-full flex-col justify-between gap-8">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="glass" icon={<Sparkles size={12} />}>
                {selectedProject
                  ? t(
                      "contracts.hero.context_badge_active",
                      "Active settlement context",
                    )
                  : t(
                      "contracts.hero.context_badge_idle",
                      "Finance operations workspace",
                    )}
              </Badge>

              {projectStatusMeta && (
                <StatusBadge
                  variant={projectStatusMeta.tone}
                  label={t(
                    projectStatusMeta.translationKey,
                    projectStatusMeta.fallback,
                  )}
                  isPulsing={projectStatusMeta.tone === "active"}
                />
              )}
            </div>

            <div className="space-y-3">
              <Heading as="h2" size="5xl" color="marble" weight="medium">
                {selectedProject
                  ? selectedProject.title
                  : t(
                      "contracts.hero.title_default",
                      "Contracts and payroll cockpit",
                    )}
              </Heading>
              <Text color="parchment-muted" className="max-w-2xl">
                {selectedProject
                  ? t(
                      "contracts.hero.description_selected",
                      "Control valuations, payout readiness, and document exports for the selected production without leaving the ledger surface.",
                    )
                  : t(
                      "contracts.hero.description_default",
                      "Choose a project to manage cast fees, crew remuneration, and contract-ready PDFs in one coherent workspace.",
                    )}
              </Text>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <ContextStat
              icon={<ReceiptText size={14} strokeWidth={1.5} />}
              label={t("contracts.hero.stat_contracts", "Contracts")}
              value={
                selectedProject
                  ? `${formatInteger(projectContractCount)} ${t("contracts.hero.contract_records", "records")}`
                  : `${formatInteger(totalProjects)} ${t("contracts.hero.portfolio_projects", "projects in portfolio")}`
              }
              tone="dark"
              className="bg-white/10 text-ethereal-marble"
            />
            <ContextStat
              icon={<Sparkles size={14} strokeWidth={1.5} />}
              label={t("contracts.hero.stat_budget", "Budget posture")}
              value={
                selectedProject
                  ? formatContractCurrency(projectBudget)
                  : formatContractCurrency(globalBudget)
              }
              tone="dark"
              className="bg-white/10 text-ethereal-marble"
            />
            <ContextStat
              icon={<Users size={14} strokeWidth={1.5} />}
              label={t("contracts.hero.stat_completion", "Valuation coverage")}
              value={`${selectedProject ? projectCompletionRate : globalCompletionRate}%`}
              tone="dark"
              className="bg-white/10 text-ethereal-marble"
            />
          </div>
        </div>
      </GlassCard>

      <GlassCard variant="light" padding="md" isHoverable={false}>
        <div className="flex h-full flex-col gap-5">
          <div className="space-y-2">
            <Eyebrow color="muted">
              {t("contracts.hero.selector_eyebrow", "Project scope")}
            </Eyebrow>
            <Text color="graphite">
              {t(
                "contracts.hero.selector_description",
                "The selected event becomes the operational context for valuations, budget checks, and PDF generation.",
              )}
            </Text>
          </div>

          <Select
            value={selectedProjectId}
            onChange={(event) => onProjectChange(event.target.value)}
            label={t("contracts.hero.selector_label", "Settlement context")}
            leftIcon={<ReceiptText size={16} aria-hidden="true" />}
          >
            <option value="">
              {t(
                "contracts.hero.selector_placeholder",
                "Choose an event from the portfolio",
              )}
            </option>

            {projects.map((project) => (
              <option key={project.id} value={String(project.id)}>
                {project.title}
              </option>
            ))}
          </Select>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <ContextStat
              icon={<CalendarClock size={14} strokeWidth={1.5} />}
              label={t("contracts.hero.context_schedule", "Schedule")}
              value={scheduledAt}
            />
            <ContextStat
              icon={<MapPin size={14} strokeWidth={1.5} />}
              label={t("contracts.hero.context_location", "Location")}
              value={locationLabel}
            />
            <ContextStat
              icon={<Wrench size={14} strokeWidth={1.5} />}
              label={t("contracts.hero.context_mix", "Personnel mix")}
              value={personnelLabel}
              className="sm:col-span-2 xl:col-span-1"
            />
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
