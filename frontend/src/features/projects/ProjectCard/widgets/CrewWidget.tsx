/**
 * @file CrewWidget.tsx
 * @description Dashboard widget detailing technical crew assignments for the project.
 * @architecture Enterprise SaaS 2026
 * @module panel/projects/ProjectCard/widgets/CrewWidget
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { Wrench } from "lucide-react";

import type { Project, Collaborator } from "../../../../shared/types";
import { useProjectData } from "../../hooks/useProjectData";
import { GlassCard } from "../../../../shared/ui/GlassCard";

interface CrewWidgetProps {
  project: Project;
  onEdit?: () => void;
}

export default function CrewWidget({
  project,
  onEdit,
}: CrewWidgetProps): React.JSX.Element {
  const { t } = useTranslation();
  const { crewAssignments: projectCrew, crew } = useProjectData(
    String(project.id),
  );

  const displayLimit = 9;
  const visibleCrew = projectCrew.slice(0, displayLimit);
  const overflowCount = projectCrew.length - displayLimit;

  return (
    <GlassCard
      variant="solid"
      onClick={onEdit}
      className={`p-5 flex flex-col justify-between transition-all group min-h-[220px] ${onEdit ? "cursor-pointer hover:border-[#002395]/40 hover:shadow-md" : ""}`}
      role={onEdit ? "button" : "region"}
      aria-label={t("projects.crew.aria_label", "Zarządzaj ekipą techniczną")}
    >
      <div className="flex items-center justify-between border-b border-stone-100 pb-3 mb-4">
        <h4 className="flex items-center gap-2 text-[10px] font-bold antialiased uppercase tracking-widest text-stone-500 group-hover:text-[#002395] transition-colors">
          <Wrench
            size={16}
            className="text-[#002395] group-hover:scale-110 transition-transform"
            aria-hidden="true"
          />
          {t("projects.crew.title", "Ekipa (Crew)")}
        </h4>
        {onEdit && (
          <button className="text-[9px] uppercase font-bold antialiased tracking-widest text-[#002395] opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100">
            {t("common.actions.edit", "Edytuj")}
          </button>
        )}
      </div>

      <div className="flex-1 flex flex-col justify-center items-center py-2">
        <div className="flex flex-wrap justify-center gap-2 mb-2">
          {visibleCrew.map((assign, index) => {
            const person: Collaborator | undefined = crew?.find(
              (c) => String(c.id) === String(assign.collaborator),
            );
            if (!person) return null;

            const roleLabel: string =
              assign.role_description || person.specialty.substring(0, 4);

            return (
              <span
                key={assign.id || `crew-${index}`}
                className="px-2.5 py-1 bg-stone-50 text-stone-700 text-[10px] font-bold antialiased uppercase tracking-widest rounded-md border border-stone-200 shadow-sm flex items-center gap-1"
              >
                {person.first_name} {person.last_name.charAt(0)}.
                <span className="text-stone-400 lowercase tracking-normal">
                  ({roleLabel})
                </span>
              </span>
            );
          })}

          {overflowCount > 0 && (
            <span className="px-2.5 py-1 bg-blue-50 text-[#002395] text-[10px] font-bold antialiased uppercase tracking-widest rounded-md border border-blue-200 shadow-sm">
              +{overflowCount}
            </span>
          )}

          {projectCrew.length === 0 && (
            <span className="text-xs text-stone-400 italic">
              {t("projects.crew.empty", "Brak przypisanej ekipy.")}
            </span>
          )}
        </div>
      </div>

      <div className="text-center text-[9px] font-bold antialiased uppercase tracking-widest text-stone-400 mt-auto border-t border-stone-100 pt-3">
        {t("projects.crew.employed", "Zatrudnionych:")} {projectCrew.length}
      </div>
    </GlassCard>
  );
}
