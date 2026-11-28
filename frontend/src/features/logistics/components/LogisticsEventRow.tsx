/**
 * @file LogisticsEventRow.tsx
 * @description One upcoming concert or rehearsal, as a `RecordRow`: the type's
 * icon leads, the event is the title, and the byline names its type and its
 * venue. The date stands on the right, and under it, within a week, how soon
 * ("Jutro", "za 3 dni"). A row with a venue focuses it, so the atlas flies
 * there; one without stays listed, so nothing silently disappears, and opens
 * nothing.
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
  /** Whether the event's venue is the one the map has focused. */
  readonly isCurrent: boolean;
  readonly onSelect: (locationId: string) => void;
}

const LogisticsEventRowComponent = ({
  event,
  isCurrent,
  onSelect,
}: LogisticsEventRowProps): React.JSX.Element => {
  const { t, i18n } = useTranslation();
  const TypeIcon = event.type === "CONCERT" ? Music : Repeat;
  const typeLabel = getLogisticsEventPresentation(event);
  const venue = event.location;
  const relative = formatRelativeDay(event.date, t);

  return (
    <RecordRow
      open={venue ? { onOpen: () => onSelect(String(venue.id)) } : undefined}
      title={event.title}
      voice="name"
      current={isCurrent}
      leading={
        <span className="flex size-9 items-center justify-center text-ethereal-graphite">
          <TypeIcon size={18} strokeWidth={1.75} aria-hidden="true" />
        </span>
      }
      facts={[
        t(typeLabel.labelKey, typeLabel.fallbackLabel),
        venue?.name ?? t("logistics.event.no_venue", "Bez miejsca"),
      ]}
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
