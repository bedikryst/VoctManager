/**
 * @file LocationMapPicker.tsx
 * @description Provides an interactive Google Map with a search overlay to pick precise geographical locations.
 * Utilizes the Google Maps Places API (New) with Session Tokens for optimized billing.
 * @module features/logistics/components/LocationMapPicker
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  Map,
  AdvancedMarker,
  useMap,
  useMapsLibrary,
  MapMouseEvent,
} from "@vis.gl/react-google-maps";
import { Search, MapPin, Navigation, Loader2 } from "lucide-react";
import { useDebounceValue } from "usehooks-ts"; // Modern standard for debouncing

import type { LocationFormValues } from "../types/logistics.dto"; // Synced with Zod schema
import { Button } from "../../../shared/ui/Button";

interface LocationMapPickerProps {
  onLocationSelect: (locationData: Partial<LocationFormValues>) => void;
}

const DEFAULT_CENTER: google.maps.LatLngLiteral = {
  lat: 52.2297,
  lng: 21.0122,
};

export const LocationMapPicker = ({
  onLocationSelect,
}: LocationMapPickerProps) => {
  const { t } = useTranslation();

  // Dedicated map instance reference
  const map = useMap("VOCTMANAGER_PICKER_MAP");

  // Load necessary Google Maps libraries dynamically
  const placesLibrary = useMapsLibrary("places");
  const geocodingLibrary = useMapsLibrary("geocoding");

  const dropdownRef = useRef<HTMLDivElement>(null);

  const [markerPos, setMarkerPos] =
    useState<google.maps.LatLngLiteral>(DEFAULT_CENTER);
  const [inputValue, setInputValue] = useState("");

  // Replaces custom useEffect + setTimeout for safe, leak-free debouncing
  const [debouncedValue] = useDebounceValue(inputValue, 300);

  const [suggestions, setSuggestions] = useState<
    google.maps.places.AutocompleteSuggestion[]
  >([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  const [sessionToken, setSessionToken] =
    useState<google.maps.places.AutocompleteSessionToken | null>(null);

  /**
   * Initializes the Autocomplete Session Token to group requests for billing optimization.
   */
  useEffect(() => {
    if (placesLibrary) {
      setSessionToken(new placesLibrary.AutocompleteSessionToken());
    }
  }, [placesLibrary]);

  /**
   * Fetches place suggestions based on the debounced input value using the New Places API.
   */
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!debouncedValue.trim() || !placesLibrary || !sessionToken) {
        setSuggestions([]);
        return;
      }

      try {
        const { suggestions: newSuggestions } =
          await placesLibrary.AutocompleteSuggestion.fetchAutocompleteSuggestions(
            {
              input: debouncedValue,
              sessionToken: sessionToken,
            },
          );

        setSuggestions(newSuggestions);
        setIsOpen(true);
      } catch (error) {
        console.error(
          "[VoctManager] Failed to fetch autocomplete suggestions:",
          error,
        );
      }
    };

    fetchSuggestions();
  }, [debouncedValue, placesLibrary, sessionToken]);

  /**
   * Handles the selection of a specific suggestion from the dropdown and extracts detailed fields.
   */
  const handleSelectSuggestion = async (
    suggestion: google.maps.places.AutocompleteSuggestion,
  ) => {
    if (!placesLibrary || !suggestion.placePrediction) return;

    try {
      const place = suggestion.placePrediction.toPlace();

      // Restrict payload to essential fields to optimize data usage and latency
      await place.fetchFields({
        fields: ["id", "displayName", "formattedAddress", "location"],
      });

      const name = place.displayName || "";
      const address = place.formattedAddress || "";
      const newPos = {
        lat: place.location?.lat() ?? 0,
        lng: place.location?.lng() ?? 0,
      };

      setInputValue(name || address);
      setIsOpen(false);
      setSuggestions([]);

      // Refresh session token for subsequent independent queries
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
      console.error("[VoctManager] Failed to fetch place details:", error);
    }
  };

  /**
   * Performs reverse geocoding when the user clicks directly on the map interface.
   */
  const handleMapClick = useCallback(
    (e: MapMouseEvent) => {
      if (!e.detail.latLng || !geocodingLibrary) return;

      const latLng = { lat: e.detail.latLng.lat, lng: e.detail.latLng.lng };
      setMarkerPos(latLng);

      const geocoder = new geocodingLibrary.Geocoder();
      geocoder.geocode({ location: latLng }, (results, status) => {
        if (status === "OK" && results?.[0]) {
          const place = results[0];
          setInputValue(place.formatted_address);

          onLocationSelect({
            name: place.formatted_address.split(",")[0],
            formatted_address: place.formatted_address,
            google_place_id: place.place_id,
            latitude: latLng.lat,
            longitude: latLng.lng,
          });
        }
      });
    },
    [geocodingLibrary, onLocationSelect],
  );

  /**
   * Uses HTML5 Geolocation to center the map on the user's physical position.
   */
  const handleLocateMe = () => {
    if (!navigator.geolocation) return;

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const pos = {
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

  /**
   * Handles closing the suggestion dropdown when clicking outside the component.
   */
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="space-y-4" ref={dropdownRef}>
      <div className="flex flex-col sm:flex-row gap-3 relative">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#002395]/50 z-10">
            <Search size={18} />
          </div>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onFocus={() => suggestions.length > 0 && setIsOpen(true)}
            placeholder={t(
              "logistics.map.search_placeholder",
              "Wyszukaj globalne lokacje...",
            )}
            className="w-full pl-10 pr-4 py-3 bg-white/50 border border-stone-200/60 rounded-xl text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#002395]/20 focus:border-[#002395]/40 backdrop-blur-md transition-all duration-300 relative z-10 font-medium text-sm"
          />

          {isOpen && suggestions.length > 0 && (
            <ul className="absolute z-50 w-full mt-2 py-2 bg-white/95 backdrop-blur-xl border border-stone-200/60 rounded-xl overflow-hidden shadow-2xl">
              {suggestions.map((suggestion, index) => {
                if (!suggestion.placePrediction) return null;
                return (
                  <li
                    key={index}
                    onClick={() => handleSelectSuggestion(suggestion)}
                    className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-[#002395]/5 transition-colors duration-200 text-stone-700 text-sm border-b border-stone-100 last:border-0"
                  >
                    <MapPin size={16} className="text-[#002395]/70 shrink-0" />
                    <span className="truncate text-stone-900 font-medium">
                      {suggestion.placePrediction.text.text}
                    </span>
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
          className="flex items-center gap-2"
        >
          {isLocating ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Navigation size={18} />
          )}
          <span className="hidden sm:inline">
            {t("logistics.map.locate_me", "Moja Lokalizacja")}
          </span>
        </Button>
      </div>

      <div className="w-full h-[350px] rounded-xl overflow-hidden border border-stone-200/60 shadow-inner relative bg-stone-50">
        <Map
          defaultZoom={12}
          defaultCenter={DEFAULT_CENTER}
          id="VOCTMANAGER_PICKER_MAP"
          mapId={import.meta.env.VITE_GOOGLE_MAP_ID}
          disableDefaultUI={true}
          onClick={handleMapClick}
          className="w-full h-full"
        >
          <AdvancedMarker position={markerPos}>
            <div className="flex flex-col items-center gap-0.5 group">
              <MapPin
                className="text-[#2e57dd] transition-transform group-hover:-translate-y-1"
                size={24}
              />
              <div className="w-1.5 h-1 rounded-full bg-[#c49a45] blur-[1px] opacity-60" />
            </div>
          </AdvancedMarker>
        </Map>
      </div>
    </div>
  );
};
