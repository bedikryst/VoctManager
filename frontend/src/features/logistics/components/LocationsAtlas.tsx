/**
 * @file LocationsAtlas.tsx
 * @description The protagonist surface of the logistics command centre. Every
 * venue is one marker; venues hosting upcoming events glow by imminence (gold =
 * today + pulse, amethyst = this week, sage = later) so the map reads as "where
 * is the ensemble headed", not a static address book. Selecting a venue (here or
 * from the rail) performs one cinematic camera flight that automatically dives
 * into a gentle 3D tilt — and because the detail now lives in the rail / a bottom
 * sheet (never a full modal), that dive stays visible. Auto-fits to the dataset
 * when nothing is selected. Camera choreography is the shared `cameraFlight`;
 * pins and atmosphere are the shared `MapPinShell` / `MapAtmosphere`.
 * @architecture Enterprise SaaS 2026
 * @module features/logistics/components/LocationsAtlas
 */

import React, { useEffect, useMemo, useRef } from "react";
import { AdvancedMarker, Map, useMap } from "@vis.gl/react-google-maps";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Globe2, Layers, MapPin, Minus, Plus, Radio } from "lucide-react";

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
import { CINEMATIC, flyCameraTo } from "../lib/cameraFlight";
import type { VenueActivity } from "../hooks/useLogisticsEvents";
import type { LocationDto } from "../types/logistics.dto";

import { MapAtmosphere } from "./MapAtmosphere";
import { MapPinShell } from "./MapPinShell";

const ATLAS_MAP_ID = "VOCTMANAGER_LOGISTICS_ATLAS";
const DEFAULT_CENTER: google.maps.LatLngLiteral = { lat: 50.0, lng: 14.0 };

interface LocationsAtlasProps {
  locations: LocationDto[];
  venueActivity: Map<string, VenueActivity>;
  categoryStats: Partial<Record<LocationCategory, number>>;
  activeLocationId: string | null;
  onSelectLocation: (id: string) => void;
  /** When the map takes over the viewport (tablet/mobile focus mode). */
  fullscreen?: boolean;
}

type GeoLocation = LocationDto & { latitude: number; longitude: number };

const hasCoordinates = (location: LocationDto): location is GeoLocation =>
  location.latitude !== null && location.longitude !== null;

const toLatLng = (location: GeoLocation): google.maps.LatLngLiteral => ({
  lat: Number(location.latitude),
  lng: Number(location.longitude),
});

/** The zoom level fitBounds would settle on — needed to animate the exit. */
const getBoundsZoomLevel = (
  bounds: google.maps.LatLngBounds,
  width: number,
  height: number,
  padding: number,
): number => {
  const WORLD_DIM = 256;
  const ZOOM_MAX = 18;
  const latRad = (lat: number): number => {
    const sin = Math.sin((lat * Math.PI) / 180);
    const radX2 = Math.log((1 + sin) / (1 - sin)) / 2;
    return Math.max(Math.min(radX2, Math.PI), -Math.PI) / 2;
  };
  const zoomFor = (mapPx: number, fraction: number): number =>
    Math.log2(mapPx / WORLD_DIM / fraction);

  const ne = bounds.getNorthEast();
  const sw = bounds.getSouthWest();
  const latFraction = (latRad(ne.lat()) - latRad(sw.lat())) / Math.PI;
  const lngDiff = ne.lng() - sw.lng();
  const lngFraction = (lngDiff < 0 ? lngDiff + 360 : lngDiff) / 360;

  const latZoom = zoomFor(height - padding * 2, Math.max(latFraction, 1e-9));
  const lngZoom = zoomFor(width - padding * 2, Math.max(lngFraction, 1e-9));
  return Math.min(latZoom, lngZoom, ZOOM_MAX);
};

/** The camera pose that frames the whole dataset (centre + zoom). */
const getFitTarget = (
  map: google.maps.Map,
  locs: GeoLocation[],
): { center: google.maps.LatLngLiteral; zoom: number } | null => {
  if (locs.length === 0) return null;
  if (locs.length === 1) return { center: toLatLng(locs[0]), zoom: 13 };
  const bounds = new window.google.maps.LatLngBounds();
  locs.forEach((loc) => bounds.extend(toLatLng(loc)));
  const center = bounds.getCenter();
  const div = map.getDiv();
  const zoom = getBoundsZoomLevel(
    bounds,
    div.offsetWidth || 800,
    div.offsetHeight || 600,
    64,
  );
  return { center: { lat: center.lat(), lng: center.lng() }, zoom };
};

/**
 * Drives the camera: a cinematic fly-to with an automatic 3D dive on selection,
 * and a symmetric flight back out to the dataset view on deselect (instant only
 * on first paint / data changes). Tilt is best-effort — only vector map ids
 * honour it, so it is simply ignored on raster maps.
 */
