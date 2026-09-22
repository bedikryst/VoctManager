/**
 * @file RehearsalPlanTimeline.tsx
 * @description The plan as it is read, not edited: a gold spine, a clock
 * rubric where a row carries one, the title, the note under it, and a tick
 * where the row was done. Rows that do not call the reader are dimmed and
 * say so — the reader's own window is the page's job, this only shows which
 * rows made it. Two sizes: the panel's dense reading, and `stand` — reading
 * size at arm's length for the lead sheet at the music stand, where nobody
 * drags rows. Shared by the lead sheet (Stage 3) and the chorister's
 * rehearsal page (Stage 4); a row can link out through `hrefOf`.
 * @architecture Enterprise SaaS 2026
 * @module features/rehearsals/components/plan/RehearsalPlanTimeline
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Check } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { Caption, Text } from "@/shared/ui/primitives/typography";
import type { RehearsalPlanItem } from "@/shared/types";

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

  return (
    <ol className={cn("flex flex-col", className)}>
      {rows.map((row, index) => {
        const isDone = row.done_at !== null;
        const isOut = row.calls_me === false;
        const isLast = index === rows.length - 1;
        const href = row.piece !== null && hrefOf ? hrefOf(row) : null;
        // A piece is a titled work and takes the serif, a size up so it does
        // not read smaller than the sans note under it; a free row (a warm-up,
        // a break) stays in the sans.
        const title = (
          <Text
            as="span"
            size={row.piece !== null ? (isStand ? "2xl" : "md") : isStand ? "xl" : "base"}
            weight="medium"
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
          <li
            key={row.id}
            className={cn("flex items-stretch gap-3", isOut && "opacity-55")}
          >
            <Text
              as="span"
              size={isStand ? "lg" : "sm"}
              weight="semibold"
              className={cn(
                "shrink-0 pt-0.5 text-right tabular-nums",
                isStand ? "w-14" : "w-11",
              )}
            >
              {row.starts_at ?? ""}
            </Text>
            {/* The spine is the content column's left rule, so it runs exactly
                the rows' height; the dot hangs on it from the row it belongs to. */}
            <div
              className={cn(
                "relative flex min-w-0 flex-1 flex-col gap-0.5 border-l border-ethereal-gold/40",
                isStand ? "pl-5" : "pl-4",
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
        );
      })}
    </ol>
  );
};
