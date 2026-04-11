import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Plus, Search, Filter, Map, LayoutGrid } from "lucide-react";

import { useLocationsData } from "../hooks/useLocationsData";
import { useBodyScrollLock } from "../../../shared/lib/hooks/useBodyScrollLock";
import ConfirmModal from "../../../shared/ui/ConfirmModal";
import { Button } from "../../../shared/ui/Button";
import { Input } from "../../../shared/ui/Input";
import { GlassCard } from "../../../shared/ui/GlassCard";
import { LocationCard } from "./LocationCard";
import LocationInlineEditor from "./LocationInlineEditor"; // Używamy Inline Editora

export const LocationsManager = (): React.JSX.Element => {
  const { t } = useTranslation();
  const {
    isLoading,
    isError,
    displayLocations,
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

  // Blokujemy tło tylko przy próbie usunięcia (Modal). Edytor jest teraz inline!
  useBodyScrollLock(locationToArchive !== null);

  const toggleAddMode = () => {
    if (isPanelOpen && !editingLocation) {
      closePanel(); // Jeśli dodawanie jest już otwarte, zamknij
    } else {
      openPanel(null); // Otwórz formularz dodawania
    }
  };

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
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/80 backdrop-blur-md border border-white/60 shadow-sm mb-4">
                <Map size={12} className="text-[#002395]" />
                <p className="text-[9px] uppercase tracking-widest font-bold antialiased text-[#002395]/80">
                  {t("logistics.dashboard.subtitle", "Moduł Logistyczny")}
                </p>
              </div>
              <h1
                className="text-3xl md:text-4xl font-medium text-stone-900 leading-tight tracking-tight"
                style={{ fontFamily: "'Cormorant', serif" }}
              >
                {t("logistics.dashboard.title_prefix", "Baza")}{" "}
                <span className="italic text-[#002395]">
                  {t("logistics.dashboard.title_highlight", "Lokacji")}
                </span>
                .
              </h1>
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

      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        <div className="flex-1">
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
        <div className="relative w-full sm:w-72 flex-shrink-0">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Filter size={16} className="text-stone-400" />
          </div>
          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value as any)}
            className="w-full pl-11 pr-4 py-3 text-sm text-stone-800 bg-white/50 backdrop-blur-sm border border-stone-200/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#002395]/20 focus:border-[#002395]/40 transition-all font-bold appearance-none cursor-pointer"
          >
            <option value="">
              {t("logistics.filters.all", "Wszystkie kategorie")}
            </option>
            <option value="CONCERT_HALL">
              {t("logistics.categories.concert_hall", "Sale Koncertowe")}
            </option>
            <option value="REHEARSAL_ROOM">
              {t("logistics.categories.rehearsal_room", "Sale Prób")}
            </option>
            <option value="HOTEL">
              {t("logistics.categories.hotel", "Hotele")}
            </option>
            <option value="AIRPORT">
              {t("logistics.categories.airport", "Lotniska")}
            </option>
          </select>
        </div>
      </div>

      <motion.div
        layout
        className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"
      >
        {/* === Zjazd Edytora z góry dla akcji DODAJ NOWE === */}
        <AnimatePresence mode="popLayout">
          {isPanelOpen && !editingLocation && (
            <LocationInlineEditor
              key="new-location-editor"
              location={null}
              onClose={closePanel}
            />
          )}
        </AnimatePresence>

        {isLoading ? (
          Array.from({ length: 6 }).map((_, index) => (
            <div
              key={`skeleton-${index}`}
              className="h-64 bg-stone-100/50 rounded-[2rem] border border-white/50 animate-pulse"
            />
          ))
        ) : displayLocations.length > 0 ? (
          <AnimatePresence mode="popLayout">
            {displayLocations.map((loc) => {
              // === Zmiana karty w Edytor dla akcji EDYTUJ ISTNIEJĄCE ===
              if (isPanelOpen && editingLocation?.id === loc.id) {
                return (
                  <LocationInlineEditor
                    key={`edit-${loc.id}`}
                    location={loc}
                    onClose={closePanel}
                  />
                );
              }

              // Standardowa Karta Lokacji
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
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="col-span-full"
          >
            <GlassCard className="p-16 flex flex-col items-center justify-center text-center">
              <LayoutGrid
                size={48}
                className="text-stone-300 mb-4 opacity-50"
              />
              <span className="text-[11px] font-bold antialiased uppercase tracking-widest text-stone-500 mb-2">
                {t("logistics.dashboard.empty_title", "Brak wyników")}
              </span>
              <span className="text-xs text-stone-400 max-w-sm">
                {t(
                  "logistics.dashboard.empty_desc",
                  "Zmień filtry lub dodaj nowe miejsce korzystając z integracji Google Maps.",
                )}
              </span>
            </GlassCard>
          </motion.div>
        )}
      </motion.div>

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
