/**
 * @file LocationsManager.tsx
 * @description Master controller for the Logistics command centre. The map is
 * the protagonist (venues + upcoming concerts/rehearsals, fly-to + 3D), paired
 * with a dense command rail (venues / upcoming feed). All domain logic stays in
 * `useLocationsData` (filters, archive, selection) and `useLogisticsEvents`
 * (the client-side join of schedule → coordinates); this file only composes.
 * @architecture Enterprise SaaS 2026
 * @module features/logistics/components/LocationsManager
 */

import React, { useDeferredValue, useEffect, useMemo } from "react";
import { AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useMediaQuery } from "usehooks-ts";
import { useTranslation } from "react-i18next";
import {
  CalendarClock,
  List,
  MapPin,
  Map as MapIcon,
  Plus,
  Search,
} from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { foldDiacritics } from "@/shared/lib/text";
import { useBodyScrollLock } from "@/shared/lib/dom/useBodyScrollLock";
import { ConfirmModal } from "@/shared/ui/composites/ConfirmModal";
import { FilterTokens } from "@/shared/ui/composites/FilterTokens";
import { PageHeader } from "@/shared/ui/composites/PageHeader";
import { SegmentedTabs } from "@/shared/ui/composites/SegmentedTabs";
import { StatePanel } from "@/shared/ui/composites/StatePanel";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Button } from "@/shared/ui/primitives/Button";
import { Input } from "@/shared/ui/primitives/Input";
import { Text } from "@/shared/ui/primitives/typography";
import { PageTransition } from "@/shared/ui/kinematics/PageTransition";
import {
  StaggeredBentoContainer,
  StaggeredBentoItem,
} from "@/shared/ui/composites/StaggeredBento";

import { getLocationCategoryOptions } from "../constants/locationCategories";
import { useLocationsData } from "../hooks/useLocationsData";
import { useLogisticsEvents } from "../hooks/useLogisticsEvents";

import { LocationDetail } from "./LocationDetail";
import { LocationEditorPanel } from "./LocationEditorPanel";
import { LocationRow } from "./LocationRow";
import { LocationSheet } from "./LocationSheet";
import { LocationsAtlas } from "./LocationsAtlas";
import { LogisticsEventRow } from "./LogisticsEventRow";
import { LogisticsOverviewBar } from "./LogisticsOverviewBar";
import { LogisticsTimezoneBand } from "./LogisticsTimezoneBand";

