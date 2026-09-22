/**
 * @file RehearsalPlanTimeline.tsx
 * @description The plan as it is read, not edited: a gold spine, a clock
 * rubric where the reader is shown one (`shownClocks`: every effective clock
 * for staff; anchors and the reader's own arrival and release for a
 * chorister — promises, not the budget), the title, the note under it, and a tick
 * where the row was done (`done`, the server's one answer — never the
 * stamps). Rows that do not call the reader are dimmed and say so — the
 * reader's own window is the page's job, this only shows which rows made it.
 * A break is muted and never "not you": it calls nobody, reader included.
 * The reserve sits under a "Jeśli starczy czasu" rule on a dashed spine, so
 * the page, the lead sheet and the print all draw the conductor's divider.
 * Two sizes: the panel's dense reading, and `stand` — reading size at arm's
 * length for the lead sheet at the music stand, where nobody drags rows.
 * Shared by the lead sheet, the chorister's rehearsal page and the schedule
 * previews (which pass the main rows only); a row can link out through
 * `hrefOf`.
 * @architecture Enterprise SaaS 2026
 * @module features/rehearsals/components/plan/RehearsalPlanTimeline
 */

import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Check } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { Caption, Eyebrow, Text } from "@/shared/ui/primitives/typography";
import type { RehearsalPlanItem } from "@/shared/types";
import { shownClocks } from "../../lib/rehearsalPlan";

interface RehearsalPlanTimelineProps {
  readonly rows: readonly RehearsalPlanItem[];
  readonly size?: "default" | "stand";
  /** A route for a piece row (its materials); a free row never links. */
  readonly hrefOf?: (row: RehearsalPlanItem) => string | null;
  readonly className?: string;
}

export const RehearsalPlanTimeline = ({
  rows,
  size = "default",
  hrefOf,
  className,
}: RehearsalPlanTimelineProps): React.JSX.Element => {
  const { t } = useTranslation();
  const isStand = size === "stand";
  const firstReserve = rows.findIndex((row) => row.is_reserve);
  const clocks = useMemo(() => shownClocks(rows), [rows]);
  const clockWidth = isStand ? "w-14" : "w-11";
  const indent = isStand ? "pl-5" : "pl-4";

  return (
    <ol className={cn("flex flex-col", className)}>
      {rows.map((row, index) => {
        const isDone = row.done === true;
        const isBreak = row.is_break;
        const isOut = !isBreak && row.calls_me === false;
        const isLast = index === rows.length - 1;
        const href = row.piece !== null && hrefOf ? hrefOf(row) : null;
        // A piece is a titled work and takes the serif, a size up so it does
        // not read smaller than the sans note under it; a free row (a warm-up,
        // a break) stays in the sans.
        const title = (
          <Text
            as="span"
            size={row.piece !== null ? (isStand ? "2xl" : "md") : isStand ? "xl" : "base"}
            weight={isBreak ? "normal" : "medium"}
            color={isBreak ? "muted" : "default"}
            className={cn(
              "block leading-snug",
              row.piece !== null && "font-serif",
              isDone && "line-through decoration-ethereal-graphite/40",
            )}
          >
            {row.title}
          </Text>
        );
        return (
          <React.Fragment key={row.id}>
            {index === firstReserve && (
              <li className="flex items-stretch gap-3">
                <span aria-hidden="true" className={cn("shrink-0", clockWidth)} />
                <div
                  className={cn(
                    "min-w-0 flex-1 border-l border-dashed border-ethereal-gold/40",
                    indent,
                    isStand ? "pb-5" : "pb-3",
                  )}
                >
                  <Eyebrow color="gold">
                    {t("rehearsals.plan.reserve.title", "Jeśli starczy czasu")}
                  </Eyebrow>
                </div>
              </li>
            )}
            <li className={cn("flex items-stretch gap-3", isOut && "opacity-55")}>
              <Text
                as="span"
                size={isStand ? "lg" : "sm"}
                weight="semibold"
                color={isBreak ? "muted" : "default"}
                className={cn("shrink-0 pt-0.5 text-right tabular-nums", clockWidth)}
              >
                {clocks[index] ?? ""}
              </Text>
              {/* The spine is the content column's left rule, so it runs
                  exactly the rows' height; the dot hangs on it from the row it
                  belongs to. Dashed under the reserve rule. */}
              <div
                className={cn(
                  "relative flex min-w-0 flex-1 flex-col gap-0.5 border-l border-ethereal-gold/40",
                  row.is_reserve && "border-dashed",
                  indent,
                  isLast ? "pb-0" : isStand ? "pb-5" : "pb-3",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute flex items-center justify-center rounded-full border-2",
                    isStand ? "-left-2.25 top-1.5 size-4" : "-left-1.75 top-1.5 size-3",
                    isDone
                      ? "border-ethereal-sage bg-ethereal-sage text-ethereal-alabaster"
                      : isBreak
                        ? "border-ethereal-graphite/25 bg-ethereal-marble"
                        : "border-ethereal-gold bg-ethereal-marble",
                  )}
                >
                  {isDone && <Check size={isStand ? 10 : 8} strokeWidth={3} />}
                </span>
                {href ? (
                  <Link
                    to={href}
                    className="rounded-chip focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40 hover:text-ethereal-gold"
                  >
                    {title}
                  </Link>
                ) : (
                  title
                )}
                {row.note && (
                  <Text
                    as="span"
                    size={isStand ? "md" : "sm"}
                    color="graphite"
                    className="block italic"
                  >
                    {row.note}
                  </Text>
                )}
                {isOut && (
                  <Caption color="muted">
                    {t("rehearsals.plan.timeline.not_you", "bez Twojego głosu")}
                  </Caption>
                )}
              </div>
            </li>
          </React.Fragment>
        );
      })}
    </ol>
  );
};
