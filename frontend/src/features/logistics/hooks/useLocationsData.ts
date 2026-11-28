/**
 * @file useLocationsData.ts
 * @description The locations page's UI state on top of the React Query cache:
 * the view read from the address (`?widok=`), the search, the category, the
 * quick filter for venues without coordinates, the tokens of the filters in
 * use, the venue the map has focused, the editor, and the archive lifecycle.
 * Server state stays in `logistics.queries`.
 *
 * Two narrowed lists: `displayLocations` is the rail's (search, category and
 * the quick filter), `mapLocations` the map's (search and category). A venue
 * without coordinates has no pin, so the quick filter would only empty the map.
 * @module features/logistics/hooks/useLocationsData
 */

import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

import { toastApiError } from "@/shared/api/errors";
import { foldDiacritics } from "@/shared/lib/text";
import type { LocationCategory } from "@/shared/types";
import type { FilterToken } from "@/shared/ui/composites/FilterTokens";

import { useDeleteLocation, useLocations } from "../api/logistics.queries";
import { getLocationCategoryOption } from "../constants/locationCategories";
import {
  isLocationsView,
  LOCATIONS_VIEW_PARAM,
  type LocationsView,
} from "../lib/locationsView";
import type { LocationDto } from "../types/logistics.dto";

const lacksCoordinates = (location: LocationDto): boolean =>
  location.latitude === null || location.longitude === null;

export const useLocationsData = () => {
  const { t } = useTranslation();
  const { data: locationsData, isError } = useLocations();
  const [searchParams] = useSearchParams();

  const deleteLocationMutation = useDeleteLocation();

  const locations: LocationDto[] = useMemo(
    () => (Array.isArray(locationsData) ? locationsData : []),
    [locationsData],
  );

  const rawView = searchParams.get(LOCATIONS_VIEW_PARAM);
  const view: LocationsView = isLocationsView(rawView) ? rawView : "miejsca";

  const [searchTerm, setSearchTerm] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<LocationCategory | "">("");
  const [noCoordinatesPressed, setNoCoordinatesOnly] = useState<boolean>(false);
  const [activeLocationId, setActiveLocationId] = useState<string | null>(null);

  const [isPanelOpen, setIsPanelOpen] = useState<boolean>(false);
  const [editingLocation, setEditingLocation] = useState<LocationDto | null>(null);
  const [locationToArchive, setLocationToArchive] = useState<LocationDto | null>(null);

  // List-wide, like the total beside it; at zero the chip leaves and its
  // filter switches itself off.
  const noCoordinatesCount = useMemo(
    () => locations.filter(lacksCoordinates).length,
    [locations],
  );
  const noCoordinatesOnly = noCoordinatesPressed && noCoordinatesCount > 0;

  const mapLocations = useMemo(() => {
    // Folded, so "kosciol" finds Kościół: the one fold, shared with every
    // other search in the panel.
    const term = foldDiacritics(searchTerm.trim());
    return locations.filter((loc) => {
      const name = foldDiacritics(loc.name ?? "");
      const address = foldDiacritics(loc.formatted_address ?? "");
      const matchesSearch = term.length === 0 || name.includes(term) || address.includes(term);
      const matchesCategory = categoryFilter ? loc.category === categoryFilter : true;
      return matchesSearch && matchesCategory;
    });
  }, [locations, searchTerm, categoryFilter]);

  const displayLocations = useMemo(
    () => (noCoordinatesOnly ? mapLocations.filter(lacksCoordinates) : mapLocations),
    [mapLocations, noCoordinatesOnly],
  );

  const activeLocation = useMemo(
    () =>
      activeLocationId
        ? (locations.find((loc) => String(loc.id) === activeLocationId) ?? null)
        : null,
    [locations, activeLocationId],
  );

  const term = searchTerm.trim();

  // The search and the category; the quick filter is its own pressed chip.
  const filterTokens = useMemo<FilterToken[]>(() => {
    const tokens: FilterToken[] = [];
    if (term) {
      tokens.push({
        id: "search",
        label: t("logistics.filters.chip_search", 'Wyszukiwanie: "{{term}}"', { term }),
        clear: () => setSearchTerm(""),
      });
    }
    if (categoryFilter) {
      tokens.push({
        id: "category",
        label: getLocationCategoryOption(t, categoryFilter).label,
        clear: () => setCategoryFilter(""),
      });
    }
    return tokens;
  }, [t, term, categoryFilter]);

  /** Whether the search or the category narrows the lists; the events know no other filter. */
  const isFiltered = term.length > 0 || categoryFilter !== "";
  /** Whether anything narrows the venues. */
  const isNarrowed = isFiltered || noCoordinatesOnly;

  const resetFilters = useCallback(() => {
    setSearchTerm("");
    setCategoryFilter("");
    setNoCoordinatesOnly(false);
  }, []);

  const selectLocation = useCallback((id: string | null) => {
    setActiveLocationId(id);
  }, []);

  const openPanel = useCallback((location: LocationDto | null = null) => {
    setEditingLocation(location);
    setIsPanelOpen(true);
  }, []);

  const closePanel = useCallback(() => {
    setIsPanelOpen(false);
    setEditingLocation(null);
  }, []);

  const requestArchive = useCallback((location: LocationDto) => {
    setLocationToArchive(location);
  }, []);

  const cancelArchive = useCallback(() => {
    setLocationToArchive(null);
  }, []);

  const executeArchive = useCallback(async () => {
    if (!locationToArchive) return;
    const toastId = toast.loading(t("logistics.toast.archiving", "Archiwizowanie miejsca…"));

    try {
      await deleteLocationMutation.mutateAsync(locationToArchive.id);
      toast.success(
        t("logistics.toast.archived_success", "Miejsce zarchiwizowane."),
        { id: toastId },
      );
    } catch (error) {
      toastApiError(error, t, {
        id: toastId,
        fallbackDescription: t(
          "logistics.toast.archive_error",
          "Nie udało się zarchiwizować miejsca.",
        ),
      });
    } finally {
      setLocationToArchive(null);
    }
  }, [deleteLocationMutation, locationToArchive, t]);

  return {
    isError,
    locations,
    view,
    mapLocations,
    displayLocations,
    filterTokens,
    isFiltered,
    isNarrowed,
    searchTerm,
    setSearchTerm,
    categoryFilter,
    setCategoryFilter,
    noCoordinatesCount,
    noCoordinatesOnly,
    setNoCoordinatesOnly,
    resetFilters,
    activeLocationId,
    activeLocation,
    selectLocation,
    isPanelOpen,
    editingLocation,
    openPanel,
    closePanel,
    locationToArchive,
    requestArchive,
    cancelArchive,
    executeArchive,
    isArchiving: deleteLocationMutation.isPending,
  };
};

export type UseLocationsDataReturn = ReturnType<typeof useLocationsData>;
