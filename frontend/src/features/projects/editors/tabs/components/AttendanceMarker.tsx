/**
 * @file AttendanceMarker.tsx
 * @description The one glyph the attendance grid speaks in — used by the cells
 * and by the legend that decodes them, so the two can never drift apart.
 *
 * The weights are deliberately unequal, and that is the whole design. A grid
 * holds hundreds of these at once: giving every status a saturated fill turned
 * the tab into a mosaic in which the two absences that matter were no louder
 * than the thirty-eight people who simply turned up. So presence — the expected
 * outcome — is a quiet tick with no surface, an unmarked seat is barely a dot,
 * and crimson is spent on the one thing that is genuinely a problem.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/editors/tabs/components/AttendanceMarker
 */

import React from "react";

import { ATTENDANCE_STATUS_META } from "@/features/rehearsals/constants/attendanceMeta";
import type { AttendanceMark } from "../../../lib/attendanceMatrix";
import { cn } from "@/shared/lib/utils";

/** Vocabulary (label, icon, meaning) is shared; only the density is local. */
const markMetaKey = (mark: AttendanceMark): "NONE" | NonNullable<AttendanceMark> =>
  mark ?? "NONE";

const MARK_SURFACE: Record<NonNullable<AttendanceMark>, string> = {
  PRESENT: "text-ethereal-sage",
  LATE: "bg-ethereal-gold/15 text-ethereal-gold ring-1 ring-inset ring-ethereal-gold/35",
  ABSENT: "bg-ethereal-crimson text-ethereal-alabaster",
  EXCUSED:
    "bg-ethereal-amethyst/12 text-ethereal-amethyst ring-1 ring-inset ring-ethereal-amethyst/35",
};

export const attendanceMarkLabelKey = (mark: AttendanceMark): string =>
  ATTENDANCE_STATUS_META[markMetaKey(mark)].labelKey;

export const attendanceMarkFallback = (mark: AttendanceMark): string =>
  ATTENDANCE_STATUS_META[markMetaKey(mark)].fallback;

interface AttendanceMarkerProps {
  readonly mark: AttendanceMark;
  readonly className?: string;
}

export const AttendanceMarker = ({
  mark,
  className,
}: AttendanceMarkerProps): React.JSX.Element => {
  if (mark === null) {
    return (
      <span
        className={cn(
          "flex h-6 w-6 items-center justify-center",
          className,
        )}
        aria-hidden="true"
      >
        <span className="h-1 w-1 rounded-full bg-ethereal-ink/20" />
      </span>
    );
  }

  const { Icon } = ATTENDANCE_STATUS_META[mark];

  return (
    <span
      className={cn(
        "flex h-6 w-6 items-center justify-center rounded-chip",
        MARK_SURFACE[mark],
        className,
      )}
      aria-hidden="true"
    >
      <Icon size={14} className="shrink-0" />
    </span>
  );
};
