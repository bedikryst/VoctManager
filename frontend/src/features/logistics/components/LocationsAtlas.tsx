/**
 * @file LocationsAtlas.tsx
 * @description The protagonist surface of the logistics command centre. Every
 * venue is one marker; venues hosting upcoming events glow by imminence (gold =
 * today + pulse, amethyst = this week, sage = later) so the map reads as "where
 * is the ensemble headed", not a static address book. Selecting a venue (here
 * or from the rail) flies the camera in — optionally diving into a 3D tilt —
 * and the dossier opens. Auto-fits to the dataset when nothing is selected.
 * @architecture Enterprise SaaS 2026
 * @module features/logistics/components/LocationsAtlas
 */

import React, { useEffect, useMemo, useState } from "react";
import { AdvancedMarker, Map, useMap } from "@vis.gl/react-google-maps";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Box, Globe2, Layers, MapPin, Radio } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Eyebrow, Text } from "@/shared/ui/primitives/typography";

import type { LocationCategory } from "@/shared/types";
import { getImminenceDefinition } from "../constants/eventImminence";
import {
  type LocationCategoryOption,
  getLocationCategoryOption,
  getLocationCategoryOptions,
} from "../constants/locationCategories";
import type { VenueActivity } from "../hooks/useLogisticsEvents";
import type { LocationDto } from "../types/logistics.dto";

const ATLAS_MAP_ID = "VOCTMANAGER_LOGISTICS_ATLAS";
const DEFAULT_CENTER: google.maps.LatLngLiteral = { lat: 50.0, lng: 14.0 };
const FOCUS_ZOOM = 16;
const TILT_ANGLE = 47.5;
const TILT_HEADING = 25;

interface LocationsAtlasProps {
  locations: LocationDto[];
  venueActivity: Map<string, VenueActivity>;
  categoryStats: Partial<Record<LocationCategory, number>>;
  activeLocationId: string | null;
  onSelectLocation: (id: string) => void;
}

type GeoLocation = LocationDto & { latitude: number; longitude: number };

const hasCoordinates = (location: LocationDto): location is GeoLocation =>
  location.latitude !== null && location.longitude !== null;

const toLatLng = (location: GeoLocation): google.maps.LatLngLiteral => ({
  lat: Number(location.latitude),
  lng: Number(location.longitude),
});

/**
 * Drives the camera: fly-to (+ optional 3D dive) on selection, auto-fit when
 * nothing is selected. Tilt/heading are best-effort — only vector map ids
 * honour them, so the calls are feature-detected and harmless otherwise.
 */
const AtlasCamera = ({
  locations,
  activeLocationId,
  tilt3D,
}: {
  locations: GeoLocation[];
  activeLocationId: string | null;
  tilt3D: boolean;
}): null => {
  const map = useMap(ATLAS_MAP_ID);

  const activeLocation = useMemo(
    () =>
      activeLocationId
        ? (locations.find((loc) => String(loc.id) === activeLocationId) ?? null)
        : null,
    [locations, activeLocationId],
  );

  // Fly to the selected venue (and dive into 3D when enabled).
  useEffect(() => {
    if (!map || !activeLocation) return;
    map.panTo(toLatLng(activeLocation));
    map.setZoom(FOCUS_ZOOM);
    map.setTilt?.(tilt3D ? TILT_ANGLE : 0);
    map.setHeading?.(tilt3D ? TILT_HEADING : 0);
  }, [map, activeLocation, tilt3D]);

  // Auto-fit the whole dataset whenever the selection is cleared.
  useEffect(() => {
    if (!map || activeLocation || !window.google) return;
    map.setTilt?.(0);
    map.setHeading?.(0);
    if (locations.length === 0) return;
    if (locations.length === 1) {
      map.setCenter(toLatLng(locations[0]));
      map.setZoom(13);
      return;
    }
    const bounds = new window.google.maps.LatLngBounds();
    locations.forEach((loc) => bounds.extend(toLatLng(loc)));
    map.fitBounds(bounds, { top: 64, bottom: 64, left: 64, right: 64 });
  }, [map, activeLocation, locations]);

  return null;
};

interface VenueMarkerProps {
  location: GeoLocation;
  option: LocationCategoryOption;
  activity: VenueActivity | undefined;
  isActive: boolean;
  onSelect: (id: string) => void;
}

