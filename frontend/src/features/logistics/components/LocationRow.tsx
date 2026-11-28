/**
 * @file LocationRow.tsx
 * @description One venue, as a `RecordRow`: the row focuses the venue, so the
 * atlas flies to it and the detail opens. The category's icon leads in its
 * accent, the colour of the venue's pin, so the row and the pin agree; the
 * address is the byline. The soonest event stands on the right as its day
 * ("Dziś", "za 3 dni", "31 sty"); a venue with nothing booked says nothing,
 * since most of the list is quiet most of the time. The edit icon opens the
 * editor without focusing the venue.
 * @module features/logistics/components/LocationRow
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { Pencil } from "lucide-react";

import { ACCENT_TEXT } from "@/shared/ui/primitives/accents";
import { RecordRow, recordActionClass } from "@/shared/ui/composites/RecordList";
import { Button } from "@/shared/ui/primitives/Button";
import { Text } from "@/shared/ui/primitives/typography";

import { getLocationCategoryOption } from "../constants/locationCategories";
import type { LogisticsEvent } from "../hooks/useLogisticsEvents";
import { formatRelativeDay, formatShortDate } from "../lib/relativeDay";
import type { LocationDto } from "../types/logistics.dto";

interface LocationRowProps {
  readonly location: LocationDto;
  /** The venue the map has focused. */
  readonly isCurrent: boolean;
  readonly nextEvent: LogisticsEvent | null;
  readonly onSelect: (id: string) => void;
  readonly onEdit: (location: LocationDto) => void;
}

const LocationRowComponent = ({
  location,
  isCurrent,
  nextEvent,
  onSelect,
  onEdit,
}: LocationRowProps): React.JSX.Element => {
  const { t, i18n } = useTranslation();
  const option = getLocationCategoryOption(t, location.category);
  const Icon = option.icon;
  const nextDay = nextEvent
    ? (formatRelativeDay(nextEvent.date, t) ?? formatShortDate(nextEvent.date, i18n.language))
    : null;

  return (
    <RecordRow
      open={{ onOpen: () => onSelect(String(location.id)) }}
      title={location.name}
      voice="name"
      current={isCurrent}
      leading={
        <Text
          as="span"
          color={ACCENT_TEXT[option.accent]}
          className="flex size-9 items-center justify-center"
        >
          <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
        </Text>
      }
      facts={[location.formatted_address?.trim() || null]}
      figure={
        nextDay && (
          <Text as="span" size="sm" color="graphite" className="whitespace-nowrap">
            {nextDay}
          </Text>
        )
      }
      actions={
        <Button
          variant="icon"
          size="icon"
          className={recordActionClass}
          onClick={() => onEdit(location)}
          aria-label={t("logistics.row.edit_aria", "Edytuj {{name}}", { name: location.name })}
        >
          <Pencil size={16} aria-hidden="true" />
        </Button>
      }
    />
  );
};

export const LocationRow = React.memo(LocationRowComponent);
LocationRow.displayName = "LocationRow";
