/**
 * @file LocationPreview.tsx
 * @description The venue chip used everywhere OUTSIDE logistics - the schedule,
 * the dashboard, rehearsal rows, project cards. Hover or tap opens a portalled
 * card with a map, the address, and two distinct exits: the card itself opens
 * the venue on Google Maps, its footer opens a route to it.
 *
 * The category line resolves through the shared dictionary. It used to print
 * `location.category` verbatim, so half the panel showed a reader the string
 * `CONCERT_HALL`, uppercase and tracked out as though it were a label.
 * @architecture Enterprise SaaS 2026
 * @module features/logistics/components/LocationPreview
 */

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { MapPin, Navigation, ExternalLink } from "lucide-react";
import { Map, AdvancedMarker } from "@vis.gl/react-google-maps";
import { useLocationResolver } from "../hooks/useLocationResolver";
import type {
  LocationDto,
  LocationReference,
  LocationReferenceDto,
} from "../types/logistics.dto";
import { Heading, Text, Eyebrow, Caption } from "@/shared/ui/primitives/typography";
import { cn } from "@/shared/lib/utils";
import { getLocationCategoryOption } from "../constants/locationCategories";
import { buildDirectionsUrl, buildPlaceUrl } from "../lib/mapsLinks";

interface LocationPreviewProps {
  locationRef: LocationReference | null | undefined;
  fallback?: string;
  className?: string;
  variant?: "badge" | "minimal";
}

type ResolvedLocationPreview = LocationDto | LocationReferenceDto;

interface NormalizedLocationPreview {
  id: string;
  name: string;
  category: string | null;
  formattedAddress: string | null;
  googlePlaceId: string | null;
  latitude: number | null;
  longitude: number | null;
}

