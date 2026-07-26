/**
 * @file PickerRow.tsx
 * @description One candidate in a picker column — a piece in the composition
 * database, a singer in the artist roster. Program and Obsada are the same
 * composition (a pool on one side, the work product on the other) and this is
 * the row they share, so the two tabs stop reading as two products.
 * The whole row is the control. Thirty rows each carrying their own bordered
 * button is chrome competing with the names it lists, and the row is a far
 * larger target than the button ever was.
 * A taken row stays in place instead of vanishing, so the list does not
 * reshuffle under the pointer between two picks — but it reads as taken, not
 * struck out: a line through a title means cancelled, not chosen.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/editors/tabs/components/PickerRow
 */

import React from "react";
import { Check, Loader2, Plus } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { Caption, Text } from "@/shared/ui/primitives/typography";

interface PickerRowProps {
  readonly title: string;
  /** Secondary line — composer · voicing, or range · sight-reading. */
  readonly meta?: string | null;
  /** Right-aligned datum shown before the affordance (the duration column). */
  readonly trailing?: React.ReactNode;
  /**
   * Already in the work product: the row states it and stops responding. Only
   * meaningful for a pool that keeps taken rows in place — a pool that hands
   * its rows over to the other column (the cast) never has one.
   */
  readonly isTaken?: boolean;
  readonly isBusy?: boolean;
  readonly onPick: () => void;
  readonly pickLabel: string;
  readonly takenLabel?: string;
}

export function PickerRow({
  title,
  meta,
  trailing,
  isTaken = false,
  isBusy = false,
  onPick,
  pickLabel,
  takenLabel,
}: PickerRowProps): React.JSX.Element {
  const actionLabel = (isTaken && takenLabel) || pickLabel;

  return (
    <li>
      <button
        type="button"
        disabled={isTaken || isBusy}
        onClick={onPick}
        title={actionLabel}
        className={cn(
          "group/pick flex w-full items-center gap-3 px-5 py-2.5 text-left transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ethereal-gold/40",
          isTaken
            ? "cursor-default"
            : "hover:bg-ethereal-gold/8 disabled:cursor-wait",
        )}
      >
        <span className="flex min-w-0 flex-1 flex-col">
          <Text
            as="span"
            size="sm"
            weight="medium"
            truncate
            color={isTaken ? "muted" : "graphite"}
          >
            {title}
          </Text>
          {meta && (
            <Caption as="span" color="muted" className="truncate">
              {meta}
            </Caption>
          )}
        </span>

        {trailing}

        <span
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-chip transition-colors",
            "pointer-coarse:h-9 pointer-coarse:w-9",
            isTaken
              ? "text-ethereal-sage"
              : "text-ethereal-graphite/35 group-hover/pick:bg-ethereal-gold/12 group-hover/pick:text-ethereal-gold",
          )}
          aria-hidden="true"
        >
          {isBusy ? (
            <Loader2 size={14} className="animate-spin" />
          ) : isTaken ? (
            <Check size={14} />
          ) : (
            <Plus size={15} />
          )}
        </span>

        <span className="sr-only">{actionLabel}</span>
      </button>
    </li>
  );
}
