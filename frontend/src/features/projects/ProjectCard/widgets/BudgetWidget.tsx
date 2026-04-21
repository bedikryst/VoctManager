/**
 * @file BudgetWidget.tsx
 * @description Dashboard widget displaying the high-level estimated production cost.
 * @architecture Enterprise SaaS 2026
 * @module panel/projects/ProjectCard/widgets/BudgetWidget
 */

import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Banknote } from "lucide-react";

import type { Project } from "@/shared/types";
import { useProjectData } from "../../hooks/useProjectData";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { MetricBlock } from "@/shared/ui/composites/MetricBlock";
import { SectionHeader } from "@/shared/ui/composites/SectionHeader";
import { Button } from "@/shared/ui/primitives/Button";

interface BudgetWidgetProps {
  project: Project;
  onEdit?: () => void;
}

export function BudgetWidget({
  project,
  onEdit,
}: BudgetWidgetProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const { participations, crewAssignments } = useProjectData(
    String(project.id),
  );

  const totalBudget = useMemo<number>(() => {
    const totalArtistsCost: number = participations.reduce(
      (sum, p) => sum + (Number(p.fee) || 0),
      0,
    );
    const totalCrewCost: number = crewAssignments.reduce(
      (sum, c) => sum + (Number(c.fee) || 0),
      0,
    );

    return totalArtistsCost + totalCrewCost;
  }, [participations, crewAssignments]);
  const formattedBudget = useMemo(
    () =>
      new Intl.NumberFormat(t("common.locale", "pl-PL"), {
        maximumFractionDigits: 0,
      }).format(totalBudget),
    [t, totalBudget],
  );

  return (
    <GlassCard
      variant="solid"
      padding="md"
      isHoverable={Boolean(onEdit)}
      onClick={onEdit}
      className="flex min-h-56 flex-col justify-between"
      role={onEdit ? "button" : "region"}
      aria-label={t(
        "projects.budget.aria_label",
        "Zarządzaj budżetem projektu",
      )}
    >
      <div className="mb-4 flex items-start justify-between gap-3 border-b border-ethereal-incense/10 pb-4">
        <SectionHeader
          title={t("projects.budget.title", "Kosztorys")}
          icon={<Banknote size={16} aria-hidden="true" />}
          className="mb-0 pb-0"
        />
        {onEdit && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={(event) => {
              event.stopPropagation();
              onEdit();
            }}
            className="opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
          >
            {t("common.actions.edit", "Edytuj")}
          </Button>
        )}
      </div>

      <MetricBlock
        label={t("projects.budget.estimated_cost", "Przewidywany koszt")}
        value={formattedBudget}
        unit={t("common.currency", "PLN")}
        icon={<Banknote aria-hidden="true" />}
        accentColor="gold"
        className="flex-1 items-center justify-center text-center"
      />
    </GlassCard>
  );
}
