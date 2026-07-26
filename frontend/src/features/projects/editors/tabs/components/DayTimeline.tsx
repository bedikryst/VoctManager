/**
 * @file DayTimeline.tsx
 * @description The concert day as one runway. The two anchors a producer plans
 * around — the call and the downbeat — are derived from the fields above and
 * rendered as fixed stops among the editable points, so the plan is built inside
 * a visible frame instead of against two times kept in other cards.
 * The frame also does the warning: a point that lands before the call or after
 * the downbeat simply appears outside the anchors, which needs no advisory copy
 * and no validation rule. The row language is the Overview run-sheet widget's —
 * one spine, gold clock, optional title — because this edits what that displays.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/editors/tabs/components/DayTimeline
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence } from "framer-motion";

import { formatLocalizedDate } from "@/shared/lib/time/intl";
import type { RunSheetItem } from "@/shared/types";
import { Caption, Eyebrow, Text } from "@/shared/ui/primitives/typography";
import type { DayAnchorKind, DayTimelineEntry } from "../../../lib/dayTimeline";
import { RunSheetRow } from "./RunSheetRow";

interface DayTimelineProps {
  readonly entries: readonly DayTimelineEntry[];
  readonly onUpdate: (
    id: string,
    field: keyof RunSheetItem,
    value: string,
  ) => void;
  readonly onCommitOrder: () => void;
  readonly onRemove: (id: string) => void;
  /** `yyyy-MM-dd` of the concert, for dating an anchor that falls elsewhere. */
  readonly concertDate: string | null;
  /** Same shape, for the call time — the only anchor that can move days. */
  readonly callDate: string | null;
}

const ANCHOR_LABEL_KEYS: Record<DayAnchorKind, readonly [string, string]> = {
  call: ["projects.details_tab.day_plan.anchor_call", "Zbiórka"],
  concert: ["projects.details_tab.day_plan.anchor_concert", "Koncert"],
};

export const DayTimeline = ({
  entries,
  onUpdate,
  onCommitOrder,
  onRemove,
  concertDate,
  callDate,
}: DayTimelineProps): React.JSX.Element => {
  const { t } = useTranslation();

  return (
    <ul className="relative ml-1 flex flex-col gap-4 border-l border-hairline-strong pl-5">
      <AnimatePresence initial={false}>
        {entries.map((entry) => {
          if (entry.kind === "point") {
            return (
              <RunSheetRow
                key={String(entry.item.id)}
                item={entry.item}
                onUpdate={onUpdate}
                onCommitOrder={onCommitOrder}
                onRemove={onRemove}
              />
            );
          }

          const [labelKey, labelFallback] = ANCHOR_LABEL_KEYS[entry.kind];
          const anchorDate = entry.kind === "call" ? callDate : concertDate;
          const showsDate = entry.dayOffset !== 0 && Boolean(anchorDate);

          return (
            <li key={entry.kind} className="relative py-1">
              {/* Filled, where an editable point is a ring: the anchor is a
                  consequence of the fields above, not a row to type into. */}
              <span
                className="absolute -left-[1.65rem] top-2 h-3 w-3 rounded-full bg-ethereal-gold"
                aria-hidden="true"
              />
              <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                <Text
                  as="span"
                  size="base"
                  weight="bold"
                  className="tabular-nums text-ethereal-gold"
                >
                  {entry.time}
                </Text>
                <Eyebrow color="graphite">{t(labelKey, labelFallback)}</Eyebrow>
                {showsDate && (
                  <Caption color="muted">
                    {/* Noon, not midnight: a bare `yyyy-MM-dd` parses as UTC and
                        would print the previous day west of Greenwich. */}
                    {formatLocalizedDate(`${anchorDate}T12:00`, {
                      day: "numeric",
                      month: "long",
                    })}
                  </Caption>
                )}
              </div>
            </li>
          );
        })}
      </AnimatePresence>
    </ul>
  );
};
