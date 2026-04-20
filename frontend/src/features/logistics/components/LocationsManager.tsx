import React, { useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Plus, Search, Map as MapIcon, LayoutGrid, Globe2 } from "lucide-react";

import { LocationsGlobalMap } from "./LocationsGlobalMap";
import { useLocationsData } from "../hooks/useLocationsData";
import { useBodyScrollLock } from "@/shared/lib/dom/useBodyScrollLock";
import { ConfirmModal } from "@/shared/ui/composites/ConfirmModal";
import { Button } from "@/shared/ui/primitives/Button";
import { Input } from "@/shared/ui/primitives/Input";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { LocationCard } from "./LocationCard";
import LocationInlineEditor from "./LocationInlineEditor";
import { Heading, Text, Eyebrow, Caption } from "@/shared/ui/primitives/typography";
import type { LocationCategory } from "@/shared/types";

const FILTER_CATEGORIES: {
  value: LocationCategory | "";
  labelKey: string;
  fallback: string;
}[] = [
  { value: "", labelKey: "logistics.filters.all", fallback: "Wszystkie" },
  {
    value: "CONCERT_HALL",
    labelKey: "logistics.categories.concert_hall",
    fallback: "Sale Koncertowe",
  },
  {
    value: "REHEARSAL_ROOM",
    labelKey: "logistics.categories.rehearsal_room",
    fallback: "Sale Prób",
  },
  {
    value: "HOTEL",
    labelKey: "logistics.categories.hotel",
    fallback: "Hotele",
  },
  {
    value: "AIRPORT",
    labelKey: "logistics.categories.airport",
    fallback: "Lotniska",
  },
  {
    value: "TRANSIT_STATION",
    labelKey: "logistics.categories.transit",
    fallback: "Stacje",
  },
  {
    value: "WORKSPACE",
    labelKey: "logistics.categories.workspace",
    fallback: "Przestrzenie",
  },
  { value: "OTHER", labelKey: "logistics.categories.other", fallback: "Inne" },
];

