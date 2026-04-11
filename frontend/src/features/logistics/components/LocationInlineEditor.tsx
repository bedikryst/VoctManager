/**
 * @file LocationInlineEditor.tsx
 * @description Inline expandable editor for logistics locations.
 * Spans full width of the grid, pushing other items smoothly.
 * @module features/logistics/components/LocationInlineEditor
 */

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { X, CheckCircle2, MapPin, Globe, Loader2 } from "lucide-react";

import ConfirmModal from "../../../shared/ui/ConfirmModal";
import { Button } from "../../../shared/ui/Button";
import { Input } from "../../../shared/ui/Input";
import type { LocationDto } from "../types/logistics.dto";
import type { LocationCategory } from "../../../shared/types";
import { useLocationForm } from "../hooks/useLocationForm";
import { LocationMapPicker } from "./LocationMapPicker";
import { LocationAutocomplete } from "./LocationAutocomplete";

interface LocationInlineEditorProps {
  location: LocationDto | null;
  onClose: () => void;
}

const STYLE_LABEL =
  "block text-[10px] font-bold antialiased uppercase tracking-widest text-stone-500 mb-2 ml-1";
const STYLE_SELECT =
  "w-full px-4 py-3 text-sm text-stone-800 bg-white/50 backdrop-blur-sm border border-stone-200/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#002395]/20 focus:border-[#002395]/40 transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]";

