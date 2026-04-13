/**
 * @file LocationPreview.tsx
 * @description Enhanced Interactive Location Badge with full-card click support.
 * @architecture Enterprise SaaS 2026
 */

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { MapPin, Navigation, ExternalLink } from "lucide-react";
import { Map, AdvancedMarker } from "@vis.gl/react-google-maps";
import { useLocationResolver } from "../hooks/useLocationResolver";
import type { LocationDto } from "../types/logistics.dto";

interface LocationPreviewProps {
  locationRef: string | LocationDto | unknown;
  fallback?: string;
  className?: string;
}

export const LocationPreview = ({
  locationRef,
  fallback = "Unknown Location",
  className = "",
}: LocationPreviewProps): React.JSX.Element => {
  const { t } = useTranslation();
  const { resolveLocation } = useLocationResolver();
  const location = resolveLocation(locationRef);

  const [isOpen, setIsOpen] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, []);

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => setIsOpen(false), 300);
  };

  const openInGoogleMaps = (e: React.BaseSyntheticEvent) => {
    e.stopPropagation();
    if (!location) return;

    const { latitude, longitude, google_place_id, name, formatted_address } =
      location;

    let url = "";
    if (google_place_id) {
      // Oficjalny format Google Maps Search API
      url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}&query_place_id=${google_place_id}`;
    } else if (latitude && longitude) {
      url = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
    } else {
      const query = encodeURIComponent(`${name} ${formatted_address || ""}`);
      url = `https://www.google.com/maps/search/?api=1&query=${query}`;
    }

    window.open(url, "_blank", "noopener,noreferrer");
  };

  if (!location) {
    return (
      <span className={`flex items-center gap-1.5 text-stone-500 ${className}`}>
        <MapPin size={12} className="flex-shrink-0" />
        <span className="truncate">{fallback}</span>
      </span>
    );
  }

  const hasCoordinates =
    location.latitude !== null &&
    location.longitude !== null &&
    !isNaN(Number(location.latitude)) &&
    !isNaN(Number(location.longitude));

  return (
    <div
      className="relative inline-flex"
      ref={containerRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 bg-stone-100/50 hover:bg-brand/5 hover:text-brand hover:border-brand/30 px-2.5 py-1.5 rounded-lg border border-stone-200/80 transition-all group ${className}`}
      >
        <MapPin
          size={12}
          className="flex-shrink-0 text-stone-400 group-hover:text-brand transition-colors"
        />
        <span className="truncate font-bold antialiased uppercase tracking-widest text-[10px]">
          {location.name}
        </span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.95 }}
            whileHover={{ y: -2, transition: { duration: 0.1 } }}
            onClick={openInGoogleMaps}
            className="absolute z-50 top-full left-0 mt-2 w-72 bg-white/95 backdrop-blur-xl border border-brand/20 rounded-2xl shadow-2xl overflow-hidden flex flex-col cursor-pointer ring-1 ring-black/5"
          >
            {/* MAP PREVIEW */}
            {hasCoordinates ? (
              <div className="w-full h-32 bg-stone-100 relative pointer-events-none grayscale-[0.3] group-hover:grayscale-0 transition-all">
                <Map
                  defaultZoom={15}
                  defaultCenter={{
                    lat: Number(location.latitude),
                    lng: Number(location.longitude),
                  }}
                  disableDefaultUI={true}
                  gestureHandling="none"
                  mapId={import.meta.env.VITE_GOOGLE_MAP_ID}
                  id={`PREVIEW_${location.id}`}
                  className="w-full h-full"
                >
                  <AdvancedMarker
                    position={{
                      lat: Number(location.latitude),
                      lng: Number(location.longitude),
                    }}
                  >
                    <div className="flex flex-col items-center gap-0.5 group">
                      <MapPin
                        className="text-[#2e57dd] transition-transform group-hover:-translate-y-1"
                        size={24}
                      />
                      <div className="w-1.5 h-1 rounded-full bg-[#c49a45] blur-[1px] opacity-60" />
                    </div>
                  </AdvancedMarker>
                </Map>
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
              </div>
            ) : (
              <div className="w-full h-24 bg-stone-50 flex items-center justify-center border-b border-stone-100">
                <span className="text-[9px] text-stone-400 font-bold uppercase tracking-widest">
                  {t("logistics.preview.no_map", "Map Preview Unavailable")}
                </span>
              </div>
            )}

            {/* DETAILS */}
            <div className="p-4 flex flex-col gap-3 relative">
              <div>
                <div className="flex justify-between items-start">
                  <p className="text-[8px] font-bold antialiased uppercase tracking-widest text-brand mb-0.5">
                    {location.category}
                  </p>
                  <ExternalLink size={10} className="text-stone-300" />
                </div>
                <h4 className="text-sm font-bold text-stone-900 leading-tight">
                  {location.name}
                </h4>
                <p className="text-[10px] text-stone-500 mt-1 line-clamp-2 leading-relaxed">
                  {location.formatted_address}
                </p>
              </div>

              <div className="w-full py-2.5 bg-brand/5 group-hover:bg-brand group-hover:text-white text-brand text-[9px] font-bold uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2">
                <Navigation size={12} />
                {t("logistics.preview.get_directions", "Wyznacz trasę")}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
