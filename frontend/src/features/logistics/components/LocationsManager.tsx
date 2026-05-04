/**
 * @file LocationsManager.tsx
 * @description Master controller for the Logistics atlas. Keeps the page shell
 * declarative — every domain decision (filtering, metrics, archive lifecycle,
 * view-mode persistence) is delegated to the `useLocationsData` hook and
 * presentation is fully composed from feature-scoped components.
 * @architecture Enterprise SaaS 2026
 * @module features/logistics/components/LocationsManager
 */

import React, { useDeferredValue, useEffect, useMemo } from "react";
import { AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Compass, Plus } from "lucide-react";

import { useBodyScrollLock } from "@/shared/lib/dom/useBodyScrollLock";
import { ConfirmModal } from "@/shared/ui/composites/ConfirmModal";
import { PageHeader } from "@/shared/ui/composites/PageHeader";
import { SectionHeader } from "@/shared/ui/composites/SectionHeader";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Button } from "@/shared/ui/primitives/Button";
import { Heading, Text } from "@/shared/ui/primitives/typography";
import { PageTransition } from "@/shared/ui/kinematics/PageTransition";
import {
  StaggeredBentoContainer,
  StaggeredBentoItem,
} from "@/shared/ui/composites/StaggeredBento";

import { getLocationCategoryOptions } from "../constants/locationCategories";
import { useLocationsData } from "../hooks/useLocationsData";
import type { LocationCategory } from "@/shared/types";

import { LocationCard } from "./LocationCard";
import { LocationCategoryBadge } from "./LocationCategoryBadge";
import { LocationEditorPanel } from "./LocationEditorPanel";
import { LocationsAtlas } from "./LocationsAtlas";
import { LocationsEmptyState } from "./LocationsEmptyState";
import { LocationsFiltersPanel } from "./LocationsFiltersPanel";
import { LocationsHeroPanel } from "./LocationsHeroPanel";
import { LocationsMetricsGrid } from "./LocationsMetricsGrid";

const formatPercentage = (value: number, total: number): number => {
  if (total === 0) return 0;
  return Math.round((value / total) * 100);
};

