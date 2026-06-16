/**
 * @file LocationDetail.tsx
 * @description The venue read-out, decoupled from any container. It is the
 * single master-detail body shared by the desktop command rail (replaces the
 * venue list when one is selected) and the tablet/mobile bottom sheet — so the
 * map is never covered by a modal again. Surfaces what a conductor needs at a
 * glance: live local time, booked events, the internal "gate code" whisper, and
 * one-tap Maps / directions deep-links. Edit is one tap deeper.
 * @architecture Enterprise SaaS 2026
 * @module features/logistics/components/LocationDetail
 */

import React from "react";
import { useTranslation } from "react-i18next";
import {
  Archive,
  ChevronLeft,
  Clock,
  ExternalLink,
  History,
  Music,
  Navigation,
  Pencil,
  Repeat,
  StickyNote,
} from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { useLocalTime } from "@/shared/lib/time/hooks/useLocalTime";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Button } from "@/shared/ui/primitives/Button";
import {
  Caption,
  Eyebrow,
  Heading,
  Text,
} from "@/shared/ui/primitives/typography";

import { getImminenceDefinition } from "../constants/eventImminence";
import { getLocationCategoryOption } from "../constants/locationCategories";
import type { LogisticsEvent, VenueActivity } from "../hooks/useLogisticsEvents";
import type { LocationDto } from "../types/logistics.dto";

import { LocationCategoryBadge } from "./LocationCategoryBadge";

interface LocationDetailProps {
  location: LocationDto;
  activity: VenueActivity | undefined;
  onClose: () => void;
  onEdit: (location: LocationDto) => void;
  onArchive: (location: LocationDto) => void;
  /** Label for the back affordance ("All venues" on desktop). */
  backLabel?: string;
  className?: string;
}

const buildMapsUrl = (location: LocationDto): string => {
  const base = "https://www.google.com/maps/search/?api=1";
  if (location.google_place_id) {
    return `${base}&query=${encodeURIComponent(location.name)}&query_place_id=${location.google_place_id}`;
  }
  if (location.latitude && location.longitude) {
    return `${base}&query=${location.latitude},${location.longitude}`;
  }
  return `${base}&query=${encodeURIComponent(`${location.name} ${location.formatted_address ?? ""}`)}`;
};

const buildDirectionsUrl = (location: LocationDto): string => {
  const base = "https://www.google.com/maps/dir/?api=1";
  if (location.latitude && location.longitude) {
    const dest = `${location.latitude},${location.longitude}`;
    const placeId = location.google_place_id
      ? `&destination_place_id=${location.google_place_id}`
      : "";
    return `${base}&destination=${dest}${placeId}`;
  }
  return `${base}&destination=${encodeURIComponent(`${location.name} ${location.formatted_address ?? ""}`)}`;
};

