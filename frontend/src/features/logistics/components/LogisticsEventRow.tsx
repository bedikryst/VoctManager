/**
 * @file LogisticsEventRow.tsx
 * @description One concert or rehearsal, as a `RecordRow`: the type's icon
 * leads and the event is the title. The date stands on the right, and under
 * it, within a week, how soon ("Jutro", "za 3 dni").
 *
 * On the upcoming list (`onSelect`) the byline names the type and the venue,
 * and the row focuses the venue, so the atlas flies there; a row without a
 * venue stays listed, so nothing silently disappears, and opens nothing.
 * Inside a venue's own record the venue goes without saying: the byline names
 * the type and, for a rehearsal with a focus, its project, and the row opens
 * the project (a rehearsal, the project's rehearsals).
 * @module features/logistics/components/LogisticsEventRow
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { Music, Repeat } from "lucide-react";

import { RecordRow } from "@/shared/ui/composites/RecordList";
import { Text } from "@/shared/ui/primitives/typography";

import type { LogisticsEvent } from "../hooks/useLogisticsEvents";
import { getLogisticsEventPresentation } from "../lib/eventLabel";
import { formatRelativeDay, formatShortDate } from "../lib/relativeDay";

interface LogisticsEventRowProps {
  readonly event: LogisticsEvent;
  /** On the upcoming list: whether the event's venue is the one the map has
   *  focused. */
  readonly isCurrent?: boolean;
  /** On the upcoming list: focuses the event's venue. Without it the row is
   *  in a venue's record and opens the event's project. */
  readonly onSelect?: (locationId: string) => void;
}

const projectEventPath = (event: LogisticsEvent): string =>
  event.type === "REHEARSAL"
    ? `/panel/projects/${event.projectId}/rehearsals`
    : `/panel/projects/${event.projectId}`;

const LogisticsEventRowComponent = ({
  event,
  isCurrent = false,
  onSelect,
}: LogisticsEventRowProps): React.JSX.Element => {
  const { t, i18n } = useTranslation();
  const TypeIcon = event.type === "CONCERT" ? Music : Repeat;
  const presentation = getLogisticsEventPresentation(event);
  const typeLabel = t(presentation.labelKey, presentation.fallbackLabel);
  const venue = event.location;
  const relative = formatRelativeDay(event.date, t);

  const open = onSelect
    ? venue
      ? { onOpen: () => onSelect(String(venue.id)) }
      : undefined
    : { to: projectEventPath(event) };
  const facts = onSelect
    ? [typeLabel, venue?.name ?? t("logistics.event.no_venue", "Bez miejsca")]
    : [typeLabel, event.subtitle];

  return (
    <RecordRow
      open={open}
      title={event.title}
      voice="name"
      current={isCurrent}
      leading={
        <span className="flex size-9 items-center justify-center text-ethereal-graphite">
          <TypeIcon size={18} strokeWidth={1.75} aria-hidden="true" />
        </span>
      }
      facts={facts}
      figure={
        <>
          <Text as="span" size="sm" color="graphite" className="whitespace-nowrap">
            {formatShortDate(event.date, i18n.language)}
          </Text>
          {relative && (
            <Text as="span" size="sm" color="muted" className="whitespace-nowrap">
              {relative}
            </Text>
          )}
        </>
      }
    />
  );
};

export const LogisticsEventRow = React.memo(LogisticsEventRowComponent);
LogisticsEventRow.displayName = "LogisticsEventRow";
