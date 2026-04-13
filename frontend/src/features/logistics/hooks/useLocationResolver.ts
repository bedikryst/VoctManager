/**
 * @file useLocationResolver.ts
 * @description Enterprise pattern for resolving polymorphic location references (ID vs Object).
 * Leverages React Query cache for zero-latency lookups across the app.
 * @module features/logistics/hooks
 */

import { useMemo, useCallback } from "react";
import { useLocations } from "../api/logistics.queries";
import type { LocationDto } from "../types/logistics.dto";

export const useLocationResolver = () => {
  const { data: locations = [] } = useLocations();

  const locationMap = useMemo(() => {
    const map = new Map<string, LocationDto>();
    locations.forEach((loc) => map.set(String(loc.id), loc));
    return map;
  }, [locations]);

  const resolveLocation = useCallback(
    (locationRef: any): LocationDto | null => {
      if (!locationRef) return null;

      const id = typeof locationRef === "object" ? locationRef.id : locationRef;
      return (
        locationMap.get(String(id)) ||
        (typeof locationRef === "object" ? locationRef : null)
      );
    },
    [locationMap],
  );

  const getLocationName = useCallback(
    (
      locationRef: string | LocationDto | unknown,
      fallback = "Brak lok.",
    ): string => {
      const resolved = resolveLocation(locationRef);
      return resolved?.name || fallback;
    },
    [resolveLocation],
  );

  return {
    resolveLocation,
    getLocationName,
  };
};
