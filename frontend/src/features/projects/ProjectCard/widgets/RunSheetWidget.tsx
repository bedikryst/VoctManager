/**
 * @file RunSheetWidget.tsx
 * @description Concert-day run sheet (agenda) for the Project Overview. Rebuilt onto the
 * canonical WidgetCard: no longer a bespoke collapsible GlassCard with its own header and
 * "Edytuj" button, but a consistent, always-open compact timeline that deep-links to the
 * Details work area like every other Overview card. Sorts entries chronologically and caps
 * the preview so the card stays a summary, not the full editor.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/ProjectCard/widgets/RunSheetWidget
 */

import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Clock } from "lucide-react";

import type { Project } from "@/shared/types";
import { Badge } from "@/shared/ui/primitives/Badge";
import { WidgetCard } from "@/shared/ui/composites/WidgetCard";
import { Caption, Text } from "@/shared/ui/primitives/typography";

interface RunSheetWidgetProps {
  project: Project;
  onEdit?: () => void;
}

const DISPLAY_LIMIT = 6;

export function RunSheetWidget({
  project,
  onEdit,
}: RunSheetWidgetProps): React.JSX.Element {
  const { t } = useTranslation();

  const sortedRunSheet = useMemo(() => {
    if (!project.run_sheet) return [];
    return [...project.run_sheet].sort((a, b) => a.time.localeCompare(b.time));
  }, [project.run_sheet]);

  const overflow = sortedRunSheet.length - DISPLAY_LIMIT;

  return (
    <WidgetCard
      title={t("projects.run_sheet.title", "Harmonogram dnia koncertu")}
      icon={<Clock size={15} aria-hidden="true" />}
      onActivate={onEdit}
      ariaLabel={t("projects.run_sheet.aria_label", "Zarządzaj harmonogramem dnia")}
    >
      {sortedRunSheet.length > 0 ? (
        <ul className="relative ml-1 space-y-4 border-l border-ethereal-ink/10 pl-5">
          {sortedRunSheet.slice(0, DISPLAY_LIMIT).map((item, index) => (
            <li key={item.id || index} className="relative">
              <span
                className="absolute -left-[1.6rem] top-1 h-2.5 w-2.5 rounded-full border-2 border-ethereal-gold bg-ethereal-marble"
                aria-hidden="true"
              />
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="brand">{item.time}</Badge>
                <Text as="span" size="sm" weight="medium">
                  {item.title}
                </Text>
              </div>
              {item.description && (
                <Text color="graphite" size="sm" className="mt-0.5 text-pretty italic">
                  {item.description}
                </Text>
              )}
            </li>
          ))}
          {overflow > 0 && (
            <li className="relative">
              <Caption color="muted" weight="bold" className="uppercase tracking-[0.16em]">
                {t("projects.program.and_more", "...i {{count}} więcej", {
                  count: overflow,
                })}
              </Caption>
            </li>
          )}
        </ul>
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
          <Clock size={26} className="text-ethereal-incense/30" aria-hidden="true" />
          <Text color="muted" className="italic">
            {t("projects.run_sheet.empty", "Brak harmonogramu dla tego wydarzenia.")}
          </Text>
        </div>
      )}
    </WidgetCard>
  );
}
