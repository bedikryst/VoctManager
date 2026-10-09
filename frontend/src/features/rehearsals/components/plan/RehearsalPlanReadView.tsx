/**
 * @file RehearsalPlanReadView.tsx
 * @description The evening's plan as whoever may plan it reads it between
 * edits: the conductor's sheet on one screen, not a form. The header carries
 * what a planner checks at a glance — how many points, the minutes against
 * the evening's length, whether the choir has it (the publication caption
 * and, for a saved plan not yet sent as it stands, "Wyślij plan") — and
 * "Edytuj plan", one tap away. Once the evening has started the rows are the
 * debrief's checklist too (`onMarkItem`), so a past evening shows its plan
 * once, with its ticks.
 *
 * The rows come from the plan read the editor writes to, so the read view
 * shows a save the moment it lands; the rehearsal's own copy stands in until
 * that read arrives. The stand-in who may not plan never gets here — they
 * read `RehearsalPlanTimeline` at stand size, without the publication.
 * @architecture Enterprise SaaS 2026
 * @module features/rehearsals/components/plan/RehearsalPlanReadView
 */

import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ListMusic, PenLine, Send } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/primitives/Button";
import { Caption, Eyebrow } from "@/shared/ui/primitives/typography";
import type { Rehearsal } from "@/shared/types";
import { useRehearsalPlan } from "../../api/plan.queries";
import { eveningClocksOf, plannedMinutes, rowLengths } from "../../lib/rehearsalPlan";
import { PlanBudget } from "./PlanBudget";
import { RehearsalPlanTimeline } from "./RehearsalPlanTimeline";
import { usePlanPublication } from "./usePlanPublication";

interface RehearsalPlanReadViewProps {
  readonly rehearsal: Rehearsal;
  /** `stand` for a card read at the music stand (the lead sheet). */
  readonly size?: "default" | "stand";
  readonly onEdit: () => void;
  /** Ticks one row off after the fact; absent before the downbeat, or for a reader who may not. */
  readonly onMarkItem?: (itemId: string, done: boolean) => Promise<unknown>;
  readonly className?: string;
}

export const RehearsalPlanReadView = ({
  rehearsal,
  size = "default",
  onEdit,
  onMarkItem,
  className,
}: RehearsalPlanReadViewProps): React.JSX.Element => {
  const { t } = useTranslation();
  const planQuery = useRehearsalPlan(String(rehearsal.id));
  const publication = usePlanPublication(rehearsal, planQuery.data);
  const rows = useMemo(
    () => planQuery.data?.rows ?? rehearsal.plan ?? [],
    [planQuery.data?.rows, rehearsal.plan],
  );
  // The same budget the editor states, so a save changes nothing about it:
  // the main rows' lengths, the ones their clocks imply included.
  const planned = useMemo(() => {
    const { start, end } = eveningClocksOf(rehearsal);
    const main = rows
      .filter((row) => !row.is_reserve)
      .map((row) => ({ startsAt: row.starts_at || null, minutes: row.minutes }));
    return plannedMinutes(rowLengths(main, start, end));
  }, [rows, rehearsal]);
  const hasRows = rows.length > 0;

  return (
    <section className={cn("flex flex-col", className)}>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-5 py-3">
        <div className="flex items-center gap-2">
          <ListMusic size={12} className="text-ethereal-gold/70" aria-hidden="true" />
          <Eyebrow as="h3" color="graphite">
            {t("rehearsals.plan.title", "Plan próby")}
          </Eyebrow>
          {hasRows ? (
            <>
              <Caption color="muted" className="tabular-nums">
                {rows.length}
              </Caption>
              <PlanBudget planned={planned} length={rehearsal.duration_minutes ?? null} />
            </>
          ) : (
            <Caption color="muted">{t("rehearsals.plan.empty.title", "Bez planu")}</Caption>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {publication.canSend && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => void publication.send()}
              disabled={publication.isSending}
              isLoading={publication.isSending}
              leftIcon={!publication.isSending ? <Send size={14} aria-hidden="true" /> : undefined}
            >
              {publication.sendLabel}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onEdit}
            leftIcon={<PenLine size={14} aria-hidden="true" />}
          >
            {hasRows
              ? t("rehearsals.plan.edit", "Edytuj plan")
              : t("rehearsals.plan.compose", "Ułóż plan")}
          </Button>
        </div>
      </div>

      {publication.caption && (
        <div className="px-5 pb-2">
          <Caption color={publication.caption.attention ? "gold" : "muted"}>
            {publication.caption.text}
          </Caption>
        </div>
      )}

      {hasRows && (
        <RehearsalPlanTimeline
          rows={rows}
          size={size}
          onMark={onMarkItem}
          className="px-5 pb-5 pt-2"
        />
      )}
    </section>
  );
};