const DetailEventRow = ({
  event,
}: {
  event: LogisticsEvent;
}): React.JSX.Element => {
  const { t } = useTranslation();
  const imminence = getImminenceDefinition(event.imminence);
  const TypeIcon = event.type === "CONCERT" ? Music : Repeat;
  const dateLabel = new Intl.DateTimeFormat("pl-PL", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(event.date);

  return (
    <div className="flex items-center gap-3 rounded-xl border border-ethereal-ink/8 bg-ethereal-alabaster/70 px-3 py-2.5">
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border"
        style={{ borderColor: imminence.marker, color: imminence.marker }}
        aria-hidden="true"
      >
        <TypeIcon size={14} strokeWidth={1.75} />
      </span>
      <div className="min-w-0 flex-1">
        <Text as="p" size="sm" weight="semibold" truncate className="text-ethereal-ink">
          {event.title}
        </Text>
        <Caption color="muted" truncate className="mt-0.5">
          {event.type === "CONCERT"
            ? t("logistics.event.concert", "Koncert")
            : t("logistics.event.rehearsal", "Próba")}{" "}
          · {dateLabel}
        </Caption>
      </div>
      <span
        className={cn(
          "h-1.5 w-1.5 shrink-0 rounded-full",
          imminence.pulse && "animate-pulse",
        )}
        style={{ backgroundColor: imminence.marker }}
        aria-hidden="true"
      />
    </div>
  );
};

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
  const liveTime = useLocalTime(location.timezone ?? "");

  const option = getLocationCategoryOption(t, location.category);
  const upcoming = activity?.upcoming ?? [];
  const pastCount = activity?.past.length ?? 0;

  return (
    <div className={cn("flex h-full min-h-0 flex-col", className)}>
      <header className="flex shrink-0 items-start justify-between gap-3 border-b border-ethereal-ink/6 bg-ethereal-marble/60 px-5 py-4">
        <div className="flex min-w-0 items-start gap-2.5">
          <button
            type="button"
            onClick={onClose}
            aria-label={backLabel ?? t("logistics.dossier.close", "Zamknij")}
            className="mt-0.5 shrink-0 rounded-lg border border-ethereal-ink/8 bg-ethereal-marble/70 p-1.5 text-ethereal-graphite transition-colors hover:text-ethereal-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40"
          >
            <ChevronLeft size={16} aria-hidden="true" />
          </button>
          <div className="min-w-0 space-y-1.5">
            <Eyebrow color="muted">
              {t("logistics.dossier.eyebrow", "Karta lokacji")}
            </Eyebrow>
            <Heading as="h2" size="lg" truncate className="text-ethereal-ink">
              {location.name}
            </Heading>
            {option && (
              <LocationCategoryBadge category={location.category} size="sm" />
            )}
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overflow-x-hidden px-5 py-5">
        {/* Live local time */}
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-ethereal-ink/6 bg-ethereal-marble/50 px-4 py-3">
          <div className="flex items-center gap-2 text-ethereal-graphite/70">
            <Clock size={14} aria-hidden="true" />
            <Eyebrow color="muted">
              {t("logistics.atlas.local_time", "Czas lokalny")}
            </Eyebrow>
          </div>
          <Text
            as="span"
            size="lg"
            weight="semibold"
            className="tabular-nums text-ethereal-ink"
          >
            {liveTime || location.timezone}
          </Text>
        </div>

        {/* Address + deep links */}
        <div className="space-y-2">
          <Text as="p" size="sm" color="graphite" className="leading-relaxed">
            {location.formatted_address ||
              t("logistics.card.no_address", "Brak adresu")}
          </Text>
          <div className="flex flex-wrap gap-2">
            <a
              href={buildMapsUrl(location)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-ethereal-ink/8 bg-ethereal-marble/70 px-3 py-1.5 text-xs font-semibold text-ethereal-graphite transition-colors hover:border-ethereal-gold/40 hover:text-ethereal-gold"
            >
              <ExternalLink size={12} aria-hidden="true" />
              {t("logistics.atlas.open_maps", "Mapy Google")}
            </a>
            <a
              href={buildDirectionsUrl(location)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-ethereal-ink/8 bg-ethereal-marble/70 px-3 py-1.5 text-xs font-semibold text-ethereal-graphite transition-colors hover:border-ethereal-gold/40 hover:text-ethereal-gold"
            >
              <Navigation size={12} aria-hidden="true" />
              {t("logistics.preview.get_directions", "Wyznacz trasę")}
            </a>
          </div>
        </div>

        {/* Internal notes */}
        {location.internal_notes && location.internal_notes.trim() && (
          <div className="flex items-start gap-2 rounded-2xl border border-ethereal-gold/15 bg-ethereal-gold/5 px-4 py-3">
            <StickyNote
              size={14}
              strokeWidth={1.6}
              className="mt-0.5 shrink-0 text-ethereal-gold"
              aria-hidden="true"
            />
            <Text as="p" size="sm" color="graphite" className="italic leading-relaxed">
              {location.internal_notes}
            </Text>
          </div>
        )}

        {/* Events at this venue */}
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <Eyebrow as="h3" color="graphite">
              {t("logistics.dossier.events_here", "Wydarzenia tutaj")}
            </Eyebrow>
            {pastCount > 0 && (
              <Caption color="muted" className="inline-flex items-center gap-1">
                <History size={11} aria-hidden="true" />
                {t("logistics.dossier.past_count", "{{count}} minionych", {
                  count: pastCount,
                })}
              </Caption>
            )}
          </div>

          {upcoming.length > 0 ? (
            <div className="space-y-2">
              {upcoming.map((event) => (
                <DetailEventRow key={event.id} event={event} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-ethereal-ink/10 bg-ethereal-alabaster/50 px-4 py-5 text-center">
              <Badge variant="glass">
                {t("logistics.dossier.no_upcoming", "Brak zaplanowanych wydarzeń")}
              </Badge>
            </div>
          )}
        </section>
      </div>

      <footer className="flex shrink-0 gap-3 border-t border-ethereal-ink/6 bg-ethereal-marble/40 px-5 py-4">
        <Button
          variant="outline"
          onClick={() => onEdit(location)}
          leftIcon={<Pencil size={14} aria-hidden="true" />}
          className="flex-1 justify-center"
        >
          {t("logistics.card.edit", "Edytuj")}
        </Button>
        <Button
          variant="ghost"
          onClick={() => onArchive(location)}
          leftIcon={<Archive size={14} aria-hidden="true" />}
          className="justify-center text-ethereal-crimson hover:bg-ethereal-crimson/10 hover:text-ethereal-crimson"
        >
          {t("logistics.card.archive", "Archiwizuj")}
        </Button>
      </footer>
    </div>
  );
};
