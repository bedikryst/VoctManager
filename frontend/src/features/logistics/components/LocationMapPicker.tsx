/**
 * @file LocationMapPicker.tsx
 * @description Interactive place picker for the location editor. A keyboard-
 * navigable Places (New) search overlays a cinematic map: choosing a result
 * (or dropping / dragging the gilded pin) flies the camera in and surfaces a
 * "pin dropped" confirmation chip with the resolved name, address and precise
 * coordinates. Built on the shared cameraFlight choreography, MapPinShell, and
 * MapAtmosphere so it is visually identical to the global atlas. Session tokens
 * keep Places billing optimal; everything speaks Ethereal tokens.
 * @architecture Enterprise SaaS 2026
 * @module features/logistics/components/LocationMapPicker
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AdvancedMarker,
  Map,
  MapMouseEvent,
  useMap,
  useMapsLibrary,
} from "@vis.gl/react-google-maps";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Crosshair,
  Loader2,
  MapPin,
  Minus,
  Navigation,
  Plus,
  Search,
} from "lucide-react";
import { useDebounceValue } from "usehooks-ts";

import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/primitives/Button";
import { Input } from "@/shared/ui/primitives/Input";
import { Caption, Text } from "@/shared/ui/primitives/typography";

import { CINEMATIC, flyCameraTo } from "../lib/cameraFlight";
import type { LocationFormValues } from "../types/logistics.dto";

import { MapAtmosphere } from "./MapAtmosphere";
import { MapPinShell } from "./MapPinShell";

interface LocationMapPickerProps {
  onLocationSelect: (locationData: Partial<LocationFormValues>) => void;
  initialPosition?: google.maps.LatLngLiteral;
  /** Seeds the confirmation chip when editing an existing venue. */
  initialName?: string;
  initialAddress?: string;
}

interface SelectedMeta {
  name: string;
  address: string;
  lat: number;
  lng: number;
}

const isNodeTarget = (value: EventTarget | null): value is Node =>
  value instanceof Node;

const DEFAULT_CENTER: google.maps.LatLngLiteral = {
  lat: 52.2297,
  lng: 21.0122,
};

const PICKER_MAP_ID = "VOCTMANAGER_PICKER_MAP";

const formatCoord = (value: number): string => value.toFixed(6);

