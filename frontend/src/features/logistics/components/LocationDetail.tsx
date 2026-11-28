/**
 * @file LocationDetail.tsx
 * @description A venue's record, decoupled from any container: the body of the
 * desktop rail (in place of the venue list while one is focused) and of the
 * phone's bottom sheet, so the map is never covered by a modal.
 *
 * The head is the record's: on desktop a back link to the list, the venue's
 * name in the sans (a place is a name, not a titled work), the category with
 * its icon in the accent of its pin, then the address; "Edytuj" and a menu
 * holding "Archiwizuj" beside it, as on a row. On a phone the sheet has no
 * list to go back to, so a close button takes the back link's place.
 *
 * Below: the local time, only when the venue's clock differs from the
 * reader's; the Maps and directions links; the team's notes; what is coming up
 * here, each event opening its project, with the past folded into one line.
 * @module features/logistics/components/LocationDetail
 */

import React, { useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Archive,
  ArrowLeft,
  ExternalLink,
  History,
  MoreHorizontal,
  Navigation,
  Pencil,
  X,
} from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { useLocalTime } from "@/shared/lib/time/hooks/useLocalTime";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/composites/DropdownMenu";
import { FoldLine } from "@/shared/ui/composites/FoldLine";
import { RecordList } from "@/shared/ui/composites/RecordList";
import { ACCENT_TEXT } from "@/shared/ui/primitives/accents";
import { Button } from "@/shared/ui/primitives/Button";
import { Text } from "@/shared/ui/primitives/typography";

import { getLocationCategoryOption } from "../constants/locationCategories";
import { tzCity, type VenueActivity } from "../hooks/useLogisticsEvents";
import { buildDirectionsUrl, buildPlaceUrl } from "../lib/mapsLinks";
import type { LocationDto } from "../types/logistics.dto";

import { LogisticsEventRow } from "./LogisticsEventRow";

interface LocationDetailProps {
  location: LocationDto;
  activity: VenueActivity | undefined;
  onClose: () => void;
  onEdit: (location: LocationDto) => void;
  onArchive: (location: LocationDto) => void;
  /** The back link's label, on desktop ("Miejsca"); without it, a close
   *  button. */
  backLabel?: string;
  className?: string;
}

/** The reader's own zone, against which a venue's clock is worth stating. */
const READER_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

/** The shape both deep-link builders read, from a full venue record. */
const toMapsTarget = (location: LocationDto) => ({
  name: location.name,
  formattedAddress: location.formatted_address,
  googlePlaceId: location.google_place_id,
  latitude: location.latitude,
  longitude: location.longitude,
});

const MAPS_LINK_CLASS =
  "inline-flex items-center gap-1.5 rounded-chip border border-hairline-strong bg-ethereal-marble/70 px-3 py-1.5 text-xs font-semibold text-ethereal-graphite transition-colors hover:border-ethereal-gold/40 hover:text-ethereal-gold";

