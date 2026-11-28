/**
 * @file locationsView.ts
 * @description The locations page's view, held in the address (`?widok=`) so a
 * reload keeps it: the venues (the default, no parameter), the upcoming events,
 * and below `lg` the map. From `lg` the map always stands beside the rail, so
 * there `mapa` reads as the venues.
 * @module features/logistics/lib/locationsView
 */

export const LOCATIONS_PATH = "/panel/locations";

export const LOCATIONS_VIEW_PARAM = "widok";

export type LocationsView = "miejsca" | "nadchodzace" | "mapa";

export const isLocationsView = (value: string | null): value is LocationsView =>
  value === "miejsca" || value === "nadchodzace" || value === "mapa";

export const locationsViewHref = (view: LocationsView): string =>
  view === "miejsca" ? LOCATIONS_PATH : `${LOCATIONS_PATH}?${LOCATIONS_VIEW_PARAM}=${view}`;
