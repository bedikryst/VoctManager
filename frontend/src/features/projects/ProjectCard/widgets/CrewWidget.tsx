/**
 * @file CrewWidget.tsx
 * @description Dashboard widget detailing technical crew assignments for the project.
 * @architecture Enterprise SaaS 2026
 * @module panel/projects/ProjectCard/widgets/CrewWidget
 */

import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Wrench } from "lucide-react";

import type { Project, Collaborator } from "@/shared/types";
import { useProjectData } from "../../hooks/useProjectData";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Button } from "@/shared/ui/primitives/Button";
import { SectionHeader } from "@/shared/ui/composites/SectionHeader";
import { Caption, Text } from "@/shared/ui/primitives/typography";

interface CrewWidgetProps {
  project: Project;
  onEdit?: () => void;
}

const DISPLAY_LIMIT = 9;

export function CrewWidget({
  project,
  onEdit,
}: CrewWidgetProps): React.JSX.Element {
  const { t } = useTranslation();
  const { crewAssignments: projectCrew, crew } = useProjectData(
    String(project.id),
  );

  const crewMap = useMemo<Map<string, Collaborator>>(
    () =>
      new Map(
        crew.map((collaborator) => [String(collaborator.id), collaborator]),
      ),
    [crew],
  );
  const visibleCrew = projectCrew.slice(0, DISPLAY_LIMIT);
  const overflowCount = projectCrew.length - DISPLAY_LIMIT;

  return (
    <GlassCard
      variant="solid"
      padding="md"
      isHoverable={Boolean(onEdit)}
      onClick={onEdit}
      className="flex min-h-56 flex-col justify-between"
      role={onEdit ? "button" : "region"}
      aria-label={t("projects.crew.aria_label", "Zarządzaj ekipą techniczną")}
    >
      <div className="mb-4 flex items-start justify-between gap-3 border-b border-ethereal-incense/10 pb-4">
        <SectionHeader
          title={t("projects.crew.title", "Ekipa")}
          icon={<Wrench size={16} aria-hidden="true" />}
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

      <div className="flex flex-1 flex-col items-center justify-center py-2">
        <div className="mb-2 flex flex-wrap justify-center gap-2">
          {visibleCrew.map((assign, index) => {
            const person = crewMap.get(String(assign.collaborator));
            if (!person) return null;

            const roleLabel: string =
              assign.role_description || person.specialty.substring(0, 4);

            return (
              <Badge
                key={assign.id || `crew-${index}`}
                variant="neutral"
              >
                {person.first_name} {person.last_name.charAt(0)}. ({roleLabel})
              </Badge>
            );
          })}

          {overflowCount > 0 && (
            <Badge variant="brand">
              +{overflowCount}
            </Badge>
          )}

          {projectCrew.length === 0 && (
            <Text color="muted" className="italic">
              {t("projects.crew.empty", "Brak przypisanej ekipy.")}
            </Text>
          )}
        </div>
      </div>

      <Caption
        color="muted"
        weight="bold"
        className="mt-auto border-t border-ethereal-incense/10 pt-3 text-center uppercase tracking-[0.16em]"
      >
        {t("projects.crew.employed", "Zatrudnionych:")} {projectCrew.length}
      </Caption>
    </GlassCard>
  );
}
