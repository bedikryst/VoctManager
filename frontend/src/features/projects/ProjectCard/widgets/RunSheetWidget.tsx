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
import { Clock, ClipboardList } from "lucide-react";

import type { Project } from "@/shared/types";
import { Button } from "@/shared/ui/primitives/Button";
import { SectionCard } from "@/shared/ui/composites/SectionCard";
import { StatePanel } from "@/shared/ui/composites/StatePanel";
import { Eyebrow, Text } from "@/shared/ui/primitives/typography";

interface RunSheetWidgetProps {
  project: Project;
  onEdit?: () => void;
  /**
   * Opens the printable day card, which leads with exactly this agenda. Offered
   * here because the run sheet is where the concert day is being thought about;
   * the export menu keeps the full catalogue.
   */
  onOpenDayCard?: () => void;
}

const DISPLAY_LIMIT = 6;

export function RunSheetWidget({
  project,
  onEdit,
  onOpenDayCard,
}: RunSheetWidgetProps): React.JSX.Element {
  const { t } = useTranslation();

  const sortedRunSheet = useMemo(() => {
    if (!project.run_sheet) return [];
    return [...project.run_sheet].sort((a, b) => a.time.localeCompare(b.time));
  }, [project.run_sheet]);

  const overflow = sortedRunSheet.length - DISPLAY_LIMIT;

  return (
    <SectionCard
      title={t("projects.run_sheet.title", "Harmonogram dnia koncertu")}
      icon={<Clock size={15} aria-hidden="true" />}
      onActivate={onEdit}
      ariaLabel={t("projects.run_sheet.aria_label", "Zarządzaj harmonogramem dnia")}
      action={
        onOpenDayCard && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onOpenDayCard}
            leftIcon={<ClipboardList size={13} aria-hidden="true" />}
            aria-label={t(
              "projects.run_sheet.open_day_card_aria",
              "Otwórz kartę dnia (PDF)",
            )}
          >
            {t("projects.exports.day_card", "Karta dnia")}
          </Button>
        )
      }
    >
      {sortedRunSheet.length > 0 ? (
        <ul className="relative ml-1 space-y-4 border-l border-hairline-strong pl-5">
          {sortedRunSheet.slice(0, DISPLAY_LIMIT).map((item, index) => (
            <li key={item.id || index} className="relative">
              <span
                className="absolute -left-[1.6rem] top-1 h-2.5 w-2.5 rounded-full border-2 border-ethereal-gold bg-ethereal-marble"
                aria-hidden="true"
              />
              {/* The clock is the spine of a run sheet, so it is set as time,
                  not boxed as a chip: a title is optional in this data, and a
                  row that is only a bordered pill floating in space reads as
                  something that failed to render. */}
              <div className="flex flex-wrap items-baseline gap-2">
                <Text
                  as="span"
                  size="sm"
                  weight="bold"
                  className="tabular-nums text-ethereal-gold"
                >
                  {item.time}
                </Text>
                {item.title && (
                  <Text as="span" size="sm" weight="medium">
                    {item.title}
                  </Text>
                )}
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
              <Eyebrow color="muted">
                {t("projects.program.and_more", "...i {{count}} więcej", {
                  count: overflow,
                })}
              </Eyebrow>
            </li>
          )}
        </ul>
      ) : (
        <StatePanel
          variant="inline"
          icon={<Clock size={24} aria-hidden="true" />}
          title={t("projects.run_sheet.empty", "Brak harmonogramu dnia")}
        />
      )}
    </SectionCard>
  );
}
