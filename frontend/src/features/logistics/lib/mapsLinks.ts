/**
 * @file mapsLinks.ts
 * @description The two Google Maps deep-links a venue can offer, in one place.
 * They are NOT interchangeable and the distinction is the point: `place` opens
 * the venue's own page, `directions` opens a route to it. The location popover
 * used to label its footer "Wyznacz trasę" and then run the place search — a
 * control whose label is not what it does.
 * @module features/logistics/lib/mapsLinks
 */

interface MapsTarget {
  readonly name: string;
  readonly formattedAddress?: string | null;
  readonly googlePlaceId?: string | null;
  readonly latitude?: number | string | null;
  readonly longitude?: number | string | null;
}

const query = (target: MapsTarget): string =>
  encodeURIComponent(`${target.name} ${target.formattedAddress ?? ""}`.trim());

const coordinates = (target: MapsTarget): string | null => {
  const { latitude, longitude } = target;
  if (latitude === null || latitude === undefined) return null;
  if (longitude === null || longitude === undefined) return null;
  return `${latitude},${longitude}`;
};

/** The venue's page on Google Maps. */
export const buildPlaceUrl = (target: MapsTarget): string => {
  const base = "https://www.google.com/maps/search/?api=1";
  if (target.googlePlaceId) {
    return `${base}&query=${encodeURIComponent(target.name)}&query_place_id=${target.googlePlaceId}`;
  }
  const point = coordinates(target);
  if (point) return `${base}&query=${point}`;
  return `${base}&query=${query(target)}`;
};

/** A route to the venue from wherever the reader is. */
export const buildDirectionsUrl = (target: MapsTarget): string => {
  const base = "https://www.google.com/maps/dir/?api=1";
  const point = coordinates(target);
  if (point) {
    const placeId = target.googlePlaceId
      ? `&destination_place_id=${target.googlePlaceId}`
      : "";
    return `${base}&destination=${point}${placeId}`;
  }
  return `${base}&destination=${query(target)}`;
};
