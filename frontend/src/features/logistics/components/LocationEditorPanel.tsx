/**
 * @file LocationEditorPanel.tsx
 * @description Slide-over editor for creating or updating a logistics location.
 * Built on Ethereal primitives (Input, Select, Textarea, Heading, Eyebrow), the
 * shared EditorActionBar, and a portal-managed motion shell. Re-uses the proven
 * react-hook-form + Zod pipeline exposed by `useLocationForm`.
 * @architecture Enterprise SaaS 2026
 * @module features/logistics/components/LocationEditorPanel
 */

import React, { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Compass, Globe2, MapPin, StickyNote, X } from "lucide-react";

import { ConfirmModal } from "@/shared/ui/composites/ConfirmModal";
import { Button } from "@/shared/ui/primitives/Button";
import { Divider } from "@/shared/ui/primitives/Divider";
import { Input } from "@/shared/ui/primitives/Input";
import { Select } from "@/shared/ui/primitives/Select";
import { Textarea } from "@/shared/ui/primitives/Textarea";
import {
  Eyebrow,
  Heading,
  Text,
} from "@/shared/ui/primitives/typography";

import { getLocationCategoryOptions } from "../constants/locationCategories";
import { useLocationForm } from "../hooks/useLocationForm";
import type { LocationDto } from "../types/logistics.dto";

import { LocationCategoryBadge } from "./LocationCategoryBadge";
import { LocationMapPicker } from "./LocationMapPicker";

interface LocationEditorPanelProps {
  isOpen: boolean;
  onClose: () => void;
  location: LocationDto | null;
}

const FORM_ID = "logistics-location-editor-form";

const getValidationMessage = (message: unknown): string | null =>
  typeof message === "string" && message.trim().length > 0 ? message : null;

