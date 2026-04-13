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

interface BudgetWidgetProps {
  project: Project;
  onEdit?: () => void;
}

export default function BudgetWidget({
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

  return (
    <GlassCard
      variant="solid"
      onClick={onEdit}
      className={`p-5 flex flex-col justify-between transition-all group min-h-[220px] ${onEdit ? "cursor-pointer hover:border-brand/40 hover:shadow-md" : ""}`}
      role={onEdit ? "button" : "region"}
      aria-label={t(
        "projects.budget.aria_label",
        "Zarządzaj budżetem projektu",
      )}
    >
      <div className="flex items-center justify-between border-b border-stone-100 pb-3 mb-4">
        <h4 className="flex items-center gap-2 text-[10px] font-bold antialiased uppercase tracking-widest text-stone-500 group-hover:text-brand transition-colors">
          <Banknote
            size={16}
            className="text-brand group-hover:scale-110 transition-transform"
            aria-hidden="true"
          />
          {t("projects.budget.title", "Kosztorys")}
        </h4>
        {onEdit && (
          <button className="text-[9px] uppercase font-bold antialiased tracking-widest text-brand opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100">
            {t("common.actions.edit", "Edytuj")}
          </button>
        )}
      </div>

      <div className="flex-1 flex flex-col justify-center items-center py-4">
        <div className="text-4xl font-bold text-brand mb-2 tracking-tight">
          {totalBudget.toLocaleString(t("common.locale", "pl-PL"))}{" "}
          {t("common.currency", "PLN")}
        </div>
        <div className="text-[9px] font-bold antialiased uppercase tracking-widest text-stone-400">
          {t("projects.budget.estimated_cost", "Przewidywany Koszt")}
        </div>
      </div>
    </GlassCard>
  );
}
