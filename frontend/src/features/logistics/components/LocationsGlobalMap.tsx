import React, { useState, useEffect } from "react";
import {
  Map,
  AdvancedMarker,
  InfoWindow,
  useMap,
} from "@vis.gl/react-google-maps";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { MapPin, Clock } from "lucide-react";
import type { LocationDto } from "../types/logistics.dto";
import { useLocalTime } from "../../../shared/lib/hooks/useLocalTime";

interface LocationsGlobalMapProps {
  locations: LocationDto[];
}

// 1. Sub-komponent odpowiedzialny tylko za inteligentne centrowanie mapy
const BoundsFitter = ({ locations }: { locations: LocationDto[] }) => {
  const map = useMap("VOCTMANAGER_GLOBAL_MAP");

  useEffect(() => {
    // Upewniamy się, że mapa jest załadowana i mamy bibliotekę Google
    if (!map || !window.google || locations.length === 0) return;

    const bounds = new window.google.maps.LatLngBounds();
    let validLocationsCount = 0;

    // Rozciągamy "pudełko" na podstawie koordynatów lokacji
    locations.forEach((loc) => {
      if (loc.latitude && loc.longitude) {
        bounds.extend({
          lat: Number(loc.latitude),
          lng: Number(loc.longitude),
        });
        validLocationsCount++;
      }
    });

    if (validLocationsCount > 1) {
      // Jeśli mamy wiele punktów - dopasuj i dodaj 50px luksusowego marginesu
      map.fitBounds(bounds, { top: 50, bottom: 50, left: 50, right: 50 });
    } else if (validLocationsCount === 1) {
      // Jeśli to tylko 1 punkt - wyśrodkuj i daj przyjemny zoom (14 to widok dzielnicy)
      map.setCenter(bounds.getCenter());
      map.setZoom(14);
    }
  }, [map, locations]);

  return null; // Ten komponent nie renderuje UI, jedynie operuje na API Mapy
};

const LocationInfo = ({ location }: { location: LocationDto }) => {
  const { t } = useTranslation();
  const liveLocalTime = useLocalTime(location.timezone);

  return (
    <div className="p-2 min-w-[200px] font-sans">
      <p className="text-[9px] font-bold antialiased uppercase tracking-widest text-[#002395] mb-1">
        {t(
          `logistics.categories.${location.category.toLowerCase()}`,
          location.category.replace("_", " "),
        )}
      </p>
      <h4 className="text-sm font-bold text-stone-900 leading-tight mb-2">
        {location.name}
      </h4>
      <div className="flex items-center gap-1.5 text-xs text-stone-600 mb-2 border-t border-stone-100 pt-2">
        <Clock size={12} className="text-[#002395]" />
        <span className="font-medium">
          {liveLocalTime || location.timezone}
        </span>
      </div>
      <p className="text-[10px] text-stone-500 line-clamp-2">
        {location.formatted_address}
      </p>
    </div>
  );
};

export const LocationsGlobalMap = ({
  locations,
}: LocationsGlobalMapProps): React.JSX.Element => {
  const [selectedLocation, setSelectedLocation] = useState<LocationDto | null>(
    null,
  );

  // Defaultowy fallback, póki BoundsFitter nie przejmie kontroli
  const defaultCenter = { lat: 52.0, lng: 19.0 };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="w-full h-[600px] rounded-[2rem] overflow-hidden border border-stone-200/60 shadow-[0_20px_40px_rgba(0,35,149,0.05)] relative bg-stone-50"
    >
      <Map
        defaultZoom={4}
        defaultCenter={defaultCenter}
        mapId="VOCTMANAGER_GLOBAL_MAP"
        disableDefaultUI={true}
        gestureHandling="greedy"
        className="w-full h-full"
      >
        {/* Odpalamy nasz inteligentny fiter */}
        <BoundsFitter locations={locations} />

        {locations.map((loc) => {
          if (!loc.latitude || !loc.longitude) return null;

          return (
            <AdvancedMarker
              key={loc.id}
              position={{
                lat: Number(loc.latitude),
                lng: Number(loc.longitude),
              }}
              onClick={() => setSelectedLocation(loc)}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-transform ${selectedLocation?.id === loc.id ? "scale-125 bg-[#002395] text-white shadow-lg" : "bg-white text-[#002395] border border-stone-200 shadow-md hover:scale-110"}`}
              >
                <MapPin size={16} />
              </div>
            </AdvancedMarker>
          );
        })}

        {selectedLocation &&
          selectedLocation.latitude &&
          selectedLocation.longitude && (
            <InfoWindow
              position={{
                lat: Number(selectedLocation.latitude),
                lng: Number(selectedLocation.longitude),
              }}
              onCloseClick={() => setSelectedLocation(null)}
            >
              <LocationInfo location={selectedLocation} />
            </InfoWindow>
          )}
      </Map>
    </motion.div>
  );
};
