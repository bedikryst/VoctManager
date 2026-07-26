/**
 * @file ProgramWidget.tsx
 * @description Overview summary of the concert programme — a compact, read-only line
 * list of pieces with their casting status, total runtime in the footer.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/ProjectCard/widgets/ProgramWidget
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { Check, ListOrdered, Music } from "lucide-react";

import type { Project } from "@/shared/types";
import { SectionCard } from "@/shared/ui/composites/SectionCard";
import { StatePanel } from "@/shared/ui/composites/StatePanel";
import { Eyebrow, Text } from "@/shared/ui/primitives/typography";
import {
  useProgramFulfillment,
  type EnrichedProgramItem,
} from "../hooks/useProgramFulfillment";

interface ProgramWidgetProps {
  project: Project;
  onEdit?: () => void;
}

const DISPLAY_LIMIT = 7;

/**
 * The setlist is a worklist, so only an unfinished piece earns colour: a chip
 * on every row (and a whole programme of "NIEOBSADZONY" is the normal state of
 * a young production) flattens the list into noise and buries the one row that
 * differs. A gap says how many singers are missing; a covered piece gets a
 * quiet tick; a piece with no casting requirements says nothing at all.
 */
const ProgramStatus = ({
  item,
}: {
  item: EnrichedProgramItem;
}): React.JSX.Element | null => {
  const { t } = useTranslation();

  if (item.statusVariant === "warning") {
    return (
      <Text
        as="span"
        size="sm"
        weight="medium"
        color="gold"
        className="shrink-0 tabular-nums"
      >
        {t("projects.program.gaps_count", "{{count}} luk", {
          count: item.missingCount,
        })}
      </Text>
    );
  }

  if (item.statusVariant === "success") {
    return (
      <span className="shrink-0 text-ethereal-sage" title={item.statusText}>
        <Check size={14} aria-hidden="true" />
        <span className="sr-only">{item.statusText}</span>
      </span>
    );
  }

  return null;
};

export function ProgramWidget({
  project,
  onEdit,
}: ProgramWidgetProps): React.JSX.Element {
  const { t } = useTranslation();
  const { enrichedProgram, formattedDuration, hasDuration } =
    useProgramFulfillment(project);

  const overflow = enrichedProgram.length - DISPLAY_LIMIT;

  return (
    <SectionCard
      title={t("projects.program.title", "Program koncertu")}
      icon={<ListOrdered size={15} aria-hidden="true" />}
      onActivate={onEdit}
      ariaLabel={t("projects.program.aria_label", "Zarządzaj programem koncertu")}
      footer={
        /* A running total is the quietest thing in the card, so it is set as
           one — a bordered chip here outweighed every piece title above it. */
        enrichedProgram.length > 0 ? (
          <div className="flex items-center justify-center gap-1.5 text-ethereal-graphite/60">
            <Music size={12} aria-hidden="true" className="shrink-0" />
            <Eyebrow as="span" color="inherit">
              {hasDuration
                ? formattedDuration
                : t("projects.program.duration_unknown", "Czas nieznany")}
            </Eyebrow>
          </div>
        ) : undefined
      }
    >
      {enrichedProgram.length > 0 ? (
        <ul className="-my-1 divide-y divide-hairline">
          {enrichedProgram.slice(0, DISPLAY_LIMIT).map((item, index) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-3 py-1.5"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <Text
                  as="span"
                  size="xs"
                  weight="bold"
                  className="w-5 shrink-0 tabular-nums text-ethereal-gold/70"
                >
                  {String(index + 1).padStart(2, "0")}
                </Text>
                <Text as="span" size="sm" weight="medium" truncate>
                  {item.title}
                </Text>
              </div>
              <ProgramStatus item={item} />
            </li>
          ))}
          {overflow > 0 && (
            <li className="py-1.5 pl-7">
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
          icon={<ListOrdered size={24} aria-hidden="true" />}
          title={t("projects.program.empty.setlist_title", "Setlista jest pusta")}
        />
      )}
    </SectionCard>
  );
}
