/**
 * @file LocationPreview.tsx
 * @description Ethereal UI Interactive Location Badge.
 * Features kinematic glassmorphism popovers powered by React Portals,
 * robust z-indexing, and an opaque reading pedestal.
 * @architecture Enterprise SaaS 2026
 */

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { MapPin, Navigation, ExternalLink } from "lucide-react";
import { Map, AdvancedMarker } from "@vis.gl/react-google-maps";
import { useLocationResolver } from "../hooks/useLocationResolver";
import type { LocationDto } from "../types/logistics.dto";
import { Heading, Text, Eyebrow, Caption } from "@/shared/ui/primitives/typography";
import { cn } from "@/shared/lib/utils";

interface LocationPreviewProps {
  locationRef: string | LocationDto | unknown;
  fallback?: string;
  className?: string;
  variant?: "badge" | "minimal";
}

export const LocationPreview = ({
  locationRef,
  fallback,
  className = "",
  variant = "badge",
}: LocationPreviewProps): React.JSX.Element => {
  const { t } = useTranslation();
  const { resolveLocation } = useLocationResolver();
  const location = resolveLocation(locationRef);

  const [isOpen, setIsOpen] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({});

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const displayFallback =
    fallback || t("logistics.preview.unknown_location", "Nieznana lokacja");

  const updatePosition = () => {
    if (!anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    const POPOVER_WIDTH = 288;
    const MARGIN = 16;
    const isRightAligned =
      rect.left + POPOVER_WIDTH > window.innerWidth - MARGIN;

    setPopoverStyle({
      position: "fixed",
      top: `${rect.bottom + 8}px`,
      left: isRightAligned ? "auto" : `${rect.left}px`,
      right: isRightAligned ? `${window.innerWidth - rect.right}px` : "auto",
      zIndex: 99999,
    });
  };

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      window.addEventListener("scroll", updatePosition, true);
      window.addEventListener("resize", updatePosition);
    }
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (
        anchorRef.current &&
        !anchorRef.current.contains(target) &&
        popoverRef.current &&
        !popoverRef.current.contains(target)
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
    const baseUrl = "https://www.google.com/maps/search/?api=1";
    let url = baseUrl;

    if (google_place_id) {
      url += `&query=${encodeURIComponent(name)}&query_place_id=${google_place_id}`;
    } else if (latitude && longitude) {
      url += `&query=${latitude},${longitude}`;
    } else {
      const query = encodeURIComponent(`${name} ${formatted_address || ""}`);
      url += `&query=${query}`;
    }

    window.open(url, "_blank", "noopener,noreferrer");
  };

  if (!location) {
    return (
      <Text
        as="span"
        size="sm"
        weight="medium"
        color="graphite"
        className={cn(
          "flex items-center gap-1.5 opacity-60",
          className,
        )}
      >
        <MapPin size={12} className="shrink-0" />
        <span className="truncate tracking-widest">{displayFallback}</span>
      </Text>
    );
  }

  const hasCoordinates =
    location.latitude !== null &&
    location.longitude !== null &&
    !isNaN(Number(location.latitude)) &&
    !isNaN(Number(location.longitude));

  // Variant Styles Architecture
  const anchorStyles =
    variant === "badge"
      ? "rounded-lg border border-ethereal-incense/20 bg-white/5 px-2.5 py-1.5 backdrop-blur-md hover:border-ethereal-gold/40 hover:bg-white/10"
      : "bg-transparent p-0 hover:text-ethereal-gold transition-colors duration-500";

  return (
    <>
      <button
        ref={anchorRef}
        onClick={() => setIsOpen(!isOpen)}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={cn(
          "group flex items-center gap-1.5 transition-all duration-500",
          anchorStyles,
          className,
        )}
      >
        <MapPin
          size={12}
          className="shrink-0 text-ethereal-incense/60 transition-colors duration-500 group-hover:text-ethereal-gold"
        />
        <Text
          as="span"
          size="sm"
          weight="medium"
          className="truncate tracking-widest text-inherit transition-colors duration-500 group-hover:text-ethereal-gold"
        >
          {location.name}
        </Text>
      </button>

      {/* THE ETHEREAL POPOVER (PORTALED) */}
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {isOpen && (
              <motion.div
                ref={popoverRef}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                initial={{
                  opacity: 0,
                  y: -10,
                  scale: 0.95,
                  filter: "blur(4px)",
                }}
                animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -5, scale: 0.95, filter: "blur(4px)" }}
                transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
                className="flex w-72 cursor-pointer flex-col overflow-hidden rounded-[2rem] border border-ethereal-gold/80 bg-white/70 p-1.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.8),0_24px_64px_rgba(166,146,121,0.25)] backdrop-blur-[32px]"
                style={popoverStyle}
                onClick={openInGoogleMaps}
              >
                {/* ... (Wnętrze mapy pozostaje bez zmian, używa Twojego doskonałego kodu) */}
                <div className="relative z-0 h-32 w-full overflow-hidden rounded-[1.5rem]">
                  {hasCoordinates ? (
                    <div className="group relative h-full w-full grayscale-[0.2] transition-all duration-700 hover:grayscale-0">
                      <Map
                        defaultZoom={15}
                        defaultCenter={{
                          lat: Number(location.latitude),
                          lng: Number(location.longitude),
                        }}
                        disableDefaultUI={true}
                        gestureHandling="none"
                        mapId={
                          import.meta.env.VITE_GOOGLE_MAP_ID || "DEMO_MAP_ID"
                        }
                        id={`PREVIEW_${location.id}`}
                        className="h-full w-full"
                      >
                        <AdvancedMarker
                          position={{
                            lat: Number(location.latitude),
                            lng: Number(location.longitude),
                          }}
                        >
                          <div className="group flex flex-col items-center gap-0.5">
                            <MapPin
                              className="text-ethereal-gold transition-transform duration-700 group-hover:-translate-y-1"
                              size={24}
                              strokeWidth={1.5}
                            />
                            <div className="h-1 w-1.5 rounded-full bg-ethereal-ink/40 blur-[2px]" />
                          </div>
                        </AdvancedMarker>
                      </Map>
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ethereal-ink/20 to-transparent mix-blend-multiply" />
                    </div>
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-white/20">
                      <Eyebrow as="span" color="graphite" className="opacity-60">
                        {t("logistics.preview.no_map", "Brak współrzędnych")}
                      </Eyebrow>
                    </div>
                  )}
                </div>

                {/* DETAILS COMPARTMENT */}
                <div className="group/details relative z-20 mt-1.5 flex flex-col gap-3 rounded-[1.5rem] bg-ethereal-marble/95 p-5 shadow-glass-solid backdrop-blur-xl">
                  <div>
                    <div className="mb-2 flex items-start justify-between">
                      <Caption color="sage" weight="bold" className="uppercase tracking-[0.2em]">
                        {location.category ||
                          t("logistics.preview.default_category", "Lokacja")}
                      </Caption>
                      <ExternalLink
                        size={12}
                        strokeWidth={1.5}
                        className="text-ethereal-incense/40 transition-colors duration-500 group-hover/details:text-ethereal-gold"
                      />
                    </div>
                    <Heading as="h4" size="xl" weight="medium" className="leading-tight">
                      {location.name}
                    </Heading>
                    <Caption color="graphite" className="mt-2 line-clamp-2 leading-relaxed">
                      {location.formatted_address}
                    </Caption>
                  </div>
                  <div className="mt-2 flex items-center justify-between border-t border-ethereal-incense/15 pt-4 transition-colors duration-700 group-hover/details:border-ethereal-gold/30">
                    <Caption color="incense-muted" weight="bold" className="uppercase tracking-[0.25em] transition-colors duration-500 group-hover/details:text-ethereal-gold">
                      {t("logistics.preview.get_directions", "Wyznacz trasę")}
                    </Caption>
                    <Navigation
                      size={14}
                      strokeWidth={1.5}
                      className="text-ethereal-incense/50 transition-all duration-700 group-hover/details:translate-x-1 group-hover/details:text-ethereal-gold"
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
};