export const LocationMapPicker = ({
  onLocationSelect,
  initialPosition,
  initialName,
  initialAddress,
}: LocationMapPickerProps): React.JSX.Element => {
  const { t } = useTranslation();
  const prefersReduced = useReducedMotion();

  const map = useMap(PICKER_MAP_ID);
  const placesLibrary = useMapsLibrary("places");
  const geocodingLibrary = useMapsLibrary("geocoding");

  const rootRef = useRef<HTMLDivElement>(null);
  const cancelFlightRef = useRef<(() => void) | null>(null);

  const [markerPos, setMarkerPos] = useState<google.maps.LatLngLiteral>(
    initialPosition ?? DEFAULT_CENTER,
  );
  const [inputValue, setInputValue] = useState<string>("");
  const [debouncedValue] = useDebounceValue(inputValue, 300);

  const [suggestions, setSuggestions] = useState<
    google.maps.places.AutocompleteSuggestion[]
  >([]);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isResolving, setIsResolving] = useState<boolean>(false);

  const [selected, setSelected] = useState<SelectedMeta | null>(
    initialPosition && (initialName || initialAddress)
      ? {
          name: initialName ?? "",
          address: initialAddress ?? "",
          lat: initialPosition.lat,
          lng: initialPosition.lng,
        }
      : null,
  );

  const [sessionToken, setSessionToken] =
    useState<google.maps.places.AutocompleteSessionToken | null>(null);

  const isReady = Boolean(placesLibrary && map);
  const listboxId = "voct-picker-suggestions";

  /** Cancel any in-flight camera animation, then start a fresh swoop. */
  const flyTo = useCallback(
    (center: google.maps.LatLngLiteral, zoom: number): void => {
      if (!map) return;
      cancelFlightRef.current?.();
      cancelFlightRef.current = flyCameraTo(
        map,
        { center, zoom },
        { reducedMotion: prefersReduced ?? false },
      );
    },
    [map, prefersReduced],
  );

  useEffect(() => () => cancelFlightRef.current?.(), []);

  useEffect(() => {
    if (placesLibrary) {
      setSessionToken(new placesLibrary.AutocompleteSessionToken());
    }
  }, [placesLibrary]);

  useEffect(() => {
    const fetchSuggestions = async (): Promise<void> => {
      if (!debouncedValue.trim() || !placesLibrary || !sessionToken) {
        setSuggestions([]);
        return;
      }

      try {
        const { suggestions: newSuggestions } =
          await placesLibrary.AutocompleteSuggestion.fetchAutocompleteSuggestions(
            { input: debouncedValue, sessionToken },
          );
        setSuggestions(newSuggestions);
        setActiveIndex(-1);
        setIsOpen(true);
      } catch (error) {
        console.error("[VoctManager Logistics] Autocomplete failed:", error);
      }
    };

    void fetchSuggestions();
  }, [debouncedValue, placesLibrary, sessionToken]);

  const handleSelectSuggestion = useCallback(
    async (
      suggestion: google.maps.places.AutocompleteSuggestion,
    ): Promise<void> => {
      if (!placesLibrary || !suggestion.placePrediction) return;

      try {
        const place = suggestion.placePrediction.toPlace();
        await place.fetchFields({
          fields: ["id", "displayName", "formattedAddress", "location"],
        });

        const name = place.displayName ?? "";
        const address = place.formattedAddress ?? "";
        const newPos: google.maps.LatLngLiteral = {
          lat: place.location?.lat() ?? 0,
          lng: place.location?.lng() ?? 0,
        };

        setInputValue(name || address);
        setIsOpen(false);
        setActiveIndex(-1);
        setSuggestions([]);
        setSessionToken(new placesLibrary.AutocompleteSessionToken());

        setMarkerPos(newPos);
        setSelected({ name, address, lat: newPos.lat, lng: newPos.lng });
        flyTo(newPos, CINEMATIC.FOCUS_ZOOM);

        onLocationSelect({
          name,
          formatted_address: address,
          google_place_id: place.id,
          latitude: newPos.lat,
          longitude: newPos.lng,
        });
      } catch (error) {
        console.error("[VoctManager Logistics] Place fetch failed:", error);
      }
    },
    [placesLibrary, flyTo, onLocationSelect],
  );

  /**
   * Resolve a raw coordinate via reverse geocoding. `rename` distinguishes
   * "I'm pointing at a new place" (drop → adopt the place name) from "I'm just
   * nudging the existing dot" (drag → keep the chosen name, refine coords).
   */
  const commitPosition = useCallback(
    (latLng: google.maps.LatLngLiteral, rename: boolean): void => {
      setMarkerPos(latLng);
      if (!geocodingLibrary) {
        setSelected((prev) => ({
          name: prev?.name ?? "",
          address: prev?.address ?? "",
          lat: latLng.lat,
          lng: latLng.lng,
        }));
        onLocationSelect({ latitude: latLng.lat, longitude: latLng.lng });
        return;
      }

      setIsResolving(true);
      const geocoder = new geocodingLibrary.Geocoder();
      void geocoder
        .geocode({ location: latLng })
        .then((response) => {
          const place = response.results?.[0];
          if (!place) return;

          const address = place.formatted_address;
          const derivedName = address.split(",")[0];
          if (rename) setInputValue(address);
          setSelected((prev) => ({
            name: rename ? derivedName : prev?.name || derivedName,
            address,
            lat: latLng.lat,
            lng: latLng.lng,
          }));

          onLocationSelect({
            ...(rename ? { name: derivedName } : {}),
            formatted_address: address,
            google_place_id: place.place_id,
            latitude: latLng.lat,
            longitude: latLng.lng,
          });
        })
        .catch((error) => {
          console.error("[VoctManager Logistics] Reverse geocode failed:", error);
          onLocationSelect({ latitude: latLng.lat, longitude: latLng.lng });
        })
        .finally(() => setIsResolving(false));
    },
    [geocodingLibrary, onLocationSelect],
  );

  const handleMapClick = useCallback(
    (event: MapMouseEvent) => {
      if (!event.detail.latLng) return;
      commitPosition(
        { lat: event.detail.latLng.lat, lng: event.detail.latLng.lng },
        true,
      );
    },
    [commitPosition],
  );

  const handleMarkerDragEnd = useCallback(
    (event: google.maps.MapMouseEvent) => {
      setIsDragging(false);
      const lat = event.latLng?.lat();
      const lng = event.latLng?.lng();
      if (lat === undefined || lng === undefined) return;
      commitPosition({ lat, lng }, false);
    },
    [commitPosition],
  );

  const handleLocateMe = (): void => {
    if (!navigator.geolocation) return;
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const pos: google.maps.LatLngLiteral = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        flyTo(pos, 15);
        commitPosition(pos, true);
        setIsLocating(false);
      },
      () => setIsLocating(false),
    );
  };

  const handleZoom = useCallback(
    (delta: number): void => {
      if (!map) return;
      const next = (map.getZoom() ?? 12) + delta;
      cancelFlightRef.current?.();
      cancelFlightRef.current = flyCameraTo(
        map,
        { zoom: next },
        { durationMs: 360, reducedMotion: prefersReduced ?? false },
      );
    },
    [map, prefersReduced],
  );

  const handleInputKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>,
  ): void => {
    if (!isOpen || suggestions.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((prev) => Math.max(prev - 1, 0));
    } else if (event.key === "Enter") {
      const target = suggestions[activeIndex] ?? suggestions[0];
      if (target) {
        event.preventDefault();
        void handleSelectSuggestion(target);
      }
    } else if (event.key === "Escape") {
      setIsOpen(false);
      setActiveIndex(-1);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent): void => {
      const target = event.target;
      if (!isNodeTarget(target)) return;
      if (rootRef.current && !rootRef.current.contains(target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const controlButtonClass =
    "flex h-9 w-9 items-center justify-center rounded-xl border border-ethereal-incense/20 bg-ethereal-marble/90 text-ethereal-graphite shadow-glass-solid backdrop-blur-xl transition-colors hover:text-ethereal-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40";

  const hasSuggestions = isOpen && suggestions.length > 0;

  const mapMarker = useMemo(
    () => (
      <AdvancedMarker
        position={markerPos}
        draggable
        onDragStart={() => setIsDragging(true)}
        onDrag={() => setIsDragging(true)}
        onDragEnd={handleMarkerDragEnd}
      >
        <MapPinShell
          color="var(--color-ethereal-gold)"
          active
          dragging={isDragging}
        >
          <MapPin size={16} strokeWidth={1.75} />
        </MapPinShell>
      </AdvancedMarker>
    ),
    [markerPos, isDragging, handleMarkerDragEnd],
  );

  return (
    <div ref={rootRef} className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="relative flex-1">
          <Input
            type="search"
            role="combobox"
            aria-expanded={hasSuggestions}
            aria-controls={listboxId}
            aria-activedescendant={
              activeIndex >= 0 ? `${listboxId}-opt-${activeIndex}` : undefined
            }
            aria-autocomplete="list"
            leftIcon={<Search size={16} aria-hidden="true" />}
            value={inputValue}
            placeholder={t(
              "logistics.map.search_placeholder",
              "Wyszukaj globalne lokacje...",
            )}
            onChange={(event) => setInputValue(event.target.value)}
            onKeyDown={handleInputKeyDown}
            onFocus={() => suggestions.length > 0 && setIsOpen(true)}
          />

          <AnimatePresence>
            {hasSuggestions && (
              <motion.ul
                id={listboxId}
                role="listbox"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18, ease: [0.25, 0.1, 0.25, 1] }}
                className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-ethereal-incense/20 bg-ethereal-marble/95 py-2 shadow-glass-solid backdrop-blur-xl"
              >
                {suggestions.map((suggestion, index) => {
                  if (!suggestion.placePrediction) return null;
                  const isActive = index === activeIndex;
                  return (
                    <li
                      key={`${suggestion.placePrediction.placeId ?? index}`}
                      id={`${listboxId}-opt-${index}`}
                      role="option"
                      aria-selected={isActive}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => void handleSelectSuggestion(suggestion)}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 border-l-2 border-transparent px-4 py-3 transition-colors duration-150",
                        isActive
                          ? "border-ethereal-gold bg-ethereal-gold/10"
                          : "hover:bg-ethereal-gold/5",
                      )}
                    >
                      <MapPin
                        size={14}
                        strokeWidth={1.6}
                        className="shrink-0 text-ethereal-gold"
                        aria-hidden="true"
                      />
                      <Text size="sm" color="default" truncate>
                        {suggestion.placePrediction.text.text}
                      </Text>
                    </li>
                  );
                })}
              </motion.ul>
            )}
          </AnimatePresence>
        </div>

        <Button
          type="button"
          variant="secondary"
          onClick={handleLocateMe}
          disabled={isLocating}
          leftIcon={
            isLocating ? (
              <Loader2 size={14} className="animate-spin" aria-hidden="true" />
            ) : (
              <Navigation size={14} aria-hidden="true" />
            )
          }
          className="shrink-0"
        >
          {t("logistics.map.locate_me", "Moja Lokalizacja")}
        </Button>
      </div>

      <div className="relative h-[360px] w-full overflow-hidden rounded-2xl border border-ethereal-incense/20 bg-ethereal-alabaster/40 shadow-[inset_0_1px_2px_rgba(22,20,18,0.04)]">
        {!isReady && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-ethereal-alabaster/60 backdrop-blur-sm">
            <Loader2
              size={22}
              className="animate-spin text-ethereal-gold"
              aria-hidden="true"
            />
            <Caption color="muted">
              {t("logistics.map.loading", "Wczytywanie atlasu…")}
            </Caption>
          </div>
        )}

        <Map
          defaultZoom={initialPosition ? 15 : 11}
          defaultCenter={initialPosition ?? DEFAULT_CENTER}
          id={PICKER_MAP_ID}
          mapId={import.meta.env.VITE_GOOGLE_MAP_ID}
          disableDefaultUI={true}
          onClick={handleMapClick}
          gestureHandling="greedy"
          className="absolute inset-0 h-full w-full"
        >
          {mapMarker}
        </Map>

        <MapAtmosphere />

        {/* Zoom + recenter cluster */}
        <div className="absolute right-3 top-3 z-10 flex flex-col gap-1.5">
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
          <button
            type="button"
            onClick={() => flyTo(markerPos, CINEMATIC.FOCUS_ZOOM)}
            aria-label={t("logistics.map.recenter", "Wyśrodkuj na pinezce")}
            className={controlButtonClass}
          >
            <Crosshair size={15} aria-hidden="true" />
          </button>
        </div>

        {/* "Pin dropped" confirmation chip */}
        <AnimatePresence>
          {selected && (
            <motion.div
              key="picker-confirm"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              transition={{ type: "spring", stiffness: 320, damping: 30 }}
              className="absolute inset-x-3 bottom-3 z-10 flex items-center gap-3 rounded-2xl border border-ethereal-gold/25 bg-ethereal-marble/92 px-4 py-3 shadow-glass-solid backdrop-blur-xl"
            >
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-ethereal-gold/40 bg-ethereal-gold/10 text-ethereal-gold"
                aria-hidden="true"
              >
                {isResolving ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <MapPin size={15} strokeWidth={1.9} />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <Text
                  as="p"
                  size="sm"
                  weight="semibold"
                  truncate
                  className="text-ethereal-ink"
                >
                  {selected.name ||
                    t("logistics.map.pin_dropped", "Wybrany punkt")}
                </Text>
                <Caption color="muted" truncate className="mt-0.5">
                  {selected.address ||
                    t("logistics.map.drag_hint", "Przeciągnij pinezkę, aby dostroić")}
                </Caption>
              </div>
              <Caption
                color="muted"
                className="hidden shrink-0 font-mono tabular-nums sm:block"
              >
                {formatCoord(selected.lat)}, {formatCoord(selected.lng)}
              </Caption>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Caption color="muted" className="block px-1">
        {t(
          "logistics.map.helper",
          "Wyszukaj miejsce, kliknij na mapie lub przeciągnij pinezkę, aby ustawić dokładną pozycję.",
        )}
      </Caption>
    </div>
  );
};
