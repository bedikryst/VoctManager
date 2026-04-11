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

  // Dedykowane ID mapy dla edytora
  const map = useMap("VOCTMANAGER_PICKER_MAP");

  // Pobieramy NOWĄ bibliotekę places
  const placesLibrary = useMapsLibrary("places");
  const geocodingLibrary = useMapsLibrary("geocoding");

  const dropdownRef = useRef<HTMLDivElement>(null);

  const [markerPos, setMarkerPos] =
    useState<google.maps.LatLngLiteral>(DEFAULT_CENTER);
  const [inputValue, setInputValue] = useState("");
  const [debouncedValue, setDebouncedValue] = useState("");

  // Silne typowanie dla Nowego API
  const [suggestions, setSuggestions] = useState<
    google.maps.places.AutocompleteSuggestion[]
  >([]);

  const [isOpen, setIsOpen] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [sessionToken, setSessionToken] =
    useState<google.maps.places.AutocompleteSessionToken | null>(null);

  // Inicjalizacja Tokenu Sesji z wykorzystaniem zbuforowanej biblioteki
  useEffect(() => {
    if (placesLibrary) {
      setSessionToken(new placesLibrary.AutocompleteSessionToken());
    }
  }, [placesLibrary]);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(inputValue), 300);
    return () => clearTimeout(handler);
  }, [inputValue]);

  // NOWE API: Wyszukiwanie Sugestii z pełnym wsparciem dla tokenizacji (redukcja kosztów)
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!debouncedValue.trim() || !placesLibrary || !sessionToken) {
        setSuggestions([]);
        return;
      }
      try {
        const request = {
          input: debouncedValue,
          sessionToken: sessionToken,
        };
        const { suggestions: newSuggestions } =
          await placesLibrary.AutocompleteSuggestion.fetchAutocompleteSuggestions(
            request,
          );

        setSuggestions(newSuggestions);
        setIsOpen(true);
      } catch (error) {
        console.error("[VoctManager] Error fetching suggestions:", error);
      }
    };
    fetchSuggestions();
  }, [debouncedValue, placesLibrary, sessionToken]);

  // NOWE API: Pobieranie dokładnych detali miejsca po kliknięciu
  const handleSelectSuggestion = async (
    suggestion: google.maps.places.AutocompleteSuggestion,
  ) => {
    if (!placesLibrary || !suggestion.placePrediction) return;

    try {
      const place = suggestion.placePrediction.toPlace();

      // Wymuszamy pobranie tylko niezbędnych pól
      await place.fetchFields({
        fields: ["id", "displayName", "formattedAddress", "location"],
      });

      const name = place.displayName || "";
      const address = place.formattedAddress || "";
      const lat = place.location?.lat() || 0;
      const lng = place.location?.lng() || 0;
      const newPos = { lat, lng };

      setInputValue(name || address);
      setIsOpen(false);
      setSuggestions([]);

      // Odświeżenie tokenu do nowych zapytań
      setSessionToken(new placesLibrary.AutocompleteSessionToken());

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
    } catch (error) {
      console.error("[VoctManager] Error fetching place details:", error);
    }
  };

  // Obsługa Reverse Geocoding przy kliknięciu bezpośrednio w mapę
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
          mapId="VOCTMANAGER_PICKER_MAP"
          disableDefaultUI={true}
          onClick={handleMapClick}
          className="w-full h-full"
        >
          <AdvancedMarker position={markerPos}>
            <div className="w-10 h-10 bg-[#002395]/10 rounded-full flex items-center justify-center animate-pulse border border-[#002395]/20">
              <MapPin className="text-[#002395] drop-shadow-md" size={24} />
            </div>
          </AdvancedMarker>
        </Map>
      </div>
    </div>
  );
};
