/**
 * @file LocationsManager.tsx
 * @description The locations page: the venues and the upcoming events as
 * lists beside the atlas that plots them. Domain logic stays in
 * `useLocationsData` (the view, filters, focus, archive) and
 * `useLogisticsEvents` (the client-side join of the schedule to coordinates);
 * this file composes.
 *
 * One band of underline tabs, held in the address (`?widok=`): "Miejsca",
 * "Nadchodzące", and below `lg` "Mapa", the page's third view on a phone. From
 * `lg` the map stands beside the rail at all times, so the tabs head the rail's
 * card, which they partition, and `mapa` reads as the venues. Below `lg` there
 * is no card: tabs, toolbar and list stand on the page under the header.
 *
 * Exactly one `LocationsAtlas` is mounted, the one the layout `isDesktop`
 * picks, never two Google maps. On a phone it mounts the first time it is
 * wanted (its tab, or a focused venue) and then stays, hidden behind the list,
 * so it keeps its camera. A focused venue takes the whole screen there, the
 * map under a bottom sheet with the detail; the list stays mounted beneath, so
 * its scroll survives. From `lg` the detail replaces the rail's content.
 * @module features/logistics/components/LocationsManager
 */

import React, { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useMediaQuery } from "usehooks-ts";
import { useTranslation } from "react-i18next";
import { CalendarClock, MapPin, MapPinPlusInside } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { foldDiacritics } from "@/shared/lib/text";
import { useBodyScrollLock } from "@/shared/lib/dom/useBodyScrollLock";
import { ConfirmModal } from "@/shared/ui/composites/ConfirmModal";
import { FilterToggle } from "@/shared/ui/composites/FilterTokens";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { ListCensus, ToolbarButton } from "@/shared/ui/composites/ListToolbar";
import { PageHeader } from "@/shared/ui/composites/PageHeader";
import { RecordList, type RecordListEdge } from "@/shared/ui/composites/RecordList";
import { RouteTabs, type RouteTabItem } from "@/shared/ui/composites/RouteTabs";
import { StatePanel } from "@/shared/ui/composites/StatePanel";
import { PageTransition } from "@/shared/ui/kinematics/PageTransition";
import { Button } from "@/shared/ui/primitives/Button";

import { useLocationsData } from "../hooks/useLocationsData";
import { useLogisticsEvents } from "../hooks/useLogisticsEvents";
import { locationsViewHref } from "../lib/locationsView";

import { LocationDetail } from "./LocationDetail";
import { LocationEditorPanel } from "./LocationEditorPanel";
import { LocationRow } from "./LocationRow";
import { LocationSheet } from "./LocationSheet";
import { LocationsAtlas } from "./LocationsAtlas";
import { LocationsToolbar } from "./LocationsToolbar";
import { LogisticsEventRow } from "./LogisticsEventRow";
import { LogisticsTimezoneBand } from "./LogisticsTimezoneBand";

