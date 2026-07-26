/**
 * @file AttendanceSessionHeader.tsx
 * @description A rehearsal as a grid column: the calendar stamp of the Próby
 * runway, narrowed to fit a column, plus the one action a roll call actually
 * needs. The stamp is repeated from the schedule on purpose — the same
 * rehearsal should look like the same object on both screens.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/editors/tabs/components/AttendanceSessionHeader
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { CheckCheck } from "lucide-react";

import type { MarkTally, MatrixSession } from "../../../lib/attendanceMatrix";
import { cn } from "@/shared/lib/utils";
import { formatLocalizedDate, formatLocalizedTime } from "@/shared/lib/time/intl";
import { Caption, Eyebrow, Metric } from "@/shared/ui/primitives/typography";

interface AttendanceSessionHeaderProps {
  readonly session: MatrixSession;
  readonly tally: MarkTally;
  readonly onMarkPresent: (rehearsalId: string) => void;
}

export const AttendanceSessionHeader = ({
  session,
  tally,
  onMarkPresent,
}: AttendanceSessionHeaderProps): React.JSX.Element => {
  const { t } = useTranslation();

  const dayNumber = formatLocalizedDate(
    session.at,
    { day: "numeric" },
    undefined,
    session.timezone,
  );
  const monthLabel = formatLocalizedDate(
    session.at,
    { month: "short" },
    undefined,
    session.timezone,
  );
  const timeLabel = formatLocalizedTime(
    session.at,
    { hour: "2-digit", minute: "2-digit" },
    undefined,
    session.timezone,
  );

  const fullDate = formatLocalizedDate(
    session.at,
    { weekday: "long", day: "numeric", month: "long", year: "numeric" },
    undefined,
    session.timezone,
  );

  // Everything the narrow column has to drop still reaches the pointer.
  const description = [fullDate, timeLabel, session.locationLabel, session.focus]
    .filter((part): part is string => Boolean(part))
    .join(" · ");

  // The live window opens two hours before the downbeat, which is when a roll
  // call is actually taken — gating on `isPast` alone would withhold the action
  // until the rehearsal had already started.
  const canFill = (session.isPast || session.isLive) && tally.missing > 0;
  const fillLabel = t(
    "projects.matrix.actions.mark_present",
    "Oznacz nieoznaczonych jako obecnych",
  );

  return (
    <th
      scope="col"
      title={description}
      className={cn(
        "sticky top-0 z-20 min-w-16 border-b border-hairline-strong bg-ethereal-marble px-1 pb-2 pt-3 align-top font-normal",
        // The session being marked right now is the one the tab was opened for.
        session.isLive && "bg-ethereal-gold/10",
      )}
    >
      <span className="flex flex-col items-center gap-0.5">
        <Metric
          as="span"
          size="lg"
          color={session.isLive ? "gold" : session.isPast ? "default" : "muted"}
          className="leading-none"
        >
          {dayNumber}
        </Metric>
        <Eyebrow
          as="span"
          size="overline-sm"
          color={session.isLive ? "gold" : "muted"}
        >
          {monthLabel}
        </Eyebrow>
        <Caption color="muted" className="tabular-nums">
          {timeLabel}
        </Caption>

        {/* Only a rehearsal that has happened can be filled in, and only the
            seats nobody has judged yet — the gesture must never overwrite a
            mark somebody made on purpose. */}
        {canFill && (
          <button
            type="button"
            onClick={() => onMarkPresent(session.rehearsalId)}
            title={fillLabel}
            aria-label={fillLabel}
            className="mt-1 flex h-7 w-7 items-center justify-center rounded-chip text-ethereal-graphite/45 transition-colors hover:bg-ethereal-sage/12 hover:text-ethereal-sage focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/45"
          >
            <CheckCheck size={14} aria-hidden="true" />
          </button>
        )}
      </span>
    </th>
  );
};