export const LocationsManager = (): React.JSX.Element => {
  const { t } = useTranslation();
  const {
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
    isArchiving,
  } = useLocationsData();

  const { upcomingEvents, venueActivity, timezoneClocks, scheduleMetrics } =
    useLogisticsEvents(locations);

  const deferredLocations = useDeferredValue(displayLocations);
  const categoryOptions = useMemo(() => getLocationCategoryOptions(t), [t]);

  // Master-detail focus: on desktop the detail replaces the rail list; on
  // tablet/mobile the map takes over the viewport and a bottom sheet carries
  // the detail — the map is never hidden behind a modal in either case.
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const isVenueFocused = activeLocation !== null;
  const mobileFocus = isVenueFocused && !isDesktop;
  const showRailDetail = isVenueFocused && isDesktop;

  useBodyScrollLock(
    isPanelOpen || locationToArchive !== null || activeLocation !== null,
  );

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

  // Escape clears the venue focus (rail detail / bottom sheet), mirroring the
  // old dossier's behaviour now that there is no modal to trap it.
  useEffect(() => {
    if (!isVenueFocused) return;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") selectLocation(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isVenueFocused, selectLocation]);

  const filteredUpcoming = useMemo(() => {
    const term = foldDiacritics(searchTerm.trim());
    return upcomingEvents.filter((event) => {
      const matchesCategory = categoryFilter
        ? event.location?.category === categoryFilter
        : true;
      const matchesSearch =
        term.length === 0 ||
        foldDiacritics(event.title).includes(term) ||
        foldDiacritics(event.location?.name ?? "").includes(term);
      return matchesCategory && matchesSearch;
    });
  }, [upcomingEvents, searchTerm, categoryFilter]);

  const handleEditFromDossier = (location: typeof activeLocation): void => {
    if (!location) return;
    selectLocation(null);
    openPanel(location);
  };

  const handleArchiveFromDossier = (location: typeof activeLocation): void => {
    if (!location) return;
    selectLocation(null);
    requestArchive(location);
  };

  // The counts ride in the labels: both are scoped to exactly what the tab
  // will show, so the number a reader compares is the number they will count.
  const RAIL_TABS = [
    {
      id: "locations" as const,
      label: `${t("logistics.rail.tab_locations", "Lokacje")} ${deferredLocations.length}`,
      Icon: MapPin,
    },
    {
      id: "upcoming" as const,
      label: `${t("logistics.rail.tab_upcoming", "Nadchodzące")} ${filteredUpcoming.length}`,
      Icon: CalendarClock,
    },
  ];

  const MOBILE_VIEWS = [
    { id: "map" as const, label: t("logistics.rail.view_map", "Mapa"), Icon: MapIcon },
    { id: "list" as const, label: t("logistics.rail.view_list", "Lista"), Icon: List },
  ];

  return (
    <PageTransition>
      <div className="relative mx-auto flex max-w-[1500px] flex-col gap-5 pb-24 pt-6">
        <StaggeredBentoContainer className="!flex flex-col gap-5">
          <StaggeredBentoItem>
            <PageHeader
              size="standard"
              roleText={t("logistics.dashboard.subtitle", "Moduł Logistyczny")}
              title={t("logistics.dashboard.title", "Centrum")}
              titleHighlight={t(
                "logistics.dashboard.title_highlight",
                "Logistyki",
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
            <LogisticsOverviewBar
              categoryOptions={categoryOptions}
              categoryStats={categoryStats}
              metrics={metrics}
              scheduleMetrics={scheduleMetrics}
              activeCategory={categoryFilter}
              onSelectCategory={setCategoryFilter}
            />
          </StaggeredBentoItem>

          <StaggeredBentoItem>
            <LogisticsTimezoneBand clocks={timezoneClocks} />
          </StaggeredBentoItem>

          {/* Mobile-only map ↔ list switch (both panes show side-by-side on lg) */}
          <StaggeredBentoItem className="lg:hidden">
            <SegmentedTabs
              items={MOBILE_VIEWS}
              value={mobileView}
              onChange={setMobileView}
              ariaLabel={t("logistics.rail.view_label", "Widok")}
            />
          </StaggeredBentoItem>

          <StaggeredBentoItem>
            <div className="grid gap-5 lg:grid-cols-12">
              {/* Map — the protagonist. On tablet/mobile focus it takes over
                  the viewport so the cinematic dive stays visible under the
                  bottom sheet. */}
              <div
                className={cn(
                  "lg:col-span-7 lg:sticky lg:top-6 lg:self-start xl:col-span-8",
                  mobileView === "list" && !mobileFocus && "hidden lg:block",
                  mobileFocus && "fixed inset-0 z-40",
                )}
              >
                <LocationsAtlas
                  locations={deferredLocations}
                  venueActivity={venueActivity}
                  activeLocationId={activeLocationId}
                  onSelectLocation={selectLocation}
                  fullscreen={mobileFocus}
                />
              </div>

              {/* Command rail */}
              <div
                className={cn(
                  "lg:col-span-5 lg:sticky lg:top-6 lg:self-start xl:col-span-4",
                  mobileView === "map" && "hidden lg:block",
                )}
              >
                <GlassCard
                  variant="solid"
                  padding="none"
                  isHoverable={false}
                  className={cn(
                    "flex flex-col",
                    showRailDetail
                      ? "lg:h-[calc(100dvh-11rem)]"
                      : "lg:max-h-[calc(100dvh-11rem)]",
                  )}
                >
                  {showRailDetail && activeLocation ? (
                    <LocationDetail
                      location={activeLocation}
                      activity={
                        activeLocationId
                          ? venueActivity.get(activeLocationId)
                          : undefined
                      }
                      onClose={() => selectLocation(null)}
                      onEdit={handleEditFromDossier}
                      onArchive={handleArchiveFromDossier}
                      backLabel={t(
                        "logistics.rail.back_to_list",
                        "Wszystkie lokacje",
                      )}
                    />
                  ) : (
                    <>
                  <div className="shrink-0 space-y-3 border-b border-hairline p-4">
                    <Input
                      leftIcon={<Search size={16} />}
                      type="search"
                      aria-label={t("logistics.filters.search_label", "Wyszukiwanie")}
                      placeholder={t(
                        "logistics.filters.search_placeholder",
                        "Szukaj po nazwie lub adresie...",
                      )}
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                    />

                    <SegmentedTabs
                      items={RAIL_TABS}
                      value={railTab}
                      onChange={setRailTab}
                      wrap
                      ariaLabel={t("logistics.rail.tabs_label", "Zawartość szyny")}
                    />

                    <FilterTokens tokens={activeFilters} onClearAll={resetFilters} />
                  </div>

                  <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
                    {railTab === "locations" ? (
                      deferredLocations.length > 0 ? (
                        <AnimatePresence mode="popLayout" initial={false}>
                          {deferredLocations.map((location) => (
                            <LocationRow
                              key={location.id}
                              location={location}
                              isActive={String(location.id) === activeLocationId}
                              nextEvent={
                                venueActivity.get(String(location.id))?.nextEvent ??
                                null
                              }
                              upcomingCount={
                                venueActivity.get(String(location.id))?.upcoming
                                  .length ?? 0
                              }
                              onSelect={selectLocation}
                              onEdit={openPanel}
                            />
                          ))}
                        </AnimatePresence>
                      ) : (
                        <StatePanel
                          variant="inline"
                          icon={<MapPin size={22} aria-hidden="true" />}
                          title={t(
                            "logistics.empty_state.title",
                            "Brak lokacji w bieżącym widoku",
                          )}
                          description={
                            hasActiveFilters
                              ? t(
                                  "logistics.empty_state.filters_blocked",
                                  "Aktualne filtry ukrywają całą bazę. Wyczyść je, aby wrócić do pełnego atlasu.",
                                )
                              : t(
                                  "logistics.empty_state.start_building",
                                  "Rozpocznij budowę globalnego atlasu, dodając pierwszą salę, kościół lub hotel zespołu.",
                                )
                          }
                          actions={
                            hasActiveFilters ? (
                              <Button variant="outline" onClick={resetFilters}>
                                {t("logistics.filters.clear_filters", "Wyczyść filtry")}
                              </Button>
                            ) : (
                              <Button
                                variant="primary"
                                onClick={() => openPanel(null)}
                                leftIcon={<Plus size={16} aria-hidden="true" />}
                              >
                                {t("logistics.dashboard.add_location", "Dodaj lokację")}
                              </Button>
                            )
                          }
                        />
                      )
                    ) : filteredUpcoming.length > 0 ? (
                      <AnimatePresence mode="popLayout" initial={false}>
                        {filteredUpcoming.map((event) => (
                          <LogisticsEventRow
                            key={event.id}
                            event={event}
                            isActive={
                              event.locationId !== null &&
                              event.locationId === activeLocationId
                            }
                            onSelect={selectLocation}
                          />
                        ))}
                      </AnimatePresence>
                    ) : (
                      <StatePanel
                        variant="inline"
                        icon={<CalendarClock size={22} aria-hidden="true" />}
                        title={t(
                          "logistics.rail.no_upcoming_title",
                          "Brak nadchodzących wydarzeń",
                        )}
                        description={t(
                          "logistics.rail.no_upcoming_desc",
                          "Koncerty i próby z przypisaną lokacją pojawią się tutaj automatycznie.",
                        )}
                      />
                    )}
                  </div>
                    </>
                  )}
                </GlassCard>

                {/* A sentence, so it is set as prose — an overline would put a
                    label's clothing on a full instruction. */}
                <Text
                  as="p"
                  size="xs"
                  color="muted"
                  className="mt-3 px-1 text-center lg:hidden"
                >
                  {t(
                    "logistics.rail.hint",
                    "Wybierz lokację, aby zobaczyć szczegóły i wydarzenia.",
                  )}
                </Text>
              </div>
            </div>
          </StaggeredBentoItem>
        </StaggeredBentoContainer>

        <LocationSheet isOpen={mobileFocus} onClose={() => selectLocation(null)}>
          {activeLocation && (
            <LocationDetail
              location={activeLocation}
              activity={
                activeLocationId
                  ? venueActivity.get(activeLocationId)
                  : undefined
              }
              onClose={() => selectLocation(null)}
              onEdit={handleEditFromDossier}
              onArchive={handleArchiveFromDossier}
            />
          )}
        </LocationSheet>

        <LocationEditorPanel
          isOpen={isPanelOpen}
          onClose={closePanel}
          location={editingLocation}
        />

        <ConfirmModal
          isOpen={!!locationToArchive}
          title={t("logistics.dashboard.archive_title", "Zarchiwizować lokację?")}
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
