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
 *
 * With `onMark` the ticks are written as well as read — the debrief's first
 * step, "Odznacz, czego nie zrobiliście", taken on the plan itself so that a
 * past evening shows its plan once. Each row's dot on the spine is then its
 * checkbox and the whole row is the label; the dots start as the plan was
 * meant (a main row done, a reserve row not), because the plan is what
 * usually happened and a debrief nobody writes must not read as "nothing was
 * done". Written after the fact, never live — the caller passes `onMark` only
 * once the evening has started. A break is never done or undone, so it has no
 * box.
 *
 * Two sizes: the panel's dense reading, and `stand` — reading size at arm's
 * length for the lead sheet at the music stand, where nobody drags rows.
 * Shared by the plan band of the rehearsal card, the lead sheet, the
 * chorister's rehearsal page and the schedule previews (which pass the main
 * rows only); a row can link out through `hrefOf`.
 * @architecture Enterprise SaaS 2026
 * @module features/rehearsals/components/plan/RehearsalPlanTimeline
 */

import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Check } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { toastApiError } from "@/shared/api/errors";
import { Caption, Eyebrow, Text } from "@/shared/ui/primitives/typography";
import type { RehearsalPlanItem } from "@/shared/types";
import { shownClocks } from "../../lib/rehearsalPlan";

interface RehearsalPlanTimelineProps {
  readonly rows: readonly RehearsalPlanItem[];
  readonly size?: "default" | "stand";
  /** A route for a piece row (its materials); a free row never links. */
  readonly hrefOf?: (row: RehearsalPlanItem) => string | null;
  /**
   * Ticks one row off (or back on). Present → every row but a break is a
   * checkbox; absent → the ticks are read. Same gate as the debrief on the
   * server: a manager, or the roll-call holder.
   */
  readonly onMark?: (itemId: string, done: boolean) => Promise<unknown>;
  readonly className?: string;
}

/**
 * What a box proposes before anyone taps: the server's verdict, else the plan
 * itself — a main row done, a reserve row not. `done` is still null while the
 * evening runs, and the boxes can be opened then.
 */
const proposedDone = (row: RehearsalPlanItem): boolean => row.done ?? !row.is_reserve;

/**
 * A tap answers at once from a local override, which the server's own
 * verdict then replaces when the read model catches up — a tablet after the
 * rehearsal is not the place to wait on a round-trip per row.
 */
const useTicks = (
  rows: readonly RehearsalPlanItem[],
  onMark: RehearsalPlanTimelineProps["onMark"],
): {
  readonly isDone: (row: RehearsalPlanItem) => boolean;
  readonly toggle: (row: RehearsalPlanItem, done: boolean) => Promise<void>;
} => {
  const { t } = useTranslation();
  const [pending, setPending] = useState<Record<string, boolean>>({});

  // Once the server says what a tap said, the override has done its job.
  useEffect(() => {
    setPending((current) => {
      const next = { ...current };
      let changed = false;
      for (const row of rows) {
        const wanted = next[row.id];
        if (wanted !== undefined && wanted === proposedDone(row)) {
          delete next[row.id];
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [rows]);

  const isDone = (row: RehearsalPlanItem): boolean =>
    onMark ? (pending[row.id] ?? proposedDone(row)) : row.done === true;

  const toggle = async (row: RehearsalPlanItem, done: boolean): Promise<void> => {
    if (!onMark) return;
    setPending((current) => ({ ...current, [row.id]: done }));
    try {
      await onMark(row.id, done);
    } catch (error) {
      setPending((current) => {
        const next = { ...current };
        delete next[row.id];
        return next;
      });
      toastApiError(error, t, {
        fallbackDescription: t("rehearsals.plan.toast.done_error", "Nie udało się odhaczyć punktu."),
      });
    }
  };

  return { isDone, toggle };
};

export const RehearsalPlanTimeline = ({
  rows,
  size = "default",
  hrefOf,
  onMark,
  className,
}: RehearsalPlanTimelineProps): React.JSX.Element => {
  const { t } = useTranslation();
  const isStand = size === "stand";
  const firstReserve = rows.findIndex((row) => row.is_reserve);
  const clocks = useMemo(() => shownClocks(rows), [rows]);
  const ticks = useTicks(rows, onMark);
  const clockWidth = isStand ? "w-14" : "w-11";
  const indent = isStand ? "pl-5" : "pl-4";

  const list = (
    <ol className={cn("flex flex-col", !onMark && className)}>
      {rows.map((row, index) => {
        const isBreak = row.is_break;
        const isTickable = Boolean(onMark) && !isBreak;
        const isDone = !isBreak && ticks.isDone(row);
        const isOut = !isBreak && row.calls_me === false;
        const isLast = index === rows.length - 1;
        // A link inside a label would turn every tap on the title into a
        // tick; a tickable row is read for its tick, not for its music.
        const href = !isTickable && row.piece !== null && hrefOf ? hrefOf(row) : null;
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
        // A box is a size up from a reading dot: it is a control, and it has
        // to be found by a finger.
        const dot = (
          <span
            aria-hidden="true"
            className={cn(
              "absolute flex items-center justify-center rounded-full border-2",
              isTickable
                ? isStand
                  ? "-left-2.75 top-1.5 size-5"
                  : "-left-2.25 top-1 size-4"
                : isStand
                  ? "-left-2.25 top-1.5 size-4"
                  : "-left-1.75 top-1.5 size-3",
              isTickable &&
                "transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-ethereal-gold/40",
              isDone
                ? "border-ethereal-sage bg-ethereal-sage text-ethereal-alabaster"
                : isBreak
                  ? "border-ethereal-graphite/25 bg-ethereal-marble"
                  : "border-ethereal-gold bg-ethereal-marble",
            )}
          >
            {isDone && (
              <Check
                size={isTickable ? (isStand ? 12 : 10) : isStand ? 10 : 8}
                strokeWidth={3}
              />
            )}
          </span>
        );
        const body = (
          <>
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
          </>
        );
        // The spine is the content column's left rule, so it runs exactly the
        // rows' height; the dot hangs on it from the row it belongs to.
        // Dashed under the reserve rule.
        const column = cn(
          "relative flex min-w-0 flex-1 flex-col gap-0.5 border-l border-ethereal-gold/40",
          row.is_reserve && "border-dashed",
          indent,
          isLast ? "pb-0" : isStand ? "pb-5" : "pb-3",
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
              {isTickable ? (
                <label
                  className={cn(
                    column,
                    "cursor-pointer rounded-r-control pr-2 transition-colors hover:bg-ethereal-ink/3 pointer-coarse:min-h-11",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={isDone}
                    onChange={(event) => void ticks.toggle(row, event.target.checked)}
                    className="peer sr-only"
                  />
                  {dot}
                  {body}
                </label>
              ) : (
                <div className={column}>
                  {dot}
                  {body}
                </div>
              )}
            </li>
          </React.Fragment>
        );
      })}
    </ol>
  );

  if (!onMark) return list;

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <Caption color="muted">
        {t("rehearsals.plan.debrief.prompt", "Odznacz, czego nie zrobiliście")}
      </Caption>
      {list}
    </div>
  );
};
