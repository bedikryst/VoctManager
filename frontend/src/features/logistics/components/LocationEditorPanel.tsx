/**
 * @file LocationEditorPanel.tsx
 * @description The editor that creates or updates a venue, on `SidePanel`.
 * Opened from the locations page and from `LocationPicker`, in the project and
 * rehearsal editors. The form runs on react-hook-form + Zod through
 * `useLocationForm`; closing with unsaved changes asks first.
 * @module features/logistics/components/LocationEditorPanel
 */

import React, { useCallback, useId, useState } from "react";
import { Controller } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Compass, Globe2, MapPin, StickyNote } from "lucide-react";

import { ConfirmModal } from "@/shared/ui/composites/ConfirmModal";
import { SidePanel } from "@/shared/ui/composites/SidePanel";
import { Button } from "@/shared/ui/primitives/Button";
import { Divider } from "@/shared/ui/primitives/Divider";
import { Input } from "@/shared/ui/primitives/Input";
import { Select } from "@/shared/ui/primitives/Select";
import { Textarea } from "@/shared/ui/primitives/Textarea";
import { Eyebrow, Text } from "@/shared/ui/primitives/typography";

import { getLocationCategoryOptions } from "../constants/locationCategories";
import { useLocationForm } from "../hooks/useLocationForm";
import type { LocationDto } from "../types/logistics.dto";

import { LocationMapPicker } from "./LocationMapPicker";

interface LocationEditorPanelProps {
  isOpen: boolean;
  onClose: () => void;
  location: LocationDto | null;
  /** Fires with the new venue when this opened to fill a field elsewhere. */
  onCreated?: (created: LocationDto) => void;
  /** Words to start the place search with, for a new venue. */
  initialQuery?: string;
}

const getValidationMessage = (message: unknown): string | null =>
  typeof message === "string" && message.trim().length > 0 ? message : null;

export function LocationEditorPanel({
  isOpen,
  onClose,
  location,
  onCreated,
  initialQuery,
}: LocationEditorPanelProps): React.JSX.Element {
  const { t } = useTranslation();
  const formId = useId();
  const [showExitConfirm, setShowExitConfirm] = useState<boolean>(false);

  const { form, handleGooglePlaceSelect, isDirty, isSubmitting, onSubmit } =
    useLocationForm(location, isOpen, onClose, onCreated);

  const handleCloseRequest = useCallback(() => {
    if (isDirty) {
      setShowExitConfirm(true);
      return;
    }
    onClose();
  }, [isDirty, onClose]);

  const forceClose = (): void => {
    setShowExitConfirm(false);
    onClose();
  };

  const categoryOptions = getLocationCategoryOptions(t);
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

  return (
    <SidePanel
      isOpen={isOpen}
      onCloseRequest={handleCloseRequest}
      size="xl"
      // No record id under the title: a UUID is something the database
      // needs, not the producer editing a venue.
      title={
        isNewEntry
          ? t("logistics.editor.title_new", "Nowa lokacja")
          : t("logistics.editor.title_edit", "Edycja lokacji")
      }
      footer={
        <Button
          type="submit"
          form={formId}
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
      }
    >
      <form
        id={formId}
        onSubmit={onSubmit}
        className="flex min-h-full flex-col gap-7 rounded-surface border border-ethereal-incense/15 bg-ethereal-marble/65 p-6 shadow-[inset_0_1px_0_var(--glass-highlight)] md:p-8"
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

          <div className="rounded-nested border border-ethereal-gold/20 bg-ethereal-gold/5 p-5">
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
              initialQuery={isNewEntry ? initialQuery : undefined}
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

          {/* No "chosen category" preview under it: the select prints
              the same label two rows higher. */}
          <Controller
            control={form.control}
            name="category"
            render={({ field }) => (
              <Select
                label={t("logistics.editor.category", "Klasyfikacja *")}
                leftIcon={<Compass size={16} aria-hidden="true" />}
                name={field.name}
                value={field.value ?? ""}
                onValueChange={field.onChange}
                disabled={isSubmitting}
                options={categoryOptions}
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
              />
            )}
          />

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

          <div className="flex items-start gap-2 rounded-nested border border-ethereal-incense/15 bg-ethereal-alabaster/60 px-4 py-3">
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
      </form>

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
    </SidePanel>
  );
}