export default function LocationInlineEditor({
  location,
  onClose,
}: LocationInlineEditorProps): React.JSX.Element {
  const { t } = useTranslation();
  const [showExitConfirm, setShowExitConfirm] = useState<boolean>(false);

  const {
    formData,
    handleDraftChange,
    handleGooglePlaceSelect,
    isFormDirty,
    isSubmitting,
    handleSubmit,
  } = useLocationForm(location, onClose);

  const handleCloseRequest = () => {
    if (isFormDirty) {
      setShowExitConfirm(true);
    } else {
      onClose();
    }
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !showExitConfirm) handleCloseRequest();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showExitConfirm, handleCloseRequest]);

  const forceClose = () => {
    setShowExitConfirm(false);
    onClose();
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, height: 0, scale: 0.98 }}
      animate={{ opacity: 1, height: "auto", scale: 1 }}
      exit={{ opacity: 0, height: 0, scale: 0.98 }}
      transition={{ type: "spring", stiffness: 200, damping: 25 }}
      className="col-span-full overflow-hidden"
    >
      <div className="bg-white/80 backdrop-blur-2xl border border-[#002395]/20 rounded-3xl shadow-[0_20px_40px_rgba(0,35,149,0.08)] relative my-2 overflow-hidden">
        {/* Luksusowy akcent dekoracyjny */}
        <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-[#002395] to-sky-400" />

        <div className="flex justify-between items-center p-6 md:p-8 border-b border-stone-200/50 bg-white/40">
          <div>
            <h3 className="font-serif text-3xl font-bold text-stone-900 tracking-tight">
              {location?.id
                ? t("logistics.editor.title_edit", "Edycja Lokacji")
                : t("logistics.editor.title_new", "Nowa Lokacja")}
            </h3>
            {location?.id && (
              <p className="text-xs text-stone-500 mt-1 font-mono">
                {location.id}
              </p>
            )}
          </div>
          <button
            onClick={handleCloseRequest}
            className="text-stone-400 hover:text-stone-900 bg-white hover:bg-stone-100 border border-stone-200/60 shadow-sm transition-all p-2.5 rounded-2xl active:scale-95"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 md:p-8">
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Integracja Google Maps dla nowych miejsc */}
            {!location?.id && (
              <div className="space-y-5 bg-[#002395]/5 p-6 rounded-2xl border border-[#002395]/10 shadow-[inset_0_1px_2px_rgba(255,255,255,0.5)]">
                <div className="flex items-center gap-2 mb-2">
                  <Globe size={18} className="text-[#002395]" />
                  <h4 className="text-[11px] font-bold antialiased uppercase tracking-[0.15em] text-[#002395]">
                    {t(
                      "logistics.editor.section_search",
                      "Globalna Baza Google",
                    )}
                  </h4>
                </div>
                <p className="text-xs text-stone-600 mb-4 max-w-2xl">
                  {t(
                    "logistics.editor.search_hint",
                    "Wyszukaj miejsce na mapie, aby automatycznie uzupełnić dane, koordynaty i strefę czasową. Pozwoli to na inteligentne zarządzanie czasem w projektach.",
                  )}
                </p>
                <LocationMapPicker onLocationSelect={handleGooglePlaceSelect} />
              </div>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
              {/* Kolumna 1: Podstawowe */}
              <div className="space-y-6">
                <h4 className="text-[10px] font-bold antialiased uppercase tracking-[0.15em] text-[#002395] border-b border-stone-200/60 pb-2">
                  {t("logistics.editor.section_basic", "Dane Podstawowe")}
                </h4>

                <div>
                  <label className={STYLE_LABEL}>
                    {t("logistics.editor.category", "Klasyfikacja *")}
                  </label>
                  <select
                    value={formData.category}
                    onChange={(event) =>
                      handleDraftChange(
                        "category",
                        event.target.value as LocationCategory,
                      )
                    }
                    className={`${STYLE_SELECT} font-bold appearance-none`}
                    disabled={isSubmitting}
                  >
                    <option value="CONCERT_HALL">
                      {t(
                        "logistics.categories.concert_hall",
                        "Sala Koncertowa",
                      )}
                    </option>
                    <option value="REHEARSAL_ROOM">
                      {t("logistics.categories.rehearsal_room", "Sala Prób")}
                    </option>
                    <option value="HOTEL">
                      {t("logistics.categories.hotel", "Hotel")}
                    </option>
                    <option value="AIRPORT">
                      {t("logistics.categories.airport", "Lotnisko")}
                    </option>
                    <option value="TRANSIT_STATION">
                      {t("logistics.categories.transit", "Stacja / Dworzec")}
                    </option>
                    <option value="WORKSPACE">
                      {t(
                        "logistics.categories.workspace",
                        "Prywatna Przestrzeń",
                      )}
                    </option>
                    <option value="OTHER">
                      {t("logistics.categories.other", "Inne")}
                    </option>
                  </select>
                </div>

                <div>
                  <label className={STYLE_LABEL}>
                    {t("logistics.editor.name", "Nazwa Wyświetlana *")}
                  </label>
                  <Input
                    type="text"
                    required
                    value={formData.name || ""}
                    onChange={(event) =>
                      handleDraftChange("name", event.target.value)
                    }
                    disabled={isSubmitting}
                    className="font-bold"
                    placeholder="np. Filharmonia Narodowa - Sala Kameralna"
                  />
                </div>

                <div>
                  <label className={STYLE_LABEL}>
                    {t("logistics.editor.address", "Oficjalny Adres *")}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-stone-400">
                      <MapPin size={16} />
                    </div>
                    <input
                      type="text"
                      required
                      value={formData.formatted_address || ""}
                      onChange={(event) =>
                        handleDraftChange(
                          "formatted_address",
                          event.target.value,
                        )
                      }
                      disabled={isSubmitting}
                      className="w-full pl-10 pr-4 py-3 bg-white/50 border border-stone-200/60 rounded-xl text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#002395]/20 focus:border-[#002395]/40 transition-all text-sm font-medium"
                      placeholder="np. ul. Jasna 5, 00-013 Warszawa"
                    />
                  </div>
                </div>
              </div>

              {/* Kolumna 2: Logistyka Wewnętrzna */}
              <div className="space-y-6">
                <h4 className="text-[10px] font-bold antialiased uppercase tracking-[0.15em] text-[#002395] border-b border-stone-200/60 pb-2">
                  {t("logistics.editor.section_notes", "Instrukcje Wewnętrzne")}
                </h4>

                <div className="h-full flex flex-col">
                  <label className={STYLE_LABEL}>
                    {t(
                      "logistics.editor.internal_notes",
                      "Notatki dla Zespołu (Opcjonalnie)",
                    )}
                  </label>
                  <textarea
                    value={formData.internal_notes || ""}
                    onChange={(event) =>
                      handleDraftChange("internal_notes", event.target.value)
                    }
                    className="flex-1 w-full px-4 py-4 text-sm text-stone-800 bg-white/50 backdrop-blur-sm border border-stone-200/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#002395]/20 focus:border-[#002395]/40 transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)] min-h-[160px] resize-y"
                    placeholder={t(
                      "logistics.editor.notes_placeholder",
                      "np. Wejście dla artystów znajduje się od strony parkingu. Kod do bramy: 1234#.",
                    )}
                    disabled={isSubmitting}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end items-center gap-4 pt-8 mt-4 border-t border-stone-200/60">
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseRequest}
                disabled={isSubmitting}
              >
                {t("common.cancel", "Anuluj")}
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={
                  isSubmitting || !formData.name || !formData.formatted_address
                }
                isLoading={isSubmitting}
                leftIcon={
                  !isSubmitting ? <CheckCircle2 size={16} /> : undefined
                }
                className="px-8"
              >
                {location?.id
                  ? t("common.save_changes", "Zapisz Zmiany")
                  : t("logistics.editor.submit", "Dodaj do Bazy")}
              </Button>
            </div>
          </form>
        </div>
      </div>

      <ConfirmModal
        isOpen={showExitConfirm}
        title={t("common.unsaved_title", "Masz niezapisane zmiany!")}
        description={t(
          "common.unsaved_desc",
          "Wprowadziłeś zmiany w formularzu, które nie zostały zapisane. Zamknięcie edytora spowoduje ich utratę.",
        )}
        onConfirm={forceClose}
        onCancel={() => setShowExitConfirm(false)}
      />
    </motion.div>
  );
}
