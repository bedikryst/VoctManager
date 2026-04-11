import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { LocationCreateDto } from "../types/logistics.dto";
import { Search, MapPin } from "lucide-react";

interface LocationAutocompleteProps {
  onLocationSelect: (locationData: Partial<LocationCreateDto>) => void;
  placeholder?: string;
}

export const LocationAutocomplete = ({
  onLocationSelect,
  placeholder,
}: LocationAutocompleteProps) => {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [inputValue, setInputValue] = useState("");
  const [debouncedValue, setDebouncedValue] = useState("");
  const [suggestions, setSuggestions] = useState<
    google.maps.places.AutocompleteSuggestion[]
  >([]);
  const [isOpen, setIsOpen] = useState(false);
  const [sessionToken, setSessionToken] =
    useState<google.maps.places.AutocompleteSessionToken | null>(null);

  // Initialize Places Session Token
  useEffect(() => {
    const initToken = async () => {
      if (!window.google?.maps) {
        console.warn("Google Maps API is not loaded.");
        return;
      }
      const { AutocompleteSessionToken } =
        (await window.google.maps.importLibrary(
          "places",
        )) as google.maps.PlacesLibrary;
      setSessionToken(new AutocompleteSessionToken());
    };
    initToken();
  }, []);

  // Debounce input value
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(inputValue);
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [inputValue]);

  // Fetch suggestions when debounced value changes
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!debouncedValue.trim()) {
        setSuggestions([]);
        setIsOpen(false);
        return;
      }

      if (!sessionToken || !window.google?.maps) return;

      try {
        const { AutocompleteSuggestion } =
          (await window.google.maps.importLibrary(
            "places",
          )) as google.maps.PlacesLibrary;
        const request = {
          input: debouncedValue,
          sessionToken: sessionToken,
        };

        const { suggestions: newSuggestions } =
          await AutocompleteSuggestion.fetchAutocompleteSuggestions(request);
        setSuggestions(newSuggestions);
        setIsOpen(true);
      } catch (error) {
        console.error("Error fetching places suggestions:", error);
        setSuggestions([]);
      }
    };

    fetchSuggestions();
  }, [debouncedValue, sessionToken]);

  // Handle typing
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  // Handle suggestion selection
  const handleSelect = async (
    suggestion: google.maps.places.AutocompleteSuggestion,
  ) => {
    if (!suggestion.placePrediction) return;

    try {
      const place = suggestion.placePrediction.toPlace();

      // Fetch details using the new Place API
      await place.fetchFields({
        fields: ["id", "displayName", "formattedAddress", "location"],
      });

      const name = place.displayName || "";
      const address = place.formattedAddress || "";

      setInputValue(name || address);
      setIsOpen(false);
      setSuggestions([]);

      // Refresh session token after successful selection to optimize billing
      const { AutocompleteSessionToken } =
        (await window.google.maps.importLibrary(
          "places",
        )) as google.maps.PlacesLibrary;
      setSessionToken(new AutocompleteSessionToken());

      onLocationSelect({
        name: name,
        google_place_id: place.id,
        formatted_address: address,
        latitude: place.location?.lat(),
        longitude: place.location?.lng(),
      });
    } catch (error) {
      console.error("Error fetching place details:", error);
    }
  };

  // Close suggestions dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative w-full" ref={containerRef}>
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-white/50 z-10">
        <Search size={18} />
      </div>
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onFocus={() => {
          if (suggestions.length > 0) setIsOpen(true);
        }}
        placeholder={
          placeholder ||
          t("logistics.autocomplete.placeholder", "Search global locations...")
        }
        className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl 
                   text-white placeholder-white/40 focus:outline-none focus:ring-2 
                   focus:ring-white/20 backdrop-blur-md transition-all duration-300"
      />

      {isOpen && suggestions.length > 0 && (
        <ul className="absolute z-50 w-full mt-2 py-2 bg-black/80 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden shadow-2xl">
          {suggestions.map((suggestion, index) => {
            if (!suggestion.placePrediction) return null;
            return (
              <li
                key={index}
                onClick={() => handleSelect(suggestion)}
                className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-white/10 transition-colors duration-200 text-white/90 text-sm"
              >
                <MapPin size={16} className="text-white/50 shrink-0" />
                <span className="truncate">
                  {suggestion.placePrediction.text.text}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
