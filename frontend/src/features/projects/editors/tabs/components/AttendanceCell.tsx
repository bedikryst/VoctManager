/**
 * @file AttendanceCell.tsx
 * @description One seat at one rehearsal. The whole cell is the control — a
 * grid this dense has no room for a button smaller than its own box, and the
 * old 28px swatch left two thirds of every cell inert. Click advances the mark,
 * Shift-click walks it back.
 * Memoised on value: a project can hold several hundred of these, and a single
 * click must not repaint the grid.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/editors/tabs/components/AttendanceCell
 */

import React from "react";

import type { AttendanceMark } from "../../../lib/attendanceMatrix";
import { AttendanceMarker } from "./AttendanceMarker";

interface AttendanceCellProps {
  readonly rehearsalId: string;
  readonly participationId: string;
  readonly mark: AttendanceMark;
  /** Summoned to this rehearsal at all — a sectional call leaves the rest N/A. */
  readonly isCalled: boolean;
  /** Edited since the last save; the row is a draft until the action bar is used. */
  readonly isDirty: boolean;
  /** Resolved by the caller so several hundred cells share one translator read. */
  readonly label: string;
  readonly onCycle: (
    rehearsalId: string,
    participationId: string,
    direction: 1 | -1,
  ) => void;
}

const AttendanceCellComponent = ({
  rehearsalId,
  participationId,
  mark,
  isCalled,
  isDirty,
  label,
  onCycle,
}: AttendanceCellProps): React.JSX.Element => {
  if (!isCalled) {
    return (
      <td
        className="border-b border-hairline bg-ethereal-parchment/30 p-0"
        title={label}
      >
        <span className="flex h-11 items-center justify-center" aria-hidden="true">
          <span className="h-px w-4 rotate-[-30deg] bg-ethereal-ink/15" />
        </span>
        <span className="sr-only">{label}</span>
      </td>
    );
  }

  return (
    <td className="relative border-b border-hairline p-0 group-hover/row:bg-ethereal-gold/6">
      <button
        type="button"
        onClick={(event) =>
          onCycle(rehearsalId, participationId, event.shiftKey ? -1 : 1)
        }
        title={label}
        aria-label={label}
        className="flex h-11 w-full items-center justify-center transition-colors duration-150 hover:bg-ethereal-gold/12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ethereal-gold/45"
      >
        <AttendanceMarker mark={mark} />
      </button>
      {isDirty && (
        <span
          className="pointer-events-none absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-ethereal-gold ring-2 ring-ethereal-alabaster"
          aria-hidden="true"
        />
      )}
    </td>
  );
};

export const AttendanceCell = React.memo(AttendanceCellComponent);
AttendanceCell.displayName = "AttendanceCell";
