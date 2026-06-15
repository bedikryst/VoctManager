/**
 * @file useLocationsData.ts
 * @description Operational orchestrator for the Logistics domain — derives metrics,
 * filter state, active filter chips, view-mode persistence, and archive lifecycle on
 * top of the React Query cache. Server state stays delegated to `logistics.queries`;
 * this hook owns purely UI logic.
 * @architecture Enterprise SaaS 2026
 * @module features/logistics/hooks/useLocationsData
 */

import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";

import type { LocationCategory } from "@/shared/types";
import { useDeleteLocation, useLocations } from "../api/logistics.queries";
import {
  getLocationCategoryOption,
} from "../constants/locationCategories";
import type { LocationDto } from "../types/logistics.dto";

export type LocationsMobileView = "map" | "list";
export type LocationsRailTab = "locations" | "upcoming";

export interface LocationsActiveFilter {
  id: string;
  label: string;
  clear: () => void;
}

export interface LocationsMetrics {
  totalLocations: number;
  uniqueCategories: number;
  uniqueCountries: number;
  uniqueTimezones: number;
  geoTagged: number;
  withNotes: number;
  topCategory: {
    value: LocationCategory;
    count: number;
  } | null;
}

const extractCountry = (formattedAddress: string | null | undefined): string => {
  if (!formattedAddress) return "";
  const parts = formattedAddress.split(",");
  return parts[parts.length - 1]?.trim().toLowerCase() ?? "";
};

const computeMetrics = (locations: LocationDto[]): LocationsMetrics => {
  const categories = new Set<LocationCategory>();
  const countries = new Set<string>();
  const timezones = new Set<string>();
  let geoTagged = 0;
  let withNotes = 0;
  const categoryCounts = new Map<LocationCategory, number>();

  locations.forEach((loc) => {
    categories.add(loc.category);
    categoryCounts.set(
      loc.category,
      (categoryCounts.get(loc.category) ?? 0) + 1,
    );

    const country = extractCountry(loc.formatted_address);
    if (country) countries.add(country);

    if (loc.timezone) timezones.add(loc.timezone);

    if (loc.latitude !== null && loc.longitude !== null) geoTagged += 1;
    if (loc.internal_notes && loc.internal_notes.trim().length > 0) {
      withNotes += 1;
    }
  });

  let topCategory: LocationsMetrics["topCategory"] = null;
  categoryCounts.forEach((count, value) => {
    if (!topCategory || count > topCategory.count) {
      topCategory = { value, count };
    }
  });

  return {
    totalLocations: locations.length,
    uniqueCategories: categories.size,
    uniqueCountries: countries.size,
    uniqueTimezones: timezones.size,
    geoTagged,
    withNotes,
    topCategory,
  };
};

const buildActiveFilters = (
  t: TFunction,
  searchTerm: string,
  categoryFilter: LocationCategory | "",
  resetters: {
    setSearchTerm: (value: string) => void;
    setCategoryFilter: (value: LocationCategory | "") => void;
  },
): LocationsActiveFilter[] => {
  const filters: LocationsActiveFilter[] = [];

  if (searchTerm.trim()) {
    filters.push({
      id: "search",
      label: t("logistics.filters.chip_search", 'Wyszukiwanie: "{{term}}"', {
        term: searchTerm.trim(),
      }),
      clear: () => resetters.setSearchTerm(""),
    });
  }

  if (categoryFilter) {
    const option = getLocationCategoryOption(t, categoryFilter);
    filters.push({
      id: `category-${categoryFilter}`,
      label: t("logistics.filters.chip_category", "Kategoria: {{label}}", {
        label: option.label,
      }),
      clear: () => resetters.setCategoryFilter(""),
    });
  }

  return filters;
};

export const useLocationsData = () => {
  const { t } = useTranslation();
  const { data: locationsData, isError } = useLocations();

  const deleteLocationMutation = useDeleteLocation();

  const locations: LocationDto[] = useMemo(
    () => (Array.isArray(locationsData) ? locationsData : []),
    [locationsData],
  );

  const [searchTerm, setSearchTerm] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<LocationCategory | "">(
    "",
  );
  const [mobileView, setMobileView] = useState<LocationsMobileView>("map");
  const [railTab, setRailTab] = useState<LocationsRailTab>("locations");
  const [activeLocationId, setActiveLocationId] = useState<string | null>(null);

  const [isPanelOpen, setIsPanelOpen] = useState<boolean>(false);
  const [editingLocation, setEditingLocation] = useState<LocationDto | null>(
    null,
  );
  const [locationToArchive, setLocationToArchive] =
    useState<LocationDto | null>(null);

  const displayLocations = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return locations.filter((loc) => {
      const name = (loc.name ?? "").toLowerCase();
      const address = (loc.formatted_address ?? "").toLowerCase();
      const matchesSearch =
        term.length === 0 || name.includes(term) || address.includes(term);
      const matchesCategory = categoryFilter
        ? loc.category === categoryFilter
        : true;
      return matchesSearch && matchesCategory;
    });
  }, [locations, searchTerm, categoryFilter]);

  const metrics = useMemo(() => computeMetrics(locations), [locations]);

  const activeLocation = useMemo(
    () =>
      activeLocationId
        ? (locations.find((loc) => String(loc.id) === activeLocationId) ?? null)
        : null,
    [locations, activeLocationId],
  );

  const categoryStats = useMemo(() => {
    const stats: Partial<Record<LocationCategory, number>> = {};
    locations.forEach((loc) => {
      stats[loc.category] = (stats[loc.category] ?? 0) + 1;
    });
    return stats;
  }, [locations]);

  const activeFilters = useMemo(
    () =>
      buildActiveFilters(t, searchTerm, categoryFilter, {
        setSearchTerm,
        setCategoryFilter,
      }),
    [t, searchTerm, categoryFilter],
  );

  const hasActiveFilters = activeFilters.length > 0;

  const resetFilters = useCallback(() => {
    setSearchTerm("");
    setCategoryFilter("");
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
    const toastId = toast.loading(
      t("logistics.toast.archiving", "Dezaktywacja lokacji..."),
    );

    try {
      await deleteLocationMutation.mutateAsync(locationToArchive.id);
      toast.success(
        t(
          "logistics.toast.archived_success",
          "Lokacja zarchiwizowana pomyślnie.",
        ),
        { id: toastId },
      );
    } catch (error) {
      console.error("[VoctManager Logistics]", error);
      toast.error(t("common.errors.server_error", "Błąd serwera"), {
        id: toastId,
        description: t(
          "logistics.toast.archive_error",
          "Nie udało się zarchiwizować lokacji.",
        ),
      });
    } finally {
      setLocationToArchive(null);
    }
  }, [deleteLocationMutation, locationToArchive, t]);

  return {
    isError,
    locations,
    displayLocations,
    metrics,
    categoryStats,
    activeFilters,
    hasActiveFilters,
    searchTerm,
    setSearchTerm,
    categoryFilter,
    setCategoryFilter,
    resetFilters,
    mobileView,
    setMobileView,
    railTab,
    setRailTab,
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
