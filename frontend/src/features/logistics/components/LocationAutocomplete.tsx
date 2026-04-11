import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { LocationCreateDto } from "../types/logistics.dto";
import { Input } from "../../../shared/ui/Input";
import { Search } from "lucide-react";

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
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [inputValue, setInputValue] = useState("");

  useEffect(() => {
    // Defensive programming. Ensure Google API is loaded.
    if (!window.google || !window.google.maps || !inputRef.current) {
      console.warn("Google Maps API is not loaded.");
      return;
    }

    // Initialize Autocomplete
    autocompleteRef.current = new window.google.maps.places.Autocomplete(
      inputRef.current,
      {
        fields: ["place_id", "geometry", "name", "formatted_address"],
      },
    );

    // Listen for user selection
    const listener = autocompleteRef.current.addListener(
      "place_changed",
      () => {
        const place = autocompleteRef.current?.getPlace();

        if (!place || !place.geometry || !place.geometry.location) {
          // User pressed enter without selecting a Google suggestion (Hybrid location creation)
          return;
        }

        setInputValue(place.name || place.formatted_address || "");

        // Parse the data and send it back up via callback
        onLocationSelect({
          name: place.name || "",
          google_place_id: place.place_id,
          formatted_address: place.formatted_address || "",
          latitude: place.geometry.location.lat(),
          longitude: place.geometry.location.lng(),
        });
      },
    );

    return () => {
      // Cleanup listener to prevent memory leaks
      if (window.google) {
        window.google.maps.event.removeListener(listener);
      }
    };
  }, [onLocationSelect]);

  return (
    <div className="relative w-full">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-white/50">
        <Search size={18} />
      </div>
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        placeholder={
          placeholder ||
          t("logistics.autocomplete.placeholder", "Search global locations...")
        }
        className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl 
                   text-white placeholder-white/40 focus:outline-none focus:ring-2 
                   focus:ring-white/20 backdrop-blur-md transition-all duration-300"
      />
    </div>
  );
};