export const LocationsManager = (): React.JSX.Element => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
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
    isArchiving,
  } = useLocationsData();

  const { upcomingEvents, venueActivity, timezoneClocks } = useLogisticsEvents(locations);

  const deferredLocations = useDeferredValue(displayLocations);
  const deferredMapLocations = useDeferredValue(mapLocations);

  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const isVenueFocused = activeLocation !== null;
  const mobileFocus = isVenueFocused && !isDesktop;
  const showRailDetail = isVenueFocused && isDesktop;
  const showsEvents = view === "nadchodzace";
  const showsMap = view === "mapa" && !isDesktop;

  // A latch, set while rendering: the phone's map mounts the first time it
  // shows and stays, so it never first lays out inside a hidden box.
  const wantsPhoneAtlas = showsMap || mobileFocus;
  const [isPhoneAtlasMounted, setIsPhoneAtlasMounted] = useState<boolean>(wantsPhoneAtlas);
  if (wantsPhoneAtlas && !isPhoneAtlasMounted) setIsPhoneAtlasMounted(true);

  // The overlays (editor, archive confirm, the phone's venue sheet) hold their
  // own locks while they are on screen; the desktop rail detail is no overlay,
  // so the page locks for it.
  useBodyScrollLock(showRailDetail);

  useEffect(() => {
    if (!isError) return;
    toast.error(t("logistics.toast.sync_warning", "Ostrzeżenie synchronizacji"), {
      description: t("logistics.dashboard.sync_error", "Nie udało się pobrać miejsc."),
    });
  }, [isError, t]);

  // Escape clears the venue focus (the rail detail, the bottom sheet), unless
  // something opened over it answered the key first (the detail's menu).
  useEffect(() => {
    if (!isVenueFocused) return;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape" && !event.defaultPrevented) selectLocation(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isVenueFocused, selectLocation]);

  const filteredUpcoming = useMemo(() => {
    const term = foldDiacritics(searchTerm.trim());
    return upcomingEvents.filter((event) => {
      const matchesCategory = categoryFilter ? event.location?.category === categoryFilter : true;
      const matchesSearch =
        term.length === 0 ||
        foldDiacritics(event.title).includes(term) ||
        foldDiacritics(event.location?.name ?? "").includes(term);
      return matchesCategory && matchesSearch;
    });
  }, [upcomingEvents, searchTerm, categoryFilter]);

  const handleEditFromDetail = (location: typeof activeLocation): void => {
    if (!location) return;
    selectLocation(null);
    openPanel(location);
  };

  const handleArchiveFromDetail = (location: typeof activeLocation): void => {
    if (!location) return;
    selectLocation(null);
    requestArchive(location);
  };

  // The tabs carry the whole lists' sizes; the census says how far a filter
  // narrows the one on screen.
  const tabs: RouteTabItem[] = [
    {
      to: locationsViewHref("miejsca"),
      label: t("logistics.tabs.venues", "Miejsca"),
      count: locations.length,
      active: !showsEvents && !showsMap,
    },
    {
      to: locationsViewHref("nadchodzace"),
      label: t("logistics.tabs.upcoming", "Nadchodzące"),
      count: upcomingEvents.length,
      active: showsEvents,
    },
    ...(isDesktop
      ? []
      : [
          {
            to: locationsViewHref("mapa"),
            label: t("logistics.tabs.map", "Mapa"),
            active: showsMap,
          },
        ]),
  ];
  const tabRow = (
    <RouteTabs variant="underline" items={tabs} ariaLabel={t("logistics.tabs.aria", "Widoki miejsc")} />
  );

  const narrowedLabel = (visible: number, total: number): string =>
    t("logistics.census.narrowed", "{{visible}} z {{total}}", { visible, total });
  const venuesNoun = t("logistics.census.venues", "miejsc", { count: locations.length });
  const census = showsEvents ? (
    <ListCensus
      total={upcomingEvents.length}
      noun={t("logistics.census.events", "wydarzeń", { count: upcomingEvents.length })}
      narrowed={isFiltered ? narrowedLabel(filteredUpcoming.length, upcomingEvents.length) : null}
    />
  ) : showsMap ? (
    <ListCensus
      total={locations.length}
      noun={venuesNoun}
      narrowed={isFiltered ? narrowedLabel(mapLocations.length, locations.length) : null}
    />
  ) : (
    <ListCensus
      total={locations.length}
      noun={venuesNoun}
      narrowed={isNarrowed ? narrowedLabel(displayLocations.length, locations.length) : null}
    />
  );

  // A venue without coordinates has no pin, so on the map the chip is the way
  // to the list of them, where they get fixed; it narrows nothing there.
  const quickFilter =
    !showsEvents && noCoordinatesCount > 0 ? (
      <FilterToggle
        label={t("logistics.quick.no_coordinates", "{{count}} bez współrzędnych", {
          count: noCoordinatesCount,
        })}
        pressed={noCoordinatesOnly && !showsMap}
        onToggle={() => {
          if (showsMap) {
            setNoCoordinatesOnly(true);
            navigate(locationsViewHref("miejsca"));
            return;
          }
          setNoCoordinatesOnly((pressed) => !pressed);
        }}
      />
    ) : null;

  const toolbar = (
    <LocationsToolbar
      searchTerm={searchTerm}
      onSearch={setSearchTerm}
      categoryFilter={categoryFilter}
      onCategory={setCategoryFilter}
      census={census}
      quickFilters={quickFilter}
      tokens={filterTokens}
      onResetFilters={resetFilters}
    />
  );

  const clearFiltersButton = (
    <Button variant="outline" casing="sentence" onClick={resetFilters}>
      {t("logistics.filters.clear_filters", "Wyczyść filtry")}
    </Button>
  );

  const renderList = (edge: RecordListEdge): React.JSX.Element => {
    const emptyVariant = edge === "inset" ? "inline" : undefined;

    if (showsEvents) {
      return filteredUpcoming.length > 0 ? (
        <RecordList edge={edge} label={t("logistics.tabs.upcoming", "Nadchodzące")}>
          {filteredUpcoming.map((event) => (
            <LogisticsEventRow
              key={event.id}
              event={event}
              isCurrent={event.locationId !== null && event.locationId === activeLocationId}
              onSelect={selectLocation}
            />
          ))}
        </RecordList>
      ) : (
        <StatePanel
          variant={emptyVariant}
          icon={<CalendarClock size={22} aria-hidden="true" />}
          title={
            isFiltered
              ? t("logistics.rail.no_upcoming_filtered", "Żadne wydarzenie nie pasuje do filtrów")
              : t("logistics.rail.no_upcoming_title", "Brak nadchodzących wydarzeń")
          }
          description={
            isFiltered
              ? undefined
              : t("logistics.rail.no_upcoming_desc", "Tu pojawią się zaplanowane koncerty i próby.")
          }
          actions={isFiltered ? clearFiltersButton : undefined}
        />
      );
    }

    return deferredLocations.length > 0 ? (
      <RecordList edge={edge} label={t("logistics.tabs.venues", "Miejsca")}>
        {deferredLocations.map((location) => (
          <LocationRow
            key={location.id}
            location={location}
            isCurrent={String(location.id) === activeLocationId}
            nextEvent={venueActivity.get(String(location.id))?.nextEvent ?? null}
            onSelect={selectLocation}
            onEdit={openPanel}
          />
        ))}
      </RecordList>
    ) : (
      <StatePanel
        variant={emptyVariant}
        icon={<MapPin size={22} aria-hidden="true" />}
        title={
          isNarrowed
            ? t("logistics.empty_state.title_filtered", "Żadne miejsce nie pasuje do filtrów")
            : t("logistics.empty_state.title", "Nie ma jeszcze żadnego miejsca")
        }
        description={
          isNarrowed
            ? undefined
            : t(
                "logistics.empty_state.start_building",
                "Dodaj pierwszą salę, kościół albo hotel zespołu.",
              )
        }
        actions={
          isNarrowed ? (
            clearFiltersButton
          ) : (
            <Button
              variant="secondary"
              casing="sentence"
              onClick={() => openPanel(null)}
              leftIcon={<MapPinPlusInside size={16} aria-hidden="true" />}
            >
              {t("logistics.dashboard.add_location", "Dodaj miejsce")}
            </Button>
          )
        }
      />
    );
  };

  const atlas = (
    <LocationsAtlas
      locations={deferredMapLocations}
      venueActivity={venueActivity}
      activeLocationId={activeLocationId}
      onSelectLocation={selectLocation}
      fullscreen={mobileFocus}
    />
  );

  const timezoneBand = <LogisticsTimezoneBand clocks={timezoneClocks} />;

  return (
    <PageTransition>
      <div className="relative mx-auto flex max-w-[1500px] flex-col gap-5 pb-24 pt-6">
        <PageHeader
          size="compact"
          title={t("logistics.dashboard.title", "Miejsca")}
          rightContent={
            <ToolbarButton
              variant="primary"
              icon={<MapPinPlusInside size={16} aria-hidden="true" />}
              label={t("logistics.dashboard.add_location", "Dodaj miejsce")}
              onClick={() => openPanel(null)}
            />
          }
        />

        {isDesktop ? (
          <>
            {timezoneBand}
            <div className="grid grid-cols-12 gap-5">
              <div className="sticky top-6 col-span-7 self-start xl:col-span-8">{atlas}</div>

              <div className="sticky top-6 col-span-5 self-start xl:col-span-4">
                <GlassCard
                  variant="solid"
                  padding="none"
                  isHoverable={false}
                  className={cn(
                    "flex flex-col",
                    showRailDetail ? "h-[calc(100dvh-11rem)]" : "max-h-[calc(100dvh-11rem)]",
                  )}
                >
                  {showRailDetail && activeLocation ? (
                    <LocationDetail
                      location={activeLocation}
                      activity={activeLocationId ? venueActivity.get(activeLocationId) : undefined}
                      onClose={() => selectLocation(null)}
                      onEdit={handleEditFromDetail}
                      onArchive={handleArchiveFromDetail}
                      backLabel={t("logistics.rail.back_to_list", "Miejsca")}
                    />
                  ) : (
                    <>
                      <div className="flex shrink-0 flex-col gap-3 border-b border-hairline px-5 pb-4 pt-2">
                        {tabRow}
                        {toolbar}
                      </div>
                      <div className="min-h-0 flex-1 overflow-y-auto">{renderList("inset")}</div>
                    </>
                  )}
                </GlassCard>
              </div>
            </div>
          </>
        ) : (
          <>
            {tabRow}
            {toolbar}
            {isPhoneAtlasMounted && (
              <div className={cn(mobileFocus ? "fixed inset-0 z-40" : !showsMap && "hidden")}>
                {atlas}
              </div>
            )}
            {!showsMap && renderList("flush")}
            {timezoneBand}
          </>
        )}

        <LocationSheet isOpen={mobileFocus} onClose={() => selectLocation(null)}>
          {activeLocation && (
            <LocationDetail
              location={activeLocation}
              activity={activeLocationId ? venueActivity.get(activeLocationId) : undefined}
              onClose={() => selectLocation(null)}
              onEdit={handleEditFromDetail}
              onArchive={handleArchiveFromDetail}
            />
          )}
        </LocationSheet>

        <LocationEditorPanel isOpen={isPanelOpen} onClose={closePanel} location={editingLocation} />

        <ConfirmModal
          isOpen={!!locationToArchive}
          title={t("logistics.dashboard.archive_title", "Zarchiwizować miejsce?")}
          description={t(
            "logistics.dashboard.archive_desc",
            "Miejsce zniknie z listy, ale projekty, które się w nim odbyły, zachowają je w swojej historii.",
          )}
          onConfirm={executeArchive}
          onCancel={cancelArchive}
          isLoading={isArchiving}
        />
      </div>
    </PageTransition>
  );
};