export function LocationEditorPanel({
  isOpen,
  onClose,
  location,
}: LocationEditorPanelProps): React.ReactPortal | null {
  const { t } = useTranslation();
  const [showExitConfirm, setShowExitConfirm] = useState<boolean>(false);
  const [mounted, setMounted] = useState<boolean>(false);

  const { form, handleGooglePlaceSelect, isDirty, isSubmitting, onSubmit } =
    useLocationForm(location, isOpen, onClose);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleCloseRequest = useCallback(() => {
    if (isDirty) {
      setShowExitConfirm(true);
      return;
    }
    onClose();
  }, [isDirty, onClose]);

  useEffect(() => {
    if (!isOpen || showExitConfirm) return;
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") handleCloseRequest();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleCloseRequest, isOpen, showExitConfirm]);

  const forceClose = (): void => {
    setShowExitConfirm(false);
    onClose();
  };

  const categoryOptions = getLocationCategoryOptions(t);
  const watchedCategory = form.watch("category");
  const isNewEntry = !location?.id;

  const initialPickerPosition =
    location?.latitude !== undefined &&
    location?.latitude !== null &&
    location?.longitude !== undefined &&
    location?.longitude !== null
      ? {
          lat: Number(location.latitude),
          lng: Number(location.longitude),
        }
      : undefined;

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <React.Fragment key="location-panel-wrapper">
          <motion.div
            key="location-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleCloseRequest}
            className="fixed inset-0 z-focus-trap bg-ethereal-ink/35 backdrop-blur-sm"
            aria-hidden="true"
          />

          <motion.div
            key="location-panel"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 26, stiffness: 220 }}
            className="fixed inset-y-0 right-0 z-focus-trap flex w-full max-w-2xl flex-col border-l border-ethereal-incense/20 bg-ethereal-alabaster/95 shadow-glass-solid backdrop-blur-xl"
            role="dialog"
            aria-modal="true"
          >
            <header className="flex flex-shrink-0 items-center justify-between gap-4 border-b border-ethereal-incense/15 bg-ethereal-marble/60 px-6 py-5 backdrop-blur-xl md:px-8">
              <div className="min-w-0 space-y-1.5">
                <Eyebrow color="muted">
                  {t("logistics.editor.eyebrow", "Profil lokacji")}
                </Eyebrow>
                <Heading as="h3" size="2xl" truncate>
                  {isNewEntry
                    ? t("logistics.editor.title_new", "Nowa lokacja")
                    : t("logistics.editor.title_edit", "Edycja lokacji")}
                </Heading>
                {!isNewEntry && location?.id && (
                  <Text
                    as="p"
                    size="xs"
                    color="muted"
                    className="font-mono"
                    truncate
                  >
                    {location.id}
                  </Text>
                )}
              </div>
              <button
                type="button"
                onClick={handleCloseRequest}
                aria-label={t("logistics.editor.close_aria", "Zamknij panel")}
                className="rounded-xl border border-ethereal-incense/20 bg-ethereal-marble/70 p-2.5 text-ethereal-graphite shadow-sm transition-all duration-300 hover:border-ethereal-gold/40 hover:text-ethereal-ink active:scale-95"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </header>

            <div className="relative flex-1 overflow-y-auto overflow-x-hidden px-6 py-6 md:px-8 md:py-8">
              <form
                id={FORM_ID}
                onSubmit={onSubmit}
                className="flex min-h-full flex-col gap-7 rounded-3xl border border-ethereal-incense/15 bg-ethereal-marble/65 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] backdrop-blur-xl md:p-8"
              >
                <section className="space-y-5">
                  <div className="flex items-center gap-3">
                    <Eyebrow color="gold">
                      {isNewEntry
                        ? t(
                            "logistics.editor.section_search",
                            "Globalna baza Google",
                          )
                        : t(
                            "logistics.editor.section_position",
                            "Pozycja na mapie",
                          )}
                    </Eyebrow>
                    <Divider variant="gradient-right" />
                  </div>

                  <div className="rounded-2xl border border-ethereal-gold/20 bg-ethereal-gold/5 p-5">
                    <div className="mb-4 flex items-center gap-2 text-ethereal-gold">
                      <Globe2 size={14} strokeWidth={1.6} aria-hidden="true" />
                      <Text size="xs" color="graphite" className="max-w-md">
                        {isNewEntry
                          ? t(
                              "logistics.editor.search_hint",
                              "Wyszukaj miejsce, aby automatycznie uzupełnić dane, koordynaty i strefę czasową — kluczowe dla inteligentnego planowania.",
                            )
                          : t(
                              "logistics.editor.position_hint",
                              "Przeciągnij pinezkę lub kliknij na mapie, aby skorygować dokładną pozycję i adres tej lokacji.",
                            )}
                      </Text>
                    </div>
                    <LocationMapPicker
                      onLocationSelect={handleGooglePlaceSelect}
                      initialPosition={initialPickerPosition}
                      initialName={location?.name}
                      initialAddress={location?.formatted_address}
                    />
                  </div>
                </section>

                <section className="space-y-5">
                  <div className="flex items-center gap-3">
                    <Eyebrow color="gold">
                      {t("logistics.editor.section_basic", "Dane podstawowe")}
                    </Eyebrow>
                    <Divider variant="gradient-right" />
                  </div>

                  <Select
                    label={t("logistics.editor.category", "Klasyfikacja *")}
                    leftIcon={<Compass size={16} aria-hidden="true" />}
                    {...form.register("category")}
                    disabled={isSubmitting}
                    error={
                      getValidationMessage(
                        form.formState.errors.category?.message,
                      )
                        ? t(
                            getValidationMessage(
                              form.formState.errors.category?.message,
                            ) ?? "",
                          )
                        : undefined
                    }
                  >
                    {categoryOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>

                  <div className="flex items-center justify-between gap-3 rounded-2xl border border-ethereal-incense/15 bg-ethereal-alabaster/60 px-4 py-3">
                    <Text size="xs" color="graphite">
                      {t(
                        "logistics.editor.category_preview",
                        "Wybrana kategoria",
                      )}
                    </Text>
                    <LocationCategoryBadge
                      category={watchedCategory}
                      size="sm"
                    />
                  </div>

                  <Input
                    label={t("logistics.editor.name", "Nazwa wyświetlana *")}
                    type="text"
                    {...form.register("name")}
                    disabled={isSubmitting}
                    placeholder={t(
                      "logistics.editor.placeholder_name",
                      "np. Filharmonia Narodowa — Sala Kameralna",
                    )}
                    error={
                      getValidationMessage(form.formState.errors.name?.message)
                        ? t(
                            getValidationMessage(
                              form.formState.errors.name?.message,
                            ) ?? "",
                          )
                        : undefined
                    }
                  />

                  <Input
                    label={t("logistics.editor.address", "Oficjalny adres *")}
                    type="text"
                    leftIcon={<MapPin size={16} aria-hidden="true" />}
                    {...form.register("formatted_address")}
                    disabled={isSubmitting}
                    placeholder={t(
                      "logistics.editor.placeholder_address",
                      "np. ul. Jasna 5, 00-013 Warszawa",
                    )}
                    error={
                      getValidationMessage(
                        form.formState.errors.formatted_address?.message,
                      )
                        ? t(
                            getValidationMessage(
                              form.formState.errors.formatted_address?.message,
                            ) ?? "",
                          )
                        : undefined
                    }
                  />
                </section>

                <section className="space-y-5">
                  <div className="flex items-center gap-3">
                    <Eyebrow color="gold">
                      {t(
                        "logistics.editor.section_notes",
                        "Instrukcje wewnętrzne",
                      )}
                    </Eyebrow>
                    <Divider variant="gradient-right" />
                  </div>

                  <Textarea
                    label={t(
                      "logistics.editor.internal_notes",
                      "Notatki dla zespołu (opcjonalnie)",
                    )}
                    rows={5}
                    {...form.register("internal_notes")}
                    disabled={isSubmitting}
                    placeholder={t(
                      "logistics.editor.notes_placeholder",
                      "np. Wejście dla artystów od strony parkingu. Kod do bramy: 1234#.",
                    )}
                    error={
                      getValidationMessage(
                        form.formState.errors.internal_notes?.message,
                      )
                        ? t(
                            getValidationMessage(
                              form.formState.errors.internal_notes?.message,
                            ) ?? "",
                          )
                        : undefined
                    }
                  />

                  <div className="flex items-start gap-2 rounded-2xl border border-ethereal-incense/15 bg-ethereal-alabaster/60 px-4 py-3">
                    <StickyNote
                      size={13}
                      strokeWidth={1.6}
                      className="mt-0.5 shrink-0 text-ethereal-incense"
                      aria-hidden="true"
                    />
                    <Text size="xs" color="graphite">
                      {t(
                        "logistics.editor.notes_hint",
                        "Pojawiają się jako wewnętrzny szept zespołu w karcie lokacji — niewidoczne na zewnątrz.",
                      )}
                    </Text>
                  </div>
                </section>

                <div className="sticky bottom-0 -mx-6 -mb-6 mt-auto rounded-b-3xl border-t border-ethereal-ink/8 bg-ethereal-alabaster/90 p-4 shadow-[0_-10px_30px_rgba(22,20,18,0.05)] backdrop-blur-xl md:-mx-8 md:-mb-8 md:p-6">
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={isSubmitting}
                    isLoading={isSubmitting}
                    fullWidth
                    leftIcon={
                      !isSubmitting ? (
                        <CheckCircle2 size={16} aria-hidden="true" />
                      ) : undefined
                    }
                  >
                    {isNewEntry
                      ? t("logistics.editor.submit", "Dodaj do bazy")
                      : t("common.save_changes", "Zapisz zmiany")}
                  </Button>
                </div>
              </form>
            </div>
          </motion.div>

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
        </React.Fragment>
      )}
    </AnimatePresence>,
    document.body,
  );
}
