/**
 * @file LocationAutocomplete.tsx
 * @description Search-only autocomplete for the Google Places API (New).
 * Uses session tokens for billing optimisation, the shared Input primitive for
 * styling, and a portal-free dropdown anchored to the input. Use it when the
 * caller does not need the in-line map picker.
 * @architecture Enterprise SaaS 2026
 * @module features/logistics/components/LocationAutocomplete
 */

import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMapsLibrary } from "@vis.gl/react-google-maps";
import { useDebounceValue } from "usehooks-ts";
import { MapPin, Search } from "lucide-react";

import { Input } from "@/shared/ui/primitives/Input";
import { Text } from "@/shared/ui/primitives/typography";

import type { LocationFormValues } from "../types/logistics.dto";

interface LocationAutocompleteProps {
  onLocationSelect: (locationData: Partial<LocationFormValues>) => void;
  placeholder?: string;
  label?: string;
}

const isNodeTarget = (value: EventTarget | null): value is Node =>
  value instanceof Node;

export const LocationAutocomplete = ({
  onLocationSelect,
  placeholder,
  label,
}: LocationAutocompleteProps): React.JSX.Element => {
  const { t } = useTranslation();
  const placesLibrary = useMapsLibrary("places");

  const containerRef = useRef<HTMLDivElement>(null);
  const [inputValue, setInputValue] = useState<string>("");
  const [debouncedValue] = useDebounceValue(inputValue, 300);
  const [suggestions, setSuggestions] = useState<
    google.maps.places.AutocompleteSuggestion[]
  >([]);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [sessionToken, setSessionToken] =
    useState<google.maps.places.AutocompleteSessionToken | null>(null);

  useEffect(() => {
    if (placesLibrary) {
      setSessionToken(new placesLibrary.AutocompleteSessionToken());
    }
  }, [placesLibrary]);

  useEffect(() => {
    const fetchSuggestions = async (): Promise<void> => {
      if (!debouncedValue.trim()) {
        setSuggestions([]);
        setIsOpen(false);
        return;
      }
      if (!placesLibrary || !sessionToken) return;

      try {
        const { suggestions: newSuggestions } =
          await placesLibrary.AutocompleteSuggestion.fetchAutocompleteSuggestions(
            { input: debouncedValue, sessionToken },
          );
        setSuggestions(newSuggestions);
        setIsOpen(true);
      } catch (error) {
        console.error("[VoctManager Logistics] Autocomplete failed:", error);
        setSuggestions([]);
      }
    };

    void fetchSuggestions();
  }, [debouncedValue, placesLibrary, sessionToken]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent): void => {
      const target = event.target;
      if (!isNodeTarget(target)) return;
      if (
        containerRef.current &&
        !containerRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = async (
    suggestion: google.maps.places.AutocompleteSuggestion,
  ): Promise<void> => {
    if (!suggestion.placePrediction || !placesLibrary) return;

    try {
      const place = suggestion.placePrediction.toPlace();
      await place.fetchFields({
        fields: ["id", "displayName", "formattedAddress", "location"],
      });

      const name = place.displayName ?? "";
      const address = place.formattedAddress ?? "";

      setInputValue(name || address);
      setIsOpen(false);
      setSuggestions([]);

      setSessionToken(new placesLibrary.AutocompleteSessionToken());

      onLocationSelect({
        name,
        google_place_id: place.id,
        formatted_address: address,
        latitude: place.location?.lat(),
        longitude: place.location?.lng(),
      });
    } catch (error) {
      console.error("[VoctManager Logistics] Place fetch failed:", error);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <Input
        type="search"
        label={label}
        leftIcon={<Search size={16} aria-hidden="true" />}
        value={inputValue}
        placeholder={
          placeholder ||
          t(
            "logistics.autocomplete.placeholder",
            "Zacznij wpisywać nazwę miejsca...",
          )
        }
        onChange={(event) => setInputValue(event.target.value)}
        onFocus={() => {
          if (suggestions.length > 0) setIsOpen(true);
        }}
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
                onClick={() => void handleSelect(suggestion)}
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
  );
};
