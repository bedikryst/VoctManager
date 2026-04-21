/**
 * @file useLocationResolver.ts
 * @description Enterprise pattern for resolving polymorphic location references (ID vs Object).
 * Leverages React Query cache for zero-latency lookups across the app.
 * @module features/logistics/hooks
 */

import { useMemo, useCallback } from "react";
import { useLocations } from "../api/logistics.queries";
import type {
  LocationDto,
  LocationReference,
  LocationReferenceDto,
} from "../types/logistics.dto";

const isLocationReferenceObject = (
  value: LocationReference | unknown,
): value is LocationDto | LocationReferenceDto =>
  typeof value === "object" &&
  value !== null &&
  "id" in value &&
  typeof value.id === "string";

export const useLocationResolver = () => {
  const { data: locations = [] } = useLocations();

  const locationMap = useMemo(() => {
    const map = new Map<string, LocationDto>();
    locations.forEach((loc) => map.set(String(loc.id), loc));
    return map;
  }, [locations]);

  const resolveLocation = useCallback(
    (
      locationRef: LocationReference | null | undefined,
    ): LocationDto | LocationReferenceDto | null => {
      if (!locationRef) return null;

      const id = isLocationReferenceObject(locationRef)
        ? locationRef.id
        : locationRef;

      return locationMap.get(String(id)) || (
        isLocationReferenceObject(locationRef) ? locationRef : null
      );
    },
    [locationMap],
  );

  const getLocationName = useCallback(
    (
      locationRef: LocationReference | null | undefined,
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
