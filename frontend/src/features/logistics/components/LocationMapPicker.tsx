/**
 * @file LocationMapPicker.tsx
 * @description Provides an interactive Google Map with a search overlay to pick precise
 * geographical locations. Uses the Places API (New) with session tokens for billing
 * optimisation, the shared Input/Button primitives, and Ethereal tokens throughout.
 * @architecture Enterprise SaaS 2026
 * @module features/logistics/components/LocationMapPicker
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AdvancedMarker,
  Map,
  MapMouseEvent,
  useMap,
  useMapsLibrary,
} from "@vis.gl/react-google-maps";
import { Loader2, MapPin, Navigation, Search } from "lucide-react";
import { useDebounceValue } from "usehooks-ts";

import { Button } from "@/shared/ui/primitives/Button";
import { Input } from "@/shared/ui/primitives/Input";
import { Text } from "@/shared/ui/primitives/typography";

import type { LocationFormValues } from "../types/logistics.dto";

interface LocationMapPickerProps {
  onLocationSelect: (locationData: Partial<LocationFormValues>) => void;
  initialPosition?: google.maps.LatLngLiteral;
}

const isNodeTarget = (value: EventTarget | null): value is Node =>
  value instanceof Node;

const DEFAULT_CENTER: google.maps.LatLngLiteral = {
  lat: 52.2297,
  lng: 21.0122,
};

export const LocationMapPicker = ({
  onLocationSelect,
  initialPosition,
}: LocationMapPickerProps): React.JSX.Element => {
  const { t } = useTranslation();

  const map = useMap("VOCTMANAGER_PICKER_MAP");
  const placesLibrary = useMapsLibrary("places");
  const geocodingLibrary = useMapsLibrary("geocoding");

  const dropdownRef = useRef<HTMLDivElement>(null);

  const [markerPos, setMarkerPos] = useState<google.maps.LatLngLiteral>(
    initialPosition ?? DEFAULT_CENTER,
  );
  const [inputValue, setInputValue] = useState<string>("");
  const [debouncedValue] = useDebounceValue(inputValue, 300);

  const [suggestions, setSuggestions] = useState<
    google.maps.places.AutocompleteSuggestion[]
  >([]);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isLocating, setIsLocating] = useState<boolean>(false);

  const [sessionToken, setSessionToken] =
    useState<google.maps.places.AutocompleteSessionToken | null>(null);

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
        setIsOpen(true);
      } catch (error) {
        console.error("[VoctManager Logistics] Autocomplete failed:", error);
      }
    };

    void fetchSuggestions();
  }, [debouncedValue, placesLibrary, sessionToken]);

  const handleSelectSuggestion = async (
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
      setSuggestions([]);
      setSessionToken(new placesLibrary.AutocompleteSessionToken());

      setMarkerPos(newPos);
      map?.panTo(newPos);
      map?.setZoom(16);

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
  };

  const handleMapClick = useCallback(
    (event: MapMouseEvent) => {
      if (!event.detail.latLng || !geocodingLibrary) return;

      const latLng: google.maps.LatLngLiteral = {
        lat: event.detail.latLng.lat,
        lng: event.detail.latLng.lng,
      };
      setMarkerPos(latLng);

      const geocoder = new geocodingLibrary.Geocoder();
      void geocoder
        .geocode({ location: latLng })
        .then((response) => {
          const place = response.results?.[0];
          if (!place) return;

          setInputValue(place.formatted_address);
          onLocationSelect({
            name: place.formatted_address.split(",")[0],
            formatted_address: place.formatted_address,
            google_place_id: place.place_id,
            latitude: latLng.lat,
            longitude: latLng.lng,
          });
        })
        .catch((error) => {
          console.error("[VoctManager Logistics] Reverse geocode failed:", error);
        });
    },
    [geocodingLibrary, onLocationSelect],
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
        setMarkerPos(pos);
        map?.panTo(pos);
        map?.setZoom(15);
        setIsLocating(false);
      },
      () => setIsLocating(false),
    );
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent): void => {
      const target = event.target;
      if (!isNodeTarget(target)) return;
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={dropdownRef} className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="relative flex-1">
          <Input
            type="search"
            leftIcon={<Search size={16} aria-hidden="true" />}
            value={inputValue}
            placeholder={t(
              "logistics.map.search_placeholder",
              "Wyszukaj globalne lokacje...",
            )}
            onChange={(event) => setInputValue(event.target.value)}
            onFocus={() => suggestions.length > 0 && setIsOpen(true)}
          />

          {isOpen && suggestions.length > 0 && (
            <ul
              role="listbox"
              className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-ethereal-incense/20 bg-ethereal-marble/95 py-2 shadow-glass-solid backdrop-blur-xl"
            >
              {suggestions.map((suggestion, index) => {
                if (!suggestion.placePrediction) return null;
                return (
                  <li
                    key={`${suggestion.placePrediction.placeId ?? index}`}
                    role="option"
                    aria-selected="false"
                    onClick={() => void handleSelectSuggestion(suggestion)}
                    className="flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors duration-200 hover:bg-ethereal-gold/10"
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
            </ul>
          )}
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
        <Map
          defaultZoom={initialPosition ? 15 : 11}
          defaultCenter={initialPosition ?? DEFAULT_CENTER}
          id="VOCTMANAGER_PICKER_MAP"
          mapId={import.meta.env.VITE_GOOGLE_MAP_ID}
          disableDefaultUI={true}
          onClick={handleMapClick}
          gestureHandling="greedy"
          className="absolute inset-0 h-full w-full"
        >
          <AdvancedMarker position={markerPos}>
            <div className="group relative flex flex-col items-center">
              <span
                aria-hidden="true"
                className="absolute -top-2 h-7 w-7 rounded-full bg-ethereal-gold opacity-50 blur-md"
              />
              <div className="relative flex h-9 w-9 items-center justify-center rounded-full border border-ethereal-gold bg-ethereal-marble text-ethereal-gold shadow-[0_8px_18px_rgba(22,20,18,0.25)]">
                <MapPin size={16} strokeWidth={1.75} />
              </div>
            </div>
          </AdvancedMarker>
        </Map>
      </div>
    </div>
  );
};
