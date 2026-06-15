/**
 * @file LocationRow.tsx
 * @description Dense, click-to-open row for a venue in the command rail
 * (replaces the old big LocationCard). Clicking selects the venue — the atlas
 * flies to it and the dossier opens. A "live" chip surfaces the soonest event
 * here so the conductor sees activity without leaving the list. Quiet inline
 * edit stays always-visible (touch-safe), never hover-gated.
 * @architecture Enterprise SaaS 2026
 * @module features/logistics/components/LocationRow
 */

import React from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { CalendarClock, MapPin, Pencil } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import {
  Caption,
  Text,
} from "@/shared/ui/primitives/typography";

import {
  daysUntil,
  getImminenceDefinition,
} from "../constants/eventImminence";
import { getLocationCategoryOption } from "../constants/locationCategories";
import type { LogisticsEvent } from "../hooks/useLogisticsEvents";
import type { LocationDto } from "../types/logistics.dto";

interface LocationRowProps {
  location: LocationDto;
  isActive: boolean;
  nextEvent: LogisticsEvent | null;
  upcomingCount: number;
  onSelect: (id: string) => void;
  onEdit: (location: LocationDto) => void;
}

const formatRelativeDay = (date: Date, t: TFunction): string => {
  const diff = daysUntil(date);
  if (diff <= 0) return t("logistics.imminence.today", "Dziś");
  if (diff === 1) return t("logistics.timezone.tomorrow", "Jutro");
  if (diff <= 7) return t("logistics.timezone.in_days", "za {{count}} dni", { count: diff });
  return new Intl.DateTimeFormat("pl-PL", {
    day: "numeric",
    month: "short",
  }).format(date);
};

const tzCity = (timezone: string): string =>
  (timezone.split("/").pop() ?? timezone).replace(/_/g, " ");

const LocationRowComponent = ({
  location,
  isActive,
  nextEvent,
  upcomingCount,
  onSelect,
  onEdit,
}: LocationRowProps): React.JSX.Element => {
  const { t } = useTranslation();
  const option = getLocationCategoryOption(t, location.category);
  const Icon = option.icon;
  const imminence = nextEvent
    ? getImminenceDefinition(nextEvent.imminence)
    : null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      role="button"
      tabIndex={0}
      aria-pressed={isActive}
      onClick={() => onSelect(String(location.id))}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(String(location.id));
        }
      }}
      className={cn(
        "group flex cursor-pointer items-center gap-3 rounded-2xl border px-3 py-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40",
        isActive
          ? "border-ethereal-gold/45 bg-ethereal-gold/[0.06] ring-1 ring-ethereal-gold/25"
          : "border-ethereal-ink/8 bg-ethereal-alabaster hover:border-ethereal-gold/30",
      )}
    >
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border bg-ethereal-marble"
        style={{ borderColor: option.atlasMarker, color: option.atlasMarker }}
        aria-hidden="true"
      >
        <Icon size={17} strokeWidth={1.6} />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Text as="p" size="sm" weight="semibold" truncate className="text-ethereal-ink">
            {location.name}
          </Text>
          {upcomingCount > 1 && (
            <Caption
              color="muted"
              className="shrink-0 rounded-full bg-ethereal-ink/6 px-1.5 tabular-nums"
            >
              {upcomingCount}
            </Caption>
          )}
        </div>
        <Caption
          color="muted"
          truncate
          className="mt-0.5 flex items-center gap-1"
        >
          <MapPin size={10} aria-hidden="true" className="shrink-0" />
          {location.formatted_address || tzCity(location.timezone)}
        </Caption>
      </div>

      {nextEvent && imminence ? (
        <div className="flex shrink-0 items-center gap-1.5">
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              imminence.pulse && "animate-pulse",
            )}
            style={{ backgroundColor: imminence.marker }}
            aria-hidden="true"
          />
          <Text
            as="span"
            size="xs"
            weight="semibold"
            className="whitespace-nowrap text-ethereal-graphite"
          >
            {formatRelativeDay(nextEvent.date, t)}
          </Text>
        </div>
      ) : (
        <Caption color="muted" className="hidden shrink-0 items-center gap-1 sm:flex">
          <CalendarClock size={10} aria-hidden="true" />
          {t("logistics.row.no_events", "—")}
        </Caption>
      )}

      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onEdit(location);
        }}
        aria-label={t("logistics.row.edit_aria", "Edytuj {{name}}", {
          name: location.name,
        })}
        className="shrink-0 rounded-lg p-1.5 text-ethereal-graphite/40 transition-colors hover:bg-ethereal-ink/[0.04] hover:text-ethereal-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40"
      >
        <Pencil size={14} aria-hidden="true" />
      </button>
    </motion.div>
  );
};

const arePropsEqual = (
  prev: Readonly<LocationRowProps>,
  next: Readonly<LocationRowProps>,
): boolean =>
  prev.location === next.location &&
  prev.isActive === next.isActive &&
  prev.nextEvent === next.nextEvent &&
  prev.upcomingCount === next.upcomingCount &&
  prev.onSelect === next.onSelect &&
  prev.onEdit === next.onEdit;

export const LocationRow = React.memo(LocationRowComponent, arePropsEqual);
LocationRow.displayName = "LocationRow";
