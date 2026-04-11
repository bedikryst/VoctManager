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
import { LocationCreateDto } from "../types/logistics.dto";
import { Button } from "../../../shared/ui/Button";

interface LocationMapPickerProps {
  onLocationSelect: (locationData: Partial<LocationCreateDto>) => void;
}

const DEFAULT_CENTER = { lat: 52.2297, lng: 21.0122 };

export const LocationMapPicker = ({
  onLocationSelect,
}: LocationMapPickerProps) => {
  const { t } = useTranslation();
  const map = useMap();
  const placesLibrary = useMapsLibrary("places");
  const geocodingLibrary = useMapsLibrary("geocoding");

  const dropdownRef = useRef<HTMLDivElement>(null);

  const [markerPos, setMarkerPos] =
    useState<google.maps.LatLngLiteral>(DEFAULT_CENTER);
  const [inputValue, setInputValue] = useState("");
  const [debouncedValue, setDebouncedValue] = useState("");
  const [suggestions, setSuggestions] = useState<
    google.maps.places.AutocompleteSuggestion[]
  >([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [sessionToken, setSessionToken] =
    useState<google.maps.places.AutocompleteSessionToken | null>(null);

  // Inicjalizacja tokenu sesji (optymalizacja billingu Google)
  useEffect(() => {
    if (placesLibrary) {
      setSessionToken(new placesLibrary.AutocompleteSessionToken());
    }
  }, [placesLibrary]);

  // Debounce dla zapytań tekstowych
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(inputValue), 300);
    return () => clearTimeout(handler);
  }, [inputValue]);

  // Headless Autocomplete (pobieranie podpowiedzi zamiast używania starego widgetu)
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!debouncedValue.trim() || !placesLibrary || !sessionToken) {
        setSuggestions([]);
        return;
      }
      try {
        const request = { input: debouncedValue, sessionToken };
        const { suggestions: newSuggestions } =
          await placesLibrary.AutocompleteSuggestion.fetchAutocompleteSuggestions(
            request,
          );
        setSuggestions(newSuggestions);
        setIsOpen(true);
      } catch (error) {
        console.error("Error fetching places suggestions:", error);
      }
    };
    fetchSuggestions();
  }, [debouncedValue, placesLibrary, sessionToken]);

  // Wybór miejsca z customowej listy rozwijanej
  const handleSelectSuggestion = async (
    suggestion: google.maps.places.AutocompleteSuggestion,
  ) => {
    if (!suggestion.placePrediction || !placesLibrary) return;

    try {
      const place = suggestion.placePrediction.toPlace();
      await place.fetchFields({
        fields: ["id", "displayName", "formattedAddress", "location"],
      });

      const name = place.displayName || "";
      const address = place.formattedAddress || "";
      const location = place.location;

      setInputValue(name || address);
      setIsOpen(false);
      setSuggestions([]);

      // Reset tokenu po udanym wyszukaniu
      setSessionToken(new placesLibrary.AutocompleteSessionToken());

      if (location) {
        const newPos = { lat: location.lat(), lng: location.lng() };
        setMarkerPos(newPos);
        map?.panTo(newPos);
        map?.setZoom(16);

        onLocationSelect({
          name: name,
          formatted_address: address,
          google_place_id: place.id,
          latitude: newPos.lat,
          longitude: newPos.lng,
        });
      }
    } catch (error) {
      console.error("Error fetching place details:", error);
    }
  };

  // Reverse Geocoding: Kliknięcie na mapę -> zmiana w adres
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

  // HTML5 Geolokalizacja natywna
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
      () => {
        setIsLocating(false);
        console.warn("Geolocation permission denied.");
      },
    );
  };

  // Zamknięcie dropdowna po kliknięciu poza niego
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
      {/* Search & Action Bar */}
      <div className="flex flex-col sm:flex-row gap-3 relative">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-cyan-400/50 z-10">
            <Search size={18} />
          </div>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onFocus={() => suggestions.length > 0 && setIsOpen(true)}
            placeholder={t(
              "logistics.map.search_placeholder",
              "Search global locations...",
            )}
            className="w-full pl-10 pr-4 py-3 bg-black/40 border border-white/10 rounded-xl 
                       text-white placeholder-white/40 focus:outline-none focus:ring-2 
                       focus:ring-cyan-500/50 backdrop-blur-md transition-all duration-300 relative z-10"
          />

          {/* Custom Glassmorphism Dropdown */}
          {isOpen && suggestions.length > 0 && (
            <ul className="absolute z-50 w-full mt-2 py-2 bg-black/80 backdrop-blur-2xl border border-cyan-500/20 rounded-xl overflow-hidden shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
              {suggestions.map((suggestion, index) => {
                if (!suggestion.placePrediction) return null;
                return (
                  <li
                    key={index}
                    onClick={() => handleSelectSuggestion(suggestion)}
                    className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-cyan-500/10 transition-colors duration-200 text-white/90 text-sm border-b border-white/5 last:border-0"
                  >
                    <MapPin size={16} className="text-cyan-400/70 shrink-0" />
                    <span className="truncate">
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
          className="flex items-center gap-2 bg-cyan-500/10 border-cyan-500/20 text-cyan-300 hover:bg-cyan-500/20"
        >
          {isLocating ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Navigation size={18} />
          )}
          <span className="hidden sm:inline">
            {t("logistics.map.locate_me", "My Location")}
          </span>
        </Button>
      </div>

      {inputValue && (
        <div className="text-right">
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              onLocationSelect({
                name: inputValue,
                formatted_address: inputValue,
              });
            }}
            className="text-xs text-cyan-400/70 hover:text-cyan-300 transition-colors font-mono tracking-wide"
          >
            {t(
              "logistics.map.use_as_custom",
              "↳ Save as private/custom workspace",
            )}
          </button>
        </div>
      )}

      {/* Map Container */}
      <div className="w-full h-[350px] rounded-xl overflow-hidden border border-white/10 shadow-[0_0_40px_rgba(6,182,212,0.1)] relative">
        <Map
          defaultZoom={12}
          defaultCenter={DEFAULT_CENTER}
          mapId="DEMO_MAP_ID"
          disableDefaultUI={true}
          onClick={handleMapClick}
          className="w-full h-full"
        >
          <AdvancedMarker position={markerPos}>
            <div className="w-10 h-10 bg-cyan-500/20 rounded-full flex items-center justify-center animate-pulse">
              <MapPin
                className="text-cyan-400 drop-shadow-[0_0_10px_rgba(6,182,212,0.8)]"
                size={24}
              />
            </div>
          </AdvancedMarker>
        </Map>
      </div>
    </div>
  );
};
