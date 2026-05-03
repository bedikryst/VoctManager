/**
 * @file LocationsAtlas.tsx
 * @description Premium global atlas for the logistics location base.
 * Auto-fits to the active dataset, renders category-aware markers (with hover
 * lift + halo), exposes a glass legend tied to the same category dictionary as
 * cards & filters, and surfaces a rich info window with live local time and a
 * deep-link to Google Maps. Replaces the previous LocationsGlobalMap.
 * @architecture Enterprise SaaS 2026
 * @module features/logistics/components/LocationsAtlas
 */

import React, { useEffect, useMemo, useState } from "react";
import {
  AdvancedMarker,
  InfoWindow,
  Map,
  useMap,
} from "@vis.gl/react-google-maps";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Clock, ExternalLink, Globe2, Layers, MapPin } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { useLocalTime } from "@/shared/lib/time/hooks/useLocalTime";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Eyebrow, Heading, Text } from "@/shared/ui/primitives/typography";

import type { LocationCategory } from "@/shared/types";
import {
  type LocationCategoryOption,
  getLocationCategoryOption,
  getLocationCategoryOptions,
} from "../constants/locationCategories";
import type { LocationDto } from "../types/logistics.dto";

import { LocationCategoryBadge } from "./LocationCategoryBadge";

interface LocationsAtlasProps {
  locations: LocationDto[];
  categoryStats: Partial<Record<LocationCategory, number>>;
}

const DEFAULT_CENTER: google.maps.LatLngLiteral = { lat: 50.0, lng: 14.0 };

const hasCoordinates = (
  location: LocationDto,
): location is LocationDto & { latitude: number; longitude: number } => {
  return location.latitude !== null && location.longitude !== null;
};

