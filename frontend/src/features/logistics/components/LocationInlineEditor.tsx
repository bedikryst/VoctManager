/**
 * @file LocationInlineEditor.tsx
 * @description Inline expandable editor for logistics locations.
 * Spans full width of the grid, pushing other items smoothly.
 * Integrates React Hook Form and Zod validation schemas.
 * @module features/logistics/components/LocationInlineEditor
 */

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { X, CheckCircle2, MapPin, Globe } from "lucide-react";
import { cn } from "@/shared/lib/utils";

import { ConfirmModal } from "@/shared/ui/composites/ConfirmModal";
import { Button } from "@/shared/ui/primitives/Button";
import { Input } from "@/shared/ui/primitives/Input";
import type { LocationDto } from "../types/logistics.dto";
import { useLocationForm } from "../hooks/useLocationForm";
import { LocationMapPicker } from "./LocationMapPicker";

interface LocationInlineEditorProps {
  location: LocationDto | null;
  onClose: () => void;
}

const STYLE_LABEL =
  "block text-[10px] font-bold antialiased uppercase tracking-widest text-stone-500 mb-2 ml-1";
const STYLE_SELECT =
  "w-full px-4 py-3 text-sm text-stone-800 bg-white/50 backdrop-blur-sm border border-stone-200/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand/40 transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]";

export default function LocationInlineEditor({
  location,
  onClose,
}: LocationInlineEditorProps): React.JSX.Element {
  const { t } = useTranslation();
  const [showExitConfirm, setShowExitConfirm] = useState<boolean>(false);

  const { form, handleGooglePlaceSelect, isDirty, isSubmitting, onSubmit } =
    useLocationForm(location, onClose);

  const handleCloseRequest = () => {
    if (isDirty) {
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
  }, [showExitConfirm, isDirty]); // Added isDirty to dependencies

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
      <div className="bg-white/80 backdrop-blur-2xl border border-brand/20 rounded-3xl shadow-[0_20px_40px_rgba(0,35,149,0.08)] relative my-2 overflow-hidden">
        {/* Decorative accent */}
        <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-brand to-sky-400" />

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
            type="button"
            className="text-stone-400 hover:text-stone-900 bg-white hover:bg-stone-100 border border-stone-200/60 shadow-sm transition-all p-2.5 rounded-2xl active:scale-95"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 md:p-8">
          {/* Note the form.handleSubmit wrap around our onSubmit */}
          <form onSubmit={onSubmit} className="space-y-8">
            {/* Google Maps Integration for new entries */}
            {!location?.id && (
              <div className="space-y-5 bg-brand/5 p-6 rounded-2xl border border-brand/10 shadow-[inset_0_1px_2px_rgba(255,255,255,0.5)]">
                <div className="flex items-center gap-2 mb-2">
                  <Globe size={18} className="text-brand" />
                  <h4 className="text-[11px] font-bold antialiased uppercase tracking-[0.15em] text-brand">
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
              {/* Column 1: Basic Information */}
              <div className="space-y-6">
                <h4 className="text-[10px] font-bold antialiased uppercase tracking-[0.15em] text-brand border-b border-stone-200/60 pb-2">
                  {t("logistics.editor.section_basic", "Dane Podstawowe")}
                </h4>

                <div>
                  <label className={STYLE_LABEL}>
                    {t("logistics.editor.category", "Klasyfikacja *")}
                  </label>
                  <select
                    {...form.register("category")}
                    disabled={isSubmitting}
                    className={cn(
                      STYLE_SELECT,
                      "font-bold appearance-none",
                      form.formState.errors.category &&
                        "border-red-500 focus:ring-red-500/20 focus:border-red-500",
                    )}
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
                  {form.formState.errors.category && (
                    <p className="text-red-500 text-xs mt-1.5 ml-1">
                      {t(form.formState.errors.category.message as string)}
                    </p>
                  )}
                </div>

                <div>
                  <label className={STYLE_LABEL}>
                    {t("logistics.editor.name", "Nazwa Wyświetlana *")}
                  </label>
                  <Input
                    type="text"
                    {...form.register("name")}
                    disabled={isSubmitting}
                    className={cn(
                      "font-bold",
                      form.formState.errors.name &&
                        "border-red-500 focus:ring-red-500/20 focus:border-red-500",
                    )}
                    placeholder={t(
                      "logistics.editor.placeholder_name",
                      "np. Filharmonia Narodowa - Sala Kameralna",
                    )}
                  />
                  {form.formState.errors.name && (
                    <p className="text-red-500 text-xs mt-1.5 ml-1">
                      {t(form.formState.errors.name.message as string)}
                    </p>
                  )}
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
                      {...form.register("formatted_address")}
                      disabled={isSubmitting}
                      className={cn(
                        "w-full pl-10 pr-4 py-3 bg-white/50 border border-stone-200/60 rounded-xl text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand/40 transition-all text-sm font-medium",
                        form.formState.errors.formatted_address &&
                          "border-red-500 focus:ring-red-500/20 focus:border-red-500",
                      )}
                      placeholder={t(
                        "logistics.editor.placeholder_address",
                        "np. ul. Jasna 5, 00-013 Warszawa",
                      )}
                    />
                  </div>
                  {form.formState.errors.formatted_address && (
                    <p className="text-red-500 text-xs mt-1.5 ml-1">
                      {t(
                        form.formState.errors.formatted_address
                          .message as string,
                      )}
                    </p>
                  )}
                </div>
              </div>

              {/* Column 2: Internal Logistics */}
              <div className="space-y-6">
                <h4 className="text-[10px] font-bold antialiased uppercase tracking-[0.15em] text-brand border-b border-stone-200/60 pb-2">
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
                    {...form.register("internal_notes")}
                    disabled={isSubmitting}
                    className={cn(
                      "flex-1 w-full px-4 py-4 text-sm text-stone-800 bg-white/50 backdrop-blur-sm border border-stone-200/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand/40 transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)] min-h-[160px] resize-y",
                      form.formState.errors.internal_notes &&
                        "border-red-500 focus:ring-red-500/20 focus:border-red-500",
                    )}
                    placeholder={t(
                      "logistics.editor.notes_placeholder",
                      "np. Wejście dla artystów znajduje się od strony parkingu. Kod do bramy: 1234#.",
                    )}
                  />
                  {form.formState.errors.internal_notes && (
                    <p className="text-red-500 text-xs mt-1.5 ml-1">
                      {t(
                        form.formState.errors.internal_notes.message as string,
                      )}
                    </p>
                  )}
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
                disabled={isSubmitting}
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
