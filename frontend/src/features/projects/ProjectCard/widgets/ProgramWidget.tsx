/**
 * @file ProgramWidget.tsx
 * @description Dashboard widget displaying the concert program. Render-only component.
 * @architecture Enterprise SaaS 2026
 * @module panel/projects/ProjectCard/widgets/ProgramWidget
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { ListOrdered, Music } from "lucide-react";

import type { Project } from "@/shared/types";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Button } from "@/shared/ui/primitives/Button";
import { SectionHeader } from "@/shared/ui/composites/SectionHeader";
import { Caption, Text } from "@/shared/ui/primitives/typography";
import { useProgramFulfillment } from "../hooks/useProgramFulfillment";

interface ProgramWidgetProps {
  project: Project;
  onEdit?: () => void;
  onOpenMicroCast?: () => void;
}

export function ProgramWidget({
  project,
  onEdit,
  onOpenMicroCast,
}: ProgramWidgetProps): React.JSX.Element {
  const { t } = useTranslation();
  const { enrichedProgram, formattedDuration, hasDuration } =
    useProgramFulfillment(project);

  const handleOpenMicroCast = (
    e: React.MouseEvent<HTMLButtonElement>,
  ): void => {
    e.stopPropagation();
    if (onOpenMicroCast) onOpenMicroCast();
  };

  return (
    <GlassCard
      variant="solid"
      padding="md"
      isHoverable={Boolean(onEdit)}
      onClick={onEdit}
      className="flex min-h-56 flex-col justify-between"
      role={onEdit ? "button" : "region"}
      aria-label={t(
        "projects.program.aria_label",
        "Zarządzaj programem koncertu",
      )}
    >
      <div className="mb-4 flex items-start justify-between gap-3 border-b border-ethereal-incense/10 pb-4">
        <SectionHeader
          title={t("projects.program.title", "Program koncertu")}
          icon={<ListOrdered size={16} aria-hidden="true" />}
          className="mb-0 pb-0"
        />
        {onOpenMicroCast && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleOpenMicroCast}
            className="opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
          >
            Divisi
          </Button>
        )}
      </div>

      {enrichedProgram.length > 0 ? (
        <div className="flex h-full flex-col justify-between">
          <ul className="mb-3 flex-1 space-y-2">
            {enrichedProgram.slice(0, 5).map((item, index) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-ethereal-incense/10 bg-ethereal-alabaster/60 px-3 py-2"
              >
                <Text
                  as="span"
                  size="sm"
                  weight="medium"
                  className="min-w-0 truncate pr-2"
                >
                  <Text
                    as="span"
                    size="sm"
                    weight="medium"
                    color="muted"
                    className="inline-block w-4"
                  >
                    {index + 1}.
                  </Text>{" "}
                  {item.title}
                </Text>
                <Badge variant={item.statusVariant}>{item.statusText}</Badge>
              </li>
            ))}

            {enrichedProgram.length > 5 && (
              <li className="pt-2 text-center">
                <Caption
                  color="muted"
                  weight="bold"
                  className="uppercase tracking-[0.16em]"
                >
                  {t("projects.program.and_more", "...i {{count}} więcej", {
                    count: enrichedProgram.length - 5,
                  })}
                </Caption>
              </li>
            )}
          </ul>

          <div className="mt-auto flex-shrink-0 border-t border-ethereal-incense/10 pt-3 text-center">
            {hasDuration ? (
              <Badge
                variant="brand"
                icon={<Music size={12} aria-hidden="true" />}
              >
                {formattedDuration}
              </Badge>
            ) : (
              <Caption
                color="muted"
                weight="bold"
                className="uppercase tracking-[0.16em]"
              >
                {t("projects.program.duration_unknown", "Czas nieznany")}
              </Caption>
            )}
          </div>
        </div>
      ) : (
        <Text
          color="muted"
          className="flex flex-1 items-center justify-center py-4 italic"
        >
          {t("projects.program.empty.setlist_title", "Setlista jest pusta.")}
        </Text>
      )}
    </GlassCard>
  );
}
