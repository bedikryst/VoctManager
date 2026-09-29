/**
 * @file DayTimeline.tsx
 * @description The plan as one runway. Every moment the producer typed into a
 * field rather than into the list — the call, the downbeat, and the two
 * windows from the card below — is derived and rendered as a fixed stop among
 * the editable points, so the plan is built inside a visible frame instead of
 * against times kept in other cards.
 * The frame also does the warning: a point that lands before the call, after
 * the downbeat, or on top of the sound check simply appears there, which needs
 * no advisory copy and no validation rule. The row language is the Overview
 * run-sheet widget's — one spine, gold clock, optional title — because this
 * edits what that displays.
 * A plan that reaches past concert day is a trip, and each of its days opens
 * under its date — the same headings the printed sheet and the singer's card
 * draw. An anchor off concert day therefore needs no date of its own.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/editors/tabs/components/DayTimeline
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence } from "framer-motion";

import type { SelectOption } from "@/shared/ui/primitives/Select";
import { Caption, Eyebrow, Text } from "@/shared/ui/primitives/typography";
import {
  groupDayTimeline,
  isDayWindow,
  isMultiDayTimeline,
  type DayTimelineEntry,
} from "../../../lib/dayTimeline";
import {
  DAY_WINDOW_UNTIL,
  getDayFixturePresentation,
} from "../../../lib/projectPresentation";
import type { ProjectEventKind } from "../../../constants/projectDomain";
import type { RunSheetItemUpdater } from "../../hooks/useDetailsForm";
import { RunSheetRow } from "./RunSheetRow";

interface DayTimelineProps {
  readonly entries: readonly DayTimelineEntry[];
  /** Saved venues a point can be sent to; owned by the tab that queries them. */
  readonly locationOptions: readonly SelectOption[];
  /** The plan's days, for each row's day select. */
  readonly dayOptions: readonly SelectOption[];
  /** What a row with no day reads as — the event's own day. */
  readonly dayPlaceholder: string;
  /** Names a day of the plan for its heading. */
  readonly dayLabel: (dayOffset: number) => string;
  readonly onUpdate: RunSheetItemUpdater;
  readonly onCommitOrder: () => void;
  readonly onRemove: (id: string) => void;
  /** Opens the venue editor for one row; the new venue lands in its picker. */
  readonly onCreatePlace: (id: string) => void;
  /** Names the downbeat: the form's live value, so switching the kind renames
   *  the row before the project is saved. */
  readonly eventKind: ProjectEventKind;
}

export const DayTimeline = ({
  entries,
  locationOptions,
  dayOptions,
  dayPlaceholder,
  dayLabel,
  onUpdate,
  onCommitOrder,
  onRemove,
  onCreatePlace,
  eventKind,
}: DayTimelineProps): React.JSX.Element => {
  const { t } = useTranslation();
  const isMultiDay = isMultiDayTimeline(entries);
  const groups = isMultiDay
    ? groupDayTimeline(entries)
    : [{ dayOffset: 0, entries }];

  const renderEntry = (entry: DayTimelineEntry): React.JSX.Element => {
    if (entry.kind === "point") {
      return (
        <RunSheetRow
          key={String(entry.item.id)}
          item={entry.item}
          locationOptions={locationOptions}
          dayOptions={dayOptions}
          dayPlaceholder={dayPlaceholder}
          onUpdate={onUpdate}
          onCommitOrder={onCommitOrder}
          onRemove={onRemove}
          onCreatePlace={onCreatePlace}
        />
      );
    }

    const { labelKey, fallbackLabel } = getDayFixturePresentation(
      entry.kind,
      eventKind,
    );

    return (
      <li key={entry.kind} className="relative py-1">
        {/* Filled, where an editable point is a ring: a fixed stop is a
            consequence of the fields, not a row to type into. One treatment
            for all four — the label already says which moment it is, so a
            second colour would spend an accent on a distinction the words
            carry. */}
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
  };

  return (
    <ul className="relative ml-1 flex flex-col gap-4 border-l border-hairline-strong pl-5">
      <AnimatePresence initial={false}>
        {groups.flatMap((group, index) => [
          ...(isMultiDay
            ? [
                <li
                  key={`day-${index}-${group.dayOffset}`}
                  className={index > 0 ? "pt-2" : undefined}
                >
                  <Eyebrow as="h3" color={group.dayOffset === 0 ? "gold" : "muted"}>
                    {dayLabel(group.dayOffset)}
                  </Eyebrow>
                </li>,
              ]
            : []),
          ...group.entries.map(renderEntry),
        ])}
      </AnimatePresence>
    </ul>
  );
};
