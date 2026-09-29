/**
 * @file PlanStartChip.tsx
 * @description "Plan starts" beside the call on a singer's project card, shown
 * when the reader is due somewhere before the call: the departure for a
 * traveller, the sound check the evening before for a singer who joins on
 * site. Without it a traveller reads "Zbiórka 12:30" and can reasonably
 * conclude they may arrive on concert day. The printed sheet's masthead cell
 * on a chip: the label, the hour, and a note naming the day and what happens
 * then.
 * @module features/schedule/components/PlanStartChip
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { Flag } from "lucide-react";

import type { Project } from "@/shared/types";
import { cn } from "@/shared/lib/utils";
import { Caption } from "@/shared/ui/primitives/typography";
import { DualTimeDisplay } from "@/widgets/utility/DualTimeDisplay";
import { usePlanStartNote } from "../hooks/usePlanStartNote";
import type { TimelineEvent } from "../types/schedule.dto";

interface PlanStartChipProps {
  event: TimelineEvent;
  project: Project;
  /** The chip's surface, matched to the call chip it sits beside. */
  className?: string;
}

export const PlanStartChip = ({
  event,
  project,
  className,
}: PlanStartChipProps): React.JSX.Element | null => {
  const { t } = useTranslation();
  const note = usePlanStartNote(event.planStart, project);

  if (!event.planStart || !note) return null;

  const noteText = [note.day, note.title].filter(Boolean).join(" · ");

  return (
    <span
      className={cn(
        "flex min-w-0 max-w-full items-center gap-1.5 rounded-lg border px-2.5 py-1 text-ink-on-inverse",
        className,
      )}
    >
      <DualTimeDisplay
        value={event.planStart.at}
        timeZone={project.timezone}
        label={t("schedule.card.plan_start", "Początek planu:")}
        icon={<Flag size={11} aria-hidden="true" />}
        variant="dark"
        containerClassName="flex shrink-0 items-center gap-1.5"
        primaryTimeClassName="flex items-center gap-1.5 font-medium"
        divider
      />
      {noteText && (
        <Caption color="ink-on-inverse-muted" className="min-w-0 truncate">
          {noteText}
        </Caption>
      )}
    </span>
  );
};
