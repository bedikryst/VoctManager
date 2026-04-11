/**
 * @file useLocationsData.ts
 * @description Manages UI state, client-side filtering, and aggregates for logistics.
 * Reads data exclusively from the React Query cache.
 * @module features/logistics/hooks/useLocationsData
 */

import { useState, useMemo, useCallback } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useLocations, useDeleteLocation } from "../api/logistics.queries";
import type { LocationDto } from "../types/logistics.dto";
import type { LocationCategory } from "../../../shared/types";

export const useLocationsData = () => {
  const { t } = useTranslation();
  const {
    data: locationsData,
    isLoading: isLocationsLoading,
    isError: isLocationsError,
  } = useLocations();

  const deleteLocationMutation = useDeleteLocation();

  const locations: LocationDto[] = locationsData || [];

  const [searchTerm, setSearchTerm] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<LocationCategory | "">(
    "",
  );

  const [isPanelOpen, setIsPanelOpen] = useState<boolean>(false);
  const [editingLocation, setEditingLocation] = useState<LocationDto | null>(
    null,
  );
  const [locationToArchive, setLocationToArchive] =
    useState<LocationDto | null>(null);

  const displayLocations = useMemo(() => {
    return locations.filter((loc) => {
      const matchesSearch =
        loc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        loc.formatted_address.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = categoryFilter
        ? loc.category === categoryFilter
        : true;
      return matchesSearch && matchesCategory;
    });
  }, [locations, searchTerm, categoryFilter]);

  const categoryStats = useMemo(() => {
    const stats: Record<string, number> = {};
    locations.forEach((loc) => {
      stats[loc.category] = (stats[loc.category] || 0) + 1;
    });
    return stats;
  }, [locations]);

  const openPanel = useCallback((location: LocationDto | null = null) => {
    setEditingLocation(location);
    setIsPanelOpen(true);
  }, []);

  const closePanel = useCallback(() => {
    setIsPanelOpen(false);
    setTimeout(() => {
      setEditingLocation(null);
    }, 300);
  }, []);

  const executeArchive = async () => {
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
    } catch (err: unknown) {
      console.error(err);
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
  };

  return {
    isLoading: isLocationsLoading,
    isError: isLocationsError,
    locations,
    displayLocations,
    categoryStats,
    searchTerm,
    setSearchTerm,
    categoryFilter,
    setCategoryFilter,
    isPanelOpen,
    editingLocation,
    openPanel,
    closePanel,
    locationToArchive,
    setLocationToArchive,
    executeArchive,
    isArchiving: deleteLocationMutation.isPending,
  };
};