export const LocationsManager = (): React.JSX.Element => {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = React.useState<"grid" | "map">("grid");

  const {
    isLoading,
    isError,
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
    isArchiving,
  } = useLocationsData();

  useEffect(() => {
    if (isError) {
      toast.error(
        t(
          "logistics.dashboard.sync_error",
          "Błąd synchronizacji lokacji z bazą.",
        ),
      );
    }
  }, [isError, t]);

  useBodyScrollLock(locationToArchive !== null);

  const toggleAddMode = () => {
    if (isPanelOpen && !editingLocation) {
      closePanel();
    } else {
      openPanel(null);
    }
  };

  // Architektura Smart Grouping - kategoryzacja wizualna
  const groupedLocations = useMemo(() => {
    const groups = {} as Record<string, typeof displayLocations>;

    // Inicjalizacja pustych tablic w ustalonej kolejności (aby zachować stały layout)
    FILTER_CATEGORIES.forEach((cat) => {
      if (cat.value) groups[cat.value] = [];
    });

    // Grupowanie lokacji do odpowiednich "wiaderek"
    displayLocations.forEach((loc) => {
      if (!groups[loc.category]) groups[loc.category] = [];
      groups[loc.category].push(loc);
    });

    // Odfiltrowujemy puste grupy (żeby nie rysować nagłówka z wynikiem 0)
    return Object.entries(groups).filter(([_, locs]) => locs.length > 0);
  }, [displayLocations]);

  return (
    <div className="space-y-6 animate-fade-in relative cursor-default pb-12 max-w-7xl mx-auto px-4 sm:px-0">
      <header className="relative pt-2 mb-8">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-5">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-glass-surface backdrop-blur-md border border-glass-border shadow-sm mb-4">
                <MapIcon size={12} className="text-ethereal-gold" />
                <Caption color="gold" weight="bold" className="uppercase tracking-widest antialiased">
                  {t("logistics.dashboard.subtitle", "Moduł Logistyczny")}
                </Caption>
              </div>
              <Heading as="h1" size="4xl" weight="medium" className="leading-tight tracking-tight">
                {t("logistics.dashboard.title_prefix", "Baza")}{" "}
                <Text as="span" color="gold" size="inherit" className="italic">
                  {t("logistics.dashboard.title_highlight", "Lokacji")}
                </Text>
                .
              </Heading>
            </div>

            <Button
              variant={
                isPanelOpen && !editingLocation ? "secondary" : "primary"
              }
              onClick={toggleAddMode}
              leftIcon={
                <Plus
                  size={16}
                  className={
                    isPanelOpen && !editingLocation
                      ? "rotate-45 transition-transform"
                      : "transition-transform"
                  }
                />
              }
            >
              {isPanelOpen && !editingLocation
                ? t("common.cancel", "Anuluj")
                : t("logistics.dashboard.add_location", "Dodaj Miejsce")}
            </Button>
          </div>
        </motion.div>
      </header>

      {/* PASEK AKCJI: Wyszukiwarka i Przełącznik Widoków */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6 items-center justify-between">
        <div className="w-full sm:max-w-md">
          <Input
            leftIcon={<Search size={16} />}
            type="text"
            placeholder={t(
              "logistics.dashboard.search_placeholder",
              "Szukaj lokacji po nazwie lub adresie...",
            )}
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>

        <div className="flex bg-ethereal-alabaster/50 p-1 rounded-xl border border-ethereal-incense/20 shrink-0">
          <button
            onClick={() => setViewMode("grid")}
            className={`p-2 rounded-lg transition-all flex items-center justify-center ${viewMode === "grid" ? "bg-white text-ethereal-gold shadow-sm font-bold" : "text-ethereal-graphite hover:text-ethereal-ink hover:bg-white/50"}`}
          >
            <LayoutGrid size={18} />
          </button>
          <button
            onClick={() => setViewMode("map")}
            className={`p-2 rounded-lg transition-all flex items-center justify-center ${viewMode === "map" ? "bg-white text-ethereal-gold shadow-sm font-bold" : "text-ethereal-graphite hover:text-ethereal-ink hover:bg-white/50"}`}
          >
            <Globe2 size={18} />
          </button>
        </div>
      </div>

      {/* LUKSUSOWE PRZYCISKI KATEGORII (Pills ze statystykami) */}
      <div
        className="flex items-center gap-3 overflow-x-auto pb-4 mb-4 w-full [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: "none" }}
      >
        {FILTER_CATEGORIES.map((cat) => {
          const count =
            cat.value === "" ? locations.length : categoryStats[cat.value] || 0;

          return (
            <button
              key={`filter-${cat.value}`}
              onClick={() => setCategoryFilter(cat.value)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold antialiased transition-all duration-300 border shrink-0 outline-none
                ${
                  categoryFilter === cat.value
                    ? "bg-ethereal-gold text-white border-ethereal-gold shadow-[0_8px_16px_rgba(194,168,120,0.2)]"
                    : "bg-white/60 text-ethereal-graphite border-ethereal-incense/20 hover:bg-white hover:border-ethereal-incense/40 hover:shadow-sm"
                }`}
            >
              {t(cat.labelKey, cat.fallback)}
              <span
                className={`px-2 py-0.5 rounded-md text-[10px] shadow-inner ${
                  categoryFilter === cat.value
                    ? "bg-white/20 text-white"
                    : "bg-ethereal-alabaster/80 text-ethereal-graphite border border-ethereal-incense/20"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {viewMode === "map" ? (
          <motion.div
            key="map-view"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-col gap-6"
          >
            <AnimatePresence mode="popLayout">
              {isPanelOpen && !editingLocation && (
                <LocationInlineEditor
                  key="new-location-editor"
                  location={null}
                  onClose={closePanel}
                />
              )}
            </AnimatePresence>
            <LocationsGlobalMap locations={displayLocations} />
          </motion.div>
        ) : (
          <motion.div
            key="grid-view"
            layout
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col gap-10" // Zamiana grid na kolumnę dla zgrupowanych sekcji
          >
            <AnimatePresence mode="popLayout">
              {/* Edytor tworzenia zawsze na samej górze */}
              {isPanelOpen && !editingLocation && (
                <LocationInlineEditor
                  key="new-location-editor"
                  location={null}
                  onClose={closePanel}
                />
              )}
            </AnimatePresence>

            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 w-full">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div
                    key={`skeleton-${index}`}
                    className="h-64 bg-stone-100/50 rounded-[2rem] border border-white/50 animate-pulse"
                  />
                ))}
              </div>
            ) : displayLocations.length > 0 ? (
              // RENDEROWANIE SMART GROUPING
              groupedLocations.map(([category, locs]) => (
                <div key={category} className="w-full relative">
                  {/* Nagłówek Sekcji */}
                  <div className="flex items-center gap-3 mb-5 border-b border-ethereal-incense/20 pb-3">
                    <Heading as="h2" size="xl" weight="bold" className="tracking-tight text-ethereal-ink">
                      {t(
                        `logistics.categories.${category.toLowerCase()}`,
                        category.replace("_", " "),
                      )}
                    </Heading>
                    <span className="px-2 py-0.5 rounded-md bg-ethereal-alabaster border border-ethereal-incense/20 text-ethereal-graphite text-[10px] font-bold">
                      {locs.length}
                    </span>
                  </div>

                  {/* Siatka dla konkretnej Kategorii */}
                  <motion.div
                    layout
                    className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"
                  >
                    <AnimatePresence mode="popLayout">
                      {locs.map((loc) => {
                        // Jeśli kliknięto "Edytuj", karta w tej grupie zamienia się na szeroki edytor
                        if (isPanelOpen && editingLocation?.id === loc.id) {
                          return (
                            <LocationInlineEditor
                              key={`edit-${loc.id}`}
                              location={loc}
                              onClose={closePanel}
                            />
                          );
                        }
                        // Standardowa karta
                        return (
                          <LocationCard
                            key={`card-${loc.id}`}
                            location={loc}
                            onEdit={openPanel}
                            onArchive={setLocationToArchive}
                          />
                        );
                      })}
                    </AnimatePresence>
                  </motion.div>
                </div>
              ))
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="col-span-full"
              >
                <GlassCard className="p-16 flex flex-col items-center justify-center text-center">
                  <MapIcon
                    size={48}
                    className="text-ethereal-incense mb-4 opacity-50"
                  />
                  <Caption color="muted" weight="bold" className="uppercase tracking-widest mb-2">
                    {t("logistics.dashboard.empty_title", "Brak wyników")}
                  </Caption>
                  <Text as="span" size="sm" color="graphite" className="max-w-sm">
                    {t(
                      "logistics.dashboard.empty_desc",
                      "Zmień filtry lub dodaj nowe miejsce korzystając z integracji Google Maps.",
                    )}
                  </Text>
                </GlassCard>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={!!locationToArchive}
        title={t("logistics.dashboard.archive_title", "Zarchiwizować lokację?")}
        description={t(
          "logistics.dashboard.archive_desc",
          "Lokacja zniknie z głównej bazy operacyjnej, ale zostanie zachowana dla projektów historycznych.",
        )}
        onConfirm={executeArchive}
        onCancel={() => setLocationToArchive(null)}
        isLoading={isArchiving}
      />
    </div>
  );
};