const isNodeTarget = (value: EventTarget | null): value is Node =>
  value instanceof Node;

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const parseCoordinate = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const normalizeLocation = (
  location: ResolvedLocationPreview,
  fallbackLabel: string,
): NormalizedLocationPreview => ({
  id: location.id,
  name: isNonEmptyString(location.name) ? location.name : fallbackLabel,
  category: isNonEmptyString(location.category) ? location.category : null,
  formattedAddress: isNonEmptyString(location.formatted_address)
    ? location.formatted_address
    : null,
  googlePlaceId: isNonEmptyString(location.google_place_id)
    ? location.google_place_id
    : null,
  latitude: parseCoordinate(location.latitude),
  longitude: parseCoordinate(location.longitude),
});

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
  const normalizedLocation = location
    ? normalizeLocation(location, displayFallback)
    : null;

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
      const target = event.target;
      if (!isNodeTarget(target)) {
        return;
      }

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

  const mapsTarget = normalizedLocation
    ? {
        name: normalizedLocation.name,
        formattedAddress: normalizedLocation.formattedAddress,
        googlePlaceId: normalizedLocation.googlePlaceId,
        latitude: normalizedLocation.latitude,
        longitude: normalizedLocation.longitude,
      }
    : null;

  const openPlaceOnMaps = (event: React.BaseSyntheticEvent) => {
    event.stopPropagation();
    if (!mapsTarget) return;
    window.open(buildPlaceUrl(mapsTarget), "_blank", "noopener,noreferrer");
  };

  if (!normalizedLocation) {
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
        <span className="truncate">{displayFallback}</span>
      </Text>
    );
  }

  const hasCoordinates =
    normalizedLocation?.latitude !== null &&
    normalizedLocation?.longitude !== null;

  // The stored value is an enum code, not a label - resolve it, or say nothing
  // more specific than "Lokacja".
  const categoryLabel = normalizedLocation?.category
    ? getLocationCategoryOption(t, normalizedLocation.category).label
    : t("logistics.preview.default_category", "Lokacja");

  // Variant Styles Architecture
  const anchorStyles =
    variant === "badge"
      ? "rounded-chip border border-ethereal-incense/20 bg-white/5 px-2.5 py-1.5 backdrop-blur-md hover:border-ethereal-gold/40 hover:bg-white/10"
      : "bg-transparent p-0 hover:text-ethereal-gold transition-colors duration-500";

  return (
    <>
      <button
        type="button"
        ref={anchorRef}
        onClick={() => setIsOpen(!isOpen)}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={cn(
          // min-w-0 + max-w-full let the inner label actually truncate instead
          // of forcing the badge wider than its container (mobile overflow fix).
          "group flex min-w-0 max-w-full items-center gap-1.5 transition-all duration-500",
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
          className="truncate text-inherit transition-colors duration-500 group-hover:text-ethereal-gold"
        >
          {normalizedLocation?.name ?? displayFallback}
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
                className="z-focus-trap flex w-72 cursor-pointer flex-col overflow-hidden rounded-surface border border-ethereal-gold/80 bg-white/70 p-1.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.8),0_24px_64px_rgba(166,146,121,0.25)] backdrop-blur-[32px]"
                style={popoverStyle}
                onClick={openPlaceOnMaps}
              >
                {/* ... (Wnętrze mapy pozostaje bez zmian, używa Twojego doskonałego kodu) */}
                <div className="relative z-0 h-32 w-full overflow-hidden rounded-nested">
                  {hasCoordinates ? (
                    <div className="group relative h-full w-full grayscale-[0.2] transition-all duration-700 hover:grayscale-0">
                      <Map
                        defaultZoom={15}
                        defaultCenter={{
                          lat: normalizedLocation?.latitude ?? 0,
                          lng: normalizedLocation?.longitude ?? 0,
                        }}
                        disableDefaultUI={true}
                        gestureHandling="none"
                        mapId={
                          import.meta.env.VITE_GOOGLE_MAP_ID || "DEMO_MAP_ID"
                        }
                        id={`PREVIEW_${normalizedLocation?.id ?? "UNKNOWN"}`}
                        className="h-full w-full"
                      >
                        <AdvancedMarker
                          position={{
                            lat: normalizedLocation?.latitude ?? 0,
                            lng: normalizedLocation?.longitude ?? 0,
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
                <div className="group/details relative z-20 mt-1.5 flex flex-col gap-3 rounded-nested bg-ethereal-marble/95 p-5 shadow-glass-solid backdrop-blur-xl">
                  <div>
                    <div className="mb-2 flex items-start justify-between">
                      <Eyebrow color="graphite">{categoryLabel}</Eyebrow>
                      <ExternalLink
                        size={12}
                        strokeWidth={1.5}
                        aria-hidden="true"
                        className="text-ethereal-incense/40 transition-colors duration-500 group-hover/details:text-ethereal-gold"
                      />
                    </div>
                    <Heading as="h4" size="xl" weight="medium" className="leading-tight">
                      {normalizedLocation?.name ?? displayFallback}
                    </Heading>
                    <Caption color="graphite" className="mt-2 line-clamp-2 leading-relaxed">
                      {normalizedLocation?.formattedAddress}
                    </Caption>
                  </div>
                  {/* A separate exit, because it goes somewhere else: the card
                      opens the venue, this opens a route to it. */}
                  {mapsTarget && (
                    <a
                      href={buildDirectionsUrl(mapsTarget)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(event) => event.stopPropagation()}
                      className="group/route mt-2 flex items-center justify-between border-t border-ethereal-incense/15 pt-4 text-ethereal-incense/60 transition-colors duration-500 hover:border-ethereal-gold/30 hover:text-ethereal-gold"
                    >
                      <Eyebrow color="inherit">
                        {t("logistics.preview.get_directions", "Wyznacz trasę")}
                      </Eyebrow>
                      <Navigation
                        size={14}
                        strokeWidth={1.5}
                        aria-hidden="true"
                        className="transition-transform duration-700 group-hover/route:translate-x-1"
                      />
                    </a>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
};