export const LocationDetail = ({
  location,
  activity,
  onClose,
  onEdit,
  onArchive,
  backLabel,
  className,
}: LocationDetailProps): React.JSX.Element => {
  const { t } = useTranslation();
  const notesHeadingId = useId();
  const eventsHeadingId = useId();
  // Archive opens its confirmation once the menu has handed focus back to its
  // trigger, so the dialog does not race the menu for it.
  const archiveChosen = useRef(false);
  // The fold is open for one venue; focusing another starts it closed.
  const [pastOpenFor, setPastOpenFor] = useState<string | null>(null);

  const locationId = String(location.id);
  const category = getLocationCategoryOption(t, location.category);
  const CategoryIcon = category.icon;
  const address = location.formatted_address?.trim() || null;
  const notes = location.internal_notes?.trim() || null;

  const venueTime = useLocalTime(location.timezone ?? "");
  const readerTime = useLocalTime(READER_TIMEZONE);
  const showsLocalTime = venueTime !== "" && venueTime !== readerTime;

  const upcoming = activity?.upcoming ?? [];
  const past = activity?.past ?? [];
  const pastOpen = pastOpenFor === locationId;
  const eventsHeading = t("logistics.dossier.upcoming_here", "Nadchodzące tutaj");
  const pastLabel = t("logistics.dossier.past_label", "Minione tutaj");

  return (
    <div className={cn("flex h-full min-h-0 flex-col", className)}>
      <header className="shrink-0 border-b border-hairline px-5 py-4">
        {backLabel && (
          <button
            type="button"
            onClick={onClose}
            className="mb-3 inline-flex items-center gap-2 rounded-chip text-ethereal-graphite transition-colors hover:text-ethereal-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40"
          >
            <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />
            <Text as="span" size="base" color="inherit">
              {backLabel}
            </Text>
          </button>
        )}
        <div className="flex items-start gap-3">
          <Text
            as="h2"
            size="lg"
            weight="semibold"
            className="min-w-0 flex-1 self-center wrap-break-word"
          >
            {location.name}
          </Text>
          <div className="-mr-2 -my-1.5 flex shrink-0 items-center">
            <Button
              variant="icon"
              size="icon"
              onClick={() => onEdit(location)}
              aria-label={t("logistics.card.edit", "Edytuj")}
              title={t("logistics.card.edit", "Edytuj")}
            >
              <Pencil size={18} aria-hidden="true" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="icon"
                  size="icon"
                  aria-label={t("logistics.dossier.menu_aria", "Więcej: {{name}}", {
                    name: location.name,
                  })}
                >
                  <MoreHorizontal size={18} aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                onCloseAutoFocus={() => {
                  if (!archiveChosen.current) return;
                  archiveChosen.current = false;
                  onArchive(location);
                }}
              >
                <DropdownMenuItem
                  destructive
                  icon={<Archive size={16} />}
                  onSelect={() => {
                    archiveChosen.current = true;
                  }}
                >
                  {t("logistics.card.archive", "Archiwizuj")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {!backLabel && (
              <Button
                variant="icon"
                size="icon"
                onClick={onClose}
                aria-label={t("common.actions.close", "Zamknij")}
              >
                <X size={18} aria-hidden="true" />
              </Button>
            )}
          </div>
        </div>
        {/* Under the whole row, not beside the actions: an address runs long,
            and on a phone three icon buttons would leave it a narrow column. */}
        <Text as="div" size="sm" color="muted" className="mt-1 flex gap-1.5">
          <Text
            as="span"
            color={ACCENT_TEXT[category.accent]}
            className="flex h-5 shrink-0 items-center"
          >
            <CategoryIcon size={14} strokeWidth={1.75} aria-hidden="true" />
          </Text>
          <span className="min-w-0">
            {[category.label, address].filter(Boolean).join(", ")}
          </span>
        </Text>
      </header>

      <div className="min-h-0 flex-1 space-y-7 overflow-y-auto overflow-x-hidden px-5 py-5">
        <div className="space-y-3">
          {showsLocalTime && (
            <Text as="p" size="sm" color="graphite" className="tabular-nums">
              {t("logistics.dossier.local_time", "Czas lokalny {{time}}, {{city}}", {
                time: venueTime,
                city: tzCity(location.timezone ?? ""),
              })}
            </Text>
          )}
          <div className="flex flex-wrap gap-2">
            <a
              href={buildPlaceUrl(toMapsTarget(location))}
              target="_blank"
              rel="noopener noreferrer"
              className={MAPS_LINK_CLASS}
            >
              <ExternalLink size={12} aria-hidden="true" />
              {t("logistics.atlas.open_maps", "Mapy Google")}
            </a>
            <a
              href={buildDirectionsUrl(toMapsTarget(location))}
              target="_blank"
              rel="noopener noreferrer"
              className={MAPS_LINK_CLASS}
            >
              <Navigation size={12} aria-hidden="true" />
              {t("logistics.preview.get_directions", "Wyznacz trasę")}
            </a>
          </div>
        </div>

        {notes && (
          <section aria-labelledby={notesHeadingId}>
            <Text as="h3" id={notesHeadingId} size="base" weight="semibold">
              {t("logistics.dossier.notes", "Notatki")}
            </Text>
            <Text as="p" size="sm" color="graphite" className="mt-1 whitespace-pre-line">
              {notes}
            </Text>
          </section>
        )}

        <section aria-labelledby={eventsHeadingId}>
          <Text as="h3" id={eventsHeadingId} size="base" weight="semibold" className="mb-1">
            {eventsHeading}
          </Text>
          {upcoming.length > 0 ? (
            <RecordList edge="inset" label={eventsHeading}>
              {upcoming.map((event) => (
                <LogisticsEventRow key={event.id} event={event} />
              ))}
            </RecordList>
          ) : (
            <Text as="p" size="sm" color="graphite">
              {t("logistics.dossier.no_upcoming", "Nic tu jeszcze nie zaplanowano.")}
            </Text>
          )}
          {past.length > 0 && (
            <div className="mt-2">
              <FoldLine
                label={pastLabel}
                summary={t("logistics.dossier.past_fold", "Minione: {{count}}", {
                  count: past.length,
                })}
                icon={<History size={16} className="text-ethereal-graphite" />}
                open={pastOpen}
                onToggle={() => setPastOpenFor(pastOpen ? null : locationId)}
              >
                <RecordList edge="inset" label={pastLabel}>
                  {past.map((event) => (
                    <LogisticsEventRow key={event.id} event={event} />
                  ))}
                </RecordList>
              </FoldLine>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
