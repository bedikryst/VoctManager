/**
 * @file ContractsMetricsGrid.tsx
 * @description Portfolio and project KPI grid for the contracts dashboard.
 * Adapts its narrative to the selected settlement context without duplicating layout code.
 * @architecture Enterprise SaaS 2026
 */

import React from "react";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  FolderKanban,
  Wallet,
  Users,
} from "lucide-react";

import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { MetricBlock } from "@/shared/ui/composites/MetricBlock";
import { Text } from "@/shared/ui/primitives/typography";
import { formatInteger } from "../lib/contractsPresentation";

interface ContractsMetricsGridProps {
  isProjectSelected: boolean;
  globalBudget: string;
  globalCompletionRate: number;
  liveProjectsCount: number;
  archivedProjectsCount: number;
  projectBudget: string;
  projectPricedContracts: number;
  projectTotalContracts: number;
  projectMissingContracts: number;
  castCount: number;
  crewCount: number;
}

export function ContractsMetricsGrid({
  isProjectSelected,
  globalBudget,
  globalCompletionRate,
  liveProjectsCount,
  archivedProjectsCount,
  projectBudget,
  projectPricedContracts,
  projectTotalContracts,
  projectMissingContracts,
  castCount,
  crewCount,
}: ContractsMetricsGridProps): React.JSX.Element {
  const { t } = useTranslation();

  const metrics = isProjectSelected
    ? [
        {
          key: "project-budget",
          label: t("contracts.metrics.project_budget", "Personnel budget"),
          value: projectBudget,
          description: t(
            "contracts.metrics.project_budget_desc",
            "Current gross budget across cast and crew.",
          ),
          icon: <Wallet />,
          accentColor: "gold" as const,
        },
        {
          key: "project-priced",
          label: t("contracts.metrics.project_priced", "Priced contracts"),
          value: `${formatInteger(projectPricedContracts)} / ${formatInteger(projectTotalContracts)}`,
          description: t(
            "contracts.metrics.project_priced_desc",
            "Contracts with a defined remuneration value.",
          ),
          icon: <CheckCircle2 />,
          accentColor: "default" as const,
        },
        {
          key: "project-missing",
          label: t("contracts.metrics.project_missing", "Missing valuations"),
          value: formatInteger(projectMissingContracts),
          description: t(
            "contracts.metrics.project_missing_desc",
            "These records still block direct PDF generation.",
          ),
          icon: <AlertTriangle />,
          accentColor: projectMissingContracts > 0 ? ("crimson" as const) : ("default" as const),
        },
        {
          key: "project-mix",
          label: t("contracts.metrics.project_mix", "Personnel mix"),
          value: `${formatInteger(castCount)} / ${formatInteger(crewCount)}`,
          description: t(
            "contracts.metrics.project_mix_desc",
            "Cast versus crew headcount in the active ledger.",
          ),
          icon: <Users />,
          accentColor: "default" as const,
        },
      ]
    : [
        {
          key: "global-budget",
          label: t("contracts.metrics.global_budget", "Global budget"),
          value: globalBudget,
          description: t(
            "contracts.metrics.global_budget_desc",
            "All remunerations already introduced into the platform.",
          ),
          icon: <Wallet />,
          accentColor: "gold" as const,
        },
        {
          key: "global-coverage",
          label: t("contracts.metrics.global_coverage", "Valuation coverage"),
          value: `${globalCompletionRate}%`,
          description: t(
            "contracts.metrics.global_coverage_desc",
            "How much of the entire portfolio is already priced.",
          ),
          icon: <CheckCircle2 />,
          accentColor: "default" as const,
        },
        {
          key: "global-live",
          label: t("contracts.metrics.global_live", "Live projects"),
          value: formatInteger(liveProjectsCount),
          description: t(
            "contracts.metrics.global_live_desc",
            "Draft and active events available for ongoing settlements.",
          ),
          icon: <FolderKanban />,
          accentColor: "default" as const,
        },
        {
          key: "global-archive",
          label: t("contracts.metrics.global_archive", "Archived projects"),
          value: formatInteger(archivedProjectsCount),
          description: t(
            "contracts.metrics.global_archive_desc",
            "Completed productions still available for historical exports.",
          ),
          icon: <Archive />,
          accentColor: "default" as const,
        },
      ];

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <GlassCard
          key={metric.key}
          variant="light"
          padding="md"
          isHoverable={false}
          className="gap-4"
        >
          <MetricBlock
            label={metric.label}
            value={metric.value}
            icon={metric.icon}
            accentColor={metric.accentColor}
          />
          <Text size="xs" color="graphite">
            {metric.description}
          </Text>
        </GlassCard>
      ))}
    </div>
  );
}