const AtlasCamera = ({
  locations,
  activeLocationId,
}: {
  locations: GeoLocation[];
  activeLocationId: string | null;
}): null => {
  const map = useMap(ATLAS_MAP_ID);
  const prefersReduced = useReducedMotion();
  const cancelFlightRef = useRef<(() => void) | null>(null);
  // Distinguishes a real deselect (animate out) from first paint (snap into view).
  const wasFocusedRef = useRef(false);

  const activeLocation = useMemo(
    () =>
      activeLocationId
        ? (locations.find((loc) => String(loc.id) === activeLocationId) ?? null)
        : null,
    [locations, activeLocationId],
  );

  useEffect(() => () => cancelFlightRef.current?.(), []);

  // Fly to the selected venue and dive into a gentle 3D tilt.
  useEffect(() => {
    if (!map || !activeLocation) return;
    wasFocusedRef.current = true;
    cancelFlightRef.current?.();
    cancelFlightRef.current = flyCameraTo(
      map,
      {
        center: toLatLng(activeLocation),
        zoom: CINEMATIC.FOCUS_ZOOM,
        tilt: CINEMATIC.TILT_ANGLE,
        heading: 0,
      },
      { reducedMotion: prefersReduced ?? false },
    );
  }, [map, activeLocation, prefersReduced]);

  // Frame the whole dataset whenever the selection is cleared — animated when
  // it is an actual deselect, instant on first paint / data changes.
  useEffect(() => {
    if (!map || activeLocation || !window.google) return;
    cancelFlightRef.current?.();

    if (wasFocusedRef.current && !(prefersReduced ?? false)) {
      wasFocusedRef.current = false;
      const target = getFitTarget(map, locations);
      if (target) {
        cancelFlightRef.current = flyCameraTo(
          map,
          { center: target.center, zoom: target.zoom, tilt: 0, heading: 0 },
          { reducedMotion: false },
        );
        return;
      }
    }
    wasFocusedRef.current = false;

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
  }, [map, activeLocation, locations, prefersReduced]);

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
      <MapPinShell
        color={ringColor}
        iconColor={option.atlasMarker}
        active={isActive}
        pulse={imminence?.pulse ?? false}
        badge={
          upcomingCount > 1 ? (
            <span
              className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-ethereal-ink px-1 text-[9px] font-bold text-ethereal-marble"
              aria-hidden="true"
            >
              {upcomingCount}
            </span>
          ) : undefined
        }
      >
        <Icon size={16} strokeWidth={1.75} />
      </MapPinShell>
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
  fullscreen = false,
}: LocationsAtlasProps): React.JSX.Element => {
  const { t } = useTranslation();
  const map = useMap(ATLAS_MAP_ID);
  const prefersReduced = useReducedMotion();
  const zoomFlightRef = useRef<(() => void) | null>(null);

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

  const handleZoom = (delta: number): void => {
    if (!map) return;
    zoomFlightRef.current?.();
    zoomFlightRef.current = flyCameraTo(
      map,
      { zoom: (map.getZoom() ?? 5) + delta },
      { durationMs: 360, reducedMotion: prefersReduced ?? false },
    );
  };

  useEffect(() => () => zoomFlightRef.current?.(), []);

  const controlButtonClass =
    "flex h-9 w-9 items-center justify-center rounded-xl border border-ethereal-incense/20 bg-ethereal-marble/90 text-ethereal-graphite shadow-glass-solid backdrop-blur-xl transition-colors hover:text-ethereal-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 220, damping: 26 }}
      className={cn(fullscreen && "h-full")}
    >
      <GlassCard
        variant="solid"
        padding="none"
        isHoverable={false}
        className={cn(
          "overflow-hidden",
          fullscreen && "h-full max-lg:!rounded-none max-lg:!border-0",
        )}
      >
        <div
          className={cn(
            "relative w-full overflow-hidden bg-ethereal-alabaster/40",
            fullscreen
              ? "h-[100dvh]"
              : "h-[480px] sm:h-[560px] lg:h-[calc(100dvh-11rem)]",
          )}
        >
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

          <MapAtmosphere />

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

          {/* Zoom cluster — lifted above the peek sheet in fullscreen focus. */}
          <div
            className={cn(
              "absolute right-4 z-10 flex flex-col gap-1.5",
              fullscreen ? "bottom-[calc(42dvh+1rem)]" : "bottom-4",
            )}
          >
            <button
              type="button"
              onClick={() => handleZoom(1)}
              aria-label={t("logistics.map.zoom_in", "Przybliż")}
              className={controlButtonClass}
            >
              <Plus size={15} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => handleZoom(-1)}
              aria-label={t("logistics.map.zoom_out", "Oddal")}
              className={controlButtonClass}
            >
              <Minus size={15} aria-hidden="true" />
            </button>
          </div>

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