export const LocationsManager = (): React.JSX.Element => {
  const { t } = useTranslation();
  const {
    isError,
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
    viewMode,
    setViewMode,
    isPanelOpen,
    editingLocation,
    openPanel,
    closePanel,
    locationToArchive,
    requestArchive,
    cancelArchive,
    executeArchive,
    isArchiving,
  } = useLocationsData();

  const deferredLocations = useDeferredValue(displayLocations);
  const normalizedSearchTerm = searchTerm.trim();
  const geoCoverage = formatPercentage(
    metrics.geoTagged,
    metrics.totalLocations,
  );
  const notesCoverage = formatPercentage(
    metrics.withNotes,
    metrics.totalLocations,
  );

  const categoryOptions = useMemo(() => getLocationCategoryOptions(t), [t]);

  useBodyScrollLock(isPanelOpen || locationToArchive !== null);

  useEffect(() => {
    if (!isError) return;
    toast.error(
      t("logistics.toast.sync_warning", "Ostrzeżenie synchronizacji"),
      {
        description: t(
          "logistics.dashboard.sync_error",
          "Nie udało się pobrać bazy lokacji.",
        ),
      },
    );
  }, [isError, t]);

  const groupedLocations = useMemo(() => {
    const groups = new Map<LocationCategory, typeof deferredLocations>();
    categoryOptions.forEach((option) => {
      groups.set(option.value, []);
    });
    deferredLocations.forEach((loc) => {
      const bucket = groups.get(loc.category);
      if (bucket) {
        bucket.push(loc);
      } else {
        groups.set(loc.category, [loc]);
      }
    });
    return Array.from(groups.entries()).filter(
      ([, items]) => items.length > 0,
    );
  }, [deferredLocations, categoryOptions]);

  const showCollection = deferredLocations.length > 0;

  return (
    <PageTransition>
      <div className="relative mx-auto flex max-w-6xl flex-col gap-6 px-4 pb-24 pt-6 sm:px-0">
        <StaggeredBentoContainer className="!flex flex-col gap-6">
          <StaggeredBentoItem>
            <PageHeader
              size="standard"
              roleText={t("logistics.dashboard.subtitle", "Moduł Logistyczny")}
              title={t("logistics.dashboard.title", "Atlas")}
              titleHighlight={t(
                "logistics.dashboard.title_highlight",
                "Lokacji",
              )}
              rightContent={
                <Button
                  variant="primary"
                  onClick={() => openPanel(null)}
                  leftIcon={<Plus size={16} aria-hidden="true" />}
                >
                  {t("logistics.dashboard.add_location", "Dodaj lokację")}
                </Button>
              }
            />
          </StaggeredBentoItem>

          <StaggeredBentoItem className="md:hidden">
            <Button
              variant="primary"
              fullWidth
              onClick={() => openPanel(null)}
              leftIcon={<Plus size={16} aria-hidden="true" />}
            >
              {t("logistics.dashboard.add_location", "Dodaj lokację")}
            </Button>
          </StaggeredBentoItem>

          <StaggeredBentoItem>
            <LocationsHeroPanel
              metrics={metrics}
              geoCoverage={geoCoverage}
              notesCoverage={notesCoverage}
            />
          </StaggeredBentoItem>

          <StaggeredBentoItem>
            <LocationsMetricsGrid
              metrics={metrics}
              geoCoverage={geoCoverage}
              notesCoverage={notesCoverage}
            />
          </StaggeredBentoItem>

          <StaggeredBentoItem>
            <LocationsFiltersPanel
              searchTerm={searchTerm}
              categoryFilter={categoryFilter}
              categoryOptions={categoryOptions}
              categoryStats={categoryStats}
              totalCount={metrics.totalLocations}
              visibleCount={deferredLocations.length}
              hasActiveFilters={hasActiveFilters}
              activeFilters={activeFilters}
              viewMode={viewMode}
              onSearchTermChange={setSearchTerm}
              onCategoryFilterChange={setCategoryFilter}
              onResetFilters={resetFilters}
              onViewModeChange={setViewMode}
            />
          </StaggeredBentoItem>

          <StaggeredBentoItem>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0">
                <SectionHeader
                  title={t(
                    "logistics.dashboard.collection_title",
                    "Globalna baza",
                  )}
                  icon={<Compass size={14} aria-hidden="true" />}
                  withFluidDivider={false}
                  className="mb-0 pb-0"
                />
                <Text color="graphite" className="mt-2 max-w-2xl">
                  {t(
                    "logistics.dashboard.collection_desc",
                    "Każda lokacja zna swoją strefę czasową i przechowuje wewnętrzne instrukcje dla zespołu produkcyjnego.",
                  )}
                </Text>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="glass">
                  {t("logistics.dashboard.in_view", "{{count}} w widoku", {
                    count: deferredLocations.length,
                  })}
                </Badge>
                {hasActiveFilters && (
                  <Badge variant="outline">
                    {t(
                      "logistics.dashboard.filtered_view",
                      "Widok filtrowany",
                    )}
                  </Badge>
                )}
              </div>
            </div>
          </StaggeredBentoItem>

          <StaggeredBentoItem>
            {viewMode === "atlas" ? (
              <LocationsAtlas
                locations={deferredLocations}
                categoryStats={categoryStats}
              />
            ) : showCollection ? (
              <div className="flex flex-col gap-10">
                {groupedLocations.map(([category, items]) => (
                  <section key={category} className="flex flex-col gap-5">
                    <header className="flex flex-wrap items-center gap-3 border-b border-ethereal-incense/15 pb-3">
                      <LocationCategoryBadge category={category} plural />
                      <Heading
                        as="h3"
                        size="xl"
                        weight="medium"
                        className="text-ethereal-ink"
                      >
                        {t(`logistics.categories_plural.${category.toLowerCase()}`, category.replace(/_/g, " "))}
                      </Heading>
                      <Badge variant="neutral">{items.length}</Badge>
                    </header>

                    <StaggeredBentoContainer className="!grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                      <AnimatePresence mode="popLayout">
                        {items.map((loc) => (
                          <StaggeredBentoItem key={loc.id} className="w-full">
                            <LocationCard
                              location={loc}
                              onEdit={openPanel}
                              onArchive={requestArchive}
                            />
                          </StaggeredBentoItem>
                        ))}
                      </AnimatePresence>
                    </StaggeredBentoContainer>
                  </section>
                ))}
              </div>
            ) : (
              <LocationsEmptyState
                searchTerm={normalizedSearchTerm}
                hasActiveFilters={hasActiveFilters}
                onCreateLocation={() => openPanel(null)}
                onResetFilters={resetFilters}
              />
            )}
          </StaggeredBentoItem>
        </StaggeredBentoContainer>

        <LocationEditorPanel
          isOpen={isPanelOpen}
          onClose={closePanel}
          location={editingLocation}
        />

        <ConfirmModal
          isOpen={!!locationToArchive}
          title={t(
            "logistics.dashboard.archive_title",
            "Zarchiwizować lokację?",
          )}
          description={t(
            "logistics.dashboard.archive_desc",
            "Lokacja zniknie z głównej bazy operacyjnej, ale zostanie zachowana dla projektów historycznych.",
          )}
          onConfirm={executeArchive}
          onCancel={cancelArchive}
          isLoading={isArchiving}
        />
      </div>
    </PageTransition>
  );
};