const toMapsUrl = (location: LocationDto): string => {
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

const BoundsFitter = ({
  locations,
}: {
  locations: LocationDto[];
}): null => {
  const map = useMap("VOCTMANAGER_GLOBAL_ATLAS");

  useEffect(() => {
    if (!map || !window.google) return;

    const tagged = locations.filter(hasCoordinates);
    if (tagged.length === 0) return;

    if (tagged.length === 1) {
      const [single] = tagged;
      map.setCenter({
        lat: Number(single.latitude),
        lng: Number(single.longitude),
      });
      map.setZoom(14);
      return;
    }

    const bounds = new window.google.maps.LatLngBounds();
    tagged.forEach((loc) => {
      bounds.extend({
        lat: Number(loc.latitude),
        lng: Number(loc.longitude),
      });
    });
    map.fitBounds(bounds, { top: 60, bottom: 60, left: 60, right: 60 });
  }, [map, locations]);

  return null;
};

interface AtlasMarkerProps {
  location: LocationDto;
  option: LocationCategoryOption;
  isActive: boolean;
  onSelect: (location: LocationDto) => void;
}

const AtlasMarker = ({
  location,
  option,
  isActive,
  onSelect,
}: AtlasMarkerProps): React.JSX.Element | null => {
  if (!hasCoordinates(location)) return null;

  const Icon = option.icon;

  return (
    <AdvancedMarker
      position={{
        lat: Number(location.latitude),
        lng: Number(location.longitude),
      }}
      onClick={() => onSelect(location)}
      title={location.name}
    >
      <div className="group relative flex flex-col items-center">
        <span
          aria-hidden="true"
          className={cn(
            "absolute -top-2 h-7 w-7 rounded-full opacity-40 blur-md transition-opacity duration-500 group-hover:opacity-80",
            isActive && "opacity-90",
          )}
          style={{ backgroundColor: option.atlasMarker }}
        />
        <div
          className={cn(
            "relative flex h-9 w-9 items-center justify-center rounded-full border bg-ethereal-marble shadow-[0_8px_18px_rgba(22,20,18,0.25)] transition-transform duration-500 group-hover:-translate-y-1",
            isActive && "-translate-y-1 scale-110",
          )}
          style={{
            borderColor: option.atlasMarker,
            color: option.atlasMarker,
          }}
        >
          <Icon size={16} strokeWidth={1.75} />
        </div>
        <span
          aria-hidden="true"
          className="mt-0.5 h-1 w-1.5 rounded-full bg-ethereal-ink/40 blur-[2px]"
        />
      </div>
    </AdvancedMarker>
  );
};

interface AtlasInfoWindowProps {
  location: LocationDto;
  option: LocationCategoryOption;
  onClose: () => void;
}

const AtlasInfoWindow = ({
  location,
  option,
  onClose,
}: AtlasInfoWindowProps): React.JSX.Element | null => {
  const { t } = useTranslation();
  const liveLocalTime = useLocalTime(location.timezone);

  if (!hasCoordinates(location)) return null;

  return (
    <InfoWindow
      position={{
        lat: Number(location.latitude),
        lng: Number(location.longitude),
      }}
      onCloseClick={onClose}
      pixelOffset={[0, -38]}
    >
      <div className="min-w-[240px] max-w-[280px] space-y-3 px-1 py-1 font-sans">
        <div className="flex items-center justify-between gap-3">
          <LocationCategoryBadge category={location.category} size="sm" />
          <a
            href={toMapsUrl(location)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.18em] text-ethereal-graphite/70 transition-colors duration-300 hover:text-ethereal-gold"
          >
            {t("logistics.atlas.open_maps", "Mapy Google")}
            <ExternalLink size={10} aria-hidden="true" />
          </a>
        </div>

        <div className="space-y-1">
          <Heading
            as="h4"
            size="lg"
            weight="medium"
            className="leading-tight text-ethereal-ink"
          >
            {location.name}
          </Heading>
          {location.formatted_address && (
            <Text size="xs" color="graphite" className="line-clamp-2">
              {location.formatted_address}
            </Text>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 rounded-lg border border-ethereal-incense/15 bg-ethereal-alabaster/70 px-3 py-2">
          <div className="flex items-center gap-2 text-ethereal-graphite/70">
            <Clock size={12} aria-hidden="true" />
            <Eyebrow color="muted">
              {t("logistics.atlas.local_time", "Czas lokalny")}
            </Eyebrow>
          </div>
          <Text size="xs" weight="bold" color="default">
            {liveLocalTime || location.timezone}
          </Text>
        </div>
      </div>
    </InfoWindow>
  );
};

interface AtlasLegendProps {
  categoryOptions: LocationCategoryOption[];
  categoryStats: Partial<Record<LocationCategory, number>>;
}

const AtlasLegend = ({
  categoryOptions,
  categoryStats,
}: AtlasLegendProps): React.JSX.Element => {
  const { t } = useTranslation();

  return (
    <div className="pointer-events-auto absolute left-4 top-4 z-10 max-w-[280px] rounded-2xl border border-ethereal-incense/20 bg-ethereal-marble/90 p-4 shadow-glass-solid backdrop-blur-xl">
      <div className="mb-3 flex items-center gap-2 text-ethereal-graphite/70">
        <Layers size={14} strokeWidth={1.5} aria-hidden="true" />
        <Eyebrow color="muted">
          {t("logistics.atlas.legend_title", "Legenda kategorii")}
        </Eyebrow>
      </div>

      <ul className="grid grid-cols-2 gap-x-3 gap-y-2">
        {categoryOptions.map((option) => {
          const Icon = option.icon;
          const count = categoryStats[option.value] ?? 0;
          const dim = count === 0;
          return (
            <li
              key={option.value}
              className={cn(
                "flex items-center gap-2 transition-opacity duration-300",
                dim && "opacity-40",
              )}
              title={option.plural}
            >
              <span
                aria-hidden="true"
                className="flex h-5 w-5 items-center justify-center rounded-full border bg-ethereal-marble"
                style={{
                  borderColor: option.atlasMarker,
                  color: option.atlasMarker,
                }}
              >
                <Icon size={10} strokeWidth={2} />
              </span>
              <Text size="xs" weight="medium" color="graphite" truncate>
                {option.plural}
              </Text>
              <Text size="xs" weight="bold" color="default" className="ml-auto">
                {count}
              </Text>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export const LocationsAtlas = ({
  locations,
  categoryStats,
}: LocationsAtlasProps): React.JSX.Element => {
  const { t } = useTranslation();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const categoryOptions = useMemo(() => getLocationCategoryOptions(t), [t]);

  const taggedLocations = useMemo(
    () => locations.filter(hasCoordinates),
    [locations],
  );

  const selectedLocation = useMemo(
    () => locations.find((loc) => loc.id === selectedId) ?? null,
    [locations, selectedId],
  );
  const selectedOption = selectedLocation
    ? getLocationCategoryOption(t, selectedLocation.category)
    : null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ type: "spring", stiffness: 220, damping: 26 }}
      className="space-y-4"
    >
      <GlassCard
        variant="solid"
        padding="none"
        isHoverable={false}
        className="overflow-hidden border border-ethereal-incense/20"
      >
        <div className="relative h-[640px] w-full overflow-hidden bg-ethereal-alabaster/40">
          <Map
            defaultZoom={4}
            defaultCenter={DEFAULT_CENTER}
            id="VOCTMANAGER_GLOBAL_ATLAS"
            mapId={import.meta.env.VITE_GOOGLE_MAP_ID}
            disableDefaultUI={true}
            gestureHandling="greedy"
            className="absolute inset-0 h-full w-full"
          >
            <BoundsFitter locations={taggedLocations} />

            {taggedLocations.map((loc) => {
              const option = getLocationCategoryOption(t, loc.category);
              return (
                <AtlasMarker
                  key={loc.id}
                  location={loc}
                  option={option}
                  isActive={loc.id === selectedId}
                  onSelect={(target) => setSelectedId(target.id)}
                />
              );
            })}

            {selectedLocation && selectedOption && (
              <AtlasInfoWindow
                location={selectedLocation}
                option={selectedOption}
                onClose={() => setSelectedId(null)}
              />
            )}
          </Map>

          <AtlasLegend
            categoryOptions={categoryOptions}
            categoryStats={categoryStats}
          />

          <div className="pointer-events-none absolute right-4 top-4 z-10 flex flex-col items-end gap-2">
            <Badge variant="glass" icon={<Globe2 size={12} />}>
              {t("logistics.atlas.live_badge", "Atlas lokacji")}
            </Badge>
            <Badge variant="brand" icon={<MapPin size={12} />}>
              {t("logistics.atlas.markers_count", "{{count}} markerów", {
                count: taggedLocations.length,
              })}
            </Badge>
          </div>

          {taggedLocations.length === 0 && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="rounded-2xl border border-ethereal-incense/20 bg-ethereal-marble/85 px-6 py-4 text-center shadow-glass-solid backdrop-blur-xl">
                <Eyebrow color="muted">
                  {t(
                    "logistics.atlas.empty_title",
                    "Brak współrzędnych do wyświetlenia",
                  )}
                </Eyebrow>
                <Text size="sm" color="graphite" className="mt-2 max-w-xs">
                  {t(
                    "logistics.atlas.empty_desc",
                    "Dodaj lokację z mapy Google, aby zobaczyć ją na atlasie.",
                  )}
                </Text>
              </div>
            </div>
          )}
        </div>
      </GlassCard>
    </motion.div>
  );
};
