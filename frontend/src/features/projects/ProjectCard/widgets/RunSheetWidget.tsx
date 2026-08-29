/**
 * @file RunSheetWidget.tsx
 * @description Concert-day run sheet (agenda) for the Project Overview. Rebuilt onto the
 * canonical WidgetCard: no longer a bespoke collapsible GlassCard with its own header and
 * "Edytuj" button, but a consistent, always-open compact timeline that deep-links to the
 * Details work area like every other Overview card. Caps the preview so the card stays a
 * summary, not the full editor.
 * It draws the same axis as the editor and the printed day card — anchors and the two
 * typed windows merged into the points — because a producer reading three lists of hours
 * for one day is reading three chances to miss a collision.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/ProjectCard/widgets/RunSheetWidget
 */

import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Clock, ClipboardList, MapPin } from "lucide-react";

import { useLocationResolver } from "@/features/logistics/hooks/useLocationResolver";
import type { Project } from "@/shared/types";
import { Button } from "@/shared/ui/primitives/Button";
import { SectionCard } from "@/shared/ui/composites/SectionCard";
import { StatePanel } from "@/shared/ui/composites/StatePanel";
import { Caption, Eyebrow, Text } from "@/shared/ui/primitives/typography";
import { buildProjectDayTimeline, isDayWindow } from "../../lib/dayTimeline";
import {
  DAY_WINDOW_UNTIL,
  getDayFixturePresentation,
} from "../../lib/projectPresentation";

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
  const { resolveLocation } = useLocationResolver();

  const entries = useMemo(() => buildProjectDayTimeline(project), [project]);

  const eventLocationId = project.location?.id ?? null;

  /**
   * The venue a point sends people to, named only when it is not the event's own
   * — this card is a summary, and a place repeated on every row says nothing.
   * Plain text, never the map chip the singer's surfaces use: the whole card is
   * one activation target (`onActivate`), and a control inside it would swallow
   * the tap that opens the editor.
   */
  const venueName = (locationId?: string | null): string => {
    if (!locationId || locationId === eventLocationId) {
      return "";
    }
    return resolveLocation(locationId)?.name ?? "";
  };

  // The anchors frame the day; they are not a plan. A project with a call time
  // and a downbeat and nothing between them has an empty run sheet, and says so.
  const hasDayPlan = entries.some(
    (entry) => entry.kind === "point" || isDayWindow(entry),
  );
  const overflow = entries.length - DISPLAY_LIMIT;

  return (
    <SectionCard
      title={t("projects.run_sheet.title", "Harmonogram dnia")}
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
      {hasDayPlan ? (
        <ul className="relative ml-1 space-y-4 border-l border-hairline-strong pl-5">
          {entries.slice(0, DISPLAY_LIMIT).map((entry, index) => {
            if (entry.kind === "point") {
              const place = venueName(entry.item.location_id);

              return (
                <li key={entry.item.id || `point-${index}`} className="relative">
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
                      {entry.item.time}
                    </Text>
                    {entry.item.title && (
                      <Text as="span" size="sm" weight="medium">
                        {entry.item.title}
                      </Text>
                    )}
                    {place && (
                      <Caption color="muted" className="inline-flex items-center gap-1">
                        <MapPin size={11} aria-hidden="true" />
                        {place}
                      </Caption>
                    )}
                  </div>
                  {entry.item.description && (
                    <Text color="graphite" size="sm" className="mt-0.5 text-pretty italic">
                      {entry.item.description}
                    </Text>
                  )}
                </li>
              );
            }

            const { labelKey, fallbackLabel } = getDayFixturePresentation(
              entry.kind,
              project.event_kind,
            );

            return (
              <li key={entry.kind} className="relative">
                {/* Filled where a typed point is a ring — the editor's own
                    distinction, so this card and the form it deep-links to read
                    as one drawing of one day. */}
                <span
                  className="absolute -left-[1.65rem] top-1 h-3 w-3 rounded-full bg-ethereal-gold"
                  aria-hidden="true"
                />
                <div className="flex flex-wrap items-baseline gap-2">
                  <Text
                    as="span"
                    size="sm"
                    weight="bold"
                    className="tabular-nums text-ethereal-gold"
                  >
                    {entry.time}
                  </Text>
                  <Eyebrow color="graphite">{t(labelKey, fallbackLabel)}</Eyebrow>
                  {isDayWindow(entry) && entry.endTime && (
                    <Caption color="muted">
                      {t(DAY_WINDOW_UNTIL.labelKey, DAY_WINDOW_UNTIL.fallbackLabel, {
                        time: entry.endTime,
                      })}
                    </Caption>
                  )}
                </div>
              </li>
            );
          })}
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
