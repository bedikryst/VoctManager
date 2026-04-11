/**
 * @file useLocationForm.ts
 * @description Encapsulates complex form state, dirty tracking, and API payload construction for Locations.
 * @module features/logistics/hooks/useLocationForm
 */

import { useState, useMemo, useEffect } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useCreateLocation, useUpdateLocation } from "../api/logistics.queries";
import type {
  LocationDto,
  LocationCreateDto,
  LocationUpdateDto,
} from "../types/logistics.dto";
import type { LocationCategory } from "../../../shared/types";

export const useLocationForm = (
  location: LocationDto | null,
  onClose: () => void,
) => {
  const { t } = useTranslation();
  const createMutation = useCreateLocation();
  const updateMutation = useUpdateLocation();

  const initialFormData = useMemo<Partial<LocationCreateDto>>(() => {
    if (location) {
      return {
        name: location.name,
        category: location.category,
        formatted_address: location.formatted_address,
        google_place_id: location.google_place_id,
        latitude: location.latitude,
        longitude: location.longitude,
        internal_notes: location.internal_notes,
      };
    }
    return {
      name: "",
      category: "CONCERT_HALL" as LocationCategory,
      formatted_address: "",
      internal_notes: "",
    };
  }, [location]);

  const [formData, setFormData] =
    useState<Partial<LocationCreateDto>>(initialFormData);

  // Sync when editing an existing location
  useEffect(() => {
    setFormData(initialFormData);
  }, [initialFormData]);

  const cleanCoordinate = (
    val: number | string | undefined | null,
  ): number | null => {
    if (val === undefined || val === null || val === "") return null;
    const num = typeof val === "string" ? parseFloat(val) : val;
    return isNaN(num) ? null : parseFloat(num.toFixed(6));
  };

  const handleDraftChange = <K extends keyof LocationCreateDto>(
    field: K,
    value: LocationCreateDto[K],
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleGooglePlaceSelect = (placeData: Partial<LocationCreateDto>) => {
    setFormData((prev) => ({
      ...prev,
      ...placeData,
    }));
  };

  const isFormDirty = useMemo(() => {
    return JSON.stringify(formData) !== JSON.stringify(initialFormData);
  }, [formData, initialFormData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.formatted_address || !formData.category) {
      toast.error(t("common.errors.validation", "Uzupełnij wymagane pola."));
      return;
    }

    const toastId = toast.loading(
      location?.id
        ? t("logistics.toast.updating", "Aktualizacja danych lokacji...")
        : t("logistics.toast.creating", "Dodawanie nowej lokacji..."),
    );

    try {
      if (location?.id) {
        const updatePayload: LocationUpdateDto = {
          name: formData.name,
          category: formData.category as LocationCategory,
          formatted_address: formData.formatted_address,
          google_place_id: formData.google_place_id || null,
          latitude: cleanCoordinate(formData.latitude),
          longitude: cleanCoordinate(formData.longitude),
          internal_notes: formData.internal_notes || "",
          is_active: true,
        };
        await updateMutation.mutateAsync({
          id: location.id,
          data: updatePayload,
        });
        toast.success(
          t("logistics.toast.update_success", "Lokacja zaktualizowana!"),
          { id: toastId },
        );
      } else {
        const createPayload: LocationCreateDto = {
          name: formData.name,
          category: formData.category as LocationCategory,
          formatted_address: formData.formatted_address,
          google_place_id: formData.google_place_id || null,
          latitude: cleanCoordinate(formData.latitude),
          longitude: cleanCoordinate(formData.longitude),
          internal_notes: formData.internal_notes || "",
        };
        await createMutation.mutateAsync(createPayload);
        toast.success(
          t("logistics.toast.create_success", "Lokacja dodana do bazy!"),
          { id: toastId },
        );
      }

      onClose();
    } catch (err: unknown) {
      console.error(err);
      toast.error(t("common.errors.save_error", "Błąd zapisu"), {
        id: toastId,
        description: t(
          "logistics.toast.save_error_desc",
          "Sprawdź poprawność wprowadzonych danych.",
        ),
      });
    }
  };

  return {
    formData,
    handleDraftChange,
    handleGooglePlaceSelect,
    isFormDirty,
    isSubmitting: createMutation.isPending || updateMutation.isPending,
    handleSubmit,
  };
};
