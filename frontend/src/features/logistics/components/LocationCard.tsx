/**
 * @file LocationCard.tsx
 * @description Memoised card surface for a single logistics location.
 * Built around Ethereal typography primitives, GlassCard, and category-driven
 * accents — zero raw HTML typography, zero stone palette. Surfaces the live
 * local time, formatted address, and an open-in-Maps deep-link.
 * @architecture Enterprise SaaS 2026
 * @module features/logistics/components/LocationCard
 */

import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  Archive,
  Clock,
  Edit2,
  ExternalLink,
  MapPin,
  StickyNote,
} from "lucide-react";

import { useLocalTime } from "@/shared/lib/time/hooks/useLocalTime";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Button } from "@/shared/ui/primitives/Button";
import {
  Caption,
  Eyebrow,
  Heading,
  Text,
} from "@/shared/ui/primitives/typography";

import { getLocationCategoryOption } from "../constants/locationCategories";
import type { LocationDto } from "../types/logistics.dto";

import { LocationCategoryBadge } from "./LocationCategoryBadge";

interface LocationCardProps {
  location: LocationDto;
  onEdit: (location: LocationDto) => void;
  onArchive: (location: LocationDto) => void;
}

const formatTimezone = (timezone: string): string => {
  if (!timezone) return "";
  const segment = timezone.split("/").pop();
  return (segment ?? timezone).replace(/_/g, " ");
};

const buildMapsUrl = (location: LocationDto): string => {
  const baseUrl = "https://www.google.com/maps/search/?api=1";
  if (location.google_place_id) {
    return `${baseUrl}&query=${encodeURIComponent(location.name)}&query_place_id=${location.google_place_id}`;
  }
  if (location.latitude && location.longitude) {
    return `${baseUrl}&query=${location.latitude},${location.longitude}`;
  }
  const query = encodeURIComponent(
    `${location.name} ${location.formatted_address ?? ""}`,
  );
  return `${baseUrl}&query=${query}`;
};

const LocationCardComponent = ({
  location,
  onEdit,
  onArchive,
}: LocationCardProps): React.JSX.Element => {
  const { t } = useTranslation();
  const option = useMemo(
    () => getLocationCategoryOption(t, location.category),
    [t, location.category],
  );
  const Icon = option.icon;
  const liveLocalTime = useLocalTime(location.timezone);
  const timezoneShort = formatTimezone(location.timezone);
  const hasGeo = location.latitude !== null && location.longitude !== null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      <GlassCard
        variant="ethereal"
        padding="md"
        isHoverable={false}
        className="flex h-full flex-col justify-between border border-ethereal-incense/20 transition-[transform,box-shadow,border-color] duration-500 hover:-translate-y-0.5 hover:border-ethereal-gold/30 hover:shadow-glass-ethereal-hover"
      >
        <div className="flex flex-1 flex-col gap-5">
          <header className="flex items-start gap-4">
            <div
              className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl border bg-ethereal-marble shadow-sm"
              style={{
                borderColor: option.atlasMarker,
                color: option.atlasMarker,
              }}
              aria-hidden="true"
            >
              <Icon size={20} strokeWidth={1.6} />
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <Heading as="h3" size="lg" weight="bold" truncate>
                {location.name}
              </Heading>
              <div className="flex flex-wrap items-center gap-2">
                <LocationCategoryBadge category={location.category} size="sm" />
                <Badge
                  variant="glass"
                  icon={
                    <Clock
                      size={11}
                      className={
                        liveLocalTime
                          ? "text-ethereal-gold"
                          : "text-ethereal-incense/50"
                      }
                    />
                  }
                >
                  {liveLocalTime ? (
                    <>
                      {liveLocalTime}
                      <Caption className="ml-1 tracking-widest text-[8px] uppercase !text-ethereal-incense/60">
                        {timezoneShort}
                      </Caption>
                    </>
                  ) : (
                    <>{timezoneShort || location.timezone}</>
                  )}
                </Badge>
              </div>
            </div>
          </header>

          <div className="rounded-2xl border border-ethereal-incense/15 bg-ethereal-alabaster/45 px-4 py-3">
            <div className="flex items-start gap-2 text-ethereal-graphite/70">
              <MapPin
                size={13}
                strokeWidth={1.6}
                className="mt-0.5 shrink-0"
                aria-hidden="true"
              />
              <Text
                as="p"
                size="sm"
                weight="medium"
                color="graphite"
                className="line-clamp-2 leading-relaxed"
              >
                {location.formatted_address ||
                  t("logistics.card.no_address", "Brak adresu")}
              </Text>
            </div>
          </div>

          {location.internal_notes && (
            <div className="flex items-start gap-2 rounded-2xl border border-ethereal-gold/15 bg-ethereal-gold/5 px-4 py-3">
              <StickyNote
                size={13}
                strokeWidth={1.6}
                className="mt-0.5 shrink-0 text-ethereal-gold"
                aria-hidden="true"
              />
              <Caption
                color="graphite"
                className="line-clamp-2 italic leading-relaxed block"
              >
                {location.internal_notes}
              </Caption>
            </div>
          )}

          {hasGeo && (
            <div className="flex items-center justify-between gap-3 text-ethereal-graphite/60">
              <Eyebrow color="muted">
                {t("logistics.card.deep_link", "Otwórz w Google Maps")}
              </Eyebrow>
              <a
                href={buildMapsUrl(location)}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t("logistics.card.deep_link_aria", {
                  name: location.name,
                  defaultValue: "Otwórz {{name}} w Google Maps",
                })}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-ethereal-incense/20 bg-ethereal-alabaster/60 text-ethereal-graphite transition-colors duration-300 hover:border-ethereal-gold/40 hover:text-ethereal-gold"
              >
                <ExternalLink size={13} strokeWidth={1.75} aria-hidden="true" />
              </a>
            </div>
          )}
        </div>

        <div className="mt-6 flex gap-3 border-t border-ethereal-incense/15 pt-5">
          <Button
            variant="outline"
            onClick={() => onEdit(location)}
            leftIcon={<Edit2 size={14} aria-hidden="true" />}
            className="flex-1 justify-center"
          >
            {t("logistics.card.edit", "Edytuj")}
          </Button>
          <Button
            variant="ghost"
            onClick={() => onArchive(location)}
            leftIcon={<Archive size={14} aria-hidden="true" />}
            className="flex-1 justify-center text-ethereal-crimson hover:bg-ethereal-crimson/10 hover:text-ethereal-crimson"
          >
            {t("logistics.card.archive", "Archiwizuj")}
          </Button>
        </div>
      </GlassCard>
    </motion.div>
  );
};

const arePropsEqual = (
  prev: Readonly<LocationCardProps>,
  next: Readonly<LocationCardProps>,
): boolean =>
  prev.location.id === next.location.id &&
  prev.location.name === next.location.name &&
  prev.location.formatted_address === next.location.formatted_address &&
  prev.location.category === next.location.category &&
  prev.location.timezone === next.location.timezone &&
  prev.location.internal_notes === next.location.internal_notes &&
  prev.location.latitude === next.location.latitude &&
  prev.location.longitude === next.location.longitude &&
  prev.onEdit === next.onEdit &&
  prev.onArchive === next.onArchive;

export const LocationCard = React.memo(LocationCardComponent, arePropsEqual);
LocationCard.displayName = "LocationCard";
