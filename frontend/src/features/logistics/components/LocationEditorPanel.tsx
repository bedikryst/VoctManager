/**
 * @file LocationEditorPanel.tsx
 * @description The editor that creates or updates a venue, on `SidePanel`.
 * Opened from the locations page and from `LocationPicker`, in the project and
 * rehearsal editors. The form runs on react-hook-form + Zod through
 * `useLocationForm`; closing with unsaved changes asks first.
 *
 * Three sections under sans sub-headings, on the panel's own ground: the map
 * first, because the place search fills the fields below it, then the venue's
 * name and address, then the team's notes.
 * @module features/logistics/components/LocationEditorPanel
 */

import React, { useCallback, useId, useState } from "react";
import { Controller } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Compass, MapPin } from "lucide-react";

import { ConfirmModal } from "@/shared/ui/composites/ConfirmModal";
import { SidePanel } from "@/shared/ui/composites/SidePanel";
import { Button } from "@/shared/ui/primitives/Button";
import { Input } from "@/shared/ui/primitives/Input";
import { Select } from "@/shared/ui/primitives/Select";
import { Textarea } from "@/shared/ui/primitives/Textarea";
import { Text } from "@/shared/ui/primitives/typography";

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

/** One of the form's sections, under a sans sub-heading, with no card. */
const VenueFormSection = ({
  heading,
  className,
  children,
}: {
  heading: string;
  className?: string;
  children: React.ReactNode;
}): React.JSX.Element => {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className={className}>
      <Text as="h3" id={headingId} size="base" weight="semibold" className="mb-3">
        {heading}
      </Text>
      {children}
    </section>
  );
};

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
  const { errors } = form.formState;

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

  /** The schema's messages are i18n keys. */
  const errorText = (message: unknown): string | undefined =>
    typeof message === "string" && message.trim().length > 0 ? t(message) : undefined;

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
          ? t("logistics.editor.title_new", "Nowe miejsce")
          : t("logistics.editor.title_edit", "Edytuj miejsce")
      }
      footer={
        <Button
          type="submit"
          form={formId}
          variant="primary"
          casing="sentence"
          disabled={isSubmitting}
          isLoading={isSubmitting}
          fullWidth
        >
          {isNewEntry
            ? t("logistics.editor.submit", "Dodaj miejsce")
            : t("logistics.editor.save", "Zapisz")}
        </Button>
      }
    >
      <form id={formId} onSubmit={onSubmit} className="space-y-9">
        <VenueFormSection
          heading={
            isNewEntry
              ? t("logistics.editor.section_search", "Globalna baza Google")
              : t("logistics.editor.section_position", "Pozycja na mapie")
          }
        >
          <LocationMapPicker
            onLocationSelect={handleGooglePlaceSelect}
            initialPosition={initialPickerPosition}
            initialName={location?.name}
            initialAddress={location?.formatted_address}
            initialQuery={isNewEntry ? initialQuery : undefined}
          />
        </VenueFormSection>

        <VenueFormSection
          heading={t("logistics.editor.section_basic", "Dane podstawowe")}
          className="space-y-5"
        >
          {/* No "chosen category" preview under it: the select prints the
              same label two rows higher. */}
          <Controller
            control={form.control}
            name="category"
            render={({ field }) => (
              <Select
                label={t("logistics.editor.category", "Rodzaj miejsca")}
                leftIcon={<Compass size={16} aria-hidden="true" />}
                name={field.name}
                value={field.value ?? ""}
                onValueChange={field.onChange}
                disabled={isSubmitting}
                options={categoryOptions}
                error={errorText(errors.category?.message)}
              />
            )}
          />

          <Input
            label={t("logistics.editor.name", "Nazwa")}
            type="text"
            {...form.register("name")}
            disabled={isSubmitting}
            placeholder={t(
              "logistics.editor.placeholder_name",
              "np. Filharmonia Narodowa — Sala Kameralna",
            )}
            error={errorText(errors.name?.message)}
          />

          <Input
            label={t("logistics.editor.address", "Adres")}
            type="text"
            leftIcon={<MapPin size={16} aria-hidden="true" />}
            {...form.register("formatted_address")}
            disabled={isSubmitting}
            placeholder={t(
              "logistics.editor.placeholder_address",
              "np. ul. Jasna 5, 00-013 Warszawa",
            )}
            error={errorText(errors.formatted_address?.message)}
          />
        </VenueFormSection>

        <VenueFormSection heading={t("logistics.editor.section_notes", "Instrukcje wewnętrzne")}>
          <Textarea
            label={t("logistics.editor.internal_notes", "Notatki dla zespołu")}
            rows={5}
            {...form.register("internal_notes")}
            disabled={isSubmitting}
            placeholder={t(
              "logistics.editor.notes_placeholder",
              "np. Wejście dla artystów od strony parkingu. Kod do bramy: 1234#.",
            )}
            error={errorText(errors.internal_notes?.message)}
          />
          <Text as="p" size="xs" color="muted" className="ml-1 mt-2">
            {t(
              "logistics.editor.notes_hint",
              "Widzi je tylko zespół, w karcie miejsca.",
            )}
          </Text>
        </VenueFormSection>
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