const VenueMarker = ({
  location,
  option,
  activity,
  isActive,
  onSelect,
}: VenueMarkerProps): React.JSX.Element => {
  const Icon = option.icon;
  const nextEvent = activity?.nextEvent ?? null;
  const imminence = nextEvent ? getImminenceDefinition(nextEvent.imminence) : null;
  const ringColor = imminence?.marker ?? option.atlasMarker;
  const upcomingCount = activity?.upcoming.length ?? 0;

  return (
    <AdvancedMarker
      position={toLatLng(location)}
      onClick={() => onSelect(String(location.id))}
      title={location.name}
      zIndex={isActive ? 50 : imminence ? 20 : 10}
    >
      <div className="group relative flex flex-col items-center">
        <span
          aria-hidden="true"
          className={cn(
            "absolute -top-2 h-8 w-8 rounded-full opacity-40 blur-md transition-opacity duration-500 group-hover:opacity-80",
            isActive && "opacity-90",
            imminence?.pulse && "animate-pulse opacity-70",
          )}
          style={{ backgroundColor: ringColor }}
        />
        <div
          className={cn(
            "relative flex h-9 w-9 items-center justify-center rounded-full border-2 bg-ethereal-marble shadow-[0_8px_18px_rgba(22,20,18,0.25)] transition-transform duration-500 group-hover:-translate-y-1",
            isActive && "-translate-y-1 scale-110 ring-2 ring-ethereal-gold ring-offset-2 ring-offset-transparent",
          )}
          style={{ borderColor: ringColor, color: option.atlasMarker }}
        >
          <Icon size={16} strokeWidth={1.75} />
          {upcomingCount > 1 && (
            <span
              className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-ethereal-ink px-1 text-[9px] font-bold text-ethereal-marble"
              aria-hidden="true"
            >
              {upcomingCount}
            </span>
          )}
        </div>
        <span
          aria-hidden="true"
          className="mt-0.5 h-1 w-1.5 rounded-full bg-ethereal-ink/40 blur-[2px]"
        />
      </div>
    </AdvancedMarker>
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
    <div className="pointer-events-auto absolute left-4 top-4 z-10 hidden max-w-[260px] rounded-2xl border border-ethereal-incense/20 bg-ethereal-marble/90 p-4 shadow-glass-solid backdrop-blur-xl sm:block">
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
          return (
            <li
              key={option.value}
              className={cn(
                "flex items-center gap-2 transition-opacity duration-300",
                count === 0 && "opacity-40",
              )}
            >
              <span
                aria-hidden="true"
                className="flex h-5 w-5 items-center justify-center rounded-full border bg-ethereal-marble"
                style={{ borderColor: option.atlasMarker, color: option.atlasMarker }}
              >
                <Icon size={10} strokeWidth={2} />
              </span>
              <Text size="xs" weight="medium" color="graphite" truncate>
                {option.plural}
              </Text>
              <Text size="xs" weight="bold" color="default" className="ml-auto tabular-nums">
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
  venueActivity,
  categoryStats,
  activeLocationId,
  onSelectLocation,
}: LocationsAtlasProps): React.JSX.Element => {
  const { t } = useTranslation();
  const [tilt3D, setTilt3D] = useState<boolean>(false);

  const categoryOptions = useMemo(() => getLocationCategoryOptions(t), [t]);
  const taggedLocations = useMemo(
    () => locations.filter(hasCoordinates),
    [locations],
  );
  const liveVenues = useMemo(() => {
    let count = 0;
    taggedLocations.forEach((loc) => {
      if ((venueActivity.get(String(loc.id))?.upcoming.length ?? 0) > 0) {
        count += 1;
      }
    });
    return count;
  }, [taggedLocations, venueActivity]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 220, damping: 26 }}
    >
      <GlassCard
        variant="solid"
        padding="none"
        isHoverable={false}
        className="overflow-hidden"
      >
        <div className="relative h-[480px] w-full overflow-hidden bg-ethereal-alabaster/40 sm:h-[560px] lg:h-[calc(100dvh-11rem)]">
          <Map
            id={ATLAS_MAP_ID}
            mapId={import.meta.env.VITE_GOOGLE_MAP_ID}
            defaultZoom={4}
            defaultCenter={DEFAULT_CENTER}
            disableDefaultUI={true}
            gestureHandling="greedy"
            className="absolute inset-0 h-full w-full"
          >
            <AtlasCamera
              locations={taggedLocations}
              activeLocationId={activeLocationId}
              tilt3D={tilt3D}
            />
            {taggedLocations.map((loc) => (
              <VenueMarker
                key={loc.id}
                location={loc}
                option={getLocationCategoryOption(t, loc.category)}
                activity={venueActivity.get(String(loc.id))}
                isActive={String(loc.id) === activeLocationId}
                onSelect={onSelectLocation}
              />
            ))}
          </Map>

          <AtlasLegend
            categoryOptions={categoryOptions}
            categoryStats={categoryStats}
          />

          <div className="pointer-events-none absolute right-4 top-4 z-10 flex flex-col items-end gap-2">
            <Badge variant="glass" icon={<Globe2 size={12} />}>
              {t("logistics.atlas.markers_count", "{{count}} miejsc", {
                count: taggedLocations.length,
              })}
            </Badge>
            {liveVenues > 0 && (
              <Badge variant="brand" icon={<Radio size={12} />}>
                {t("logistics.atlas.live_venues", "{{count}} aktywnych", {
                  count: liveVenues,
                })}
              </Badge>
            )}
          </div>

          <button
            type="button"
            aria-pressed={tilt3D}
            onClick={() => setTilt3D((prev) => !prev)}
            className={cn(
              "absolute bottom-4 right-4 z-10 inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold shadow-glass-solid backdrop-blur-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40",
              tilt3D
                ? "border-ethereal-gold/50 bg-ethereal-gold text-ethereal-ink"
                : "border-ethereal-incense/20 bg-ethereal-marble/90 text-ethereal-graphite hover:text-ethereal-ink",
            )}
          >
            <Box size={14} aria-hidden="true" />
            {t("logistics.atlas.tilt_3d", "Widok 3D")}
          </button>

          {taggedLocations.length === 0 && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
              <div className="rounded-2xl border border-ethereal-incense/20 bg-ethereal-marble/85 px-6 py-4 text-center shadow-glass-solid backdrop-blur-xl">
                <div className="mb-2 flex justify-center text-ethereal-graphite/50">
                  <MapPin size={20} aria-hidden="true" />
                </div>
                <Eyebrow color="muted">
                  {t("logistics.atlas.empty_title", "Brak współrzędnych")}
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
