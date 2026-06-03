/**
 * @file ProgramWidget.tsx
 * @description Overview summary of the concert programme — a compact, read-only line
 * list of pieces with their casting status, total runtime in the footer.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/ProjectCard/widgets/ProgramWidget
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { ListOrdered, Music } from "lucide-react";

import type { Project } from "@/shared/types";
import { Badge } from "@/shared/ui/primitives/Badge";
import { WidgetCard } from "@/shared/ui/composites/WidgetCard";
import { Caption, Text } from "@/shared/ui/primitives/typography";
import { useProgramFulfillment } from "../hooks/useProgramFulfillment";

interface ProgramWidgetProps {
  project: Project;
  onEdit?: () => void;
}

const DISPLAY_LIMIT = 7;

export function ProgramWidget({
  project,
  onEdit,
}: ProgramWidgetProps): React.JSX.Element {
  const { t } = useTranslation();
  const { enrichedProgram, formattedDuration, hasDuration } =
    useProgramFulfillment(project);

  const overflow = enrichedProgram.length - DISPLAY_LIMIT;

  return (
    <WidgetCard
      title={t("projects.program.title", "Program koncertu")}
      icon={<ListOrdered size={15} aria-hidden="true" />}
      onActivate={onEdit}
      ariaLabel={t("projects.program.aria_label", "Zarządzaj programem koncertu")}
      footer={
        enrichedProgram.length > 0 ? (
          <div className="flex items-center justify-center">
            {hasDuration ? (
              <Badge variant="brand" icon={<Music size={12} aria-hidden="true" />}>
                {formattedDuration}
              </Badge>
            ) : (
              <Caption
                as="span"
                color="muted"
                weight="bold"
                className="uppercase tracking-[0.16em]"
              >
                {t("projects.program.duration_unknown", "Czas nieznany")}
              </Caption>
            )}
          </div>
        ) : undefined
      }
    >
      {enrichedProgram.length > 0 ? (
        <ul className="-my-1 divide-y divide-ethereal-ink/5">
          {enrichedProgram.slice(0, DISPLAY_LIMIT).map((item, index) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-3 py-1.5"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="w-5 shrink-0 text-[10px] font-bold tabular-nums text-ethereal-gold/70">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <Text as="span" size="sm" weight="medium" truncate>
                  {item.title}
                </Text>
              </div>
              <Badge variant={item.statusVariant}>{item.statusText}</Badge>
            </li>
          ))}
          {overflow > 0 && (
            <li className="py-1.5 pl-7">
              <Caption color="muted" weight="bold" className="uppercase tracking-[0.16em]">
                {t("projects.program.and_more", "...i {{count}} więcej", {
                  count: overflow,
                })}
              </Caption>
            </li>
          )}
        </ul>
      ) : (
        <Text color="muted" className="flex flex-1 items-center justify-center py-6 italic">
          {t("projects.program.empty.setlist_title", "Setlista jest pusta.")}
        </Text>
      )}
    </WidgetCard>
  );
}
